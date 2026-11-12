do $$
declare v_def text; v_new text;
begin
  v_def:=pg_get_functiondef('public.admin_complete_withdrawal(uuid,text)'::regprocedure);
  v_new:=replace(v_def,
    'v_reserved_after numeric(20,8);',
    'v_reserved_after numeric(20,8); v_reserved numeric(18,2);');
  v_new:=replace(v_new,
    'if not found or v_wallet.balance<v_tx.amount_usd then',
    'if not found then raise exception ''Main Wallet could not be loaded''; end if;
    select coalesce(sum(amount_usd),0) into v_reserved from public.wallet_transactions
      where user_id=v_tx.user_id and account_id is null and kind=''withdrawal''
        and status in (''pending'',''otp_pending'',''processing'') and id<>v_tx.id;
    if v_wallet.balance-v_reserved<v_tx.amount_usd then');
  v_new:=replace(v_new,
    'if v_acc.balance+v_float-v_margin<v_tx.amount_usd then',
    'select coalesce(sum(amount_usd),0) into v_reserved from public.wallet_transactions
      where account_id=v_acc.id and kind=''withdrawal''
        and status in (''pending'',''otp_pending'',''processing'') and id<>v_tx.id;
    if v_acc.balance+v_float-v_margin-v_reserved<v_tx.amount_usd then');
  if v_new=v_def or position('v_reserved numeric(18,2)' in v_new)=0
    or position('v_wallet.balance-v_reserved' in v_new)=0
    or position('v_margin-v_reserved' in v_new)=0 then
    raise exception 'Could not safely extend withdrawal completion free-funds checks';
  end if;
  execute v_new;
end $$;

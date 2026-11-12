create or replace function public.partner_transfer_to_real_account(
  p_account_id uuid, p_amount numeric, p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $function$
declare
  v_user uuid := auth.uid();
  v_wallet public.partner_wallet_accounts%rowtype;
  v_account public.trading_accounts%rowtype;
  v_transfer uuid;
  v_before numeric(20,2);
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_amount is null or p_amount::text in ('NaN','Infinity','-Infinity') or p_amount<=0 or round(p_amount,2)<>p_amount then
    raise exception 'Enter a valid positive USD amount with up to two decimals';
  end if;
  if not exists(select 1 from public.partner_applications where user_id=v_user and status='approved') then
    raise exception 'Active approved IB partner status is required';
  end if;

  -- Lock the destination account before the IB wallet, matching the B-Book close lock order.
  select * into v_account from public.trading_accounts
   where id=p_account_id and user_id=v_user and account_mode='real'
     and status='approved' and currency='USD' and archived_at is null and deleted_at is null
   for update;
  if not found then raise exception 'Choose your active approved Real USD trading account'; end if;

  select * into v_wallet from public.partner_wallet_accounts
   where partner_user_id=v_user for update;
  if not found or v_wallet.available_balance < p_amount then
    raise exception 'Insufficient IB Wallet balance';
  end if;

  v_before := v_account.balance;
  update public.trading_accounts set balance=balance+p_amount,updated_at=now()
   where id=v_account.id;

  update public.partner_wallet_accounts
    set available_balance=available_balance-p_amount,
        total_transferred=total_transferred+p_amount,updated_at=now()
   where partner_user_id=v_user;

  insert into public.partner_wallet_transfers(partner_user_id,trading_account_id,amount,account_balance_before,account_balance_after)
  values(v_user,v_account.id,p_amount,v_before,v_before+p_amount) returning id into v_transfer;

  insert into public.account_balance_ledger(account_id,user_id,actor_user_id,entry_type,amount,balance_before,balance_after,note)
  values(v_account.id,v_user,v_user,'ib_commission_transfer',p_amount,v_before,v_before+p_amount,
    coalesce(nullif(trim(p_note),''),'IB commission wallet transfer'));

  insert into public.partner_wallet_ledger(partner_user_id,reference_id,actor_user_id,entry_type,direction,amount,balance_before,balance_after,note)
  values(v_user,v_transfer,v_user,'internal_transfer','debit',p_amount,v_wallet.available_balance,
    v_wallet.available_balance-p_amount,'Transfer to Real trading account #'||coalesce(v_account.account_number::text,'—'));

  return v_transfer;
end;
$function$;
revoke all on function public.partner_transfer_to_real_account(uuid,numeric,text) from public,anon;
grant execute on function public.partner_transfer_to_real_account(uuid,numeric,text) to authenticated;
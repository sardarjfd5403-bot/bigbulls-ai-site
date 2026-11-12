create or replace function public.client_funds_transfer(
  p_from_type text,p_from_account_id uuid,p_to_type text,p_to_account_id uuid,
  p_amount numeric,p_idempotency_key uuid,p_note text default null
)
returns uuid language plpgsql security definer set search_path=''
as $function$
declare
  v_user uuid:=auth.uid();
  v_wallet public.client_wallet_accounts%rowtype;
  v_from public.trading_accounts%rowtype;
  v_to public.trading_accounts%rowtype;
  v_transfer_id uuid;
  v_from_before numeric(18,2);
  v_to_before numeric(18,2);
  v_reserved numeric(18,2);
  v_existing uuid;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not public.private_client_wallet_kyc_allowed(v_user) then raise exception 'KYC approval required before moving Real funds'; end if;
  if p_from_type not in ('wallet','account') or p_to_type not in ('wallet','account')
     or (p_from_type='wallet' and p_to_type='wallet')
     or (p_from_type='account' and p_from_account_id is null)
     or (p_to_type='account' and p_to_account_id is null)
     or (p_from_type='wallet' and p_from_account_id is not null)
     or (p_to_type='wallet' and p_to_account_id is not null) then
    raise exception 'Invalid transfer route';
  end if;
  if p_from_type='account' and p_to_type='account' and p_from_account_id=p_to_account_id then raise exception 'Choose two different accounts'; end if;
  if p_amount is null or p_amount<=0 or round(p_amount,2)<>p_amount then raise exception 'Enter a valid USD amount with up to two decimals'; end if;
  if p_idempotency_key is null then raise exception 'Transfer reference is required'; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user::text||p_idempotency_key::text,0));
  select id into v_existing from public.client_fund_transfers where user_id=v_user and idempotency_key=p_idempotency_key;
  if v_existing is not null then return v_existing; end if;

  insert into public.client_wallet_accounts(user_id,currency,balance) values(v_user,'USD',0) on conflict(user_id) do nothing;

  if p_from_type='account' and p_to_type='account' then
    perform 1 from public.trading_accounts where id in (p_from_account_id,p_to_account_id) order by id for update;
  elsif p_from_type='account' then
    perform 1 from public.trading_accounts where id=p_from_account_id for update;
  elsif p_to_type='account' then
    perform 1 from public.trading_accounts where id=p_to_account_id for update;
  end if;

  if p_from_type='account' then
    select * into v_from from public.trading_accounts where id=p_from_account_id and user_id=v_user;
    if not found or v_from.account_mode<>'real' or v_from.status<>'approved' or v_from.currency<>'USD' or v_from.archived_at is not null or v_from.deleted_at is not null then
      raise exception 'Source must be your active, approved Real USD account';
    end if;
    select coalesce(sum(amount_usd),0) into v_reserved from public.wallet_transactions
      where account_id=v_from.id and kind='withdrawal' and status='processing';
    if v_from.balance-v_reserved<p_amount then raise exception 'Insufficient available account balance after reserved withdrawals'; end if;
  end if;

  if p_to_type='account' then
    select * into v_to from public.trading_accounts where id=p_to_account_id and user_id=v_user;
    if not found or v_to.account_mode<>'real' or v_to.status<>'approved' or v_to.currency<>'USD' or v_to.archived_at is not null or v_to.deleted_at is not null then
      raise exception 'Destination must be your active, approved Real USD account';
    end if;
  end if;

  select * into v_wallet from public.client_wallet_accounts where user_id=v_user for update;
  if p_from_type='wallet' and v_wallet.balance<p_amount then raise exception 'Insufficient Main USD Wallet balance'; end if;

  if p_from_type='account' then
    v_from_before:=v_from.balance;
    update public.trading_accounts set balance=balance-p_amount where id=v_from.id;
  end if;
  if p_to_type='account' then
    v_to_before:=v_to.balance;
    update public.trading_accounts set balance=balance+p_amount where id=v_to.id;
  end if;

  insert into public.client_fund_transfers(user_id,idempotency_key,from_type,from_account_id,to_type,to_account_id,amount)
  values(v_user,p_idempotency_key,p_from_type,p_from_account_id,p_to_type,p_to_account_id,p_amount)
  returning id into v_transfer_id;

  if p_from_type='wallet' then
    update public.client_wallet_accounts set balance=balance-p_amount,updated_at=now() where user_id=v_user;
    insert into public.client_wallet_ledger(user_id,reference_id,actor_user_id,entry_type,direction,amount,balance_before,balance_after,note)
    values(v_user,v_transfer_id,v_user,'internal_transfer_out','debit',p_amount,v_wallet.balance,v_wallet.balance-p_amount,coalesce(nullif(trim(p_note),''),'Transfer to trading account'));
  elsif p_to_type='wallet' then
    update public.client_wallet_accounts set balance=balance+p_amount,updated_at=now() where user_id=v_user;
    insert into public.client_wallet_ledger(user_id,reference_id,actor_user_id,entry_type,direction,amount,balance_before,balance_after,note)
    values(v_user,v_transfer_id,v_user,'internal_transfer_in','credit',p_amount,v_wallet.balance,v_wallet.balance+p_amount,coalesce(nullif(trim(p_note),''),'Transfer from trading account'));
  end if;

  if p_from_type='account' then
    insert into public.account_balance_ledger(account_id,user_id,actor_user_id,entry_type,amount,balance_before,balance_after,note)
    values(v_from.id,v_user,v_user,'transfer_debit',p_amount,v_from_before,v_from_before-p_amount,coalesce(nullif(trim(p_note),''),'Instant transfer · '||v_transfer_id::text));
  end if;
  if p_to_type='account' then
    insert into public.account_balance_ledger(account_id,user_id,actor_user_id,entry_type,amount,balance_before,balance_after,note)
    values(v_to.id,v_user,v_user,'transfer_credit',p_amount,v_to_before,v_to_before+p_amount,coalesce(nullif(trim(p_note),''),'Instant transfer · '||v_transfer_id::text));
  end if;
  return v_transfer_id;
end;
$function$;
revoke all on function public.client_funds_transfer(text,uuid,text,uuid,numeric,uuid,text) from public,anon;
grant execute on function public.client_funds_transfer(text,uuid,text,uuid,numeric,uuid,text) to authenticated;
notify pgrst,'reload schema';
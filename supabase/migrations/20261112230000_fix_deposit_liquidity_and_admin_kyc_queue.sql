-- Atomic wallet deposit settlement and explicit admin KYC visibility.
-- Applied to production through Supabase migration.

create or replace function public.admin_review_wallet_transaction(
  p_transaction_id uuid,
  p_status text,
  p_admin_note text default null
)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_tx public.wallet_transactions%rowtype;
  v_acc public.trading_accounts%rowtype;
  v_wallet public.client_wallet_accounts%rowtype;
  v_pool public.bb_bbook_liquidity_pool%rowtype;
  v_before numeric(18,2);
  v_reserved numeric(18,2);
  v_margin numeric(18,2);
  v_float numeric(18,2);
  v_reserved_after numeric(20,8);
begin
  if not public.is_bigbulls_admin() then raise exception 'Admin permission required'; end if;
  if p_status not in ('approved','rejected') then raise exception 'Invalid review status'; end if;

  select * into v_tx from public.wallet_transactions where id=p_transaction_id for update;
  if not found then raise exception 'Wallet request not found'; end if;

  if p_status='rejected' then
    if v_tx.status not in ('pending','otp_pending','processing') then
      raise exception 'Request is not awaiting review or payout';
    end if;
    if length(trim(coalesce(p_admin_note,'')))<4 then
      raise exception 'Rejection reason is required (at least 4 characters)';
    end if;
    if v_tx.kind='withdrawal' and v_tx.status='processing' and v_tx.pool_reserved_amount>0 then
      select * into v_pool from public.bb_bbook_liquidity_pool where singleton=true for update;
      if not found or v_pool.reserved_payout<v_tx.pool_reserved_amount then
        raise exception 'Reserved pool amount does not reconcile; manual review required';
      end if;
      v_reserved_after:=v_pool.reserved_payout-v_tx.pool_reserved_amount;
      update public.bb_bbook_liquidity_pool set reserved_payout=v_reserved_after,updated_at=now() where singleton=true;
      insert into public.bb_bbook_liquidity_ledger(entry_type,direction,amount,balance_before,balance_after,reserved_before,reserved_after,actor_user_id,note)
      values ('RELEASE','RELEASE',v_tx.pool_reserved_amount,v_pool.capital_balance,v_pool.capital_balance,
        v_pool.reserved_payout,v_reserved_after,auth.uid(),
        'Rejected withdrawal reserve released · '||coalesce(v_tx.invoice_id,v_tx.id::text));
    end if;
    update public.wallet_transactions
      set status='rejected',admin_note=p_admin_note,rejection_reason=p_admin_note,
          reviewed_by=auth.uid(),reviewed_at=now(),pool_reserved_amount=0
      where id=p_transaction_id;
    insert into public.admin_audit_logs(actor_user_id,action,entity_type,entity_id,details)
    values(auth.uid(),'wallet_request_rejected','wallet_transaction',p_transaction_id::text,
      jsonb_build_object('kind',v_tx.kind,'amount_usd',v_tx.amount_usd,
        'invoice_id',v_tx.invoice_id,'account_id',v_tx.account_id,'note',p_admin_note));
    return;
  end if;

  if v_tx.status<>'pending' then raise exception 'Request not found or already reviewed'; end if;
  if v_tx.amount_usd<=0 or v_tx.amount_crypto<=0 then raise exception 'Transaction amount must be positive'; end if;

  if v_tx.kind='deposit' then
    if v_tx.tx_hash is null or length(trim(v_tx.tx_hash))<=10 then
      raise exception 'A valid blockchain TXID is required before approving a deposit';
    end if;
    if v_tx.account_id is null then
      insert into public.client_wallet_accounts(user_id,currency,balance) values(v_tx.user_id,'USD',0)
      on conflict(user_id) do nothing;
      select * into v_wallet from public.client_wallet_accounts where user_id=v_tx.user_id for update;
      if not found then raise exception 'Main Wallet could not be initialized'; end if;
      v_before:=v_wallet.balance;
      update public.client_wallet_accounts set balance=balance+v_tx.amount_usd,updated_at=now() where user_id=v_tx.user_id;
      insert into public.client_wallet_ledger(user_id,reference_id,actor_user_id,entry_type,direction,amount,balance_before,balance_after,note)
      values(v_tx.user_id,v_tx.id,auth.uid(),'deposit_credit','credit',v_tx.amount_usd,v_before,v_before+v_tx.amount_usd,
        'Admin-approved verified deposit · '||coalesce(v_tx.invoice_id,v_tx.id::text));
    else
      select * into v_acc from public.trading_accounts where id=v_tx.account_id for update;
      if not found or v_acc.user_id<>v_tx.user_id or v_acc.account_mode<>'real'
        or v_acc.status<>'approved' or v_acc.archived_at is not null
        or v_acc.deleted_at is not null or v_acc.currency<>'USD' then
        raise exception 'Request must belong to an active, approved Real USD account';
      end if;
      v_before:=v_acc.balance;
      update public.trading_accounts set balance=balance+v_tx.amount_usd,updated_at=now() where id=v_acc.id;
      insert into public.account_balance_ledger(account_id,user_id,transaction_id,actor_user_id,entry_type,amount,balance_before,balance_after,note)
      values(v_acc.id,v_tx.user_id,v_tx.id,auth.uid(),'deposit_credit',v_tx.amount_usd,v_before,v_before+v_tx.amount_usd,
        'Admin-approved verified Real-account deposit');
    end if;

    -- Verified deposits are incoming broker funding; pool capital must increase atomically.
    select * into v_pool from public.bb_bbook_liquidity_pool where singleton=true for update;
    if not found then raise exception 'Master B-Book pool is unavailable; deposit approval rolled back'; end if;
    update public.bb_bbook_liquidity_pool
      set capital_balance=capital_balance+v_tx.amount_usd,updated_at=now()
      where singleton=true;
    insert into public.bb_bbook_liquidity_ledger(entry_type,direction,amount,balance_before,balance_after,reserved_before,reserved_after,actor_user_id,note)
    values('DEPOSIT','CREDIT',v_tx.amount_usd,v_pool.capital_balance,v_pool.capital_balance+v_tx.amount_usd,
      v_pool.reserved_payout,v_pool.reserved_payout,auth.uid(),
      'Verified client deposit credited · '||coalesce(v_tx.invoice_id,v_tx.id::text));

    update public.wallet_transactions set status='approved',admin_note=p_admin_note,reviewed_by=auth.uid(),reviewed_at=now()
      where id=p_transaction_id;
    insert into public.admin_audit_logs(actor_user_id,action,entity_type,entity_id,details)
    values(auth.uid(),'wallet_deposit_approved','wallet_transaction',p_transaction_id::text,
      jsonb_build_object('amount_usd',v_tx.amount_usd,'invoice_id',v_tx.invoice_id,'account_id',v_tx.account_id,
        'credited_to',case when v_tx.account_id is null then 'main_wallet' else 'trading_account' end,
        'liquidity_pool_credit',v_tx.amount_usd,'liquidity_pool_balance_after',v_pool.capital_balance+v_tx.amount_usd));
    return;
  end if;

  if v_tx.kind<>'withdrawal' then raise exception 'Unsupported wallet transaction kind'; end if;
  if v_tx.destination_address is null or length(trim(v_tx.destination_address))<=10 then
    raise exception 'A valid withdrawal destination is required';
  end if;
  if v_tx.account_id is null then
    insert into public.client_wallet_accounts(user_id,currency,balance) values(v_tx.user_id,'USD',0)
      on conflict(user_id) do nothing;
    select * into v_wallet from public.client_wallet_accounts where user_id=v_tx.user_id for update;
    if not found then raise exception 'Main Wallet could not be loaded'; end if;
    select coalesce(sum(amount_usd),0) into v_reserved from public.wallet_transactions
      where user_id=v_tx.user_id and account_id is null and kind='withdrawal'
        and status in ('pending','otp_pending','processing') and id<>v_tx.id;
    if v_wallet.balance-v_reserved<v_tx.amount_usd then
      raise exception 'Insufficient Main Wallet balance after pending withdrawal locks';
    end if;
  else
    select * into v_acc from public.trading_accounts where id=v_tx.account_id for update;
    if not found or v_acc.user_id<>v_tx.user_id or v_acc.account_mode<>'real'
      or v_acc.status<>'approved' or v_acc.archived_at is not null
      or v_acc.deleted_at is not null or v_acc.currency<>'USD' then
      raise exception 'Withdrawal must belong to an active, approved Real USD account';
    end if;
    select coalesce(sum(amount_usd),0) into v_reserved from public.wallet_transactions
      where account_id=v_acc.id and kind='withdrawal'
        and status in ('pending','otp_pending','processing') and id<>v_tx.id;
    select coalesce(sum(margin_used),0),coalesce(sum(floating_pnl),0) into v_margin,v_float
      from public.bb_bbook_positions where account_id=v_acc.id and status='OPEN';
    if v_acc.balance+v_float-v_margin-v_reserved<v_tx.amount_usd then
      raise exception 'Insufficient free margin after existing withdrawal locks';
    end if;
  end if;
  select * into v_pool from public.bb_bbook_liquidity_pool where singleton=true for update;
  if not found or v_pool.capital_balance-v_pool.reserved_payout<v_tx.amount_usd then
    raise exception 'Master B-Book pool has insufficient unreserved book capital for this payout';
  end if;
  v_reserved_after:=v_pool.reserved_payout+v_tx.amount_usd;
  update public.bb_bbook_liquidity_pool set reserved_payout=v_reserved_after,updated_at=now() where singleton=true;
  insert into public.bb_bbook_liquidity_ledger(entry_type,direction,amount,balance_before,balance_after,reserved_before,reserved_after,actor_user_id,note)
  values('RESERVE','HOLD',v_tx.amount_usd,v_pool.capital_balance,v_pool.capital_balance,
    v_pool.reserved_payout,v_reserved_after,auth.uid(),
    'Client withdrawal payout reserved · '||coalesce(v_tx.invoice_id,v_tx.id::text));
  update public.wallet_transactions set status='processing',admin_note=p_admin_note,reviewed_by=auth.uid(),
    reviewed_at=now(),pool_reserved_amount=v_tx.amount_usd where id=p_transaction_id;
  insert into public.admin_audit_logs(actor_user_id,action,entity_type,entity_id,details)
  values(auth.uid(),'wallet_withdrawal_reserved','wallet_transaction',p_transaction_id::text,
    jsonb_build_object('amount_usd',v_tx.amount_usd,'invoice_id',v_tx.invoice_id,
      'account_id',v_tx.account_id,'pool_reserved_amount',v_tx.amount_usd));
end;
$function$;

grant select on table public.kyc_submissions to authenticated;
drop policy if exists "admins read all kyc submissions" on public.kyc_submissions;
create policy "admins read all kyc submissions" on public.kyc_submissions
for select to authenticated using ((select public.is_bigbulls_admin()));
grant execute on function public.admin_review_wallet_transaction(uuid,text,text) to authenticated;

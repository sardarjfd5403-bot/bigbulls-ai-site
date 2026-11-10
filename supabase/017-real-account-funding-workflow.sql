-- BIGBULLS migration 017: reliable Real-account funding requests and approvals.
-- Proof images are optional; a blockchain TXID is required for deposits.
-- Crypto funding and cash withdrawals are restricted to approved Real accounts.
begin;

drop policy if exists "clients submit own pending wallet requests" on public.wallet_transactions;
create policy "clients submit own pending wallet requests"
on public.wallet_transactions
for insert to authenticated
with check (
  user_id = auth.uid()
  and status = 'pending'
  and reviewed_by is null
  and reviewed_at is null
  and otp_verified_at is null
  and completed_at is null
  and payout_reference is null
  and rejection_reason is null
  and account_id is not null
  and exists (
    select 1
    from public.trading_accounts a
    where a.id = wallet_transactions.account_id
      and a.user_id = auth.uid()
      and a.account_mode = 'real'
      and a.status = 'approved'
      and a.archived_at is null
      and a.deleted_at is null
  )
  and (
    (
      kind = 'deposit'
      and tx_hash is not null
      and length(trim(tx_hash)) > 10
      and amount_usd > 0
      and amount_crypto > 0
      and destination_address is not null
      and exists (
        select 1
        from public.crypto_wallets w
        where w.active = true
          and w.asset = wallet_transactions.asset
          and w.network = wallet_transactions.network
          and w.address = wallet_transactions.destination_address
      )
    )
    or
    (
      kind = 'withdrawal'
      and destination_address is not null
      and length(trim(destination_address)) > 5
      and amount_usd > 0
      and amount_crypto > 0
    )
  )
);

create or replace function public.admin_review_wallet_transaction(
  p_transaction_id uuid,
  p_status text,
  p_admin_note text default null
) returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_tx public.wallet_transactions%rowtype;
  v_acc public.trading_accounts%rowtype;
  v_before numeric(18,2);
  v_reserved numeric(18,2);
begin
  if not public.is_bigbulls_admin() then
    raise exception 'Admin permission required';
  end if;
  if p_status not in ('approved','rejected') then
    raise exception 'Invalid review status';
  end if;

  select * into v_tx
  from public.wallet_transactions
  where id = p_transaction_id
  for update;

  if not found or v_tx.status <> 'pending' then
    raise exception 'Request not found or already reviewed';
  end if;

  if p_status = 'rejected' and length(trim(coalesce(p_admin_note,''))) < 4 then
    raise exception 'Rejection reason is required (at least 4 characters)';
  end if;

  if v_tx.account_id is null then
    raise exception 'Funding request must be linked to a trading account';
  end if;

  select * into v_acc
  from public.trading_accounts
  where id = v_tx.account_id
  for update;

  if not found
     or v_acc.user_id <> v_tx.user_id
     or v_acc.account_mode <> 'real'
     or v_acc.status <> 'approved'
     or v_acc.archived_at is not null
     or v_acc.deleted_at is not null then
    raise exception 'Request must belong to an active, approved Real account';
  end if;

  if v_acc.currency <> 'USD' then
    raise exception 'Funding for non-USD accounts requires currency conversion setup';
  end if;

  if v_tx.kind = 'withdrawal' and p_status = 'approved' then
    select coalesce(sum(amount_usd),0)
    into v_reserved
    from public.wallet_transactions
    where account_id = v_acc.id
      and kind = 'withdrawal'
      and status = 'processing';

    if v_acc.balance - v_reserved < v_tx.amount_usd then
      raise exception 'Insufficient available balance after pending payouts';
    end if;

    update public.wallet_transactions
    set status = 'processing',
        admin_note = p_admin_note,
        reviewed_by = auth.uid(),
        reviewed_at = now()
    where id = p_transaction_id;

  elsif v_tx.kind = 'deposit' and p_status = 'approved' then
    if v_tx.tx_hash is null or length(trim(v_tx.tx_hash)) <= 10 then
      raise exception 'A valid blockchain TXID is required before approving a deposit';
    end if;
    if v_tx.amount_usd <= 0 or v_tx.amount_crypto <= 0 then
      raise exception 'Deposit amounts must be positive';
    end if;

    v_before := v_acc.balance;

    update public.trading_accounts
    set balance = balance + v_tx.amount_usd
    where id = v_acc.id;

    insert into public.account_balance_ledger(
      account_id,user_id,transaction_id,actor_user_id,entry_type,
      amount,balance_before,balance_after,note
    ) values (
      v_acc.id,v_tx.user_id,v_tx.id,auth.uid(),'deposit_credit',
      v_tx.amount_usd,v_before,v_before + v_tx.amount_usd,
      'Admin-approved and verified Real-account deposit'
    );

    update public.wallet_transactions
    set status = 'approved',
        admin_note = p_admin_note,
        reviewed_by = auth.uid(),
        reviewed_at = now()
    where id = p_transaction_id;

  else
    update public.wallet_transactions
    set status = 'rejected',
        admin_note = p_admin_note,
        rejection_reason = p_admin_note,
        reviewed_by = auth.uid(),
        reviewed_at = now()
    where id = p_transaction_id;
  end if;

  insert into public.admin_audit_logs(actor_user_id,action,entity_type,entity_id,details)
  values(
    auth.uid(),
    'wallet_request_' || p_status,
    'wallet_transaction',
    p_transaction_id::text,
    jsonb_build_object(
      'kind',v_tx.kind,
      'amount_usd',v_tx.amount_usd,
      'account_id',v_tx.account_id,
      'invoice_id',v_tx.invoice_id,
      'account_mode',v_acc.account_mode,
      'note',p_admin_note
    )
  );
end;
$function$;

create or replace function public.admin_complete_withdrawal(
  p_transaction_id uuid,
  p_payout_reference text
) returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_tx public.wallet_transactions%rowtype;
  v_acc public.trading_accounts%rowtype;
  v_before numeric(18,2);
begin
  if not public.is_bigbulls_admin() then
    raise exception 'Admin permission required';
  end if;
  if length(trim(coalesce(p_payout_reference,''))) < 5 then
    raise exception 'Payout TXID/reference is required';
  end if;

  select * into v_tx
  from public.wallet_transactions
  where id = p_transaction_id
  for update;

  if not found or v_tx.kind <> 'withdrawal' or v_tx.status <> 'processing' then
    raise exception 'Withdrawal is not processing';
  end if;

  select * into v_acc
  from public.trading_accounts
  where id = v_tx.account_id
  for update;

  if not found
     or v_acc.user_id <> v_tx.user_id
     or v_acc.account_mode <> 'real'
     or v_acc.status <> 'approved'
     or v_acc.archived_at is not null
     or v_acc.deleted_at is not null
     or v_acc.currency <> 'USD'
     or v_acc.balance < v_tx.amount_usd then
    raise exception 'Real account or available balance validation failed';
  end if;

  v_before := v_acc.balance;

  update public.trading_accounts
  set balance = balance - v_tx.amount_usd
  where id = v_acc.id;

  insert into public.account_balance_ledger(
    account_id,user_id,transaction_id,actor_user_id,entry_type,
    amount,balance_before,balance_after,note
  ) values (
    v_acc.id,v_tx.user_id,v_tx.id,auth.uid(),'withdrawal_debit',
    v_tx.amount_usd,v_before,v_before - v_tx.amount_usd,
    'Admin-confirmed external payout: ' || trim(p_payout_reference)
  );

  update public.wallet_transactions
  set status = 'completed',
      payout_reference = trim(p_payout_reference),
      completed_at = now()
  where id = v_tx.id;

  insert into public.admin_audit_logs(actor_user_id,action,entity_type,entity_id,details)
  values(
    auth.uid(),
    'withdrawal_completed',
    'wallet_transaction',
    v_tx.id::text,
    jsonb_build_object(
      'invoice_id',v_tx.invoice_id,
      'payout_reference',p_payout_reference,
      'amount_usd',v_tx.amount_usd,
      'account_id',v_acc.id
    )
  );
end;
$function$;

revoke all on function public.admin_review_wallet_transaction(uuid,text,text) from public, anon;
revoke all on function public.admin_complete_withdrawal(uuid,text) from public, anon;
grant execute on function public.admin_review_wallet_transaction(uuid,text,text) to authenticated;
grant execute on function public.admin_complete_withdrawal(uuid,text) to authenticated;

notify pgrst, 'reload schema';
commit;
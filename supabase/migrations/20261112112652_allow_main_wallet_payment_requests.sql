drop policy if exists "clients submit own pending wallet requests" on public.wallet_transactions;
create policy "clients submit own pending wallet requests"
on public.wallet_transactions
for insert
to authenticated
with check (
  user_id = auth.uid()
  and status = 'pending'
  and reviewed_by is null
  and reviewed_at is null
  and otp_verified_at is null
  and completed_at is null
  and payout_reference is null
  and rejection_reason is null
  and (
    (
      account_id is null
      and exists (
        select 1 from public.client_wallet_accounts w
        where w.user_id = auth.uid() and w.currency = 'USD'
      )
    )
    or
    (
      account_id is not null
      and exists (
        select 1 from public.trading_accounts a
        where a.id = wallet_transactions.account_id
          and a.user_id = auth.uid()
          and a.account_mode = 'real'
          and a.status = 'approved'
          and a.archived_at is null
          and a.deleted_at is null
      )
    )
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
        select 1 from public.crypto_wallets w
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
      and length(trim(destination_address)) > 10
      and amount_usd > 0
      and amount_crypto > 0
    )
  )
);

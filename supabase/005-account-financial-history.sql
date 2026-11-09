-- BIGBULLS per-account deposits, withdrawals and transaction history
alter table public.wallet_transactions
 add column if not exists account_id uuid references public.trading_accounts(id) on delete set null;

create index if not exists wallet_transactions_account_created_idx
 on public.wallet_transactions(account_id,created_at desc);

-- Keep the legacy general-wallet form working when account_id is null.
-- When a request is tied to an account, it must belong to the signed-in client
-- and must not be archived or soft-deleted.
drop policy if exists "clients submit own pending wallet requests" on public.wallet_transactions;
create policy "clients submit own pending wallet requests" on public.wallet_transactions
for insert to authenticated with check(
 user_id=auth.uid() and status='pending' and reviewed_by is null and reviewed_at is null
 and (
   account_id is null or exists(
     select 1 from public.trading_accounts a
     where a.id=wallet_transactions.account_id
       and a.user_id=auth.uid()
       and a.archived_at is null
       and a.deleted_at is null
   )
 )
 and (
   (kind='deposit' and tx_hash is not null and exists(
     select 1 from public.crypto_wallets w
     where w.active=true and w.asset=wallet_transactions.asset
       and w.network=wallet_transactions.network
       and w.address=wallet_transactions.destination_address
   ))
   or (kind='withdrawal' and destination_address is not null and length(destination_address)>10)
 )
);

grant select,insert on public.wallet_transactions to authenticated;
notify pgrst,'reload schema';

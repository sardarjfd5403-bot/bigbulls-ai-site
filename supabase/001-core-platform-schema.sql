-- BIGBULLS FX Market - core database schema
-- Run in Supabase Dashboard > SQL Editor > New query.
-- Safe to re-run. Never put a service-role key in browser code.

create extension if not exists pgcrypto;

create table if not exists public.crypto_wallets (
 id uuid primary key default gen_random_uuid(),
 asset text not null, network text not null, label text, address text not null,
 active boolean not null default true, created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(), unique(asset,network)
);

create table if not exists public.wallet_transactions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check(kind in ('deposit','withdrawal')),
 asset text not null, network text not null, destination_address text,
 amount_crypto numeric(30,10) not null check(amount_crypto>0),
 amount_usd numeric(18,2) not null check(amount_usd>0),
 tx_hash text, status text not null default 'pending' check(status in ('pending','approved','rejected')),
 admin_note text, reviewed_by uuid references auth.users(id), reviewed_at timestamptz,
 created_at timestamptz not null default now(),
 constraint deposit_has_tx_hash check(kind <> 'deposit' or (tx_hash is not null and length(tx_hash)>10)),
 constraint withdrawal_has_destination check(kind <> 'withdrawal' or (destination_address is not null and length(destination_address)>10))
);
create unique index if not exists wallet_transactions_tx_hash_unique on public.wallet_transactions(tx_hash) where tx_hash is not null;

create table if not exists public.trading_accounts (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 account_type text not null, platform text not null, currency text not null default 'USD',
 status text not null default 'pending' check(status in ('pending','approved','rejected','disabled')),
 created_at timestamptz not null default now()
);

create table if not exists public.account_transfers (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 from_account uuid not null references public.trading_accounts(id),
 to_account uuid not null references public.trading_accounts(id),
 amount_usd numeric(18,2) not null check(amount_usd>0),
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 admin_note text, reviewed_by uuid references auth.users(id), reviewed_at timestamptz,
 created_at timestamptz not null default now(),
 constraint transfer_accounts_differ check(from_account <> to_account)
);

create or replace function public.is_bigbulls_admin()
returns boolean language sql stable security definer set search_path=public
as $$ select coalesce((auth.jwt()->'app_metadata'->>'role')='admin',false); $$;

alter table public.crypto_wallets enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.trading_accounts enable row level security;
alter table public.account_transfers enable row level security;

drop policy if exists "active crypto wallets readable by clients" on public.crypto_wallets;
create policy "active crypto wallets readable by clients" on public.crypto_wallets
for select to authenticated using(active=true or public.is_bigbulls_admin());
drop policy if exists "admins manage crypto wallets" on public.crypto_wallets;
create policy "admins manage crypto wallets" on public.crypto_wallets
for all to authenticated using(public.is_bigbulls_admin()) with check(public.is_bigbulls_admin());

drop policy if exists "clients read own wallet transactions" on public.wallet_transactions;
create policy "clients read own wallet transactions" on public.wallet_transactions
for select to authenticated using(user_id=auth.uid() or public.is_bigbulls_admin());
drop policy if exists "clients submit own pending wallet requests" on public.wallet_transactions;
create policy "clients submit own pending wallet requests" on public.wallet_transactions
for insert to authenticated with check(
 user_id=auth.uid() and status='pending' and reviewed_by is null and reviewed_at is null
 and ((kind='deposit' and tx_hash is not null and exists(
  select 1 from public.crypto_wallets w where w.active=true and w.asset=wallet_transactions.asset
  and w.network=wallet_transactions.network and w.address=wallet_transactions.destination_address
 )) or (kind='withdrawal' and destination_address is not null))
);
drop policy if exists "admins review wallet transactions" on public.wallet_transactions;
create policy "admins review wallet transactions" on public.wallet_transactions
for update to authenticated using(public.is_bigbulls_admin()) with check(public.is_bigbulls_admin());

drop policy if exists "clients read own trading accounts" on public.trading_accounts;
create policy "clients read own trading accounts" on public.trading_accounts
for select to authenticated using(user_id=auth.uid() or public.is_bigbulls_admin());
drop policy if exists "clients request own trading accounts" on public.trading_accounts;
create policy "clients request own trading accounts" on public.trading_accounts
for insert to authenticated with check(user_id=auth.uid() and status='pending');
drop policy if exists "admins manage trading accounts" on public.trading_accounts;
create policy "admins manage trading accounts" on public.trading_accounts
for all to authenticated using(public.is_bigbulls_admin()) with check(public.is_bigbulls_admin());

drop policy if exists "clients read own transfers" on public.account_transfers;
create policy "clients read own transfers" on public.account_transfers
for select to authenticated using(user_id=auth.uid() or public.is_bigbulls_admin());
drop policy if exists "clients request own transfers" on public.account_transfers;
create policy "clients request own transfers" on public.account_transfers
for insert to authenticated with check(
 user_id=auth.uid() and status='pending'
 and exists(select 1 from public.trading_accounts a where a.id=from_account and a.user_id=auth.uid() and a.status='approved')
 and exists(select 1 from public.trading_accounts a where a.id=to_account and a.user_id=auth.uid() and a.status='approved')
);
drop policy if exists "admins review account transfers" on public.account_transfers;
create policy "admins review account transfers" on public.account_transfers
for update to authenticated using(public.is_bigbulls_admin()) with check(public.is_bigbulls_admin());

create or replace view public.wallet_balances with (security_invoker=true) as
select user_id,'USD'::text as asset,
coalesce(sum(case when kind='deposit' then amount_usd else -amount_usd end),0)::numeric(18,2) as balance_usd
from public.wallet_transactions where status='approved' group by user_id;

grant select on public.crypto_wallets,public.wallet_transactions,public.trading_accounts,public.account_transfers,public.wallet_balances to authenticated;
grant insert on public.wallet_transactions,public.trading_accounts,public.account_transfers to authenticated;
grant update on public.crypto_wallets,public.wallet_transactions,public.trading_accounts,public.account_transfers to authenticated;

notify pgrst,'reload schema';

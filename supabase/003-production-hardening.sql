-- BIGBULLS FX Market - production hardening migration 003
-- Run AFTER 001-core-platform-schema.sql and 002-kyc-partner-workflows.sql.
-- This migration does not provision a broker, process fiat payments, or create live trading accounts.

create table if not exists public.profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 full_name text,
 country text,
 phone text,
 account_type text not null default 'Individual',
 status text not null default 'active' check(status in ('active','restricted','closed')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

-- Compatibility: some Supabase projects already have a profiles table keyed by id.
-- Add user_id and backfill it from id before creating policies that reference user_id.
alter table public.profiles add column if not exists user_id uuid;
-- Existing profiles tables in this project use a UUID id column; preserve those user links.
update public.profiles set user_id = id where user_id is null;
create unique index if not exists profiles_user_id_uidx on public.profiles(user_id);
alter table public.profiles enable row level security;
drop policy if exists "clients read own profile" on public.profiles;
create policy "clients read own profile" on public.profiles for select to authenticated
using(user_id=auth.uid() or public.is_bigbulls_admin());
drop policy if exists "clients insert own profile" on public.profiles;
create policy "clients insert own profile" on public.profiles for insert to authenticated
with check(user_id=auth.uid() and status='active');
drop policy if exists "clients update own profile" on public.profiles;
create policy "clients update own profile" on public.profiles for update to authenticated
using(user_id=auth.uid()) with check(user_id=auth.uid() and status in ('active','restricted','closed'));
drop policy if exists "admins manage profiles" on public.profiles;
create policy "admins manage profiles" on public.profiles for all to authenticated
using(public.is_bigbulls_admin()) with check(public.is_bigbulls_admin());

create or replace function public.sync_auth_profile()
returns trigger language plpgsql security definer set search_path=public
as $$
begin
 insert into public.profiles(user_id,full_name,country,phone,account_type)
 values(new.id,new.raw_user_meta_data->>'full_name',new.raw_user_meta_data->>'country',
        new.raw_user_meta_data->>'phone',coalesce(new.raw_user_meta_data->>'account_type','Individual'))
 on conflict(user_id) do update set
  full_name=excluded.full_name,country=excluded.country,phone=excluded.phone,
  account_type=excluded.account_type,updated_at=now();
 return new;
end;
$$;
drop trigger if exists bigbulls_auth_profile_sync on auth.users;
create trigger bigbulls_auth_profile_sync after insert or update of raw_user_meta_data on auth.users
for each row execute function public.sync_auth_profile();

create table if not exists public.admin_audit_logs (
 id bigint generated always as identity primary key,
 actor_user_id uuid references auth.users(id),
 action text not null,
 entity_type text not null,
 entity_id text,
 details jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
alter table public.admin_audit_logs enable row level security;
drop policy if exists "admins read audit logs" on public.admin_audit_logs;
create policy "admins read audit logs" on public.admin_audit_logs for select to authenticated
using(public.is_bigbulls_admin());
grant select on public.admin_audit_logs to authenticated;

create table if not exists public.support_tickets (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 subject text not null check(length(subject) between 4 and 160),
 category text not null default 'general',
 message text not null check(length(message) between 10 and 5000),
 status text not null default 'open' check(status in ('open','in_progress','resolved','closed')),
 admin_reply text,
 assigned_to uuid references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.support_tickets enable row level security;
drop policy if exists "clients read own tickets" on public.support_tickets;
create policy "clients read own tickets" on public.support_tickets for select to authenticated
using(user_id=auth.uid() or public.is_bigbulls_admin());
drop policy if exists "clients create own tickets" on public.support_tickets;
create policy "clients create own tickets" on public.support_tickets for insert to authenticated
with check(user_id=auth.uid() and status='open' and admin_reply is null);
drop policy if exists "admins manage tickets" on public.support_tickets;
create policy "admins manage tickets" on public.support_tickets for update to authenticated
using(public.is_bigbulls_admin()) with check(public.is_bigbulls_admin());
grant select,insert,update on public.support_tickets to authenticated;

create table if not exists public.product_orders (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 product_code text not null,
 amount_usd numeric(18,2) not null check(amount_usd>0),
 payment_method text,
 payment_reference text,
 status text not null default 'pending' check(status in ('pending','paid','rejected','refunded')),
 created_at timestamptz not null default now(),
 reviewed_by uuid references auth.users(id),
 reviewed_at timestamptz
);
create table if not exists public.product_licenses (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 order_id uuid unique references public.product_orders(id),
 license_key_hash text not null unique,
 product_code text not null,
 status text not null default 'active' check(status in ('active','suspended','revoked','expired')),
 expires_at timestamptz,
 max_devices integer not null default 1 check(max_devices between 1 and 20),
 created_at timestamptz not null default now()
);
alter table public.product_orders enable row level security;
alter table public.product_licenses enable row level security;
drop policy if exists "clients read own orders" on public.product_orders;
create policy "clients read own orders" on public.product_orders for select to authenticated
using(user_id=auth.uid() or public.is_bigbulls_admin());
drop policy if exists "clients create own orders" on public.product_orders;
create policy "clients create own orders" on public.product_orders for insert to authenticated
with check(user_id=auth.uid() and status='pending' and reviewed_by is null);
drop policy if exists "admins manage orders" on public.product_orders;
create policy "admins manage orders" on public.product_orders for all to authenticated
using(public.is_bigbulls_admin()) with check(public.is_bigbulls_admin());
drop policy if exists "clients read own licenses" on public.product_licenses;
create policy "clients read own licenses" on public.product_licenses for select to authenticated
using(user_id=auth.uid() or public.is_bigbulls_admin());
drop policy if exists "admins manage licenses" on public.product_licenses;
create policy "admins manage licenses" on public.product_licenses for all to authenticated
using(public.is_bigbulls_admin()) with check(public.is_bigbulls_admin());
grant select,insert,update on public.product_orders to authenticated;
grant select on public.product_licenses to authenticated;

-- Prevent clients/admin UI from directly changing payment status. All approvals go through this atomic RPC.
drop policy if exists "admins review wallet transactions" on public.wallet_transactions;
create or replace function public.admin_review_wallet_transaction(p_transaction_id uuid,p_status text,p_admin_note text default null)
returns void language plpgsql security definer set search_path=public
as $$
declare v_tx public.wallet_transactions%rowtype; v_balance numeric(18,2);
begin
 if not public.is_bigbulls_admin() then raise exception 'Admin permission required'; end if;
 if p_status not in ('approved','rejected') then raise exception 'Invalid review status'; end if;
 select * into v_tx from public.wallet_transactions where id=p_transaction_id for update;
 if not found or v_tx.status <> 'pending' then raise exception 'Request not found or already reviewed'; end if;
 if p_status='approved' and v_tx.kind='withdrawal' then
  select coalesce(sum(case when kind='deposit' then amount_usd else -amount_usd end),0)
   into v_balance from public.wallet_transactions
   where user_id=v_tx.user_id and status='approved';
  if v_balance < v_tx.amount_usd then raise exception 'Insufficient available balance'; end if;
 end if;
 update public.wallet_transactions set status=p_status,admin_note=p_admin_note,
  reviewed_by=auth.uid(),reviewed_at=now() where id=p_transaction_id and status='pending';
 insert into public.admin_audit_logs(actor_user_id,action,entity_type,entity_id,details)
 values(auth.uid(),'wallet_request_'||p_status,'wallet_transaction',p_transaction_id::text,
 jsonb_build_object('kind',v_tx.kind,'amount_usd',v_tx.amount_usd,'asset',v_tx.asset,'network',v_tx.network));
end;
$$;
revoke all on function public.admin_review_wallet_transaction(uuid,text,text) from public,anon;
grant execute on function public.admin_review_wallet_transaction(uuid,text,text) to authenticated;

-- Seed profile rows for existing auth users without overwriting existing profiles.
insert into public.profiles(user_id,full_name,country,phone,account_type)
select id,raw_user_meta_data->>'full_name',raw_user_meta_data->>'country',
 raw_user_meta_data->>'phone',coalesce(raw_user_meta_data->>'account_type','Individual')
from auth.users on conflict(user_id) do nothing;

notify pgrst,'reload schema';

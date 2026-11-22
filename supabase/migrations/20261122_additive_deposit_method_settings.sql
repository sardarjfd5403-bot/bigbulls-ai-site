-- Additive deposit-method metadata. Existing crypto_wallets and wallet_transactions
-- remain the source of truth for all existing deposit/withdrawal transactions.
create table if not exists public.deposit_method_settings (
  id uuid primary key default gen_random_uuid(),
  method_key text not null unique,
  display_name text not null,
  method_type text not null check (method_type in ('crypto','fiat')),
  crypto_wallet_id uuid null references public.crypto_wallets(id) on delete cascade,
  asset text not null,
  network text not null,
  destination_details text not null default '',
  account_title text,
  account_number text,
  logo_url text,
  instructions text,
  min_amount_usd numeric(18,2) not null default 1 check (min_amount_usd >= 0),
  max_amount_usd numeric(18,2),
  active_web boolean not null default true,
  active_app boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint deposit_method_limits_valid check (max_amount_usd is null or max_amount_usd >= min_amount_usd),
  constraint deposit_method_crypto_link_valid check (
    (method_type = 'crypto' and crypto_wallet_id is not null) or
    (method_type = 'fiat' and crypto_wallet_id is null)
  )
);
create index if not exists deposit_method_settings_active_order_idx
  on public.deposit_method_settings (active_web, active_app, sort_order);
alter table public.deposit_method_settings enable row level security;
drop policy if exists "Active deposit methods are visible to clients" on public.deposit_method_settings;
create policy "Active deposit methods are visible to clients"
  on public.deposit_method_settings for select to authenticated
  using (active_web or active_app);
drop policy if exists "Admins manage deposit method settings" on public.deposit_method_settings;
create policy "Admins manage deposit method settings"
  on public.deposit_method_settings for all to authenticated
  using (public.is_bigbulls_admin())
  with check (public.is_bigbulls_admin());
insert into public.deposit_method_settings
  (method_key, display_name, method_type, crypto_wallet_id, asset, network, destination_details, instructions, active_web, active_app, sort_order)
select
  'crypto:' || cw.id::text,
  coalesce(nullif(cw.label,''), cw.asset || ' ' || cw.network),
  'crypto',
  cw.id,
  cw.asset,
  cw.network,
  cw.address,
  'Send only ' || cw.asset || ' using ' || cw.network || '.',
  cw.active,
  cw.active,
  10
from public.crypto_wallets cw
on conflict (method_key) do update set
  display_name = excluded.display_name,
  asset = excluded.asset,
  network = excluded.network,
  destination_details = excluded.destination_details,
  active_web = excluded.active_web,
  active_app = excluded.active_app,
  updated_at = now();
insert into public.deposit_method_settings
  (method_key,display_name,method_type,asset,network,destination_details,account_title,account_number,logo_url,instructions,min_amount_usd,max_amount_usd,active_web,active_app,sort_order)
values
 ('fiat:easypaisa','Easypaisa','fiat','PKR','Easypaisa','','','','','',1,null,false,false,20),
 ('fiat:jazzcash','JazzCash','fiat','PKR','JazzCash','','','','','',1,null,false,false,30),
 ('fiat:local-bank','Local Bank Transfer','fiat','PKR','Bank Transfer','','','','','',1,null,false,false,40),
 ('fiat:skrill','Skrill','fiat','USD','Skrill','','','','','',1,null,false,false,50)
on conflict (method_key) do nothing;

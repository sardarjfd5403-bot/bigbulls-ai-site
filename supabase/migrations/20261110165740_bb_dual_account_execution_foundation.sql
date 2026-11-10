-- BIGBULLS dual-mode execution foundation.
create table if not exists public.bb_execution_settings (
  singleton boolean primary key default true check (singleton),
  demo_execution_enabled boolean not null default true,
  live_execution_enabled boolean not null default false,
  global_halt boolean not null default false,
  live_readiness jsonb not null default jsonb_build_object('liquidity_verified',false,'settlement_verified',false,'regulatory_authorized',false,'client_funds_controls_verified',false,'reconciliation_verified',false),
  halt_reason text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
insert into public.bb_execution_settings(singleton) values(true) on conflict(singleton) do nothing;
create table if not exists public.bb_trade_orders (
 id uuid primary key default gen_random_uuid(), account_id uuid not null references public.trading_accounts(id),
 user_id uuid not null references auth.users(id), account_mode text not null check(account_mode in('demo','real')),
 symbol text not null, side text not null check(side in('BUY','SELL')),
 order_type text not null check(order_type in('MARKET','BUY_LIMIT','SELL_LIMIT','BUY_STOP','SELL_STOP','BUY_STOP_LIMIT','SELL_STOP_LIMIT')),
 quantity numeric(24,8) not null check(quantity>0), requested_price numeric(24,10), stop_price numeric(24,10),
 limit_price numeric(24,10), stop_loss numeric(24,10), take_profit numeric(24,10),
 trailing_distance numeric(24,10) not null default 0 check(trailing_distance>=0),
 status text not null default 'RECEIVED' check(status in('RECEIVED','PENDING','ACCEPTED','FILLED','PARTIALLY_FILLED','CANCELLED','REJECTED','EXPIRED')),
 reject_reason text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.bb_trade_positions (
 id uuid primary key default gen_random_uuid(), account_id uuid not null references public.trading_accounts(id),
 user_id uuid not null references auth.users(id), account_mode text not null check(account_mode in('demo','real')),
 order_id uuid references public.bb_trade_orders(id), symbol text not null, side text not null check(side in('BUY','SELL')),
 quantity numeric(24,8) not null check(quantity>0), entry_price numeric(24,10) not null, mark_price numeric(24,10),
 stop_loss numeric(24,10), take_profit numeric(24,10), trailing_distance numeric(24,10) not null default 0,
 realized_pnl numeric(24,8) not null default 0, unrealized_pnl numeric(24,8) not null default 0,
 status text not null default 'OPEN' check(status in('OPEN','CLOSED')), opened_at timestamptz not null default now(), closed_at timestamptz
);
create table if not exists public.bb_trade_fills (
 id uuid primary key default gen_random_uuid(), order_id uuid not null references public.bb_trade_orders(id),
 position_id uuid references public.bb_trade_positions(id), account_id uuid not null references public.trading_accounts(id),
 user_id uuid not null references auth.users(id), account_mode text not null check(account_mode in('demo','real')),
 symbol text not null, side text not null check(side in('BUY','SELL')), quantity numeric(24,8) not null check(quantity>0),
 fill_price numeric(24,10) not null, spread_cost numeric(24,8) not null default 0, commission numeric(24,8) not null default 0,
 slippage numeric(24,8) not null default 0, filled_at timestamptz not null default now()
);
create table if not exists public.bb_trade_audit_events (
 id bigint generated always as identity primary key, account_id uuid references public.trading_accounts(id),
 user_id uuid references auth.users(id), actor_user_id uuid references auth.users(id), event_type text not null,
 account_mode text check(account_mode in('demo','real')), entity_type text, entity_id uuid,
 details jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create index if not exists bb_trade_orders_account_created_idx on public.bb_trade_orders(account_id,created_at desc);
create index if not exists bb_trade_orders_user_created_idx on public.bb_trade_orders(user_id,created_at desc);
create index if not exists bb_trade_positions_account_status_idx on public.bb_trade_positions(account_id,status,opened_at desc);
create index if not exists bb_trade_positions_user_created_idx on public.bb_trade_positions(user_id,opened_at desc);
create index if not exists bb_trade_fills_account_time_idx on public.bb_trade_fills(account_id,filled_at desc);
create index if not exists bb_trade_audit_account_time_idx on public.bb_trade_audit_events(account_id,created_at desc);
alter table public.bb_execution_settings enable row level security;
alter table public.bb_trade_orders enable row level security;
alter table public.bb_trade_positions enable row level security;
alter table public.bb_trade_fills enable row level security;
alter table public.bb_trade_audit_events enable row level security;
drop policy if exists "clients read own trade orders" on public.bb_trade_orders;
create policy "clients read own trade orders" on public.bb_trade_orders for select to authenticated using((select auth.uid())=user_id or (select public.is_bigbulls_admin()));
drop policy if exists "clients read own trade positions" on public.bb_trade_positions;
create policy "clients read own trade positions" on public.bb_trade_positions for select to authenticated using((select auth.uid())=user_id or (select public.is_bigbulls_admin()));
drop policy if exists "clients read own trade fills" on public.bb_trade_fills;
create policy "clients read own trade fills" on public.bb_trade_fills for select to authenticated using((select auth.uid())=user_id or (select public.is_bigbulls_admin()));
drop policy if exists "admins read trade audit events" on public.bb_trade_audit_events;
create policy "admins read trade audit events" on public.bb_trade_audit_events for select to authenticated using((select public.is_bigbulls_admin()));
revoke all on public.bb_execution_settings from anon,authenticated;
revoke insert,update,delete on public.bb_trade_orders,public.bb_trade_positions,public.bb_trade_fills,public.bb_trade_audit_events from anon,authenticated;
grant select on public.bb_trade_orders,public.bb_trade_positions,public.bb_trade_fills,public.bb_trade_audit_events to authenticated;
grant all on public.bb_execution_settings,public.bb_trade_orders,public.bb_trade_positions,public.bb_trade_fills,public.bb_trade_audit_events to service_role;
grant usage,select on sequence public.bb_trade_audit_events_id_seq to service_role;

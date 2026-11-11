alter table public.bb_execution_settings
  add column if not exists max_risk_per_trade_pct numeric(6,3) not null default 1.000 check(max_risk_per_trade_pct>0 and max_risk_per_trade_pct<=5),
  add column if not exists max_daily_loss_pct numeric(6,3) not null default 3.000 check(max_daily_loss_pct>0 and max_daily_loss_pct<=10),
  add column if not exists max_aggregate_risk_pct numeric(6,3) not null default 3.000 check(max_aggregate_risk_pct>0 and max_aggregate_risk_pct<=15),
  add column if not exists max_open_positions integer not null default 5 check(max_open_positions between 1 and 100),
  add column if not exists max_leverage integer not null default 100 check(max_leverage between 1 and 2000);

create table if not exists public.bb_account_risk_controls (
 account_id uuid primary key references public.trading_accounts(id) on delete cascade,
 user_id uuid not null references auth.users(id),
 trading_enabled boolean not null default true,
 max_risk_per_trade_pct numeric(6,3) not null default 1.000 check(max_risk_per_trade_pct>0 and max_risk_per_trade_pct<=5),
 max_daily_loss_pct numeric(6,3) not null default 3.000 check(max_daily_loss_pct>0 and max_daily_loss_pct<=10),
 max_aggregate_risk_pct numeric(6,3) not null default 3.000 check(max_aggregate_risk_pct>0 and max_aggregate_risk_pct<=15),
 max_open_positions integer not null default 5 check(max_open_positions between 1 and 100),
 max_leverage integer not null default 100 check(max_leverage between 1 and 2000),
 halt_reason text,
 updated_at timestamptz not null default now(),
 updated_by uuid references auth.users(id)
);
create index if not exists bb_account_risk_controls_user_idx on public.bb_account_risk_controls(user_id);
alter table public.bb_account_risk_controls enable row level security;
drop policy if exists "clients read own account risk controls" on public.bb_account_risk_controls;
create policy "clients read own account risk controls" on public.bb_account_risk_controls for select to authenticated
using((select auth.uid())=user_id or (select public.is_bigbulls_admin()));
revoke insert,update,delete on public.bb_account_risk_controls from anon,authenticated;
grant select on public.bb_account_risk_controls to authenticated;
grant all on public.bb_account_risk_controls to service_role;

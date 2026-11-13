alter table public.bb_execution_settings
  add column if not exists ai_auto_execution_enabled boolean not null default false;

create table if not exists public.bb_ai_auto_trade_execution_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.trading_accounts(id) on delete cascade,
  signal_id uuid not null references public.bb_market_signal_feed(id) on delete cascade,
  signal_generated_at timestamptz not null,
  symbol text not null,
  direction text not null check (direction in ('BUY','SELL')),
  status text not null check (status in ('CLAIMED','OPENED','REJECTED')),
  reason text,
  position_id uuid references public.bb_bbook_positions(id) on delete set null,
  quote_bid numeric,
  quote_ask numeric,
  quote_time timestamptz,
  equity numeric,
  requested_risk_pct numeric,
  effective_risk_pct numeric,
  risk_amount numeric,
  reward_pct numeric,
  quantity numeric,
  contract_size numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(account_id, signal_id, signal_generated_at)
);
create index if not exists bb_ai_execution_log_account_created_idx
  on public.bb_ai_auto_trade_execution_log(account_id, created_at desc);
alter table public.bb_ai_auto_trade_execution_log enable row level security;
revoke all on public.bb_ai_auto_trade_execution_log from anon, authenticated;
grant all on public.bb_ai_auto_trade_execution_log to service_role;
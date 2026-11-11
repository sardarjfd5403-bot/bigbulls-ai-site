alter table public.bb_paper_execution_trades
  add column if not exists trailing_distance numeric(24,10) not null default 0
  check (trailing_distance >= 0);

alter table public.bb_bbook_worker_config
  add column if not exists last_processed integer not null default 0,
  add column if not exists last_closed integer not null default 0,
  add column if not exists margin_call_accounts jsonb not null default '[]'::jsonb;

create table if not exists public.bb_manual_forward_queue (
 id uuid primary key default gen_random_uuid(),
 order_id uuid not null unique references public.bb_trade_orders(id) on delete cascade,
 account_id uuid not null references public.trading_accounts(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 account_mode text not null check (account_mode in ('real','demo')),
 symbol text not null,
 side text not null check (side in ('BUY','SELL')),
 quantity numeric not null check (quantity > 0),
 reference_price numeric not null check (reference_price > 0),
 status text not null default 'AWAITING_ADMIN' check (status in ('AWAITING_ADMIN','FORWARDED','EXTERNAL_CONFIRMED','CANCELLED')),
 admin_note text,
 forwarded_at timestamptz,
 external_reference text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists bb_manual_forward_queue_status_created_idx on public.bb_manual_forward_queue(status,created_at desc);
alter table public.bb_manual_forward_queue enable row level security;
revoke all on public.bb_manual_forward_queue from anon, authenticated;
grant all on public.bb_manual_forward_queue to service_role;

create table if not exists public.bb_paper_balance_adjustments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.trading_accounts(id) on delete cascade,
  paper_account_id uuid not null references public.bb_paper_execution_accounts(id) on delete cascade,
  actor_id uuid not null references auth.users(id),
  adjustment_type text not null check (adjustment_type in ('SET','TOP_UP')),
  amount numeric(20,2) not null check (amount >= 0),
  balance_before numeric(20,2) not null,
  balance_after numeric(20,2) not null check (balance_after >= 0),
  note text not null,
  created_at timestamptz not null default now()
);
create index if not exists bb_paper_balance_adjustments_user_created_idx on public.bb_paper_balance_adjustments(user_id, created_at desc);
alter table public.bb_paper_balance_adjustments enable row level security;
drop policy if exists "paper balance adjustment owner/admin read" on public.bb_paper_balance_adjustments;
create policy "paper balance adjustment owner/admin read" on public.bb_paper_balance_adjustments
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_bigbulls_admin()));
revoke insert, update, delete on public.bb_paper_balance_adjustments from anon, authenticated;
grant select on public.bb_paper_balance_adjustments to authenticated;
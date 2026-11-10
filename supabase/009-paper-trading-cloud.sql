-- BIGBULLS paper trading cloud persistence. Run in Supabase SQL Editor after deployment.
create table if not exists public.bb_paper_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  account_state jsonb not null default '{"balance":10000,"positions":[],"history":[],"day":"","dailyRealized":0,"autoEnabled":false,"emergencyStop":false}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.bb_paper_accounts enable row level security;
drop policy if exists "paper account owner read" on public.bb_paper_accounts;
create policy "paper account owner read" on public.bb_paper_accounts for select to authenticated using (user_id=auth.uid());
drop policy if exists "paper account owner insert" on public.bb_paper_accounts;
create policy "paper account owner insert" on public.bb_paper_accounts for insert to authenticated with check (user_id=auth.uid());
drop policy if exists "paper account owner update" on public.bb_paper_accounts;
create policy "paper account owner update" on public.bb_paper_accounts for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
grant select,insert,update on public.bb_paper_accounts to authenticated;

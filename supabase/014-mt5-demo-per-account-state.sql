-- One independently monitored simulated MT5-style account per approved demo trading account.
begin;
create table if not exists public.bb_mt5_demo_accounts (
 account_id uuid primary key references public.trading_accounts(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 account_state jsonb not null default '{"balance":10000,"positions":[],"history":[],"day":"","dailyRealized":0,"autoEnabled":false,"emergencyStop":false}'::jsonb,
 updated_at timestamptz not null default now()
);
create index if not exists bb_mt5_demo_accounts_user_idx on public.bb_mt5_demo_accounts(user_id,updated_at desc);
alter table public.bb_mt5_demo_accounts enable row level security;
drop policy if exists "mt5 demo owner read" on public.bb_mt5_demo_accounts;
create policy "mt5 demo owner read" on public.bb_mt5_demo_accounts for select to authenticated using (user_id=auth.uid());
drop policy if exists "mt5 demo owner insert" on public.bb_mt5_demo_accounts;
create policy "mt5 demo owner insert" on public.bb_mt5_demo_accounts for insert to authenticated with check (
 user_id=auth.uid() and exists(select 1 from public.trading_accounts a where a.id=account_id and a.user_id=auth.uid() and a.account_mode='demo' and a.status='approved' and a.deleted_at is null)
);
drop policy if exists "mt5 demo owner update" on public.bb_mt5_demo_accounts;
create policy "mt5 demo owner update" on public.bb_mt5_demo_accounts for update to authenticated using (user_id=auth.uid()) with check (
 user_id=auth.uid() and exists(select 1 from public.trading_accounts a where a.id=account_id and a.user_id=auth.uid() and a.account_mode='demo' and a.status='approved' and a.deleted_at is null)
);
drop policy if exists "mt5 demo admin read" on public.bb_mt5_demo_accounts;
create policy "mt5 demo admin read" on public.bb_mt5_demo_accounts for select to authenticated using ((select public.is_bigbulls_admin()));
grant select,insert,update on public.bb_mt5_demo_accounts to authenticated;

create or replace function public.seed_mt5_demo_account()
returns trigger language plpgsql security definer set search_path=public
as $$
begin
 if new.account_mode='demo' and new.status='approved' and new.deleted_at is null then
  insert into public.bb_mt5_demo_accounts(account_id,user_id,account_state)
  values(new.id,new.user_id,'{"balance":10000,"positions":[],"history":[],"day":"","dailyRealized":0,"autoEnabled":false,"emergencyStop":false}'::jsonb)
  on conflict(account_id) do nothing;
 end if;
 return new;
end;
$$;
drop trigger if exists trg_seed_mt5_demo_account on public.trading_accounts;
create trigger trg_seed_mt5_demo_account after insert or update of status,account_mode,deleted_at on public.trading_accounts
for each row execute function public.seed_mt5_demo_account();

insert into public.bb_mt5_demo_accounts(account_id,user_id)
select id,user_id from public.trading_accounts
where account_mode='demo' and status='approved' and deleted_at is null
on conflict(account_id) do nothing;

do $$
begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='bb_mt5_demo_accounts') then
  alter publication supabase_realtime add table public.bb_mt5_demo_accounts;
 end if;
end $$;
commit;
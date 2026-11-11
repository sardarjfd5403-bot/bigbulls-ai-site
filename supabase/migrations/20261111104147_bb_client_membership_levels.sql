-- Client membership state for the BigbullsGlobal Market portal.
-- Membership levels and EXD points are managed by trusted staff; clients can only read their own row.
create table if not exists public.bb_client_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  level_name text not null default 'Bronze',
  points_balance numeric(12,2) not null default 0 check (points_balance >= 0),
  points_unit text not null default 'EXD',
  next_level_name text not null default 'Silver',
  next_level_threshold numeric(12,2) not null default 10 check (next_level_threshold > 0),
  upgrade_due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.bb_client_memberships enable row level security;
grant select, update on public.bb_client_memberships to authenticated;

drop policy if exists "Clients read own membership or admins read all" on public.bb_client_memberships;
create policy "Clients read own membership or admins read all"
on public.bb_client_memberships for select to authenticated
using (
  user_id = (select auth.uid())
  or coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'admin'
);

drop policy if exists "Admins manage client memberships" on public.bb_client_memberships;
create policy "Admins manage client memberships"
on public.bb_client_memberships for update to authenticated
using (coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'admin')
with check (coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'admin');

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.bb_ensure_client_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.bb_client_memberships (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

revoke all on function private.bb_ensure_client_membership() from public, anon, authenticated;

drop trigger if exists bb_profiles_create_membership on public.profiles;
create trigger bb_profiles_create_membership
after insert on public.profiles
for each row execute function private.bb_ensure_client_membership();

insert into public.bb_client_memberships (user_id)
select p.id from public.profiles p
on conflict (user_id) do nothing;

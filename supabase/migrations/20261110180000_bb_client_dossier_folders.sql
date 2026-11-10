create sequence if not exists public.bb_client_dossier_seq start 100001;
create table if not exists public.bb_client_dossiers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  dossier_number bigint not null unique default nextval('public.bb_client_dossier_seq'),
  folder_status text not null default 'ACTIVE' check (folder_status in ('ACTIVE','RESTRICTED','CLOSED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists bb_client_dossiers_number_idx on public.bb_client_dossiers(dossier_number);
alter table public.bb_client_dossiers enable row level security;
drop policy if exists "client can read own dossier" on public.bb_client_dossiers;
create policy "client can read own dossier" on public.bb_client_dossiers
 for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.bb_client_dossiers from anon, authenticated;
grant select on public.bb_client_dossiers to authenticated;
revoke all on sequence public.bb_client_dossier_seq from anon, authenticated;
create or replace function public.bb_ensure_client_dossier()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.bb_client_dossiers(user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;
revoke all on function public.bb_ensure_client_dossier() from public, anon, authenticated;
drop trigger if exists bb_profiles_create_dossier on public.profiles;
create trigger bb_profiles_create_dossier
 after insert on public.profiles
 for each row execute function public.bb_ensure_client_dossier();
insert into public.bb_client_dossiers(user_id)
select p.id from public.profiles p
on conflict (user_id) do nothing;

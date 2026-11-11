create table if not exists public.bb_growth_config (
  singleton boolean primary key default true check (singleton),
  cron_secret text not null default encode(extensions.gen_random_bytes(32), 'hex'),
  created_at timestamptz not null default now()
);
insert into public.bb_growth_config(singleton) values (true) on conflict (singleton) do nothing;
alter table public.bb_growth_config enable row level security;
revoke all on public.bb_growth_config from anon, authenticated;
grant all on public.bb_growth_config to service_role;

create table if not exists public.bb_growth_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'running' check (status in ('running','success','skipped','failed')),
  summary text,
  metrics jsonb not null default '{}'::jsonb,
  error text
);
alter table public.bb_growth_runs enable row level security;
revoke all on public.bb_growth_runs from anon, authenticated;
grant all on public.bb_growth_runs to service_role;

create table if not exists public.bb_social_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  caption text not null,
  hashtags text[] not null default '{}',
  focus_keyword text,
  target_url text,
  banner_path text,
  banner_url text,
  strategy text,
  status text not null default 'draft' check (status in ('draft','ready','published','archived')),
  generated_by text not null default 'gemini-2.5-flash',
  created_at timestamptz not null default now(),
  published_at timestamptz
);
alter table public.bb_social_posts enable row level security;
revoke all on public.bb_social_posts from anon, authenticated;
grant all on public.bb_social_posts to service_role;

alter table public.bb_seo_settings
  add column if not exists growth_monitoring_enabled boolean not null default false,
  add column if not exists growth_interval_minutes integer not null default 10 check (growth_interval_minutes = 10),
  add column if not exists last_growth_run_at timestamptz,
  add column if not exists social_drafts_enabled boolean not null default true;

insert into storage.buckets (id, name, public)
values ('bb-growth-assets', 'bb-growth-assets', true)
on conflict (id) do update set public = true;

drop policy if exists "Public can view BIGBULLS growth assets" on storage.objects;
create policy "Public can view BIGBULLS growth assets"
on storage.objects for select to anon, authenticated
using (bucket_id = 'bb-growth-assets');

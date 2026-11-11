create table if not exists public.bb_site_events (
  id bigint generated always as identity primary key,
  event_name text not null check (event_name in ('page_view','click','signup','conversion')),
  path text not null default '/',
  referrer_host text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  element_id text,
  session_id uuid,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists bb_site_events_created_idx on public.bb_site_events(created_at desc);
create index if not exists bb_site_events_path_idx on public.bb_site_events(path, created_at desc);
create index if not exists bb_site_events_session_idx on public.bb_site_events(session_id, created_at desc);
alter table public.bb_site_events enable row level security;
drop policy if exists "public can submit anonymous site events" on public.bb_site_events;
create policy "public can submit anonymous site events" on public.bb_site_events
  for insert to anon, authenticated with check (
    event_name in ('page_view','click','signup','conversion')
    and length(path) <= 500
    and (element_id is null or length(element_id) <= 120)
  );
drop policy if exists "admins read site events" on public.bb_site_events;
create policy "admins read site events" on public.bb_site_events
  for select to authenticated using ((select public.is_bigbulls_admin()));
grant insert on public.bb_site_events to anon, authenticated;
grant select on public.bb_site_events to authenticated;

create table if not exists public.bb_seo_settings (
  singleton boolean primary key default true check (singleton),
  ai_enabled boolean not null default false,
  publishing_enabled boolean not null default false,
  auto_publish_enabled boolean not null default false,
  max_daily_posts integer not null default 1 check (max_daily_posts between 0 and 5),
  google_search_console_connected boolean not null default false,
  analytics_connected boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
insert into public.bb_seo_settings(singleton) values (true) on conflict (singleton) do nothing;
alter table public.bb_seo_settings enable row level security;
drop policy if exists "admins manage seo settings" on public.bb_seo_settings;
create policy "admins manage seo settings" on public.bb_seo_settings
  for all to authenticated using ((select public.is_bigbulls_admin()))
  with check ((select public.is_bigbulls_admin()));
grant select, insert, update, delete on public.bb_seo_settings to authenticated;

create table if not exists public.bb_seo_keywords (
  id uuid primary key default gen_random_uuid(),
  keyword text not null unique,
  intent text not null default 'informational' check (intent in ('informational','commercial','navigational','transactional')),
  source text not null default 'manual',
  target_path text,
  search_volume integer,
  difficulty numeric(5,2),
  current_position numeric(6,2),
  target_position numeric(6,2),
  status text not null default 'research' check (status in ('research','targeting','tracking','paused')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.bb_seo_keywords enable row level security;
drop policy if exists "admins manage seo keywords" on public.bb_seo_keywords;
create policy "admins manage seo keywords" on public.bb_seo_keywords
  for all to authenticated using ((select public.is_bigbulls_admin()))
  with check ((select public.is_bigbulls_admin()));
grant select, insert, update, delete on public.bb_seo_keywords to authenticated;

create table if not exists public.bb_seo_pages (
  id uuid primary key default gen_random_uuid(),
  path text not null unique,
  page_title text,
  meta_description text,
  focus_keyword text,
  seo_score integer not null default 0 check (seo_score between 0 and 100),
  search_impressions bigint not null default 0,
  search_clicks bigint not null default 0,
  ctr numeric(7,4) not null default 0,
  average_position numeric(7,2),
  index_status text not null default 'unknown' check (index_status in ('unknown','indexed','not_indexed','excluded')),
  audit_notes jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.bb_seo_pages enable row level security;
drop policy if exists "admins manage seo pages" on public.bb_seo_pages;
create policy "admins manage seo pages" on public.bb_seo_pages
  for all to authenticated using ((select public.is_bigbulls_admin()))
  with check ((select public.is_bigbulls_admin()));
grant select, insert, update, delete on public.bb_seo_pages to authenticated;

create table if not exists public.bb_seo_cards (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  excerpt text not null default '',
  content text not null default '',
  focus_keyword text,
  page_path text not null default '/',
  status text not null default 'draft' check (status in ('draft','pending','published','archived')),
  generated_by text not null default 'admin',
  publish_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists bb_seo_cards_status_created_idx on public.bb_seo_cards(status, created_at desc);
alter table public.bb_seo_cards enable row level security;
drop policy if exists "published seo cards are public" on public.bb_seo_cards;
create policy "published seo cards are public" on public.bb_seo_cards
  for select to anon, authenticated using (status = 'published');
drop policy if exists "admins manage seo cards" on public.bb_seo_cards;
create policy "admins manage seo cards" on public.bb_seo_cards
  for all to authenticated using ((select public.is_bigbulls_admin()))
  with check ((select public.is_bigbulls_admin()));
grant select on public.bb_seo_cards to anon, authenticated;
grant insert, update, delete on public.bb_seo_cards to authenticated;

create table if not exists public.bb_seo_activity (
  id bigint generated always as identity primary key,
  event_type text not null,
  details jsonb not null default '{}'::jsonb,
  actor_user_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);
alter table public.bb_seo_activity enable row level security;
drop policy if exists "admins read seo activity" on public.bb_seo_activity;
create policy "admins read seo activity" on public.bb_seo_activity
  for select to authenticated using ((select public.is_bigbulls_admin()));
drop policy if exists "admins write seo activity" on public.bb_seo_activity;
create policy "admins write seo activity" on public.bb_seo_activity
  for insert to authenticated with check ((select public.is_bigbulls_admin()));
grant select, insert on public.bb_seo_activity to authenticated;

notify pgrst, 'reload schema';

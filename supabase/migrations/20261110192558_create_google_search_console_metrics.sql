create table if not exists public.bb_gsc_search_rows (
  id bigint generated always as identity primary key,
  data_date date not null,
  dimension_type text not null check (dimension_type in ('page','query')),
  dimension_value text not null,
  clicks bigint not null default 0,
  impressions bigint not null default 0,
  ctr numeric not null default 0,
  average_position numeric,
  updated_at timestamptz not null default now(),
  unique (data_date, dimension_type, dimension_value)
);
alter table public.bb_gsc_search_rows enable row level security;
revoke all on table public.bb_gsc_search_rows from anon, authenticated;
grant all on table public.bb_gsc_search_rows to service_role;

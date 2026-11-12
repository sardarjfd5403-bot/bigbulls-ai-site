create table if not exists public.bb_bbook_worker_config (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default true,
  worker_secret text not null,
  last_run_at timestamptz,
  last_error text,
  last_processed integer not null default 0,
  last_closed integer not null default 0,
  margin_call_accounts jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.bb_bbook_worker_config enable row level security;
revoke all on public.bb_bbook_worker_config from anon, authenticated;
grant all on public.bb_bbook_worker_config to service_role;
insert into public.bb_bbook_worker_config(singleton,enabled,worker_secret)
values(true,true,lower(replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','')))
on conflict(singleton) do nothing;

do $$
declare v_job bigint;
begin
  select jobid into v_job from cron.job where jobname='bigbulls-bbook-risk-worker';
  if v_job is not null then perform cron.unschedule(v_job); end if;
  perform cron.schedule(
    'bigbulls-bbook-risk-worker',
    '* * * * *',
    $job$
      select net.http_post(
        url := 'https://ztiiyulusburxjkpcfxu.supabase.co/functions/v1/bbook-worker',
        headers := jsonb_build_object(
          'Content-Type','application/json',
          'apikey','sb_publishable_5hDwqvbcUHeSJdXFHf9ugw_VPYGN4J_',
          'x-bbook-secret',(select worker_secret from public.bb_bbook_worker_config where singleton=true)
        ),
        body := '{"action":"tick"}'::jsonb,
        timeout_milliseconds := 55000
      ) as request_id;
    $job$
  );
end $$;

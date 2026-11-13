-- BIGBULLS AI Market Brain scheduled auto-publishing.
create table if not exists public.bb_market_brain_config (
  singleton boolean primary key default true check (singleton),
  cron_secret text not null,
  updated_at timestamptz not null default now()
);
alter table public.bb_market_brain_config enable row level security;
revoke all on public.bb_market_brain_config from anon, authenticated;
insert into public.bb_market_brain_config(singleton,cron_secret)
values(true, encode(gen_random_bytes(32),'hex'))
on conflict(singleton) do nothing;

select cron.unschedule(jobid)
from cron.job
where jobname='bigbulls-market-brain-auto-publish';

select cron.schedule(
  'bigbulls-market-brain-auto-publish',
  '*/15 * * * *',
  $job$
    select net.http_post(
      url := 'https://ztiiyulusburxjkpcfxu.supabase.co/functions/v1/market-brain',
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'apikey','sb_publishable_5hDwqvbcUHeSJdXFHf9ugw_VPYGN4J_',
        'x-market-brain-cron-secret',(select cron_secret from public.bb_market_brain_config where singleton=true)
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 55000
    ) as request_id;
  $job$
);

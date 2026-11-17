-- Defense-in-depth for internal tables that intentionally have no browser API grants.
-- These tables already have RLS enabled and no anon/authenticated table privileges.
-- The restrictive policies preserve that boundary if grants are accidentally added later.
-- SECURITY DEFINER functions owned by postgres and service_role (BYPASSRLS) keep their
-- existing server-side workflows. No client trading or financial workflow code changes.

do $$
declare
  t text;
  internal_tables text[] := array[
    'bb_ai_auto_trade_execution_log',
    'bb_bbook_settings',
    'bb_bbook_worker_config',
    'bb_execution_pending_orders',
    'bb_execution_settings',
    'bb_growth_config',
    'bb_growth_runs',
    'bb_gsc_search_rows',
    'bb_market_brain_config',
    'bb_social_posts',
    'kyc_email_outbox',
    'partner_referral_aliases'
  ];
begin
  foreach t in array internal_tables loop
    if not exists (
      select 1 from pg_policies
      where schemaname='public'
        and tablename=t
        and policyname='deny_direct_api_role_access'
    ) then
      execute format(
        'create policy deny_direct_api_role_access on public.%I as restrictive for all to anon, authenticated using (false) with check (false)',
        t
      );
    end if;
  end loop;
end $$;

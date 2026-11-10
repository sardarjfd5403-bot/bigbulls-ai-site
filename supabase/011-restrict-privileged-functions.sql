-- Restrict privileged helper functions to their intended trigger/maintenance callers.
begin;

-- This helper only reads the caller's JWT metadata; it does not need SECURITY DEFINER.
alter function public.is_bigbulls_admin() security invoker;
revoke all on function public.is_bigbulls_admin() from public, anon;
grant execute on function public.is_bigbulls_admin() to authenticated;

-- These functions are invoked by database triggers / event triggers, never by browser RPC.
revoke all on function public.assign_partner_referral_code() from public, anon, authenticated, service_role;
revoke all on function public.bigbulls_account_defaults() from public, anon, authenticated, service_role;
revoke all on function public.capture_partner_referral() from public, anon, authenticated, service_role;
revoke all on function public.sync_auth_profile() from public, anon, authenticated, service_role;
revoke all on function public.rls_auto_enable() from public, anon, authenticated, service_role;

-- Global account maintenance must never be callable by ordinary signed-in customers.
revoke all on function public.archive_zero_balance_trading_accounts() from public, anon, authenticated;
grant execute on function public.archive_zero_balance_trading_accounts() to service_role;

commit;

-- BIGBULLS security hardening: prevent anonymous/direct RPC invocation of
-- trigger-only and authenticated-client AI preference functions.
--
-- IMPORTANT SCOPE:
-- - Does not alter trade execution, order placement, fills, SL/TP, pending orders,
--   price feeds, paper-trading logic, Echo System, deposits, or withdrawals.
-- - The VIP bonus function remains callable by its database trigger. PostgreSQL
--   does not check EXECUTE privileges when a trigger invokes its trigger function.
-- - Authenticated users retain access to their own AI mode getter/setter; those
--   functions already require auth.uid() and verify account ownership.
--
-- Apply through the normal reviewed migration process, not directly in production.

begin;

-- Trigger-only function: remove the exposed RPC surface. Its database trigger
-- continues to invoke it normally.
revoke execute on function public.apply_vip_bonus_after_deposit()
  from public, anon, authenticated;

-- These client preference RPCs require a signed-in user (auth.uid()).
-- Keep authenticated grants unchanged; remove only the anonymous role grant.
revoke execute on function public.get_client_ai_trade_mode(uuid)
  from anon;

revoke execute on function public.set_client_ai_trade_mode(uuid, boolean)
  from anon;

commit;

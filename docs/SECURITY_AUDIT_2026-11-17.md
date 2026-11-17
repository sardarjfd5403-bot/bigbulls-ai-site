# BIGBULLS Security Audit & Hardening Plan

Audit date: 2026-11-17
Scope: website, Android client source, Supabase/PostgreSQL
Deployment status: **not deployed** — this branch is review-only.

## Protected scope (explicitly out of scope)

Do not modify:
- trade execution, order placement, order fills, pending orders, SL/TP, position close;
- demo/real paper-trading engine, Echo System, AI execution pipeline;
- market data, Twelve Data, charts, quotes, or terminal UI;
- existing login, KYC, deposit, withdrawal, transfer, account creation, or partner workflows.

Security changes must be additive or permission-only, separately reviewed, and regression-tested. Any change with a plausible effect on the protected workflows must be held back.

## Confirmed observations

1. Supabase Security Advisor reported 3 SECURITY DEFINER functions executable by `anon`:
   - `apply_vip_bonus_after_deposit()` — trigger function, not intended as browser RPC.
   - `get_client_ai_trade_mode(uuid)` — requires `auth.uid()` and checks account ownership.
   - `set_client_ai_trade_mode(uuid, boolean)` — requires `auth.uid()`, checks ownership, KYC and account state.
2. Supabase Security Advisor reported 31 SECURITY DEFINER functions executable by `authenticated`. This is not proof of a vulnerability: many are intended RPCs and must be individually reviewed. Do not blanket-revoke them.
3. 12 public-schema tables have RLS enabled and no policies. A separate privilege check found no direct `anon` or `authenticated` table grants on those tables. Keep them inaccessible unless a documented user-facing need is established.
4. `pg_net` is installed in `public`; assess moving it only after checking every dependent function/trigger and scheduled task.
5. Supabase Auth leaked-password protection is disabled; enable it in Auth password security settings after confirming the setting is available on the current plan.
6. Recent `kyc-approved-email` Edge Function requests returned HTTP 503. Investigate provider/configuration/runtime logs separately; do not change KYC approval or deposit/withdrawal workflows as part of this security patch.
7. Website and Android browser sources inspected use the Supabase publishable key, not a service-role key. Publishable keys are expected to be public and must remain protected by RLS and server-side authorization.

## Proposed narrow permission hardening

Migration `20261117090000_restrict_anonymous_trigger_and_ai_mode_rpc.sql`:
- removes direct RPC execution of the trigger-only VIP bonus function from PUBLIC/anon/authenticated; its database trigger invocation remains valid;
- removes only the anon grant from the two AI preference RPCs; authenticated access and their existing ownership checks remain unchanged.

No SQL has been run against production as part of this branch.

## Required verification before applying migration

1. Confirm trigger `apply_vip_bonus_after_deposit` remains attached to its existing table/event.
2. Confirm trigger-based VIP bonus test still credits the same bonus ledger and account credit as before.
3. Confirm signed-in client can read/update only their own AI preference.
4. Confirm anonymous RPC calls to all three functions are denied.
5. Confirm no changes to order/trade tables, execution functions, terminal sources, wallet processing, KYC, deposits, withdrawals, or transfers.
6. Re-run Supabase Security Advisor and compare results.

## Remaining hardening backlog

- Review every SECURITY DEFINER RPC individually for caller authorization, fixed search_path, qualified object names, and least-privilege grants.
- Keep the 12 no-policy internal tables inaccessible; document their intended service-only consumers.
- Review Storage policies and confirm KYC documents/payment proofs are private and user-scoped; keep only intentionally public marketing assets public.
- Enable leaked-password protection and require MFA for privileged administrators.
- Add automated dependency and secret scanning to CI after confirming the private-repository plan supports the selected tools.
- Investigate the KYC email 503 without weakening authentication or approval checks.
- Verify Android WebView settings and native manifest from the generated APK, not only the wrapper HTML.

## Rollback

If the migration causes an unexpected issue, restore the exact prior function ACLs from the database's pre-deployment ACL snapshot. Do not change function bodies or trading code as a rollback shortcut.

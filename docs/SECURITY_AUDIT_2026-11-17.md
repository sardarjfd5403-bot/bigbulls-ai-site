# BIGBULLS Security Audit & Hardening — 2026-11-17

Scope: website, Android client source, Supabase/PostgreSQL.
Production status: two permission-only database hardening changes are applied and verified. Website source and APK were not changed or rebuilt.

## Explicitly protected workflows

No changes were made to:
- trade execution, order placement, fills, pending-order matching, SL/TP, position close;
- demo/real paper-trading engine, Echo System, AI execution pipeline;
- market data, Twelve Data, charts, quotes, terminal UI;
- login, KYC approval, deposits, withdrawals, transfers, account creation, partner workflows.

## Production changes applied

1. Migration `restrict_anonymous_trigger_and_ai_mode_rpc`:
   - revoked direct RPC execution of trigger-only `apply_vip_bonus_after_deposit()` from PUBLIC/anon/authenticated; PostgreSQL trigger invocation remains valid;
   - revoked only anon execution of `get_client_ai_trade_mode(uuid)` and `set_client_ai_trade_mode(uuid, boolean)`; authenticated grants and existing ownership checks remain.
2. Migration `add_restrictive_deny_policies_to_internal_tables`:
   - added restrictive deny-all policies for anon/authenticated on 12 internal public-schema tables;
   - verified those roles have no direct table grants, and service_role retains BYPASSRLS. This adds defense-in-depth without changing server-side RPC/worker access.

## Verification

- VIP bonus trigger remains attached and enabled.
- The three functions no longer allow anonymous execution; authenticated access remains only where intended.
- Security Advisor no longer reports the 12 RLS-enabled/no-policy tables.
- KYC documents and payment proofs are in private buckets with user-folder scoping and admin access. Product downloads are private/licence-gated. Public bucket is only `bb-growth-assets`.
- Browser source uses a Supabase publishable key, not a service-role key.
- Edge functions with JWT verification disabled were reviewed: admin endpoints perform explicit authenticated-user/admin checks; scheduled workers require configured secret headers; KYC email hook checks a per-job webhook token. Do not switch JWT verification on blindly because that would break internal scheduled hooks.
- SECURITY DEFINER functions callable by authenticated users are individually guarded by admin checks or user/account ownership checks in reviewed client/admin functions. Advisor warnings remain because the linter cannot infer those checks; do not blanket-revoke them.
- `pg_net` 0.20.4 is non-relocatable in this project and is used by server-side HTTP workers. It was deliberately not moved or recreated.
- The 12 internal tables have no direct browser grants; restrictive policies now explicitly deny anon/authenticated access.

## Remaining owner actions — required before declaring the whole programme complete

1. **Admin MFA:** no verified TOTP factor is enrolled for the root admin. Enrol an authenticator factor first. Then add AAL2 enforcement to privileged admin authorization and test admin login. Do not enforce AAL2 before enrolment, or the administrator could be locked out.
2. **Leaked-password protection:** enable in Supabase Dashboard → Authentication → Settings/Password Security (if available on the project plan), then test sign-in/password reset.
3. **KYC approval email:** `kyc-approved-email` is returning 503. Its deployed source explicitly returns 503 when `RESEND_API_KEY` is missing. Add the Resend API key as an Edge Function secret in Supabase Dashboard (never commit or paste it in chat), then test one controlled KYC notification. Current outbox has 8 pending jobs; do not replay them all until provider configuration is verified.
4. **Android:** current browser source contains no observed service-role key; native manifest still needs inspection from a fresh release APK. No APK rebuild has been done as part of these database-only changes.

## Advisor results after production hardening

- The 12 `rls_enabled_no_policy` INFO findings are cleared.
- Remaining security warnings: non-relocatable `pg_net` installed in public, and 30 authenticated-executable SECURITY DEFINER RPCs. Those RPCs are retained because they are part of existing client/admin workflows and the reviewed definitions contain admin or ownership checks. Further per-function review and regression tests are required before changing their grants.

## Rollback

- Drop the `deny_direct_api_role_access` policy from the 12 listed tables to reverse the second change.
- Restore the prior function ACLs from the database's pre-change ACL snapshot to reverse the first change.
- Do not modify function bodies or trading code as a rollback shortcut.

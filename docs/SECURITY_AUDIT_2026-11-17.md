# BIGBULLS Security Audit & Hardening — 2026-11-17

Scope: BIGBULLS website, Android wrapper, Supabase/PostgreSQL.
Production database hardening is applied and verified. No production website deployment or Android store release has been made.

## Explicitly protected workflows

No trading or financial workflow implementation was modified:
- trade execution, order placement, fills, pending-order matching, SL/TP, position close;
- demo/real paper-trading engine, Echo System, AI execution pipeline;
- market data, Twelve Data, charts, quotes, terminal UI;
- login, KYC approval, deposits, withdrawals, transfers, account creation, partner workflows.

## Production database changes applied

1. `restrict_anonymous_trigger_and_ai_mode_rpc`:
   - revoked direct RPC execution of trigger-only `apply_vip_bonus_after_deposit()` from PUBLIC/anon/authenticated; PostgreSQL trigger invocation remains valid;
   - revoked only anon execution of `get_client_ai_trade_mode(uuid)` and `set_client_ai_trade_mode(uuid, boolean)`; authenticated grants and existing ownership checks remain.
2. `add_restrictive_deny_policies_to_internal_tables`:
   - added restrictive deny-all policies for anon/authenticated on 12 internal public-schema tables;
   - those roles have no direct table grants; service_role retains BYPASSRLS. This is defense-in-depth without changing server-side RPC/worker access.
3. `revoke_orphaned_withdrawal_otp_trigger_rpc`:
   - revoked authenticated EXECUTE on `enforce_withdrawal_email_otp_before_processing()`. Catalog check found no attached trigger, so this only removes an unnecessary RPC permission; it does not alter withdrawal processing.

## Verification

- Anonymous SECURITY DEFINER RPC execution count: 0.
- Authenticated-executable SECURITY DEFINER RPC count: 29. These are retained for existing admin/client RPC workflows; admin functions use the admin gate and client functions use user/account ownership checks. Do not blanket-revoke.
- VIP bonus trigger remains attached and enabled.
- The 12 RLS-enabled/no-policy INFO findings are cleared.
- KYC documents and payment proofs are in private buckets with user-folder scoping and admin access. Product downloads are private/licence-gated. Public bucket is only `bb-growth-assets`.
- Browser source uses a Supabase publishable key, not a service-role key.
- Edge functions with JWT verification disabled were reviewed: admin endpoints perform explicit authenticated-user/admin checks; scheduled workers require configured secret headers; KYC email hook checks a per-job webhook token. Do not switch JWT verification on blindly because that would break internal scheduled hooks.
- `pg_net` 0.20.4 is non-relocatable in this project and is used by server-side HTTP workers. It was deliberately not moved or recreated.
- `enforce_withdrawal_email_otp_before_processing()` has no attached trigger in the production catalog; it was not attached or modified.

## Android-only changes on feature branch

- Native manifest hardening sets `android:usesCleartextTraffic=false` and `android:allowBackup=false`, preserves biometric permission and hardware acceleration.
- Capacitor 8.6.2, native biometric plugin 8.9.3, Capacitor assets 4.0.0, and sharp 0.35.5 replace vulnerable older package ranges. The biometric plugin major is matched to Capacitor 8.
- `npm audit` on the upgraded dependency tree reports 0 vulnerabilities.
- Android debug APK build passed on commit `7678f186ee0c1fe04f3efe1c9bce9faa1c0c7e86` (Actions run 44014109294); B-Book validation passed on the same commit (run 44014115746). The artifact is a debug/test APK, not a production-signed release.
- No terminal, execution, or client workflow source files were changed.

## Remaining owner actions — required before declaring the whole programme complete

1. **Admin MFA:** no verified TOTP factor is enrolled for the root app admin. The app needs an admin-only TOTP enrollment/challenge flow; enroll a factor and verify login before adding AAL2 enforcement. Do not enforce AAL2 before enrollment, or the administrator could be locked out.
2. **KYC approval email:** `kyc-approved-email` is returning 503. Its deployed source returns 503 when `RESEND_API_KEY` is absent. Add the Resend key as a Supabase Edge Function secret (never commit or paste it in chat), then test one controlled KYC notification. There are 8 pending outbox jobs; do not replay all until provider configuration is verified.
3. **Leaked-password protection:** Supabase documents this as Pro-plan-and-above only. If this project is on Free, it cannot be enabled at zero cost. Keep strong password-length/complexity settings; enable breached-password blocking only if the project is already Pro.
4. **Repository visibility:** GitHub reports this repository is currently public. The repository owner previously wanted private source with a public website. Change visibility only after confirming the Pages/deployment arrangement, because private-repo Pages availability can depend on plan.
5. **Public APK distribution:** current build workflow outputs a debug-signed test APK artifact, not a production-signed release. A stable public website download button needs a signed release asset and durable hosting; do not link a temporary Actions artifact as the permanent download URL.

## Advisor results after production hardening

- Remaining Supabase security warnings: `pg_net` in public (extension is non-relocatable) and 29 authenticated-executable SECURITY DEFINER RPCs. Those RPCs are retained because they are part of existing client/admin workflows; further per-function regression review is required before changing grants.
- No anonymous-executable SECURITY DEFINER functions remain.
- No RLS-enabled/no-policy internal table findings remain.

## Rollback

- Drop the `deny_direct_api_role_access` policy from the 12 listed tables to reverse the second change.
- Restore the pre-change function ACLs to reverse the RPC permission changes.
- Do not modify function bodies or trading code as a rollback shortcut.

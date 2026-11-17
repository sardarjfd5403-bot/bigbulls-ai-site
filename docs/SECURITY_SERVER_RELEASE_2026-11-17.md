# BIGBULLS security release note — 2026-11-17

Server-side security maintenance was applied to Supabase:
- Anonymous direct RPC execution was removed from the trigger-only VIP bonus function.
- Anonymous execution was removed from client AI preference RPCs.
- Authenticated access for the AI preference RPCs remains unchanged.
- The VIP bonus trigger remains attached to wallet_transactions and enabled.

No Android app source, trading execution, terminal, order management, pricing, deposits, withdrawals, KYC, or client workflow code was changed. The Android build workflow is being run only to produce a fresh installable artifact from the existing app source; server-side security is enforced by Supabase independently of APK version.

# Secure financial workflow deployment

This feature is maintained on `feature/secure-financial-workflows` until the application changes have been reviewed and tested. A successful SQL migration does not itself deploy the website.

## 1. Database migrations

Run these files in order in the Supabase SQL Editor:

1. `supabase/006-secure-financial-workflows.sql`
2. `supabase/007-defer-withdrawal-otp.sql`

Migration 006 creates the private payment-proof bucket, invoice and ledger fields, account balance ledger, Admin-only RPCs, client write restrictions and Realtime publication entries.

Migration 007 replaces the Admin review RPC for the temporary no-OTP withdrawal flow. It checks the account balance after subtracting other withdrawals already in `processing`, preventing multiple pending payouts from being approved against the same available funds.

## 2. Withdrawal OTP is temporarily deferred

The client withdrawal flow currently submits a request directly to Admin review. Do not configure Resend secrets or deploy `supabase/functions/withdrawal-otp/index.ts` for this release. The Edge Function and OTP challenge table are retained for a later release when email OTP is re-enabled.

## 3. Admin role

Admin permissions rely on the existing `app_metadata.role = admin` claim and `public.is_bigbulls_admin()`. Never assign this role through user-editable metadata or a client-side form.

## 4. Deposit and withdrawal operating procedure

- Clients submit requests; they cannot directly edit trading-account balances.
- Admin verifies deposit TXID and proof before approving a deposit. Approval credits the linked USD account and writes a ledger entry.
- Admin approves a withdrawal to move it to `processing`. Its amount is reserved against available balance, but the account is not debited yet.
- Admin sends the payout externally, then records the blockchain TXID/reference. Completion atomically debits the account, writes the ledger entry and marks the invoice `completed`.
- Rejection requires a reason and does not change the balance.
- Funding is limited to USD-denominated accounts until a proper FX conversion source and rounding policy are configured.

## 5. Production gate

Before accepting real customer funds, test in a non-production account: deposit submission, proof access controls, Admin approval and rejection, withdrawal submission, insufficient available balance, multiple processing withdrawals on one account, payout completion, ledger balances, realtime history updates and Admin balance adjustments. Verify blockchain transfers independently.

This website workflow is an internal ledger and manual review process. It is not a custodian, blockchain payment processor or live MT5 broker integration. Do not advertise balances as broker-held funds or accept customer funds until the full test suite and applicable compliance checks are complete.

# Secure financial workflow deployment

This feature is kept on the `feature/secure-financial-workflows` branch until it has been reviewed and tested. It is not active on the production branch yet.

## 1. Apply the database migration

After merging this branch, open the Supabase project SQL Editor and run the complete file:

`supabase/006-secure-financial-workflows.sql`

The migration:
- Adds invoice IDs, proof references and withdrawal verification timestamps.
- Creates a private `payment-proofs` storage bucket.
- Creates an immutable account balance ledger and OTP challenge table.
- Revokes client transaction updates and account balance updates.
- Adds Admin-only RPCs for approving deposits, marking payouts complete and adjusting balances.
- Adds wallet transaction events to Realtime where the publication is available.

Funding ledger amounts are currently enabled only for USD-denominated trading accounts. Non-USD account funding is blocked until a proper FX conversion source and rounding policy are configured.

## 2. Configure email OTP delivery

The Edge Function is `supabase/functions/withdrawal-otp/index.ts`. It uses Resend to send a 6-digit OTP to the authenticated user's registered Supabase Auth email. Codes expire after 10 minutes, and request/attempt limits are enforced.

1. Verify the sending domain in Resend and create an API key.
2. Set the sender address to an address on that verified domain.
3. From the repository root, install/use the Supabase CLI and link the project:
   `supabase link --project-ref ztiiyulusburxjkpcfxu`
4. Set secrets (never put these in browser JavaScript):
   `supabase secrets set RESEND_API_KEY=YOUR_RESEND_API_KEY OTP_FROM_EMAIL="BIGBULLS Security <security@YOUR_VERIFIED_DOMAIN>"`
5. Deploy:
   `supabase functions deploy withdrawal-otp`

The function validates the user's bearer token and uses the service-role key only inside the Edge Function runtime. Never add the service-role key to `app.js` or any public file.

## 3. Admin role

Admin permissions continue to rely on the existing `app_metadata.role = admin` claim and `public.is_bigbulls_admin()`. Do not assign this role through user-editable metadata or a client-side form.

## 4. Withdrawal operating procedure

- Client submits the destination and amount.
- The OTP must be verified before the request becomes eligible for Admin review.
- Admin approves the request to move it to `processing`; this does not debit the account yet.
- Admin sends the payout externally, then records the blockchain TXID/reference using the completion action.
- The completion RPC atomically debits the account, writes the ledger entry and marks the invoice `completed`.
- Rejection requires a reason and does not change the balance.

## 5. Important production checks

Before accepting real customer funds, test deposits, failed OTP delivery, expired/incorrect OTPs, repeated requests, insufficient balance, rejected requests, payout completion and Admin balance adjustments in a non-production environment. Verify blockchain transfers independently. This website workflow is an internal ledger and manual review process; it is not a custodian, blockchain payment processor or live MT5 broker integration.

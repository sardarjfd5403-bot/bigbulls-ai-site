# Twelve Data Forex / Gold market feed

## Current state
The repository contains a Supabase Edge Function proxy and a client-side market panel loader. The provider key is intentionally NOT stored in GitHub or browser code. The feed is not active until the Edge Function is deployed and its secret is configured.

## Free plan usage
Twelve Data Basic currently lists 8 API credits/minute and 800 credits/day. A multi-symbol request consumes credits per symbol. This integration refreshes once every 15 minutes (4 symbols per request, approximately 384 symbol-credits/day if used continuously by one active client). Multiple clients calling independently can exceed the shared quota; before public launch, add server-side caching/rate limiting or use a paid/licensed data plan. Verify current plan terms and symbol availability in your Twelve Data dashboard.

## Setup
1. Create a free account at https://twelvedata.com/pricing and copy the API key from your dashboard.
2. Install / use Supabase CLI and log in to the correct Supabase project.
3. From the repository root, set the secret:
   \`supabase secrets set TWELVE_DATA_API_KEY=YOUR_KEY\`
4. Deploy:
   \`supabase functions deploy market-data\`
5. In Supabase Dashboard > Edge Functions > market-data > Details, ensure JWT verification is enabled. This endpoint is for signed-in portal users only.
6. Sign in to BIGBULLS client portal > Market Analysis. The Forex / Gold panel should populate when the provider accepts all requested symbols.

## Important
- Do not commit the Twelve Data key to GitHub, frontend JavaScript, HTML, or chat.
- If the provider rejects XAU/USD for the Basic plan, check the plan's symbol entitlement and remove it from the allowlist until access is confirmed.
- Data is 1-minute candle data and not tick-by-tick broker CFD pricing.
- Twelve Data supplies data only; it does not execute trades.
- Free-tier commercial display / redistribution rights must be confirmed with Twelve Data before public commercial rollout.
- This implementation has not been deployed or live-tested from this environment.

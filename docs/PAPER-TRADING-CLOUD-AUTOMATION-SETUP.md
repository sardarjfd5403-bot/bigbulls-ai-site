# Paper trading cloud + AI automation setup

The frontend release adds per-user Supabase cloud persistence and opt-in AI paper execution. It does not place real orders.

## Required one-time Supabase setup

1. Open Supabase Dashboard → SQL Editor for project `ztiiyulusburxjkpcfxu`.
2. Run the complete contents of `supabase/009-paper-trading-cloud.sql`.
3. Confirm the table `public.bb_paper_accounts` exists and RLS is enabled. The policies restrict each row to its authenticated owner.

## Market-data provider

The current FX/Gold feed and Market Brain use Twelve Data through Supabase Edge Functions. Set the API key as a server-side secret only:

```sh
supabase secrets set TWELVE_DATA_API_KEY=YOUR_KEY
supabase functions deploy market-data
supabase functions deploy market-brain
```

Do not put the provider key in browser JavaScript, GitHub commits, or public site configuration. Provider access, instrument coverage, rate limits and redistribution rights depend on the selected Twelve Data plan. Confirm that your plan permits the intended commercial/client-facing use before publishing prices to customers.

Crypto quotes use Binance's public spot ticker endpoint and are not broker execution quotes.

## Current automation scope and safeguards

- Auto mode is OFF by default and is enabled by the signed-in user inside Pro Terminal.
- It only considers fresh Market Brain BUY/SELL signals with score at least 80, a valid stop and target, and a current price inside the entry zone.
- Automated symbols are currently EURUSD, GBPUSD and XAUUSD, plus no other instrument until its contract/P&L specification is verified.
- Risk checks cap each paper trade at 1% of virtual balance, aggregate open risk at 3%, daily loss at 3%, and open positions at five.
- Duplicate symbol positions and recently closed symbol re-entries are filtered.
- Emergency stop disables new AI entries; existing paper positions remain subject to SL/TP monitoring and can be closed manually.
- Browser tab must remain open for client-side polling and paper position monitoring. This is not unattended server-side execution.

## Important limitations

- Index instruments are not enabled yet: an approved, plan-authorized intraday index feed and exact instrument/contract specifications must be verified before showing live prices or simulating P/L.
- The current provider proxy caches quotes; the Market Brain is a research signal generator, not a guaranteed prediction engine.
- Paper fills use the displayed provider price and do not reproduce broker spread, slippage, swaps, commissions, latency, liquidity or execution rejection.
- No real-money order routing is present. No MT5 or brokerage integration is used.
- If the SQL migration or Edge Function deployments are not completed, cloud sync or AI signals will show unavailable/pending status rather than silently claiming success.

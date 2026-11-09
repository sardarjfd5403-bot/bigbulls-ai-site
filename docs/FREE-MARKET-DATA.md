# BIGBULLS FX Market — Free Market Data Integration

## Live crypto spot feed

The client portal's Markets page uses Binance's public market-data-only endpoint:

- Base: https://data-api.binance.vision
- Endpoint: GET /api/v3/ticker/24hr
- Symbols: BTCUSDT, ETHUSDT, BNBUSDT, SOLUSDT, XRPUSDT, DOGEUSDT
- Refresh interval: 15 seconds
- Authentication: none for public market data
- API key: not required

The browser module market-feed.js attaches when the authenticated Markets page renders and stops polling when the page is left.

### Important data limitations

- These are Binance spot exchange quotes, not Forex broker quotes, CFDs, or executable BIGBULLS prices.
- The feed does not provide XAUUSD, EURUSD, GBPUSD, US30, or NAS100.
- Do not use this public display feed as a trade-execution price source.
- No order execution, signal generation, or AI prediction is enabled by this integration.
- Binance availability, regional access, CORS, rate limits, and endpoint behaviour should be verified in the deployed browser.

## Next provider candidates

### Twelve Data
Its Basic plan is listed as free and currently advertises 8 API credits per minute and 800 per day. It lists real-time Forex and crypto data, but requires an account/API key and the free quota is not suitable for indiscriminate high-frequency multi-timeframe polling. If selected, keep the API key in Supabase Edge Function secrets, never in browser JavaScript.

### Supabase
The existing project uses Supabase Auth, Postgres and Storage. Supabase documents a Free tier and Edge Functions; secrets for external API credentials belong in Edge Function secrets, not in the frontend repository.

## Deployment checklist

1. Deploy the GitHub Pages/static site update.
2. Sign in to the client portal.
3. Open Markets.
4. Confirm six Binance spot quote cards appear and update.
5. If the feed fails, check browser console/network access to data-api.binance.vision.
6. Keep Forex/Gold/Indices marked provider-pending until a suitable source is configured and tested.

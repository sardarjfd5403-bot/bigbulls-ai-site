# BIGBULLS AI Market Brain — deployment

## What this phase does
- Reads Twelve Data 1-minute OHLC history for EUR/USD, GBP/USD, USD/JPY and XAU/USD.
- Resamples available history into 1m, 5m, 15m, 1h and 4h analysis frames.
- Scores trend alignment, RSI momentum, engulfing candles, swing-liquidity sweeps, fair-value gaps, an order-block proxy, and volume confirmation only when volume is supplied.
- Runs a separate 5-minute EMA20/EMA50 crossover historical simulation with next-bar entries, ATR stop/target, stop-first same-bar handling, and a disclosed 0.03R friction proxy.
- Returns BUY, SELL or WAIT research cards and backtest metrics to the existing client Signals page.
- Places no orders and does not connect to a broker execution API.

## Deploy the Edge Function
1. Open the Supabase project dashboard: https://supabase.com/dashboard/project/ztiiyulusburxjkpcfxu/functions
2. Choose **Deploy a new function** → **Via Editor**.
3. Set the function name to `market-brain`.
4. Open `supabase/functions/market-brain/index.ts` in this GitHub repository, copy its complete contents into the Supabase editor's `index.ts`.
5. Keep **Verify JWT** enabled, because the client portal calls this function from an authenticated session.
6. Confirm the existing Edge Function secret `TWELVE_DATA_API_KEY` is present. Do not put the key in frontend code or GitHub.
7. Select **Deploy updates**.

## Verify
- Sign in to the BIGBULLS client portal.
- Open **Live Signals**.
- The page should show the Market Brain status, four instrument cards and historical backtest snapshots.
- If the page reports the function is unavailable, check that the function name is exactly `market-brain`, deployment succeeded, JWT verification is enabled, and the secret is configured.

## Data and validation limits
- This first release covers EURUSD, GBPUSD, USDJPY and XAUUSD only. It does not fabricate crypto or index signals.
- The provider's 1-minute history is resampled locally; 4-hour analysis has fewer observations than lower timeframes and should be treated as lower-confidence context.
- The 15-minute in-memory cache is per warm Edge Function instance, not a guaranteed global cache. Provider usage can be higher with multiple isolates or high traffic. Check the Twelve Data plan/credits and commercial display rights before public launch.
- Provider candles are not broker bid/ask execution quotes. Spread and slippage assumptions in the sample backtest are generic, not broker-calibrated.
- Historical simulation is not proof of future profitability. Validate with out-of-sample data and paper trading before considering live execution.
- Live trading is not implemented or enabled in this phase.

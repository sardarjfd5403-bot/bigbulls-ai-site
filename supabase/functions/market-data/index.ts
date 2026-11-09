// Twelve Data proxy for authenticated client market views.
// Deploy with Supabase CLI; keep TWELVE_DATA_API_KEY in Edge Function secrets.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const SYMBOLS = ["EUR/USD", "GBP/USD", "USD/JPY", "XAU/USD"];
// Warm-isolate cache reduces repeated provider calls; deploy a shared DB cache before high-volume public launch.
let cachedPayload: unknown = null;
let cachedAt = 0;
const CACHE_TTL_MS = 15 * 60 * 1000;
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" } });

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST required" }, 405);
  if (cachedPayload && Date.now() - cachedAt < CACHE_TTL_MS) return json(cachedPayload);
  const apiKey = Deno.env.get("TWELVE_DATA_API_KEY");
  if (!apiKey) return json({ error: "Market data provider key is not configured on the server." }, 503);

  try {
    const url = new URL("https://api.twelvedata.com/time_series");
    url.searchParams.set("symbol", SYMBOLS.join(","));
    url.searchParams.set("interval", "1min");
    url.searchParams.set("outputsize", "1");
    url.searchParams.set("apikey", apiKey);
    const upstream = await fetch(url, { headers: { Accept: "application/json" } });
    const payload = await upstream.json();
    if (!upstream.ok || payload.status === "error") {
      return json({ error: payload.message || "Twelve Data request failed", provider_code: payload.code || upstream.status }, upstream.status === 429 ? 429 : 502);
    }
    const rows: Record<string, unknown>[] = [];
    const blocks = Array.isArray(payload) ? payload : [payload];
    for (const block of blocks) {
      if (block?.meta?.symbol && Array.isArray(block.values)) {
        const latest = block.values[0];
        rows.push({ symbol: block.meta.symbol, datetime: latest.datetime, open: latest.open, high: latest.high, low: latest.low, close: latest.close, volume: latest.volume ?? null });
      } else if (block?.meta?.symbol && block?.values?.datetime) {
        rows.push({ symbol: block.meta.symbol, ...block.values });
      }
    }
    const result = { provider: "Twelve Data", interval: "1min", fetched_at: new Date().toISOString(), quotes: rows, note: "Market data only; not broker execution pricing." };
    cachedPayload = result;
    cachedAt = Date.now();
    return json(result);
  } catch (_error) {
    return json({ error: "Unable to reach market data provider." }, 502);
  }
});
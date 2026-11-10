// Public landing-page quote proxy. Keep TWELVE_DATA_API_KEY in Supabase Edge Function secrets.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://bigbullsglobalmarket.is-an.ai",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Vary": "Origin",
  "X-Content-Type-Options": "nosniff",
};
const SYMBOLS = ["EUR/USD", "GBP/USD", "USD/JPY", "XAU/USD", "NDX"];
let cachedPayload: unknown = null;
let cachedAt = 0;
const CACHE_TTL_MS = 60 * 1000;
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST required" }, 405);
  if (cachedPayload && Date.now() - cachedAt < CACHE_TTL_MS) return json(cachedPayload);

  const apiKey = Deno.env.get("TWELVE_DATA_API_KEY");
  if (!apiKey) return json({ error: "TWELVE_DATA_API_KEY is not configured in Supabase Edge Function secrets." }, 503);

  try {
    const quotes = await Promise.all(SYMBOLS.map(async (symbol) => {
      const url = new URL("https://api.twelvedata.com/quote");
      url.searchParams.set("symbol", symbol);
      url.searchParams.set("apikey", apiKey);
      const upstream = await fetch(url, { headers: { Accept: "application/json" } });
      const payload = await upstream.json();
      if (!upstream.ok || payload.status === "error" || payload.code) {
        return { symbol, error: payload.message || "Quote unavailable" };
      }
      const close = Number(payload.close);
      return {
        symbol,
        close: Number.isFinite(close) ? close : null,
        change: payload.change ?? null,
        percent_change: payload.percent_change ?? null,
        datetime: payload.datetime ?? null,
        is_market_open: payload.is_market_open ?? null,
      };
    }));
    const result = {
      provider: "Twelve Data",
      interval: "provider quote",
      fetched_at: new Date().toISOString(),
      quotes,
      note: "Indicative market quotes, not executable broker bid/ask prices.",
    };
    cachedPayload = result;
    cachedAt = Date.now();
    return json(result);
  } catch (_error) {
    return json({ error: "Unable to reach Twelve Data market provider." }, 502);
  }
});
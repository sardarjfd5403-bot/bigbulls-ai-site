import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const cors = {
  "Access-Control-Allow-Origin": "https://bigbullsglobalmarket.is-an.ai",
  "Access-Control-Allow-Headers": "content-type, x-bbook-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
  "X-Content-Type-Options": "nosniff",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
});
const SYMBOLS = new Set(["EURUSD","GBPUSD","USDJPY","XAUUSD","BTCUSDT","ETHUSDT","BNBUSDT","SOLUSDT","XRPUSDT","DOGEUSDT"]);
const normalize = (v: unknown) => String(v || "").toUpperCase().replaceAll("/", "").trim();
const category = (s: string) => s === "XAUUSD" ? "XAUUSD" : s.endsWith("USDT") ? "CRYPTO" : "FX";

async function getQuote(symbol: string, settings: any, url: string, anon: string) {
  if (!SYMBOLS.has(symbol)) throw new Error("Unsupported B-Book symbol: " + symbol);
  let mid = 0, provider = "";
  if (symbol.endsWith("USDT")) {
    const r = await fetch("https://data-api.binance.vision/api/v3/ticker/price?symbol=" + encodeURIComponent(symbol), { signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error("Crypto reference feed unavailable (" + r.status + ")");
    mid = Number((await r.json()).price);
    provider = "Binance Spot Reference";
  } else {
    const map: Record<string,string> = { EURUSD:"EUR/USD", GBPUSD:"GBP/USD", USDJPY:"USD/JPY", XAUUSD:"XAU/USD" };
    const r = await fetch(url + "/functions/v1/market-data", {
      method: "POST",
      headers: { "Content-Type":"application/json", apikey:anon, Authorization:"Bearer " + anon },
      body: JSON.stringify({ action:"quote", symbol:map[symbol] }),
      signal: AbortSignal.timeout(12000),
    });
    if (!r.ok) throw new Error("Market reference feed unavailable (" + r.status + ")");
    mid = Number((await r.json()).price);
    provider = "Twelve Data Indicative Reference";
  }
  if (!(mid > 0) || !Number.isFinite(mid)) throw new Error("Invalid reference price for " + symbol);
  const spreads = settings.spread_bps || {};
  const bps = Math.max(0, Math.min(100, Number(spreads[category(symbol)] ?? 2)));
  const half = bps / 20000;
  return { symbol, mid, bid:mid*(1-half), ask:mid*(1+half), spread_bps:bps, provider, quote_time:new Date().toISOString() };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers:cors });
  if (req.method !== "POST") return json({ error:"POST required" },405);
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SECRET_KEY");
    const anon = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    if (!url || !service || !anon) return json({ error:"Server credentials are not configured" },503);
    const db = createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
    const suppliedSecret = req.headers.get("x-bbook-secret") || "";
    const { data:config, error:configError } = await db.from("bb_bbook_worker_config").select("*").eq("singleton",true).single();
    if (configError || !config) return json({ error:"B-Book worker configuration unavailable" },503);
    if (!config.enabled) return json({ ok:true, paused:true, message:"B-Book risk worker is paused" });
    if (!suppliedSecret || suppliedSecret !== config.worker_secret) return json({ error:"Worker authentication failed" },401);

    const { data:settings, error:settingsError } = await db.from("bb_bbook_settings").select("*").eq("singleton",true).single();
    if (settingsError || !settings) throw settingsError || new Error("B-Book settings unavailable");
    const { data:openRows, error:positionsError } = await db.from("bb_bbook_positions")
      .select("*").eq("status","OPEN").order("opened_at",{ascending:true}).limit(5000);
    if (positionsError) throw positionsError;
    const open = openRows || [];
    const quotes: Record<string,any> = {};
    const errors: string[] = [];
    let closed = 0, processed = 0;

    for (const symbol of [...new Set(open.map((p:any)=>normalize(p.symbol)))]) {
      try {
        const q = await getQuote(symbol,settings,url,anon);
        quotes[symbol] = q;
        const { error } = await db.from("bb_bbook_quotes").upsert({
          symbol:q.symbol,mid:q.mid,bid:q.bid,ask:q.ask,spread_bps:q.spread_bps,
          provider:q.provider,quote_time:q.quote_time,updated_at:new Date().toISOString()
        });
        if (error) throw error;
      } catch (error) {
        errors.push(symbol + ": " + (error instanceof Error ? error.message : "quote error"));
      }
    }

    for (const p of open) {
      const q = quotes[normalize(p.symbol)];
      if (!q) continue;
      const exit = p.side === "BUY" ? q.bid : q.ask;
      let floating = (p.side === "BUY" ? exit-Number(p.entry_price) : Number(p.entry_price)-exit)
        * Number(p.quantity) * Number(p.contract_size);
      if (p.symbol === "USDJPY" && exit > 0) floating /= exit;
      const hitSl = p.side === "BUY" ? exit <= Number(p.stop_loss) : exit >= Number(p.stop_loss);
      const hitTp = p.side === "BUY" ? exit >= Number(p.take_profit) : exit <= Number(p.take_profit);
      if (hitSl || hitTp) {
        const result = await db.rpc("bb_bbook_close_position",{p:{
          user_id:p.user_id,position_id:p.id,exit_price:exit,bid:q.bid,ask:q.ask,
          reason:hitSl ? "STOP LOSS · SERVER RISK WORKER" : "TAKE PROFIT · SERVER RISK WORKER"
        }});
        if (result.error) errors.push("Close " + p.id + ": " + result.error.message);
        else closed++;
      } else {
        const result = await db.from("bb_bbook_positions").update({
          mark_price:q.mid,bid_price:q.bid,ask_price:q.ask,floating_pnl:floating
        }).eq("id",p.id).eq("status","OPEN");
        if (result.error) errors.push("Mark " + p.id + ": " + result.error.message);
      }
      processed++;
    }

    const { data:remainingRows, error:remainingError } = await db.from("bb_bbook_positions")
      .select("*").eq("status","OPEN").order("opened_at",{ascending:true}).limit(5000);
    if (remainingError) throw remainingError;
    const remaining = remainingRows || [];
    const accountIds = [...new Set(remaining.map((p:any)=>p.account_id))];
    const marginCalls: string[] = [];
    if (accountIds.length) {
      const { data:accounts, error:accountsError } = await db.from("trading_accounts")
        .select("id,balance").in("id",accountIds);
      if (accountsError) throw accountsError;
      for (const account of accounts || []) {
        const accountPositions = remaining.filter((p:any)=>p.account_id===account.id);
        const floating = accountPositions.reduce((n:number,p:any)=>n+Number(p.floating_pnl||0),0);
        const margin = accountPositions.reduce((n:number,p:any)=>n+Number(p.margin_used||0),0);
        const equity = Number(account.balance||0)+floating;
        const level = margin>0 ? equity/margin*100 : 0;
        if (margin>0 && level<=Number(settings.margin_call_level_pct||100)) marginCalls.push(account.id);
        if (margin>0 && level<=Number(settings.stop_out_level_pct||50)) {
          for (const p of [...accountPositions].sort((a:any,b:any)=>Number(a.floating_pnl)-Number(b.floating_pnl))) {
            const q = quotes[normalize(p.symbol)] || await getQuote(normalize(p.symbol),settings,url,anon);
            const exit = p.side==="BUY" ? q.bid : q.ask;
            const result = await db.rpc("bb_bbook_close_position",{p:{
              user_id:p.user_id,position_id:p.id,exit_price:exit,bid:q.bid,ask:q.ask,
              reason:"MARGIN STOP OUT · SERVER RISK WORKER"
            }});
            if (result.error) errors.push("Stop-out " + p.id + ": " + result.error.message);
            else closed++;
          }
        }
      }
    }

    const lastError = errors.length ? errors.slice(0,10).join(" | ").slice(0,1800) : null;
    const { error:updateError } = await db.from("bb_bbook_worker_config").update({
      last_run_at:new Date().toISOString(),last_error:lastError,last_processed:processed,
      last_closed:closed,margin_call_accounts:marginCalls,updated_at:new Date().toISOString()
    }).eq("singleton",true);
    if (updateError) throw updateError;
    return json({ok:true,processed,closed,margin_call_accounts:marginCalls.length,errors:errors.length,generated_at:new Date().toISOString()});
  } catch (error) {
    console.error("bbook-worker:",error);
    return json({error:error instanceof Error ? error.message : "B-Book worker failed"},500);
  }
});
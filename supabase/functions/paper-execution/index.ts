import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const ORIGIN = "https://bigbullsglobalmarket.is-an.ai";
const cors = {
  "Access-Control-Allow-Origin": ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
  "X-Content-Type-Options": "nosniff",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
const num = (v: unknown) => {
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error("A valid numeric value is required.");
  return n;
};
const normalize = (s: string) => s.toUpperCase().replaceAll("/", "");
const contract = (s: string) => ["EURUSD","GBPUSD","USDJPY"].includes(s) ? 100000 : s === "XAUUSD" ? 100 : 1;
const allowed = new Set(["EURUSD","GBPUSD","USDJPY","XAUUSD","BTCUSDT","ETHUSDT","BNBUSDT","SOLUSDT","XRPUSDT","DOGEUSDT"]);

async function quoteFor(symbol: string, supabaseUrl: string, anon: string): Promise<number> {
  const s = normalize(symbol);
  if (s.endsWith("USDT")) {
    const r = await fetch("https://api.binance.com/api/v3/ticker/price?symbol=" + encodeURIComponent(s), { signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error("Crypto quote provider unavailable (" + r.status + ").");
    const d = await r.json();
    const p = Number(d.price);
    if (!(p > 0)) throw new Error("Invalid crypto quote.");
    return p;
  }
  const r = await fetch(supabaseUrl + "/functions/v1/market-data", {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: anon, Authorization: "Bearer " + anon },
    body: "{}",
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) throw new Error("Market data service unavailable (" + r.status + ").");
  const d = await r.json();
  const q = (d.quotes || []).find((x: any) => normalize(String(x.symbol || "")) === s);
  const p = Number(q?.close);
  if (!(p > 0)) throw new Error("Fresh market quote unavailable for " + symbol + ".");
  return p;
}
function costs(symbol: string, side: string, qty: number, mid: number) {
  const s = normalize(symbol);
  const bps = s === "XAUUSD" ? 3 : s.endsWith("USDT") ? 8 : 1.2;
  const halfSpread = mid * bps / 20000;
  const slipPrice = mid * 0.5 / 10000;
  const adverse = halfSpread + slipPrice;
  const fill = side === "BUY" ? mid + adverse : mid - adverse;
  const size = contract(s);
  const spreadCost = halfSpread * qty * size;
  const slippage = slipPrice * qty * size;
  const commission = s.endsWith("USDT") ? mid * qty * 0.0005 : 3.5 * qty;
  return { fill, spread_cost: spreadCost, slippage, commission };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST required." }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const anon = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SECRET_KEY");
    if (!url || !anon || !service) return json({ error: "Server execution credentials are not configured." }, 503);
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Authentication required." }, 401);
    const auth = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: "Bearer " + token } } });
    const { data: authData, error: authError } = await auth.auth.getUser(token);
    if (authError || !authData.user) return json({ error: "Invalid or expired session." }, 401);
    const user = authData.user;
    const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "status");
    const accountId = body.account_id ? String(body.account_id) : null;
    let account: any = null;
    const mode = String(body.account_mode || (accountId ? "" : "demo"));
    if (!["demo","real"].includes(mode)) return json({ error: "Unsupported account mode." }, 400);
    if (accountId) {
      const { data, error } = await auth.from("trading_accounts")
        .select("id,user_id,account_mode,status,currency,archived_at,deleted_at")
        .eq("id", accountId).eq("user_id", user.id).maybeSingle();
      if (error) throw error;
      account = data;
      if (!account || account.account_mode !== mode || account.status !== "approved" || account.archived_at || account.deleted_at) {
        return json({ error: "Approved account not found or account access is restricted." }, 403);
      }
    } else if (mode !== "demo") {
      return json({ error: "A linked approved Real account is required." }, 400);
    }
    if (mode === "real") {
      const { data: isAdmin, error: adminCheckError } = await auth.rpc("is_bigbulls_admin");
      if (adminCheckError) throw adminCheckError;
      if (isAdmin !== true) {
        const [{ data: aal, error: aalError }, { data: kyc, error: kycError }] = await Promise.all([
          auth.auth.mfa.getAuthenticatorAssuranceLevel(),
          auth.from("kyc_submissions").select("status").eq("user_id", user.id).eq("status", "approved").maybeSingle()
        ]);
        if (aalError) throw aalError;
        if (kycError) throw kycError;
        if (aal?.currentLevel !== "aal2" || !kyc) {
          return json({ error: "Real-account test execution requires approved KYC and an AAL2-authenticated session.", code: "KYC_AAL2_REQUIRED" }, 403);
        }
      }
    }

    const { data: settings, error: settingsError } = await admin.from("bb_execution_settings")
      .select("paper_execution_enabled,demo_execution_enabled,global_halt,max_risk_per_trade_pct,max_daily_loss_pct,max_aggregate_risk_pct,max_open_positions")
      .eq("singleton", true).single();
    if (settingsError) throw settingsError;
    if (settings.global_halt || !settings.paper_execution_enabled || (mode === "demo" && !settings.demo_execution_enabled)) {
      return json({ error: "Paper execution is currently disabled by the administrator.", code: "EXECUTION_HALTED" }, 423);
    }

    const { error: ledgerError } = await admin.from("bb_paper_execution_accounts")
      .upsert({ account_id: accountId, user_id: user.id, account_mode: mode },
        { onConflict: "user_id,account_mode,account_id", ignoreDuplicates: true });
    if (ledgerError) throw ledgerError;
    let ledgerQuery = admin.from("bb_paper_execution_accounts").select("*").eq("user_id", user.id).eq("account_mode", mode);
    ledgerQuery = accountId ? ledgerQuery.eq("account_id", accountId) : ledgerQuery.is("account_id", null);
    const { data: ledger, error: readLedgerError } = await ledgerQuery.single();
    if (readLedgerError) throw readLedgerError;

    if (action === "status" || action === "refresh") {
      const { data: trades, error: tradesError } = await admin.from("bb_paper_execution_trades")
        .select("*").eq("paper_account_id", ledger.id).eq("user_id", user.id).order("opened_at", { ascending: false }).limit(500);
      if (tradesError) throw tradesError;
      const open = (trades || []).filter((t: any) => t.status === "OPEN");
      const prices: Record<string, number> = {};
      for (const s of [...new Set(open.map((t: any) => t.symbol))] as string[]) {
        try { prices[s] = await quoteFor(s, url, anon); } catch (_) { /* stale quote fails closed for mark updates */ }
      }
      for (const t of open) {
        const mid = prices[t.symbol];
        if (!(mid > 0)) continue;
        const side = t.side;
        const hitSl = side === "BUY" ? mid <= Number(t.stop_loss) : mid >= Number(t.stop_loss);
        const hitTp = t.take_profit != null && Number(t.take_profit) > 0 &&
          (side === "BUY" ? mid >= Number(t.take_profit) : mid <= Number(t.take_profit));
        if (hitSl || hitTp) {
          const c = costs(t.symbol, side === "BUY" ? "SELL" : "BUY", Number(t.quantity), mid);
          const { error } = await admin.rpc("bb_paper_close_position", {
            p: { user_id: user.id, paper_account_id: ledger.id, trade_id: t.id, exit_price: c.fill,
              spread_cost: c.spread_cost, commission: c.commission, slippage: c.slippage,
              reason: hitSl ? "STOP LOSS" : "TAKE PROFIT" }
          });
          if (error) throw error;
        } else {
          const floating = (side === "BUY" ? mid - Number(t.entry_price) : Number(t.entry_price) - mid) *
            Number(t.quantity) * contract(normalize(t.symbol));
          const { error } = await admin.from("bb_paper_execution_trades").update({ mark_price: mid, unrealized_pnl: floating })
            .eq("id", t.id).eq("paper_account_id", ledger.id).eq("status", "OPEN");
          if (error) throw error;
        }
      }
      const [{ data: freshLedger, error: freshLedgerError }, { data: freshTrades, error: freshTradesError }] = await Promise.all([
        admin.from("bb_paper_execution_accounts").select("*").eq("id", ledger.id).single(),
        admin.from("bb_paper_execution_trades").select("*").eq("paper_account_id", ledger.id).eq("user_id", user.id).order("opened_at", { ascending: false }).limit(500)
      ]);
      if (freshLedgerError || freshTradesError) throw freshLedgerError || freshTradesError;
      return json({ account: { id: accountId, account_mode: mode, currency: account?.currency || "USD" },
        execution: { mode: "PAPER", label: "Paper execution · testing only", broker_routing: false, paper_enabled: true },
        ledger: freshLedger, trades: freshTrades || [], prices, generated_at: new Date().toISOString() });
    }

    if (action === "open") {
      const source = String(body.source || "MANUAL");
      if (source.toUpperCase().startsWith("AI") && ledger.auto_enabled !== true) {
        return json({ error: "AI automation is not enabled for this account.", code: "AUTO_DISABLED" }, 423);
      }
      const symbol = String(body.symbol || "");
      const normalized = normalize(symbol);
      const side = String(body.side || "").toUpperCase();
      const quantity = num(body.quantity);
      const sl = num(body.stop_loss);
      const tp = body.take_profit == null || body.take_profit === "" ? null : num(body.take_profit);
      if (!allowed.has(normalized)) return json({ error: "Instrument is not enabled for this paper engine." }, 400);
      if (!["BUY","SELL"].includes(side) || quantity <= 0) return json({ error: "Invalid side or quantity." }, 400);
      const mid = await quoteFor(normalized, url, anon);
      const c = costs(normalized, side, quantity, mid);
      if ((side === "BUY" && sl >= c.fill) || (side === "SELL" && sl <= c.fill)) return json({ error: "Stop loss must be beyond the current market price." }, 400);
      if (tp != null && ((side === "BUY" && tp <= c.fill) || (side === "SELL" && tp >= c.fill))) return json({ error: "Take profit must be beyond the current market price." }, 400);
      const { data, error } = await admin.rpc("bb_paper_open_position", {
        p: { user_id: user.id, account_id: accountId, paper_account_id: ledger.id, account_mode: mode, symbol: normalized,
          side, quantity, fill_price: c.fill, stop_loss: sl, take_profit: tp,
          spread_cost: c.spread_cost, commission: c.commission, slippage: c.slippage,
          source: source.slice(0,80) }
      });
      if (error) throw error;
      return json({ success: true, ...data, quote: mid, execution: { mode: "PAPER", broker_routing: false } });
    }

    if (action === "close") {
      const tradeId = String(body.trade_id || "");
      const { data: trade, error: tradeError } = await auth.from("bb_paper_execution_trades")
        .select("id,symbol,side,quantity").eq("id", tradeId).eq("paper_account_id", ledger.id).eq("status","OPEN").maybeSingle();
      if (tradeError) throw tradeError;
      if (!trade) return json({ error: "Open paper position not found." }, 404);
      const mid = await quoteFor(trade.symbol, url, anon);
      const c = costs(trade.symbol, trade.side === "BUY" ? "SELL" : "BUY", Number(trade.quantity), mid);
      const { data, error } = await admin.rpc("bb_paper_close_position", {
        p: { user_id: user.id, paper_account_id: ledger.id, trade_id: trade.id, exit_price: c.fill,
          spread_cost: c.spread_cost, commission: c.commission, slippage: c.slippage,
          reason: String(body.reason || "MANUAL CLOSE").slice(0,100) }
      });
      if (error) throw error;
      return json({ success: true, ...data, quote: mid, execution: { mode: "PAPER", broker_routing: false } });
    }

    if (action === "auto_toggle") {
      const enabled = body.enabled === true;
      const { error } = await admin.from("bb_paper_execution_accounts")
        .update({ auto_enabled: enabled, emergency_stop: enabled ? false : ledger.emergency_stop, updated_at: new Date().toISOString() })
        .eq("id", ledger.id).eq("user_id", user.id);
      if (error) throw error;
      return json({ success: true, auto_enabled: enabled, execution_mode: "PAPER" });
    }
    if (action === "stop") {
      const { error } = await admin.from("bb_paper_execution_accounts")
        .update({ auto_enabled: false, emergency_stop: true, updated_at: new Date().toISOString() })
        .eq("id", ledger.id).eq("user_id", user.id);
      if (error) throw error;
      return json({ success: true, emergency_stop: true, auto_enabled: false });
    }
    if (action === "modify") {
      const tradeId = String(body.trade_id || "");
      const { data: trade, error: tradeError } = await auth.from("bb_paper_execution_trades")
        .select("id,side,mark_price,entry_price").eq("id", tradeId).eq("paper_account_id", ledger.id).eq("status","OPEN").maybeSingle();
      if (tradeError) throw tradeError;
      if (!trade) return json({ error: "Open paper position not found." }, 404);
      const sl = num(body.stop_loss);
      const tp = body.take_profit == null || body.take_profit === "" ? null : num(body.take_profit);
      const current = Number(trade.mark_price || trade.entry_price);
      if ((trade.side === "BUY" && sl >= current) || (trade.side === "SELL" && sl <= current)) return json({ error: "Invalid stop loss." }, 400);
      if (tp != null && ((trade.side === "BUY" && tp <= current) || (trade.side === "SELL" && tp >= current))) return json({ error: "Invalid take profit." }, 400);
      const { error } = await admin.from("bb_paper_execution_trades").update({ stop_loss: sl, take_profit: tp })
        .eq("id", tradeId).eq("paper_account_id", ledger.id).eq("status","OPEN");
      if (error) throw error;
      return json({ success: true });
    }
    return json({ error: "Unsupported action." }, 400);
  } catch (e) {
    console.error("paper-execution:", e);
    return json({ error: e instanceof Error ? e.message : "Paper execution error." }, 400);
  }
});
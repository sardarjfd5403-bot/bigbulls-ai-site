import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const ORIGIN = "https://bigbullsglobalmarket.is-an.ai";
const cors = {
  "Access-Control-Allow-Origin": ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
  "X-Content-Type-Options": "nosniff",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
});
const CONTRACT_SIZES: Record<string,number> = {
  EURUSD:100000,GBPUSD:100000,USDJPY:100000,
  USDCAD:1,AUDUSD:1,NZDUSD:1,USDCHF:1,EURGBP:1,EURJPY:1,GBPJPY:1,
  XAUUSD:100,XAGUSD:5000,XPTUSD:1,XPDUSD:1,
  US30:1,USTEC:1,US500:1,DE30:1,UK100:1,JP225:1,DXY:1,
  USOIL:1,UKOIL:1,NATGASUSDT:1,
  BTCUSDT:1,ETHUSDT:1,SOLUSDT:1,XRPUSDT:1,BNBUSDT:1
};
const CRYPTO_SYMBOLS = new Set(["BTCUSDT","ETHUSDT","SOLUSDT","XRPUSDT","BNBUSDT"]);
const SYMBOLS = new Set(Object.keys(CONTRACT_SIZES));
const normalize = (v: unknown) => String(v || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const contractSize = (s: string) => CONTRACT_SIZES[s] || 0;
const marketOpen = (symbol: string, now = new Date(), holidays: Set<string> = new Set()) => {
  if (CRYPTO_SYMBOLS.has(normalize(symbol))) return true;
  const day = now.getUTCDay();
  return day >= 1 && day <= 5 && !holidays.has(now.toISOString().slice(0,10));
};
const category = (s: string) => CRYPTO_SYMBOLS.has(s) ? "CRYPTO" : ["XAUUSD","XAGUSD","XPTUSD","XPDUSD"].includes(s) ? "XAUUSD" : ["USOIL","UKOIL","NATGASUSDT"].includes(s) ? "COMMODITY" : ["US30","USTEC","US500","DE30","UK100","JP225","DXY"].includes(s) ? "INDEX" : "FX";
const num = (v: unknown, label: string) => {
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(label + " must be a valid number.");
  return n;
};
const adminCheck = async (auth: any) => {
  const { data, error } = await auth.rpc("is_bigbulls_admin");
  if (error) throw error;
  if (data !== true) throw new Error("Admin permission required.");
};

async function quote(symbol: string, settings: any, url: string, anon: string, db: any) {
  if (!SYMBOLS.has(symbol)) throw new Error("Instrument is not enabled for B-Book execution.");
  try {
    let mid = 0, provider = "";
    if (CRYPTO_SYMBOLS.has(symbol)) {
      const r = await fetch("https://data-api.binance.vision/api/v3/ticker/price?symbol=" + encodeURIComponent(symbol), { signal: AbortSignal.timeout(8000) });
      if (!r.ok) throw new Error("Crypto reference feed unavailable (" + r.status + ").");
      const d = await r.json();
      mid = Number(d.price); provider = "Binance Spot Reference";
    } else {
      const map: Record<string,string> = { EURUSD:"EUR/USD",GBPUSD:"GBP/USD",USDJPY:"USD/JPY",USDCAD:"USD/CAD",AUDUSD:"AUD/USD",NZDUSD:"NZD/USD",USDCHF:"USD/CHF",EURGBP:"EUR/GBP",EURJPY:"EUR/JPY",GBPJPY:"GBP/JPY",XAUUSD:"XAU/USD",XAGUSD:"XAG/USD",XPTUSD:"XPT/USD",XPDUSD:"XPD/USD",US30:"US30",USTEC:"USTEC",US500:"US500",DE30:"DE30",UK100:"UK100",JP225:"JP225",DXY:"DXY",USOIL:"USOIL",UKOIL:"UKOIL",NATGASUSDT:"NATGASUSDT" };
      const request = {
        method: "POST",
        headers: { "Content-Type":"application/json", apikey:anon, Authorization:"Bearer " + anon },
        body: JSON.stringify({ action:"quote", symbol:map[symbol] }),
        signal: AbortSignal.timeout(7000),
      };
      let r: Response;
      try {
        r = await fetch(url + "/functions/v1/market-data", request);
      } catch (fetchError) {
        throw new Error("Market reference feed request failed: " + (fetchError instanceof Error ? fetchError.message : "network error"));
      }
      if (!r.ok) throw new Error("Market reference feed unavailable (" + r.status + ").");
      const d = await r.json();
      mid = Number(d.price); provider = String(d.provider || "Twelve Data Indicative Reference");
    }
    if (!(mid > 0) || !Number.isFinite(mid)) throw new Error("A valid market reference price was not returned.");
    const spreads = settings.spread_bps || {};
    const bps = Math.max(0, Math.min(100, Number(spreads[category(symbol)] ?? 2)));
    const half = bps / 20000;
    const bid = mid * (1 - half), ask = mid * (1 + half);
    return { symbol, mid, bid, ask, spread_bps:bps, provider, quote_time:new Date().toISOString(), fallback:provider.includes("Cache Fallback") };
  } catch (feedError) {
    const reason = feedError instanceof Error ? feedError.message : "upstream market feed failure";
    const { data: cached, error: cacheError } = await db.from("bb_bbook_quotes")
      .select("symbol,mid,bid,ask,spread_bps,provider,quote_time")
      .eq("symbol", symbol).maybeSingle();
    const quoteAgeMs = cached?.quote_time ? Date.now() - Date.parse(cached.quote_time) : Number.POSITIVE_INFINITY;
    const maxCacheAgeMs = 90_000;
    const validCached = !cacheError && cached &&
      Number(cached.mid) > 0 && Number(cached.bid) > 0 && Number(cached.ask) > 0 &&
      Number(cached.bid) <= Number(cached.mid) && Number(cached.mid) <= Number(cached.ask) &&
      Number.isFinite(quoteAgeMs) && quoteAgeMs >= 0 && quoteAgeMs <= maxCacheAgeMs;
    if (validCached) {
      console.warn("B-Book using fresh quote-cache fallback", { symbol, quote_age_ms:quoteAgeMs, upstream_error:reason });
      return {
        symbol, mid:Number(cached.mid), bid:Number(cached.bid), ask:Number(cached.ask),
        spread_bps:Number(cached.spread_bps || 0),
        provider:"Supabase Quote Cache Fallback (" + String(cached.provider || "last valid provider") + ")",
        quote_time:cached.quote_time, fallback:true, quote_age_ms:quoteAgeMs,
      };
    }
    const ageText = Number.isFinite(quoteAgeMs) ? Math.round(quoteAgeMs) + "ms" : "unavailable";
    throw new Error(reason + "; no valid quote cache within 90 seconds (cache age: " + ageText + "). Execution safely stopped rather than using stale pricing.");
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers:cors });
  if (req.method !== "POST") return json({ error:"POST required." },405);
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const anon = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SECRET_KEY");
    if (!url || !anon || !service) return json({ error:"Server credentials are not configured." },503);
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i,"");
    if (!token) return json({ error:"Authentication required." },401);
    const auth = createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:"Bearer "+token}}});
    const { data: authData, error: authError } = await auth.auth.getUser(token);
    if (authError || !authData.user) return json({ error:"Invalid or expired session." },401);
    const user = authData.user;
    const db = createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
    const body = await req.json().catch(()=>({}));
    const action = String(body.action || "status");
    const { data: settings, error: settingsError } = await db.from("bb_bbook_settings").select("*").eq("singleton",true).single();
    if (settingsError) throw settingsError;
    const { data: holidayRows, error: holidayError } = await db.from("market_holidays").select("holiday_date").eq("is_closed",true).eq("market_scope","GLOBAL");
    if (holidayError) throw holidayError;
    const holidayDates = new Set<string>((holidayRows || []).map((row:any) => String(row.holiday_date).slice(0,10)));
    const isMarketOpen = (symbol:string, now=new Date()) => marketOpen(symbol,now,holidayDates);


    if (action.startsWith("admin_")) {
      await adminCheck(auth);
      if (action === "admin_status") {
        const [{data:pool,error:poolError},{data:positions,error:posError}] = await Promise.all([
          db.from("bb_bbook_liquidity_pool").select("*").eq("singleton",true).single(),
          db.from("bb_bbook_positions").select("*,trading_accounts(account_number,display_name)").eq("status","OPEN").order("opened_at",{ascending:false}).limit(500),
        ]);
        if (poolError || posError) throw poolError || posError;
        const exposure = (positions || []).reduce((n:any,p:any)=>n + (p.symbol==="USDJPY"?Number(p.quantity)*Number(p.contract_size):Number(p.entry_price)*Number(p.quantity)*Number(p.contract_size)),0);
        const floating = (positions || []).reduce((n:any,p:any)=>n + Number(p.floating_pnl||0),0);
        const {data:ledger,error:ledgerError} = await db.from("bb_bbook_liquidity_ledger").select("*").order("created_at",{ascending:false}).limit(100);
        if (ledgerError) throw ledgerError;
        const {data:worker,error:workerError} = await db.from("bb_bbook_worker_config")
          .select("enabled,last_run_at,last_error,last_processed,last_closed,margin_call_accounts")
          .eq("singleton",true).single();
        if (workerError) throw workerError;
        return json({settings,pool,worker,positions:positions||[],ledger:ledger||[],metrics:{open_positions:(positions||[]).length,gross_exposure:exposure,floating_client_pnl:floating,house_net_pnl:-floating}});
      }
      if (action === "admin_worker_toggle") {
        const enabled = body.enabled === true;
        const {data:worker,error} = await db.from("bb_bbook_worker_config")
          .update({enabled,updated_at:new Date().toISOString()})
          .eq("singleton",true)
          .select("enabled,last_run_at,last_error,last_processed,last_closed,margin_call_accounts").single();
        if (error) throw error;
        await db.from("bb_trade_audit_events").insert({
          actor_user_id:user.id,event_type:enabled?"BBOOK_RISK_WORKER_ENABLED":"BBOOK_RISK_WORKER_PAUSED",
          entity_type:"bbook_worker_config",details:{enabled}
        });
        return json({success:true,worker});
      }
      if (action === "admin_adjust_liquidity") {
        const amount = num(body.amount,"Amount");
        const direction = String(body.direction||"").toUpperCase();
        const note = String(body.note||"").trim();
        if (!(amount>0) || !["DEPOSIT","WITHDRAWAL"].includes(direction)) return json({error:"Choose a valid deposit or withdrawal amount."},400);
        if(note.length<8)return json({error:"An audit note with a verified funding or withdrawal reference is required."},400);
        const {data,error} = await db.rpc("bb_bbook_adjust_liquidity",{p_amount:amount,p_direction:direction,p_actor:user.id,p_note:note.slice(0,250)});
        if(error)throw error;
        return json({success:true,pool:data});
      }
      if (action === "admin_update_settings") {
        const patch:any = {updated_at:new Date().toISOString(),updated_by:user.id};
        if(body.default_leverage!==undefined){const v=Math.floor(num(body.default_leverage,"Default leverage"));if(v<1||v>500)throw new Error("Default leverage must be between 1 and 500.");patch.default_leverage=v;}
        if(body.max_leverage!==undefined){const v=Math.floor(num(body.max_leverage,"Maximum leverage"));if(v<1||v>1000)throw new Error("Maximum leverage must be between 1 and 1000.");patch.max_leverage=v;}
        if(body.spread_bps!==undefined){
          const spread=body.spread_bps;
          if(!spread||typeof spread!=="object")throw new Error("Spread configuration must be an object.");
          for(const k of ["FX","XAUUSD","CRYPTO"])if(spread[k]!==undefined&&(!Number.isFinite(Number(spread[k]))||Number(spread[k])<0||Number(spread[k])>100))throw new Error("Spread markup must be between 0 and 100 bps.");
          patch.spread_bps={...settings.spread_bps,...spread};
        }
        if(body.margin_call_level_pct!==undefined){const v=num(body.margin_call_level_pct,"Margin call level");if(v<50||v>1000)throw new Error("Margin call level must be 50–1000%.");patch.margin_call_level_pct=v;}
        if(body.stop_out_level_pct!==undefined){const v=num(body.stop_out_level_pct,"Stop-out level");if(v<10||v>100)throw new Error("Stop-out level must be 10–100%.");patch.stop_out_level_pct=v;}
        if(body.enabled===true){
          const {data:execution,error}=await db.from("bb_execution_settings").select("live_execution_enabled,global_halt,live_readiness").eq("singleton",true).single();
          if(error)throw error;
          const checks=execution.live_readiness||{};
          const required=["liquidity_verified","settlement_verified","regulatory_authorized","client_funds_controls_verified","reconciliation_verified"];
          if(execution.live_execution_enabled!==true||execution.global_halt||required.some(k=>checks[k]!==true)||Deno.env.get("BBOOK_LIVE_EXECUTION_ADAPTER_READY")!=="true"){
            throw new Error("B-Book cannot be enabled: live execution, regulatory, liquidity, settlement, client-funds, reconciliation and adapter checks must all be verified.");
          }
          patch.enabled=true;
        }
        if(body.enabled===false)patch.enabled=false;
        const {data,error}=await db.from("bb_bbook_settings").update(patch).eq("singleton",true).select("*").single();
        if(error)throw error;
        await db.from("bb_trade_audit_events").insert({actor_user_id:user.id,event_type:"BBOOK_SETTINGS_UPDATED",entity_type:"bbook_settings",details:patch});
        return json({success:true,settings:data});
      }
      return json({error:"Unsupported B-Book admin action."},400);
    }

    if (action === "quote") {
      const symbol=normalize(body.symbol);
      const q=await quote(symbol,settings,url,anon,db);
      await db.from("bb_bbook_quotes").upsert({symbol:q.symbol,mid:q.mid,bid:q.bid,ask:q.ask,spread_bps:q.spread_bps,provider:q.provider,quote_time:q.quote_time,updated_at:new Date().toISOString()});
      return json({quote:q,execution_mode:"BBOOK_REFERENCE"});
    }

    const accountId=String(body.account_id||"");
    if(!accountId)return json({error:"A linked REAL account is required."},400);
    const {data:account,error:accountError}=await auth.from("trading_accounts")
      .select("id,user_id,account_mode,status,currency,balance,requested_leverage,archived_at,deleted_at")
      .eq("id",accountId).eq("user_id",user.id).maybeSingle();
    if(accountError)throw accountError;
    if(!account||account.account_mode!=="real"||account.status!=="approved"||account.archived_at||account.deleted_at)return json({error:"Approved REAL account not found."},403);

    if(action==="pending"){
      if(!settings.enabled)return json({error:"B-Book execution is not enabled."},423);
      const symbol=normalize(body.symbol),side=String(body.side||"").toUpperCase();
      if (!isMarketOpen(symbol)) return json({error:"Market is closed for this instrument. New orders resume Monday 00:00 UTC.",code:"MARKET_CLOSED"},423);
       const orderType=String(body.order_type||"").toUpperCase(),quantity=num(body.quantity,"Lot size");
      const target=num(body.target_price,"Target price");
      const sl=body.stop_loss==null||body.stop_loss===""?null:num(body.stop_loss,"Stop Loss");
      const tp=body.take_profit==null||body.take_profit===""?null:num(body.take_profit,"Take Profit");
      if(!["BUY","SELL"].includes(side)||quantity<=0)return json({error:"Invalid side or lot size."},400);
      const q=await quote(symbol,settings,url,anon,db);
      if(q.fallback)throw new Error("A fresh live quote is required to place a pending order. Cached prices are display-only.");
      const size=contractSize(symbol);
      const {data,error}=await db.rpc("bb_bbook_create_pending_order",{p:{
        user_id:user.id,account_id:accountId,symbol,side,order_type:orderType,quantity,
        contract_size:size,target_price:target,stop_loss:sl,take_profit:tp
      }});
      if(error)throw error;
      await db.from("bb_bbook_quotes").upsert({symbol,mid:q.mid,bid:q.bid,ask:q.ask,spread_bps:q.spread_bps,provider:q.provider,quote_time:q.quote_time,updated_at:new Date().toISOString()});
      return json({success:true,...data,quote:q});
    }

    if(action==="open"){
      if(!settings.enabled)return json({error:"In-house B-Book REAL execution is locked by Admin and compliance controls.",code:"BBOOK_LOCKED"},423);
      const symbol=normalize(body.symbol),side=String(body.side||"").toUpperCase(),quantity=num(body.quantity,"Lot size");
      const sl=body.stop_loss==null||body.stop_loss===""?null:num(body.stop_loss,"Stop Loss"),tp=body.take_profit==null||body.take_profit===""?null:num(body.take_profit,"Take Profit");
      if(!["BUY","SELL"].includes(side)||quantity<=0)return json({error:"Invalid side or lot size."},400);
      if(!marketOpen(symbol))return json({error:"Market is closed for this instrument. New orders resume Monday 00:00 UTC.",code:"MARKET_CLOSED"},423);
      const q=await quote(symbol,settings,url,anon,db);
      if(q.fallback)throw new Error("A fresh live quote is required to execute a REAL order. Cached prices are display-only.");
      const size=contractSize(symbol);
      const spreadCost=(q.ask-q.bid)*quantity*size;
      const {data,error}=await db.rpc("bb_bbook_open_position",{p:{user_id:user.id,account_id:accountId,symbol,side,quantity,contract_size:size,mid:q.mid,bid:q.bid,ask:q.ask,stop_loss:sl,take_profit:tp,spread_cost:spreadCost}});
      if(error)throw error;
      await db.from("bb_bbook_quotes").upsert({symbol,mid:q.mid,bid:q.bid,ask:q.ask,spread_bps:q.spread_bps,provider:q.provider,quote_time:q.quote_time,updated_at:new Date().toISOString()});
      return json({success:true,...data,quote:q});
    }

    if(action==="close"){
      const positionId=String(body.position_id||"");
      const {data:position,error}=await auth.from("bb_bbook_positions").select("id,symbol,side,quantity,contract_size").eq("id",positionId).eq("account_id",accountId).eq("user_id",user.id).eq("status","OPEN").maybeSingle();
      if(error)throw error;
      if(!position)return json({error:"Open B-Book position not found."},404);
      if(!marketOpen(position.symbol))return json({error:"Market is closed for this instrument. Position settlement will resume when the market reopens.",code:"MARKET_CLOSED"},423);
      const q=await quote(position.symbol,settings,url,anon,db);
      if(q.fallback)throw new Error("A fresh live quote is required to close a REAL position. Cached prices cannot be used for settlement.");
      const exit=position.side==="BUY"?q.bid:q.ask;
      let conversionRate:number|null=null;
      if(position.symbol.endsWith("JPY")&&position.symbol!=="USDJPY")conversionRate=(await quote("USDJPY",settings,url,anon,db)).mid;
      else if(position.symbol==="EURGBP")conversionRate=(await quote("GBPUSD",settings,url,anon,db)).mid;
      const {data,error:closeError}=await db.rpc("bb_bbook_close_position",{p:{user_id:user.id,position_id:positionId,exit_price:exit,bid:q.bid,ask:q.ask,conversion_rate:conversionRate,reason:String(body.reason||"MANUAL CLOSE").slice(0,100)}});
      if(closeError)throw closeError;
      return json({success:true,...data,quote:q});
    }

    if(action==="cancel_pending"){
      const orderId=String(body.order_id||"");
      const {data:order,error:orderError}=await auth.from("bb_bbook_pending_orders")
        .select("id,status").eq("id",orderId).eq("account_id",accountId).eq("user_id",user.id).maybeSingle();
      if(orderError)throw orderError;
      if(!order||order.status!=="PENDING")return json({error:"Pending order not found."},404);
      const {data:cancelled,error}=await db.rpc("bb_bbook_cancel_pending_order",{p_order_id:orderId,p_user_id:user.id});
      if(error)throw error;
      if(cancelled!==true)return json({error:"Pending order could not be cancelled."},409);
      return json({success:true,order_id:orderId,status:"CANCELLED"});
    }

    if(action==="status"||action==="refresh"){
      const {data:positions,error:positionsError}=await db.from("bb_bbook_positions").select("*").eq("account_id",accountId).eq("user_id",user.id).order("opened_at",{ascending:false}).limit(500);
      if(positionsError)throw positionsError;
      const open=(positions||[]).filter((p:any)=>p.status==="OPEN");
      const quotes:any={};
      const quoteSymbols=[...new Set(open.map((p:any)=>p.symbol))] as string[];
      if(open.some((p:any)=>p.symbol.endsWith("JPY")&&p.symbol!=="USDJPY"))quoteSymbols.push("USDJPY");
      if(open.some((p:any)=>p.symbol==="EURGBP"))quoteSymbols.push("GBPUSD");
      await Promise.all([...new Set(quoteSymbols)].filter(marketOpen).map(async symbol=>{
        try{
          quotes[symbol]=await quote(symbol,settings,url,anon,db);
          const {error}=await db.from("bb_bbook_quotes").upsert({symbol,mid:quotes[symbol].mid,bid:quotes[symbol].bid,ask:quotes[symbol].ask,spread_bps:quotes[symbol].spread_bps,provider:quotes[symbol].provider,quote_time:quotes[symbol].quote_time,updated_at:new Date().toISOString()});
          if(error)console.warn("B-Book quote cache write:",symbol,error);
        }catch(e){console.warn("B-Book quote:",symbol,e);}
      }));
      await Promise.all(open.map(async p=>{
        const q=quotes[p.symbol];if(!q||q.fallback)return;
        const exit=p.side==="BUY"?q.bid:q.ask;
        let floating=(p.side==="BUY"?exit-Number(p.entry_price):Number(p.entry_price)-exit)*Number(p.quantity)*Number(p.contract_size);if(p.symbol==="USDJPY"||p.symbol==="USDCAD"||p.symbol==="USDCHF"){if(exit>0)floating/=exit;}
        else if(p.symbol.endsWith("JPY")){const fx=quotes["USDJPY"]?.mid;if(Number(fx)>0)floating/=Number(fx);}
        else if(p.symbol==="EURGBP"){const fx=quotes["GBPUSD"]?.mid;if(Number(fx)>0)floating*=Number(fx);}
        const hitSl=p.stop_loss!=null&&(p.side==="BUY"?exit<=Number(p.stop_loss):exit>=Number(p.stop_loss));
        const hitTp=p.take_profit!=null&&(p.side==="BUY"?exit>=Number(p.take_profit):exit<=Number(p.take_profit));
        if(hitSl||hitTp){
          const conversionRate=p.symbol.endsWith("JPY")&&p.symbol!=="USDJPY"?quotes["USDJPY"]?.mid:p.symbol==="EURGBP"?quotes["GBPUSD"]?.mid:null;
          const {error}=await db.rpc("bb_bbook_close_position",{p:{user_id:user.id,position_id:p.id,exit_price:exit,bid:q.bid,ask:q.ask,conversion_rate:conversionRate,reason:hitSl?"STOP LOSS":"TAKE PROFIT"}});
          if(error)console.error("B-Book automatic close failed:",p.id,error);
        }else{
          const {error}=await db.from("bb_bbook_positions").update({mark_price:q.mid,bid_price:q.bid,ask_price:q.ask,floating_pnl:floating}).eq("id",p.id).eq("status","OPEN").eq("user_id",user.id);
          if(error)throw error;
        }
      }));
      let {data:fresh,error:freshError}=await db.from("bb_bbook_positions").select("*").eq("account_id",accountId).eq("user_id",user.id).order("opened_at",{ascending:false}).limit(500);
      if(freshError)throw freshError;
      const active=(fresh||[]).filter((p:any)=>p.status==="OPEN");
      const floating=active.reduce((n:number,p:any)=>n+Number(p.floating_pnl||0),0);
      const margin=active.reduce((n:number,p:any)=>n+Number(p.margin_used||0),0);
      const balance=Number(account.balance||0),equity=balance+floating;
      const marginLevel=margin>0?equity/margin*100:0;
      if(active.length&&margin>0&&marginLevel<=Number(settings.stop_out_level_pct||50)){
        for(const p of [...active].sort((a:any,b:any)=>Number(a.floating_pnl)-Number(b.floating_pnl))){
          if (!isMarketOpen(p.symbol)) continue;
          const q=quotes[p.symbol]||await quote(p.symbol,settings,url,anon,db);
          if(q.fallback)continue;
          const exit=p.side==="BUY"?q.bid:q.ask;
          const conversionRate=p.symbol.endsWith("JPY")&&p.symbol!=="USDJPY"?quotes["USDJPY"]?.mid:p.symbol==="EURGBP"?quotes["GBPUSD"]?.mid:null;
          const {error}=await db.rpc("bb_bbook_close_position",{p:{user_id:user.id,position_id:p.id,exit_price:exit,bid:q.bid,ask:q.ask,conversion_rate:conversionRate,reason:"MARGIN STOP OUT"}});
          if(error)console.error("B-Book stop-out close failed:",p.id,error);
        }
        const refreshed=await db.from("bb_bbook_positions").select("*").eq("account_id",accountId).eq("user_id",user.id).order("opened_at",{ascending:false}).limit(500);
        if(refreshed.error)throw refreshed.error;
        fresh=refreshed.data;
      }
      const {data:latestAccount,error:latestAccountError}=await db.from("trading_accounts").select("balance,currency,requested_leverage").eq("id",accountId).single();
      if(latestAccountError)throw latestAccountError;
      const remaining=(fresh||[]).filter((p:any)=>p.status==="OPEN");
      const latestFloating=remaining.reduce((n:number,p:any)=>n+Number(p.floating_pnl||0),0);
      const latestMargin=remaining.reduce((n:number,p:any)=>n+Number(p.margin_used||0),0);
      const latestBalance=Number(latestAccount.balance||0),latestEquity=latestBalance+latestFloating;
      return json({account:{id:accountId,account_mode:"real",currency:latestAccount.currency||"USD"},
        execution:{mode:"BBOOK",label:"BigBulls In-House B-Book",broker_routing:false,enabled:settings.enabled},
        positions:fresh||[],quotes,metrics:{balance:latestBalance,equity:latestEquity,margin:latestMargin,free_margin:latestEquity-latestMargin,margin_level_pct:latestMargin>0?latestEquity/latestMargin*100:0,margin_call:latestMargin>0&&latestEquity/latestMargin*100<=Number(settings.margin_call_level_pct||100),floating_pnl:latestFloating},
        generated_at:new Date().toISOString()});
    }
    return json({error:"Unsupported B-Book action."},400);
  }catch(e){
    console.error("bbook-engine:",e);
    const message = e instanceof Error ? e.message : (typeof e === "object" && e !== null && "message" in e ? String((e as any).message) : "B-Book engine error.");
    const dbCode = typeof e === "object" && e !== null && "code" in e ? String((e as any).code || "") : "";
    const locked = /readiness checks are incomplete|execution is locked|locked by platform controls|compliance controls/i.test(message);
    const kycRequired = /approved KYC is required/i.test(message);
    const feedUnavailable = /reference feed unavailable|reference feed request failed/i.test(message);
    const positionLimit = /maximum open positions reached/i.test(message);
    const riskRejected = /order exceeds account exposure limit|insufficient free margin|insufficient funds|negative client account balance/i.test(message);
    const invalidOrder = /invalid b-book order parameters|invalid side or lot size|sl\/tp levels are invalid|target price must|stop loss must|take profit must|instrument is not enabled/i.test(message);
    const adminDenied = /admin permission required/i.test(message);
    const status = positionLimit || riskRejected ? 409 : invalidOrder ? 422 : kycRequired || adminDenied ? 403 : locked ? 423 : feedUnavailable ? 503 : 500;
    return json({
      error: message,
      code: positionLimit ? "MAX_OPEN_POSITIONS" : riskRejected ? "RISK_LIMIT_REJECTED" : invalidOrder ? "INVALID_ORDER" : kycRequired ? "KYC_REQUIRED" : adminDenied ? "ADMIN_REQUIRED" : locked ? "EXECUTION_LOCKED" : feedUnavailable ? "MARKET_DATA_UNAVAILABLE" : "BBOOK_EXECUTION_ERROR",
      ...(dbCode ? { database_code: dbCode } : {}),
      request_id: req.headers.get("x-request-id") || null
    }, status);
  }
});
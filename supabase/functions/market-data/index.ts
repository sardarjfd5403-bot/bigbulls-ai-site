import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";
// BIGBULLS market feed: Twelve Data for FX/metals and Binance public market data for crypto.
// This endpoint supplies indicative chart/quote data only; it is not an execution venue.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Vary": "Origin",
  "X-Content-Type-Options": "nosniff",
};
const SYMBOLS: Record<string,string> = {
  "EUR/USD":"EUR/USD", "EURUSD":"EUR/USD",
  "GBP/USD":"GBP/USD", "GBPUSD":"GBP/USD",
  "USD/JPY":"USD/JPY", "USDJPY":"USD/JPY",
  "XAU/USD":"XAU/USD", "XAUUSD":"XAU/USD",
  "WTI/USD":"WTI/USD", "WTI":"WTI/USD",
  "NDX":"NDX",
};
const CRYPTO = new Set(["BTCUSDT","ETHUSDT","BNBUSDT","SOLUSDT","XRPUSDT","DOGEUSDT"]);
const INTERVALS: Record<string,string> = {
  "1m":"1min", "5m":"5min", "15m":"15min", "30m":"30min",
  "1h":"1h", "2h":"2h", "4h":"4h", "1d":"1day", "1D":"1day", "1w":"1week", "1W":"1week", "1M":"1month", "1mo":"1month",
};
const BINANCE_INTERVALS: Record<string,string> = {
  "1m":"1m", "5m":"5m", "15m":"15m", "30m":"30m",
  "1h":"1h", "2h":"2h", "4h":"4h", "1d":"1d", "1D":"1d", "1w":"1w", "1W":"1w", "1M":"1M", "1mo":"1M",
};
const cache = new Map<string,{at:number,payload:unknown}>();
const cacheCategory = (symbol:string) => symbol === "XAUUSD" ? "XAUUSD" : symbol.endsWith("USDT") ? "CRYPTO" : "FX";
async function persistBbookQuote(symbol:string, price:number, provider:string) {
  const url = Deno.env.get("SUPABASE_URL");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SECRET_KEY");
  if (!url || !service) return;
  const db = createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:settings} = await db.from("bb_bbook_settings").select("spread_bps").eq("singleton",true).maybeSingle();
  const spreads = settings?.spread_bps || {};
  const bps = Math.max(0,Math.min(100,Number(spreads[cacheCategory(symbol)] ?? 2)));
  const half = bps / 20000;
  const now = new Date().toISOString();
  const {error} = await db.from("bb_bbook_quotes").upsert({
    symbol,mid:price,bid:price*(1-half),ask:price*(1+half),spread_bps:bps,
    provider,quote_time:now,updated_at:now
  });
  if (error) console.warn("B-Book quote cache write failed:",symbol,error.message);
}
async function readFreshBbookQuote(symbol:string) {
  const url = Deno.env.get("SUPABASE_URL");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SECRET_KEY");
  if (!url || !service) return null;
  const db = createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error} = await db.from("bb_bbook_quotes")
    .select("symbol,mid,quote_time,provider").eq("symbol",symbol).maybeSingle();
  if (error || !data) return null;
  const age = Date.now() - Date.parse(data.quote_time);
  if (!(Number(data.mid)>0) || !Number.isFinite(age) || age<0 || age>90_000) return null;
  return {price:Number(data.mid),fetched_at:data.quote_time,quote_age_ms:age,source:data.provider};
}

const json = (body:unknown,status=200) => new Response(JSON.stringify(body),{
  status, headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}
});
async function td(path:string,params:Record<string,string>,key:string) {
  const u=new URL("https://api.twelvedata.com/"+path);
  for(const [k,v] of Object.entries(params))u.searchParams.set(k,v);
  u.searchParams.set("apikey",key);
  const r=await fetch(u,{headers:{Accept:"application/json"},signal:AbortSignal.timeout(12000)});
  const d=await r.json();
  if(!r.ok || d.status==="error" || d.code) throw new Error(d.message || "Twelve Data request failed ("+r.status+").");
  return d;
}
async function binance(path:string,params:Record<string,string>={}) {
  const u=new URL("https://data-api.binance.vision/api/v3/"+path);
  for(const [k,v] of Object.entries(params))u.searchParams.set(k,v);
  const r=await fetch(u,{headers:{Accept:"application/json"},signal:AbortSignal.timeout(10000)});
  if(!r.ok)throw new Error("Binance market data unavailable ("+r.status+").");
  return await r.json();
}
Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return json({error:"POST required"},405);
  try{
    const body=await req.json().catch(()=>({}));
    const action=String(body.action||"quotes");
    const input=String(body.symbol||"XAU/USD").toUpperCase().replaceAll("/","");
    const key=Deno.env.get("TWELVE_DATA_API_KEY");
    if(action==="candles"){
      const timeframe=String(body.timeframe||"1m");
      const requested=Number(body.outputsize)||500;
      const isLongTerm=["1d","1D","1w","1W","1M","1mo"].includes(timeframe);
      const outputsize=isLongTerm?5000:Math.min(5000,Math.max(50,requested));
      const cacheKey="c:"+input+":"+timeframe+":"+outputsize;
      const cached=cache.get(cacheKey);
      if(cached&&Date.now()-cached.at<(isLongTerm?60000:12000))return json(cached.payload);
      if(CRYPTO.has(input)){
        const interval=BINANCE_INTERVALS[timeframe];
        if(!interval)return json({error:"Unsupported crypto timeframe."},400);
        const rows=await binance("klines",{symbol:input,interval,limit:String(outputsize)});
        const candles=(rows||[]).map((v:any)=>({time:Number(v[0]),open:Number(v[1]),high:Number(v[2]),low:Number(v[3]),close:Number(v[4]),volume:Number(v[5])}))
          .filter((v:any)=>Number.isFinite(v.time)&&[v.open,v.high,v.low,v.close].every(Number.isFinite));
        if(!candles.length)throw new Error("Binance returned no OHLC candles for "+input+".");
        const payload={provider:"Binance",symbol:input,interval,timeframe,candles,price:candles[candles.length-1].close,fetched_at:new Date().toISOString(),note:"Public indicative market data; not broker bid/ask or executable pricing."};
        cache.set(cacheKey,{at:Date.now(),payload});return json(payload);
      }
      const symbol=SYMBOLS[input]||SYMBOLS[String(body.symbol||"").toUpperCase()];
      const interval=INTERVALS[timeframe];
      if(!symbol)return json({error:"Unsupported chart symbol. Use EUR/USD, GBP/USD, USD/JPY, XAU/USD, WTI/USD, NDX or supported crypto pairs."},400);
      if(!interval)return json({error:"Unsupported timeframe."},400);
      if(!key)return json({error:"TWELVE_DATA_API_KEY is not configured in Supabase Edge Function secrets."},503);
      const d=await td("time_series",{symbol,interval,outputsize:String(outputsize),order:"asc",timezone:"UTC"},key);
      const candles=(d.values||[]).map((v:any)=>({time:Date.parse(String(v.datetime).replace(" ","T")+"Z"),open:Number(v.open),high:Number(v.high),low:Number(v.low),close:Number(v.close),volume:v.volume==null?null:Number(v.volume)}))
        .filter((v:any)=>Number.isFinite(v.time)&&[v.open,v.high,v.low,v.close].every(Number.isFinite));
      if(!candles.length)throw new Error("Twelve Data returned no OHLC candles for "+symbol+".");
      const payload={provider:"Twelve Data",symbol,interval,timeframe,candles,price:candles[candles.length-1].close,fetched_at:new Date().toISOString(),note:"Indicative market data; not broker bid/ask or executable pricing."};
      cache.set(cacheKey,{at:Date.now(),payload});return json(payload);
    }
    if(action==="quote"){
      const cacheSymbol=input;
      const providerSymbol=CRYPTO.has(cacheSymbol) ? cacheSymbol : (SYMBOLS[cacheSymbol]||SYMBOLS[String(body.symbol||"").toUpperCase()]);
      if(!providerSymbol)return json({error:"Unsupported quote symbol."},400);
      const cacheKey="q:"+cacheSymbol,cached=cache.get(cacheKey);
      if(cached&&Date.now()-cached.at<8000)return json(cached.payload);
      try {
        let price=0,provider="";
        if(CRYPTO.has(cacheSymbol)){
          const d=await binance("ticker/price",{symbol:cacheSymbol});
          price=Number(d.price);provider="Binance";
        } else {
          if(!key)throw new Error("Twelve Data API key is not configured.");
          const d=await td("quote",{symbol:providerSymbol},key);
          price=Number(d.close);provider="Twelve Data";
        }
        if(!(price>0)||!Number.isFinite(price))throw new Error("No valid quote returned for "+cacheSymbol+".");
        const payload={provider,symbol:cacheSymbol,price,datetime:null,is_market_open:null,fetched_at:new Date().toISOString(),fallback:false};
        await persistBbookQuote(cacheSymbol,price,provider);
        cache.set(cacheKey,{at:Date.now(),payload});
        return json(payload);
      } catch(providerError) {
        const fallback=await readFreshBbookQuote(cacheSymbol);
        if(fallback){
          const payload={provider:"Supabase Quote Cache Fallback",symbol:cacheSymbol,price:fallback.price,
            fetched_at:fallback.fetched_at,fallback:true,quote_age_ms:fallback.quote_age_ms,
            source_provider:fallback.source,note:"Recent cached indicative quote; execution must still enforce its own freshness and risk limits."};
          cache.set(cacheKey,{at:Date.now(),payload});
          console.warn("Market quote served from fresh Supabase cache",cacheSymbol,fallback.quote_age_ms);
          return json(payload);
        }
        throw providerError;
      }
    }
    if(action==="quotes"){
      const cacheKey="quotes",cached=cache.get(cacheKey);
      if(cached&&Date.now()-cached.at<15000)return json(cached.payload);
      const fxSymbols=["EUR/USD","GBP/USD","USD/JPY","XAU/USD","WTI/USD","NDX"];
      const fx=key?await Promise.all(fxSymbols.map(async symbol=>{
        try{const d=await td("quote",{symbol},key),close=Number(d.close);return {symbol,close:Number.isFinite(close)?close:null,change:d.change??null,percent_change:d.percent_change??null,datetime:d.datetime??null,is_market_open:d.is_market_open??null,provider:"Twelve Data"}}
        catch(e){return {symbol,error:e instanceof Error?e.message:"Quote unavailable",provider:"Twelve Data"}}
      })):fxSymbols.map(symbol=>({symbol,error:"Twelve Data API key is not configured.",provider:"Twelve Data"}));
      const crypto=await Promise.all([...CRYPTO].map(async symbol=>{
        try{const d=await binance("ticker/24hr",{symbol});return {symbol,close:Number(d.lastPrice),change:d.priceChange,percent_change:d.priceChangePercent,datetime:null,is_market_open:true,provider:"Binance"}}
        catch(e){return {symbol,error:e instanceof Error?e.message:"Quote unavailable",provider:"Binance"}}
      }));
      const payload={provider:"Multi-provider",fetched_at:new Date().toISOString(),quotes:[...fx,...crypto],note:"Indicative market quotes; not executable broker bid/ask prices."};
      cache.set(cacheKey,{at:Date.now(),payload});return json(payload);
    }
    return json({error:"Unsupported action. Use candles, quote or quotes."},400);
  }catch(e){return json({error:e instanceof Error?e.message:"Unable to reach market data provider."},502)}
});
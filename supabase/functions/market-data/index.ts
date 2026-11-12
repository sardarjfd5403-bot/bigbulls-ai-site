import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";
// BIGBULLS market feed: BiQuote REST snapshots + browser SignalR streaming.
// Indicative market data only; B-Book execution remains in the existing engine.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Vary": "Origin",
  "X-Content-Type-Options": "nosniff",
};
const SYMBOLS: Record<string,string> = {
  "EUR/USD":"EURUSD", "EURUSD":"EURUSD",
  "GBP/USD":"GBPUSD", "GBPUSD":"GBPUSD",
  "USD/JPY":"USDJPY", "USDJPY":"USDJPY",
  "XAU/USD":"XAUUSD", "XAUUSD":"XAUUSD",
  "WTI/USD":"USOIL", "WTI":"USOIL", "USOIL":"USOIL",
  "NDX":"USTEC",
  "BTC":"BTCUSD", "BTCUSD":"BTCUSD", "BTCUSDT":"BTCUSD",
  "ETH":"ETHUSD", "ETHUSD":"ETHUSD", "ETHUSDT":"ETHUSD",
};
const BIQUOTE_BASE = "https://biquote.io";
const cache = new Map<string,{at:number,payload:any}>();
const normalize = (s:string) => String(s||"").toUpperCase().replaceAll("/","").trim();
const cacheCategory = (s:string) => s === "XAUUSD" ? "XAUUSD" : s.endsWith("USDT") ? "CRYPTO" : "FX";
const json = (body:unknown,status=200) => new Response(JSON.stringify(body),{
  status, headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}
});
async function biquote(path:string) {
  const u = new URL(path, BIQUOTE_BASE);
  const r = await fetch(u,{headers:{Accept:"application/json"},signal:AbortSignal.timeout(7000)});
  const data = await r.json().catch(()=>({}));
  if (!r.ok) throw new Error(String(data.message||data.error||("BiQuote request failed ("+r.status+").")));
  return data;
}
async function getTick(providerSymbol:string, strict=false) {
  const data = await biquote("/api/"+encodeURIComponent(providerSymbol)+(strict?"?allowStale=false":""));
  const bid=Number(data.bid), ask=Number(data.ask), mid=Number(data.mid || ((bid+ask)/2));
  const age=Number(data.quoteAgeSeconds ?? 0);
  if (!(bid>0 && ask>=bid && mid>0 && Number.isFinite(mid))) throw new Error("BiQuote returned an invalid bid/ask for "+providerSymbol+".");
  const stale=data.stale===true || (Number.isFinite(age)&&age>300);
  if (strict && (stale || String(data.marketState||"").toLowerCase()!=="open")) {
    throw new Error(stale ? "BiQuote quote is stale; order blocked." : "Market is closed; order blocked.");
  }
  return {
    symbol:providerSymbol,bid,ask,mid,spread:Number(data.spread ?? ask-bid),
    timestamp:data.timestamp||new Date().toISOString(),source:data.source||"BiQuote",
    marketState:data.marketState||"unknown",stale,quoteAgeSeconds:age,
    dayDiffPercent:data.dayDiffPercent??null,direction:data.direction??null
  };
}
async function getBrokerSpread(symbol:string) {
  const url=Deno.env.get("SUPABASE_URL");
  const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||Deno.env.get("SUPABASE_SECRET_KEY");
  if(!url||!service)return 2;
  try {
    const db=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data}=await db.from("bb_bbook_settings").select("spread_bps").eq("singleton",true).maybeSingle();
    const spreads=data?.spread_bps||{};
    return Math.max(0,Math.min(100,Number(spreads[cacheCategory(symbol)]??2)));
  } catch { return 2; }
}
async function persistBbookQuote(symbol:string,price:number,provider:string) {
  const url=Deno.env.get("SUPABASE_URL");
  const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||Deno.env.get("SUPABASE_SECRET_KEY");
  if(!url||!service)return;
  const db=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:settings}=await db.from("bb_bbook_settings").select("spread_bps").eq("singleton",true).maybeSingle();
  const spreads=settings?.spread_bps||{};
  const bps=Math.max(0,Math.min(100,Number(spreads[cacheCategory(symbol)]??2)));
  const half=bps/20000,now=new Date().toISOString();
  const {error}=await db.from("bb_bbook_quotes").upsert({
    symbol,mid:price,bid:price*(1-half),ask:price*(1+half),spread_bps:bps,
    provider,quote_time:now,updated_at:now
  });
  if(error)console.warn("B-Book quote cache write failed:",symbol,error.message);
}
async function readFreshBbookQuote(symbol:string) {
  const url=Deno.env.get("SUPABASE_URL");
  const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||Deno.env.get("SUPABASE_SECRET_KEY");
  if(!url||!service)return null;
  const db=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error}=await db.from("bb_bbook_quotes").select("symbol,mid,quote_time,provider").eq("symbol",symbol).maybeSingle();
  if(error||!data)return null;
  const age=Date.now()-Date.parse(data.quote_time);
  if(!(Number(data.mid)>0)||!Number.isFinite(age)||age<0||age>90000)return null;
  return {price:Number(data.mid),fetched_at:data.quote_time,quote_age_ms:age,source:data.provider};
}
function parseBars(data:any) {
  return (Array.isArray(data?.bars)?data.bars:[]).map((v:any)=>({
    time:Date.parse(String(v.openTime||"")),
    open:Number(v.open),high:Number(v.high),low:Number(v.low),close:Number(v.close),
    volume:Number(v.volume||0),tickVolume:Number(v.tickVolume||0),isOpen:v.isOpen===true
  })).filter((v:any)=>Number.isFinite(v.time)&&[v.open,v.high,v.low,v.close].every(Number.isFinite))
    .sort((a:any,b:any)=>a.time-b.time);
}
function aggregateBars(rows:any[],period:"week"|"month") {
  const groups=new Map<number,any>();
  for(const bar of rows) {
    const d=new Date(bar.time);
    const key=period==="week"
      ? Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()-((d.getUTCDay()+6)%7))
      : Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),1);
    const old=groups.get(key);
    if(!old)groups.set(key,{time:key,open:bar.open,high:bar.high,low:bar.low,close:bar.close,volume:bar.volume,tickVolume:bar.tickVolume,isOpen:bar.isOpen});
    else {old.high=Math.max(old.high,bar.high);old.low=Math.min(old.low,bar.low);old.close=bar.close;old.volume+=bar.volume;old.tickVolume+=bar.tickVolume;old.isOpen=bar.isOpen;}
  }
  return [...groups.values()].sort((a,b)=>a.time-b.time);
}
Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return json({error:"POST required"},405);
  try {
    const body=await req.json().catch(()=>({}));
    const action=String(body.action||"quotes");
    const rawSymbol=String(body.symbol||"XAU/USD").toUpperCase();
    const symbol=normalize(rawSymbol);
    const providerSymbol=SYMBOLS[symbol]||SYMBOLS[rawSymbol];
    if(action==="candles") {
      if(!providerSymbol)return json({error:"Unsupported BiQuote chart symbol: "+rawSymbol},400);
      const timeframe=String(body.timeframe||"1m");
      const supported=["1m","5m","15m","30m","1h","4h","1d","1D","1w","1W","1M","1mo"];
      if(!supported.includes(timeframe))return json({error:"Unsupported timeframe. Use 1m, 5m, 15m, 30m, 1h, 4h, 1d, 1w or 1M."},400);
      const aggregate=timeframe==="1w"||timeframe==="1W"?"week":timeframe==="1M"||timeframe==="1mo"?"month":null;
      const providerInterval=aggregate?"1d":timeframe==="1D"?"1d":timeframe;
      const daily=aggregate!==null||providerInterval==="1d";
      const requested=Number(body.outputsize)||500;
      const limit=daily?365:Math.min(1000,Math.max(50,requested));
      const cacheKey="c:"+providerSymbol+":"+timeframe+":"+limit;
      const cached=cache.get(cacheKey);
      if(cached&&Date.now()-cached.at<(daily?120000:15000))return json(cached.payload);
      const query=new URLSearchParams({interval:providerInterval,limit:String(limit)});
      const from=String(body.from||"");
      const to=String(body.to||"");
      if(from)query.set("from",from);
      if(to)query.set("to",to);
      const raw=await biquote("/api/"+encodeURIComponent(providerSymbol)+"/ohlc?"+query.toString());
      let candles=parseBars(raw);
      if(aggregate)candles=aggregateBars(candles,aggregate);
      if(!candles.length)throw new Error("BiQuote returned no OHLC candles for "+providerSymbol+" ("+timeframe+").");
      const last=candles[candles.length-1];
      const payload={
        provider:"BiQuote",symbol:providerSymbol,interval:providerInterval,timeframe,candles,
        price:last.close,fetched_at:new Date().toISOString(),
        history_depth:daily?"up to 365 daily bars; weekly/monthly are aggregated from daily bars":"up to 1000 recent intraday bars",
        note:"Indicative reference candles. The live open candle is updated by the SignalR ReceiveTick stream."
      };
      cache.set(cacheKey,{at:Date.now(),payload});return json(payload);
    }
    if(action==="quote") {
      if(!providerSymbol)return json({error:"Unsupported BiQuote quote symbol: "+rawSymbol},400);
      const cacheKey="q:"+symbol,cached=cache.get(cacheKey);
      if(cached&&Date.now()-cached.at<250)return json(cached.payload);
      try {
        const tick=await getTick(providerSymbol,true);
        const price=tick.mid;
        await persistBbookQuote(symbol,price,"BiQuote");
        const bps=await getBrokerSpread(symbol),half=bps/20000;
        const payload={
          provider:"BiQuote",symbol,price,mid:price,bid:tick.bid,ask:tick.ask,
          broker_spread_bps:bps,broker_bid:price*(1-half),broker_ask:price*(1+half),
          timestamp:tick.timestamp,datetime:tick.timestamp,marketState:tick.marketState,
          stale:tick.stale,quoteAgeSeconds:tick.quoteAgeSeconds,fallback:false
        };
        cache.set(cacheKey,{at:Date.now(),payload});return json(payload);
      } catch(providerError) {
        const fallback=await readFreshBbookQuote(symbol);
        if(fallback) {
          const payload={provider:"Supabase Quote Cache Fallback",symbol,price:fallback.price,
            fetched_at:fallback.fetched_at,fallback:true,quote_age_ms:fallback.quote_age_ms,
            source_provider:fallback.source,note:"Recent cached indicative quote; execution must still enforce freshness and risk limits."};
          return json(payload);
        }
        throw providerError;
      }
    }
    if(action==="quotes") {
      const cacheKey="quotes",cached=cache.get(cacheKey);
      if(cached&&Date.now()-cached.at<3000)return json(cached.payload);
      const requested=["EUR/USD","GBP/USD","USD/JPY","XAU/USD","WTI/USD","NDX","BTCUSDT"];
      const quotes=await Promise.all(requested.map(async label=>{
        const key=normalize(label),provider=SYMBOLS[key]||SYMBOLS[label];
        if(!provider)return {symbol:label,error:"Unsupported symbol"};
        try {
          const tick=await getTick(provider,false);
          const bps=await getBrokerSpread(key),half=bps/20000;
          return {
            symbol:label,provider:"BiQuote",provider_symbol:provider,
            close:tick.mid,price:tick.mid,mid:tick.mid,bid:tick.bid,ask:tick.ask,
            broker_spread_bps:bps,broker_bid:tick.mid*(1-half),broker_ask:tick.mid*(1+half),
            change:tick.dayDiffPercent,percent_change:tick.dayDiffPercent,
            datetime:tick.timestamp,is_market_open:tick.marketState==="open",
            marketState:tick.marketState,stale:tick.stale,quoteAgeSeconds:tick.quoteAgeSeconds
          };
        } catch(e) {return {symbol:label,error:e instanceof Error?e.message:"Quote unavailable",provider:"BiQuote"};}
      }));
      const payload={provider:"BiQuote",fetched_at:new Date().toISOString(),quotes,note:"Live reference market quotes; broker execution spread is calculated separately by BIGBULLS B-Book settings."};
      cache.set(cacheKey,{at:Date.now(),payload});return json(payload);
    }
    return json({error:"Unsupported action. Use candles, quote or quotes."},400);
  } catch(e) {
    return json({error:e instanceof Error?e.message:"Unable to reach BiQuote market data."},502);
  }
});
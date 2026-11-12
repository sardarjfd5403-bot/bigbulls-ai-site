// Twelve Data market feed for BIGBULLS terminal. API key remains in Supabase Edge Function secrets.
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
  "NDX":"NDX",
};
const INTERVALS: Record<string,string> = {
  "1m":"1min", "5m":"5min", "15m":"15min", "30m":"30min",
  "1h":"1h", "2h":"2h", "4h":"4h", "1d":"1day", "1D":"1day",
};
const cache = new Map<string,{at:number,payload:unknown}>();
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
Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return json({error:"POST required"},405);
  const key=Deno.env.get("TWELVE_DATA_API_KEY");
  if(!key)return json({error:"TWELVE_DATA_API_KEY is not configured in Supabase Edge Function secrets."},503);
  try{
    const body=await req.json().catch(()=>({}));
    const action=String(body.action||"quotes");
    if(action==="candles"){
      const input=String(body.symbol||"XAU/USD").toUpperCase();
      const symbol=SYMBOLS[input];
      const interval=INTERVALS[String(body.timeframe||"1m")];
      if(!symbol || symbol==="NDX")return json({error:"Unsupported chart symbol. Use EUR/USD, GBP/USD, USD/JPY or XAU/USD."},400);
      if(!interval)return json({error:"Unsupported timeframe. Use 1m, 5m, 15m, 30m, 1h, 2h, 4h or 1D."},400);
      const outputsize=Math.min(500,Math.max(50,Number(body.outputsize)||160));
      const cacheKey="c:"+symbol+":"+interval+":"+outputsize;
      const cached=cache.get(cacheKey);
      if(cached&&Date.now()-cached.at<12000)return json(cached.payload);
      const d=await td("time_series",{symbol,interval,outputsize:String(outputsize),order:"asc",timezone:"UTC"},key);
      const candles=(d.values||[]).map((v:any)=>({
        time:Date.parse(String(v.datetime).replace(" ","T")+"Z"),
        open:Number(v.open),high:Number(v.high),low:Number(v.low),close:Number(v.close),
        volume:v.volume==null?null:Number(v.volume)
      })).filter((v:any)=>Number.isFinite(v.time)&&[v.open,v.high,v.low,v.close].every(Number.isFinite));
      if(!candles.length)throw new Error("Twelve Data returned no OHLC candles for "+symbol+".");
      const payload={provider:"Twelve Data",symbol,interval,timeframe:String(body.timeframe||"1m"),candles,
        price:candles[candles.length-1].close,fetched_at:new Date().toISOString(),
        note:"Market data feed for paper testing; not broker bid/ask or executable pricing."};
      cache.set(cacheKey,{at:Date.now(),payload});
      return json(payload);
    }
    if(action==="quote"){
      const input=String(body.symbol||"").toUpperCase();
      const symbol=SYMBOLS[input];
      if(!symbol)return json({error:"Unsupported quote symbol."},400);
      const cacheKey="q:"+symbol;
      const cached=cache.get(cacheKey);
      if(cached&&Date.now()-cached.at<8000)return json(cached.payload);
      const d=await td("quote",{symbol},key);
      const price=Number(d.close);
      if(!(price>0))throw new Error("No valid quote returned for "+symbol+".");
      const payload={provider:"Twelve Data",symbol,price,datetime:d.datetime??null,
        is_market_open:d.is_market_open??null,fetched_at:new Date().toISOString()};
      cache.set(cacheKey,{at:Date.now(),payload});
      return json(payload);
    }
    if(action==="quotes"){
      const symbols=["EUR/USD","GBP/USD","USD/JPY","XAU/USD","NDX"];
      const cacheKey="quotes";
      const cached=cache.get(cacheKey);
      if(cached&&Date.now()-cached.at<60000)return json(cached.payload);
      const quotes=await Promise.all(symbols.map(async symbol=>{
        try{
          const d=await td("quote",{symbol},key);
          const close=Number(d.close);
          return {symbol,close:Number.isFinite(close)?close:null,change:d.change??null,
            percent_change:d.percent_change??null,datetime:d.datetime??null,is_market_open:d.is_market_open??null};
        }catch(e){return {symbol,error:e instanceof Error?e.message:"Quote unavailable"};}
      }));
      const payload={provider:"Twelve Data",fetched_at:new Date().toISOString(),quotes,
        note:"Indicative market quotes, not executable broker bid/ask prices."};
      cache.set(cacheKey,{at:Date.now(),payload});
      return json(payload);
    }
    return json({error:"Unsupported action. Use candles, quote or quotes."},400);
  }catch(e){
    return json({error:e instanceof Error?e.message:"Unable to reach Twelve Data."},502);
  }
});
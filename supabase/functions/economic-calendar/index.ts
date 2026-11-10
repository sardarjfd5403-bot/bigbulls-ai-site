import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json","Cache-Control":"public, max-age=60"}});
let cached:any=null,cachedAt=0;
serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return json({error:"POST required"},405);
 if(cached&&Date.now()-cachedAt<5*60*1000)return json(cached);
 try{
  const u=new URL("https://showmytrades.com/api/public/calendar/v1");
  u.searchParams.set("currency","USD,EUR,GBP,JPY,AUD,NZD,CAD,CHF,CNY");
  u.searchParams.set("impact","all");u.searchParams.set("days","7");u.searchParams.set("format","json");
  const upstream=await fetch(u,{headers:{Accept:"application/json","User-Agent":"BIGBULLS-Market-Calendar/1.0"},signal:AbortSignal.timeout(12000)});
  if(!upstream.ok)throw new Error("Calendar provider HTTP "+upstream.status);
  const body=await upstream.json();if(!Array.isArray(body.events))throw new Error("Unexpected calendar response");
  const events=body.events.map((e:any)=>({id:String(e.id||""),timestamp:Number(e.ts),time:String(e.time||""),currency:String(e.currency||""),impact:String(e.impact||"low").toLowerCase(),title:String(e.title||""),forecast:String(e.forecast||""),previous:String(e.previous||""),actual:String(e.actual||""),status:String(e.status||"scheduled"),confidence:String(e.confidence||"unknown"),period:String(e.period||"")})).filter((e:any)=>Number.isFinite(e.timestamp)&&e.title);
  cached={provider:"ShowMyTrades Economic Calendar",generated_at:body.generated_at||new Date().toISOString(),server_time:body.server_time||Math.floor(Date.now()/1000),count:events.length,events,attribution:{text:"Economic calendar by ShowMyTrades",url:"https://showmytrades.com/tools/economic-calendar"},source_docs:"https://showmytrades.com/docs/api/economic-calendar",disclaimer:"Schedules can change and may be incomplete. Times are UTC. This feed is not financial advice."};
  cachedAt=Date.now();return json(cached);
 }catch(e){return json({error:e instanceof Error?e.message:"Calendar unavailable",provider:"ShowMyTrades Economic Calendar",cached_available:!!cached},cached?200:503);}
});
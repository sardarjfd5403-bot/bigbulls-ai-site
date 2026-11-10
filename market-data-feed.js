(function(){
"use strict";
const URL="https://ztiiyulusburxjkpcfxu.supabase.co";
const KEY="sb_publishable_5hDwqvbcUHeSJdXFHf9ugw_VPYGN4J_";
let api=null,observer=null,timer=null;
const names={"EUR/USD":"EURUSD","GBP/USD":"GBPUSD","USD/JPY":"USDJPY","XAU/USD":"XAUUSD","NDX":"NAS100"};
function render(grid,rows,updated){
 grid.innerHTML=rows.map(q=>{
  const symbol=String(q.symbol||"").toUpperCase(),label=names[q.symbol]||symbol.replace("/","");
  const price=Number(q.close);
  return '<article class="bb-crypto-quote"><small>'+label+' · TWELVE DATA</small><strong>'+(Number.isFinite(price)?price.toLocaleString("en-US",{maximumFractionDigits:5}):"—")+'</strong><span>Provider quote · '+String(q.datetime||"")+'</span></article>';
 }).join("")||"Provider returned no supported quotes.";
 grid.dataset.loaded="true";
 const status=document.getElementById("bb-fx-status");
 if(status)status.textContent="TWELVE DATA · UPDATED "+new Date(updated).toLocaleTimeString();
}
async function refresh(){
 const grid=document.getElementById("bb-fx-market-grid");if(!grid||!api)return;
 const {data,error}=await api.functions.invoke("market-data",{body:{}});
 if(error||data?.error){
  if(!grid.dataset.loaded)grid.textContent="Forex / Gold feed not configured: "+(data?.error||error?.message||"provider unavailable");
  const status=document.getElementById("bb-fx-status");if(status)status.textContent="TWELVE DATA · SETUP REQUIRED";
  return;
 }
 render(grid,data.quotes||[],data.fetched_at);
}
function attach(){
 const grid=document.getElementById("bb-fx-market-grid");if(!grid)return;
 if(!api&&window.supabase?.createClient)api=window.supabase.createClient(URL,KEY);
 if(!api)return;
 if(!grid.dataset.feedAttached){grid.dataset.feedAttached="true";refresh();}
}
function init(){attach();observer=new MutationObserver(attach);observer.observe(document.body,{childList:true,subtree:true});if(timer)clearInterval(timer);timer=setInterval(()=>{if(document.getElementById("bb-fx-market-grid"))refresh();},60000);}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();
(function(){
"use strict";
const SYMBOLS=["BTCUSDT","ETHUSDT","BNBUSDT","SOLUSDT","XRPUSDT","DOGEUSDT"];
let timer=null,observer=null;
async function refresh(grid){
 const url="https://data-api.binance.vision/api/v3/ticker/24hr?symbols="+encodeURIComponent(JSON.stringify(SYMBOLS));
 try{
  const response=await fetch(url,{cache:"no-store"});
  if(!response.ok)throw new Error("Provider HTTP "+response.status);
  const rows=await response.json();
  if(!Array.isArray(rows))throw new Error("Unexpected market data response");
  const map=new Map(rows.map(function(row){return [row.symbol,row];}));
  grid.innerHTML=SYMBOLS.map(function(symbol){
   const row=map.get(symbol);
   if(!row)return '<article class="bb-crypto-quote"><b>'+symbol+'</b><span>Quote unavailable</span></article>';
   const change=Number(row.priceChangePercent),positive=change>=0;
   const price=Number(row.lastPrice).toLocaleString("en-US",{maximumFractionDigits:8});
   const volume=Number(row.quoteVolume).toLocaleString("en-US",{maximumFractionDigits:0});
   return '<article class="bb-crypto-quote"><small>'+symbol+'</small><strong>$'+price+'</strong><em class="'+(positive?"positive":"negative")+'">'+(positive?"+":"")+change.toFixed(2)+'%</em><span>24h quote volume · '+volume+' USDT</span></article>';
  }).join("");
  grid.dataset.loaded="true";
  const status=document.querySelector(".market-strip.large b");
  if(status)status.textContent="BINANCE SPOT FEED · LIVE";
 }catch(error){
  if(!grid.dataset.loaded)grid.textContent="Live crypto feed unavailable: "+error.message+". Retrying automatically.";
  const status=document.querySelector(".market-strip.large b");
  if(status)status.textContent="BINANCE FEED · RETRYING";
 }
}
function attach(){
 const grid=document.getElementById("bb-crypto-market-grid");
 if(!grid){if(timer){clearInterval(timer);timer=null;}return;}
 if(grid.dataset.feedAttached)return;
 grid.dataset.feedAttached="true";
 refresh(grid);
 timer=setInterval(function(){
  const current=document.getElementById("bb-crypto-market-grid");
  if(current)refresh(current);else{clearInterval(timer);timer=null;}
 },15000);
}
function init(){
 attach();
 observer=new MutationObserver(attach);
 observer.observe(document.body,{childList:true,subtree:true});
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);
else init();
})();
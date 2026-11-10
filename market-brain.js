(function(){
"use strict";
const URL="https://ztiiyulusburxjkpcfxu.supabase.co";
const KEY="sb_publishable_5hDwqvbcUHeSJdXFHf9ugw_VPYGN4J_";
let client=null,busy=false,timer=null,lastPage=false;
const $=id=>document.getElementById(id);
const fmt=(v,d=5)=>v===null||v===undefined||v===""?"—":Number.isFinite(Number(v))?Number(v).toFixed(d):"—";
const safe=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function render(data){
 const signals=data.signals||[],tests=data.backtests||[];
 $("bb-brain-status").textContent="ENGINE ACTIVE · "+new Date(data.generated_at).toLocaleTimeString();
 $("bb-brain-summary").innerHTML='<article><small>ENGINE</small><b>RESEARCH MODE</b></article><article><small>MARKETS SCANNED</small><b>'+signals.length+'</b></article><article><small>BUY / SELL SETUPS</small><b>'+signals.filter(x=>x.direction!=="WAIT").length+'</b></article><article><small>LAST SCAN</small><b>'+new Date(data.generated_at).toLocaleTimeString()+'</b></article>';
 $("bb-brain-signals").innerHTML=signals.map(s=>{
 const direction=s.direction||"WAIT",cls=direction.toLowerCase(),reasons=(s.reasons||[]).map(x=>'<li>'+safe(x)+'</li>').join("");
 return '<article class="bb-brain-card"><div class="bb-brain-card-head"><div><small>'+safe(s.category)+' · '+safe(s.symbol)+'</small><h3>'+safe(s.name||s.symbol)+'</h3></div><span class="bb-brain-direction '+cls+'">'+safe(direction)+'</span></div><div class="bb-brain-price">'+fmt(s.price,s.digits||5)+'</div><div class="bb-brain-meta"><span>Bias '+safe(s.bias)+'</span><span>Confluence '+safe(s.score)+'/100</span><span>Data '+safe(s.data_status)+'</span></div><div class="bb-brain-meter"><i style="width:'+Math.max(0,Math.min(100,Number(s.score)||0))+'%"></i></div><div class="bb-brain-levels"><div><small>ENTRY ZONE</small><b>'+fmt(s.entry_low,s.digits)+' – '+fmt(s.entry_high,s.digits)+'</b></div><div><small>STOP LOSS</small><b>'+fmt(s.stop_loss,s.digits)+'</b></div><div><small>TAKE PROFIT</small><b>'+fmt(s.take_profit,s.digits)+'</b></div></div><div class="bb-brain-news"><b>ECONOMIC NEWS · '+safe(s.news_status||"NOT CHECKED")+' · BIAS '+safe(s.news_bias||"NEUTRAL")+'</b>'+((s.news_context||[]).length?(s.news_context||[]).map(e=>'<p><span class="bb-impact '+safe(e.impact)+'">'+safe(String(e.impact||"").toUpperCase())+'</span> '+safe(e.currency)+' · '+safe(e.title)+' · '+safe(e.time)+' · Actual '+safe(e.actual||"—")+' / Forecast '+safe(e.forecast||"—")+' · Surprise '+safe(e.surprise||"—")+"</p>").join(""):'<p>No related event within the ±60 minute analysis window.</p>')+'</div><ul class="bb-brain-reasons">'+reasons+'</ul><div class="bb-brain-meta">'+(s.timeframes||[]).map(x=>'<span>'+safe(x)+'</span>').join("")+'</div><p class="fine">Setup status: '+safe(s.setup_status)+' · '+safe(s.updated_at)+'</p></article>';
 }).join("")||'<div class="empty-state">No supported markets returned.</div>';
 $("bb-brain-backtests").innerHTML=tests.map(t=>'<div class="bb-backtest-item"><small>'+safe(t.symbol)+' · '+safe(t.strategy)+'</small><b>'+safe(t.trades)+' trades</b><small>Win rate '+safe(t.win_rate)+'% · Profit factor '+safe(t.profit_factor)+' · Max DD '+safe(t.max_drawdown)+'R · Net '+safe(t.net_r)+'R</small></div>').join("")||'<div class="empty-state">Backtest data unavailable.</div>';
}
async function scan(){
 if(busy||!client||!$("bb-brain-signals"))return;busy=true;
 $("bb-brain-status").textContent="SCANNING HISTORICAL CANDLES…";
 try{
  const {data,error}=await client.functions.invoke("market-brain",{body:{}});
  if(error)throw error;
  if(!data||data.error)throw new Error(data?.error||"Market Brain unavailable");
  render(data);
 }catch(e){
  $("bb-brain-status").textContent="ENGINE OFFLINE";
  $("bb-brain-signals").innerHTML='<div class="bb-brain-warning">Market Brain is not deployed or market data is temporarily unavailable. '+safe(e.message||"Please retry.")+'</div>';
  $("bb-brain-backtests").innerHTML='<div class="empty-state">Historical test will appear when the Edge Function returns candle data.</div>';
 }finally{busy=false;}
}
function attach(){
 const page=$("bb-brain-signals");if(!page)return;
 if(!client&&window.supabase?.createClient)client=window.supabase.createClient(URL,KEY);
 if(!client)return;
 if(!page.dataset.ready){page.dataset.ready="true";$("bb-brain-refresh")?.addEventListener("click",scan);scan();if(timer)clearInterval(timer);timer=setInterval(()=>{if($("bb-brain-signals"))scan();},900000);}
}
function init(){attach();new MutationObserver(attach).observe(document.body,{childList:true,subtree:true});}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();

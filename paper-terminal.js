(function(){
"use strict";
const API="https://data-api.binance.vision/api/v3/ticker/price";
const SYMBOLS=["BTCUSDT","ETHUSDT","BNBUSDT","SOLUSDT","XRPUSDT","DOGEUSDT"];
const START_BALANCE=10000,MAX_RISK=.01,MAX_DAILY_LOSS=.03,MAX_OPEN=5;
let quotes={},timer=null,observer=null,accountKey="bb-paper-account-v1:guest",busy=false;
const $=id=>document.getElementById(id);
const money=n=>"$"+Number(n||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
const fmt=n=>Number(n).toLocaleString("en-US",{maximumFractionDigits:8});
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function load(){try{const x=JSON.parse(localStorage.getItem(accountKey)||"null");if(x&&Array.isArray(x.positions)&&Array.isArray(x.history))return x;}catch(_){}return{balance:START_BALANCE,positions:[],history:[],day:new Date().toISOString().slice(0,10),dailyRealized:0};}
let state=load();
function save(){localStorage.setItem(accountKey,JSON.stringify(state));}
function quote(symbol){return Number(quotes[symbol]);}
function pnl(p){const q=quote(p.symbol);if(!Number.isFinite(q))return 0;return(p.side==="BUY"?q-p.entry:p.entry-q)*p.quantity;}
function refreshMarks(){
 const today=new Date().toISOString().slice(0,10);
 if(state.day!==today){state.day=today;state.dailyRealized=0;save();}
 let changed=false;
 state.positions.slice().forEach(p=>{
  const q=quote(p.symbol);if(!Number.isFinite(q))return;
  const stop=p.side==="BUY"?q<=p.sl:q>=p.sl;
  const target=p.tp>0&&(p.side==="BUY"?q>=p.tp:q<=p.tp);
  if(stop||target){closePosition(p.id,q,stop?"STOP LOSS":"TAKE PROFIT");changed=true;}
 });
 if(changed)save();
}
function closePosition(id,price,reason){
 const i=state.positions.findIndex(p=>p.id===id);if(i<0)return;
 const p=state.positions.splice(i,1)[0],result=(p.side==="BUY"?price-p.entry:p.entry-price)*p.quantity;
 state.balance+=result;state.dailyRealized+=result;
 state.history.unshift({...p,exit:price,pnl:result,reason,closedAt:new Date().toISOString()});
 state.history=state.history.slice(0,100);
}
function render(){
 const root=$("bb-paper-terminal");if(!root)return;
 const floating=state.positions.reduce((n,p)=>n+pnl(p),0),equity=state.balance+floating;
 const riskToday=Math.max(0,-state.dailyRealized),locked=riskToday>=START_BALANCE*MAX_DAILY_LOSS;
 $("bb-paper-summary").innerHTML='<div><small>VIRTUAL BALANCE</small><b>'+money(state.balance)+'</b></div><div><small>EQUITY</small><b>'+money(equity)+'</b></div><div><small>OPEN P/L</small><b class="'+(floating>=0?"positive":"negative")+'">'+money(floating)+'</b></div><div><small>DAILY REALISED</small><b class="'+(state.dailyRealized>=0?"positive":"negative")+'">'+money(state.dailyRealized)+'</b></div>';
 $("bb-paper-lock").textContent=locked?"DAILY LOSS LIMIT REACHED — NEW ORDERS BLOCKED":"RISK LIMITS ACTIVE · 1% PER TRADE · 3% DAILY LOSS";
 $("bb-paper-lock").className=locked?"bb-paper-alert danger":"bb-paper-alert";
 $("bb-paper-positions").innerHTML=state.positions.length?state.positions.map(p=>'<tr><td>'+esc(p.symbol)+'</td><td>'+p.side+'</td><td>'+fmt(p.quantity)+'</td><td>'+fmt(p.entry)+'</td><td>'+fmt(quote(p.symbol)||p.entry)+'</td><td>'+money(pnl(p))+'</td><td><button data-paper-close="'+p.id+'">Close</button></td></tr>').join(""):'<tr><td colspan="7">No open paper positions.</td></tr>';
 $("bb-paper-history").innerHTML=state.history.length?state.history.slice(0,20).map(p=>'<tr><td>'+esc(p.symbol)+'</td><td>'+p.side+'</td><td>'+fmt(p.quantity)+'</td><td>'+fmt(p.entry)+'</td><td>'+fmt(p.exit)+'</td><td class="'+(p.pnl>=0?"positive":"negative")+'">'+money(p.pnl)+'</td><td>'+esc(p.reason)+'</td></tr>').join(""):'<tr><td colspan="7">No closed trades yet.</td></tr>';
 const price=quote($("bb-paper-symbol").value);$("bb-paper-price").textContent=Number.isFinite(price)?fmt(price):"Quote unavailable";
 $("bb-paper-open-count").textContent=state.positions.length+" / "+MAX_OPEN+" open";
}
async function fetchQuotes(){
 try{
  const u=API+"?symbols="+encodeURIComponent(JSON.stringify(SYMBOLS));
  const r=await fetch(u,{cache:"no-store"});if(!r.ok)throw Error("HTTP "+r.status);
  const rows=await r.json();quotes={};rows.forEach(x=>quotes[x.symbol]=Number(x.price));
  $("bb-paper-feed").textContent="BINANCE PUBLIC SPOT · "+new Date().toLocaleTimeString();
  refreshMarks();render();
 }catch(e){$("bb-paper-feed").textContent="Market data unavailable · "+e.message;}
}
function notify(msg,bad){const n=$("bb-paper-message");if(n){n.textContent=msg;n.className=bad?"bb-paper-alert danger":"bb-paper-alert";}}
function execute(side){
 if(busy)return;busy=true;
 try{
  const symbol=$("bb-paper-symbol").value,price=quote(symbol),qty=Number($("bb-paper-quantity").value),sl=Number($("bb-paper-sl").value),tp=Number($("bb-paper-tp").value||0);
  if(!Number.isFinite(price)||price<=0)throw Error("Is instrument ka live quote abhi available nahi.");
  if(!Number.isFinite(qty)||qty<=0)throw Error("Quantity valid honi chahiye.");
  if(!Number.isFinite(sl)||sl<=0||(side==="BUY"?sl>=price:sl<=price))throw Error("Valid stop-loss zaroori hai; BUY mein SL entry se neeche aur SELL mein upar ho.");
  if(tp>0&&(side==="BUY"?tp<=price:tp>=price))throw Error("Take-profit direction ghalat hai.");
  if(state.positions.length>=MAX_OPEN)throw Error("Maximum 5 open positions allowed.");
  if(Math.max(0,-state.dailyRealized)>=START_BALANCE*MAX_DAILY_LOSS)throw Error("Daily loss limit reached.");
  const risk=Math.abs(price-sl)*qty,limit=state.balance*MAX_RISK;
  if(risk>limit)throw Error("Risk "+money(risk)+" hai; per-trade limit "+money(limit)+" (1%) hai. Quantity kam karein ya SL adjust karein.");
  const p={id:Date.now().toString(36)+Math.random().toString(36).slice(2,7),symbol,side,quantity:qty,entry:price,sl,tp,openedAt:new Date().toISOString(),risk};
  state.positions.unshift(p);save();render();notify(side+" paper order executed at "+fmt(price)+". Virtual only.",false);
 }catch(e){notify(e.message,true);}finally{busy=false;}
}
function attach(){
 const page=$("client-page");if(!page||!document.querySelector(".terminal-sidebar button.active[data-page=terminal]"))return;
 if($("bb-paper-terminal"))return;
 const host=document.querySelector(".bb-terminal-layout");if(!host)return;
 const panel=document.createElement("section");panel.id="bb-paper-terminal";panel.className="bb-paper-terminal";
 panel.innerHTML='<div class="bb-paper-head"><div><span class="free-tag">INTERNAL EXECUTION ENGINE</span><h3>BIGBULLS Paper Trading</h3><p>Live public crypto quotes · simulated fills · no broker required</p></div><span id="bb-paper-feed">Connecting market feed…</span></div><div id="bb-paper-summary" class="bb-paper-summary"></div><div id="bb-paper-lock" class="bb-paper-alert"></div><div class="bb-paper-work"><div class="bb-paper-ticket"><h4>Market order ticket</h4><label>Instrument<select id="bb-paper-symbol">'+SYMBOLS.map(s=>'<option value="'+s+'">'+s+'</option>').join("")+'</select></label><div class="bb-paper-current">LIVE PRICE <b id="bb-paper-price">—</b></div><label>Side<select id="bb-paper-side"><option>BUY</option><option>SELL</option></select></label><label>Quantity (base units)<input id="bb-paper-quantity" type="number" min="0.000001" step="any" value="0.001"></label><label>Stop loss <input id="bb-paper-sl" type="number" step="any" placeholder="Required price"></label><label>Take profit <input id="bb-paper-tp" type="number" step="any" placeholder="Optional price"></label><div class="bb-paper-risk-note">Max risk 1% of virtual balance per trade. Maximum 5 open trades and 3% daily realised loss.</div><div class="bb-paper-buttons"><button id="bb-paper-buy">BUY / LONG</button><button id="bb-paper-sell">SELL / SHORT</button></div><div id="bb-paper-message" class="bb-paper-alert"></div></div><div class="bb-paper-table-wrap"><div class="bb-paper-table-head"><h4>Open positions</h4><span id="bb-paper-open-count">0 / 5 open</span></div><div class="bb-paper-table-scroll"><table><thead><tr><th>Symbol</th><th>Side</th><th>Qty</th><th>Entry</th><th>Mark</th><th>Unrealised P/L</th><th></th></tr></thead><tbody id="bb-paper-positions"></tbody></table></div><h4>Trade history</h4><div class="bb-paper-table-scroll"><table><thead><tr><th>Symbol</th><th>Side</th><th>Qty</th><th>Entry</th><th>Exit</th><th>P/L</th><th>Reason</th></tr></thead><tbody id="bb-paper-history"></tbody></table></div></div></div><div class="bb-paper-foot">Simulation only. Paper account is stored in this browser on this device; it is not a broker balance. Crypto prices are public Binance spot quotes. Forex, Gold and Indices are not enabled in this execution simulator yet.</div>';
 host.insertAdjacentElement("afterend",panel);
 $("bb-paper-buy").addEventListener("click",()=>execute("BUY"));$("bb-paper-sell").addEventListener("click",()=>execute("SELL"));
 $("bb-paper-symbol").addEventListener("change",render);
 $("bb-paper-positions").addEventListener("click",e=>{const b=e.target.closest("[data-paper-close]");if(!b)return;const p=state.positions.find(x=>x.id===b.dataset.paperClose),q=quote(p?.symbol);if(p&&Number.isFinite(q)){closePosition(p.id,q,"MANUAL CLOSE");save();render();notify("Paper position closed at current quote.",false);}});
 render();fetchQuotes();if(timer)clearInterval(timer);timer=setInterval(fetchQuotes,15000);
}
async function initUser(){
 try{if(window.supabase?.createClient){const c=window.supabase.createClient("https://ztiiyulusburxjkpcfxu.supabase.co","sb_publishable_5hDwqvbcUHeSJdXFHf9ugw_VPYGN4J_");const {data}=await c.auth.getUser();if(data?.user){accountKey="bb-paper-account-v1:"+data.user.id;state=load();}}}catch(_){}
 attach();
}
function init(){initUser();observer=new MutationObserver(()=>{if(!$("bb-paper-terminal"))attach();});observer.observe(document.body,{childList:true,subtree:true});}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();
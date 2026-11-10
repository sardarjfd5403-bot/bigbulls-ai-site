(function(){
"use strict";
const SB_URL="https://ztiiyulusburxjkpcfxu.supabase.co",SB_KEY="sb_publishable_5hDwqvbcUHeSJdXFHf9ugw_VPYGN4J_";
const CRYPTO_API="https://data-api.binance.vision/api/v3/ticker/price";
const CRYPTO=["BTCUSDT","ETHUSDT","BNBUSDT","SOLUSDT","XRPUSDT","DOGEUSDT"];
const FX=["EUR/USD","GBP/USD","XAU/USD"];
const ALL=[...CRYPTO,...FX],START=10000,RISK=.01,DAILY=.03,MAX_OPEN=5;
let quotes={},timer=null,brainTimer=null,observer=null,client=null,user=null,busy=false,saveTimer=null,scanBusy=false;
const $=id=>document.getElementById(id),money=n=>"$"+Number(n||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2}),fmt=n=>Number(n).toLocaleString("en-US",{maximumFractionDigits:6}),esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function blank(){return{balance:START,positions:[],history:[],day:new Date().toISOString().slice(0,10),dailyRealized:0,autoEnabled:false,emergencyStop:false,lastSignalAt:null};}
let state=blank();
function quote(s){return Number(quotes[s]);}
function pnl(p){const q=quote(p.symbol);return Number.isFinite(q)?(p.side==="BUY"?q-p.entry:p.entry-q)*p.quantity:0;}
function saveLocal(){try{localStorage.setItem("bb-paper-cache:"+user.id,JSON.stringify(state));}catch(_){}}
function persist(){
 if(!user||!client)return;clearTimeout(saveTimer);saveTimer=setTimeout(async()=>{
  try{const {error}=await client.from("bb_paper_accounts").upsert({user_id:user.id,account_state:state,updated_at:new Date().toISOString()},{onConflict:"user_id"});if(error)throw error;const n=$("bb-paper-cloud");if(n)n.textContent="CLOUD SYNCED · "+new Date().toLocaleTimeString();}
  catch(e){const n=$("bb-paper-cloud");if(n)n.textContent="CLOUD SYNC PENDING · Apply Supabase migration 009";console.warn("Paper cloud sync:",e.message);}
 },350);
}
function save(){saveLocal();persist();}
async function loadCloud(){
 if(!user)return;
 try{const {data,error}=await client.from("bb_paper_accounts").select("account_state").eq("user_id",user.id).maybeSingle();if(error)throw error;if(data?.account_state){state={...blank(),...data.account_state};}else{try{const old=JSON.parse(localStorage.getItem("bb-paper-account-v1:"+user.id)||"null");if(old)state={...blank(),...old};}catch(_){}save();}}
 catch(e){try{const old=JSON.parse(localStorage.getItem("bb-paper-cache:"+user.id)||"null");if(old)state={...blank(),...old};}catch(_){}const n=$("bb-paper-cloud");if(n)n.textContent="CLOUD NOT READY · Apply Supabase migration 009";}
}
function closePosition(id,price,reason){
 const i=state.positions.findIndex(p=>p.id===id);if(i<0)return;const p=state.positions.splice(i,1)[0],result=(p.side==="BUY"?price-p.entry:p.entry-price)*p.quantity;
 state.balance+=result;state.dailyRealized+=result;state.history.unshift({...p,exit:price,pnl:result,reason,closedAt:new Date().toISOString()});state.history=state.history.slice(0,200);
}
function markPositions(){
 const today=new Date().toISOString().slice(0,10);if(state.day!==today){state.day=today;state.dailyRealized=0;}
 let changed=false;state.positions.slice().forEach(p=>{const q=quote(p.symbol);if(!Number.isFinite(q))return;const sl=p.side==="BUY"?q<=p.sl:q>=p.sl,tp=p.tp>0&&(p.side==="BUY"?q>=p.tp:q<=p.tp);if(sl||tp){closePosition(p.id,q,sl?"STOP LOSS":"TAKE PROFIT");changed=true;}});if(changed)save();
}
function riskUsed(){return state.positions.reduce((n,p)=>n+Number(p.risk||0),0);}
function place(side,symbol,sl,tp,quantity,source){
 const price=quote(symbol);if(!Number.isFinite(price)||price<=0)throw Error("Fresh quote unavailable for "+symbol);
 if(!Number.isFinite(sl)||sl<=0||(side==="BUY"?sl>=price:sl<=price))throw Error("Invalid stop-loss.");
 if(tp>0&&(side==="BUY"?tp<=price:tp>=price))throw Error("Invalid take-profit.");
 if(state.positions.length>=MAX_OPEN)throw Error("Maximum 5 open positions.");
 const floating=state.positions.reduce((n,p)=>n+pnl(p),0),dayPnl=state.dailyRealized+floating;
 if(dayPnl<=-START*DAILY||state.emergencyStop)throw Error("Risk lock / emergency stop active.");
 const risk=Math.abs(price-sl)*quantity,cap=state.balance*RISK;
 if(!Number.isFinite(quantity)||quantity<=0||risk>cap||riskUsed()+risk>state.balance*.03)throw Error("Position rejected by 1% trade / 3% aggregate risk limits.");
 const p={id:Date.now().toString(36)+Math.random().toString(36).slice(2,7),symbol,side,quantity,entry:price,sl,tp:tp||0,risk,source:source||"MANUAL",openedAt:new Date().toISOString()};
 state.positions.unshift(p);save();return p;
}
async function fetchQuotes(){
 try{
  const r=await fetch(CRYPTO_API+"?symbols="+encodeURIComponent(JSON.stringify(CRYPTO)),{cache:"no-store"});if(!r.ok)throw Error("Binance HTTP "+r.status);(await r.json()).forEach(x=>quotes[x.symbol]=Number(x.price));
 }catch(e){console.warn("Crypto quotes:",e.message);}
 if(client){try{const {data,error}=await client.functions.invoke("market-data",{body:{}});if(error)throw error;(data?.quotes||[]).forEach(x=>{const s=String(x.symbol||"").replace("/","").toUpperCase();const p=Number(x.close);if(Number.isFinite(p)&&p>0)quotes[s]=p;});}catch(e){console.warn("FX/metals feed:",e.message);}}
 const n=$("bb-paper-feed");if(n)n.textContent="BINANCE CRYPTO + TWELVE DATA FX/GOLD · "+new Date().toLocaleTimeString();markPositions();render();
}
function render(){
 if(!$("bb-paper-terminal"))return;const floating=state.positions.reduce((n,p)=>n+pnl(p),0),equity=state.balance+floating,day=state.dailyRealized+floating,locked=day<=-START*DAILY||state.emergencyStop;
 $("bb-paper-summary").innerHTML='<div><small>VIRTUAL BALANCE</small><b>'+money(state.balance)+'</b></div><div><small>EQUITY</small><b>'+money(equity)+'</b></div><div><small>OPEN P/L</small><b class="'+(floating>=0?"positive":"negative")+'">'+money(floating)+'</b></div><div><small>DAILY P/L</small><b>'+money(day)+'</b></div>';
 $("bb-paper-lock").textContent=state.emergencyStop?"EMERGENCY STOP ACTIVE":locked?"DAILY LOSS LIMIT REACHED — NEW ORDERS BLOCKED":"RISK ACTIVE · 1% PER TRADE · 3% DAILY LOSS · 3% AGGREGATE";
 $("bb-paper-lock").className=locked?"bb-paper-alert danger":"bb-paper-alert";
 $("bb-paper-positions").innerHTML=state.positions.length?state.positions.map(p=>'<tr><td>'+esc(p.symbol)+'</td><td>'+p.side+'</td><td>'+fmt(p.quantity)+'</td><td>'+fmt(p.entry)+'</td><td>'+fmt(quote(p.symbol)||p.entry)+'</td><td>'+money(pnl(p))+'</td><td><button data-paper-close="'+p.id+'">Close</button></td></tr>').join(""):'<tr><td colspan="7">No open positions.</td></tr>';
 $("bb-paper-history").innerHTML=state.history.slice(0,25).map(p=>'<tr><td>'+esc(p.symbol)+'</td><td>'+p.side+'</td><td>'+fmt(p.quantity)+'</td><td>'+fmt(p.entry)+'</td><td>'+fmt(p.exit)+'</td><td>'+money(p.pnl)+'</td><td>'+esc(p.reason)+'</td></tr>').join("")||'<tr><td colspan="7">No closed trades.</td></tr>';
 $("bb-paper-open-count").textContent=state.positions.length+" / "+MAX_OPEN+" open";$("bb-paper-auto").textContent=state.autoEnabled?"AUTO STRATEGY: ON":"AUTO STRATEGY: OFF";$("bb-paper-auto").className=state.autoEnabled?"active-auto":"";
 $("bb-paper-symbol").value=ALL.includes($("bb-paper-symbol").value)?$("bb-paper-symbol").value:CRYPTO[0];$("bb-paper-price").textContent=Number.isFinite(quote($("bb-paper-symbol").value))?fmt(quote($("bb-paper-symbol").value)):"Quote unavailable";
}
function notify(s,bad){const n=$("bb-paper-message");if(n){n.textContent=s;n.className=bad?"bb-paper-alert danger":"bb-paper-alert";}}
function manual(side){try{const symbol=$("bb-paper-symbol").value,sl=Number($("bb-paper-sl").value),tp=Number($("bb-paper-tp").value||0),qty=Number($("bb-paper-quantity").value);const p=place(side,symbol,sl,tp,qty,"MANUAL");render();notify(side+" paper order filled at "+fmt(p.entry)+" · simulated only",false);}catch(e){notify(e.message,true);}}
async function runBrain(){
 if(scanBusy||!state.autoEnabled||state.emergencyStop||!client)return;scanBusy=true;
 try{
  const {data,error}=await client.functions.invoke("market-brain",{body:{}});if(error)throw error;if(!data||data.error)throw Error(data?.error||"Market Brain unavailable");
  for(const s of data.signals||[]){
   if(s.direction!=="BUY"&&s.direction!=="SELL")continue;
   if(Number(s.score)<80||s.data_status!=="FRESH"||!s.stop_loss||!s.take_profit)continue;
   const sym=String(s.symbol||"").replace("/","").toUpperCase();if(!["EURUSD","GBPUSD","XAUUSD"].includes(sym))continue;
   if(state.positions.some(p=>p.symbol===sym)||state.history.some(p=>p.symbol===sym&&Date.now()-Date.parse(p.closedAt)<30*60*1000))continue;
   const q=quote(sym);if(!Number.isFinite(q)||q<s.entry_low||q>s.entry_high)continue;
   const riskBudget=state.balance*RISK,perUnit=Math.abs(q-Number(s.stop_loss));if(!perUnit)continue;const qty=riskBudget/perUnit;
   try{const p=place(s.direction,sym,Number(s.stop_loss),Number(s.take_profit),qty,"AI MARKET BRAIN · "+s.score+"/100");state.lastSignalAt=new Date().toISOString();notify("AI paper signal executed: "+p.side+" "+sym+" · score "+s.score+"/100",false);}catch(e){console.info("AI setup filtered:",e.message);}
  }
  save();render();
 }catch(e){notify("AI automation paused: "+e.message,true);}
 finally{scanBusy=false;}
}
function attach(){
 if(!$("client-page")||!document.querySelector('.terminal-sidebar button.active[data-page="terminal"]')||$("bb-paper-terminal"))return;
 const host=document.querySelector(".bb-terminal-layout");if(!host)return;
 const panel=document.createElement("section");panel.id="bb-paper-terminal";panel.className="bb-paper-terminal";
 panel.innerHTML='<div class="bb-paper-head"><div><span class="free-tag">INTERNAL PAPER EXECUTION</span><h3>BIGBULLS AI Paper Trading</h3><p>Simulated fills only · no broker connection or real-money orders</p></div><div><span id="bb-paper-feed">Connecting approved data feeds…</span><div id="bb-paper-cloud">Checking cloud account…</div></div></div><div id="bb-paper-summary" class="bb-paper-summary"></div><div id="bb-paper-lock" class="bb-paper-alert"></div><div class="bb-paper-work"><div class="bb-paper-ticket"><h4>Order ticket</h4><label>Instrument<select id="bb-paper-symbol">'+ALL.map(s=>'<option value="'+s+'">'+s+'</option>').join("")+'</select></label><div class="bb-paper-current">LATEST PRICE <b id="bb-paper-price">—</b></div><label>Quantity / units<input id="bb-paper-quantity" type="number" min="0.000001" step="any" value="0.001"></label><label>Stop loss<input id="bb-paper-sl" type="number" step="any" placeholder="Required"></label><label>Take profit<input id="bb-paper-tp" type="number" step="any" placeholder="Optional"></label><div class="bb-paper-risk-note">Manual quantity. EURUSD/GBPUSD/XAUUSD P/L assumes USD-quoted/base-unit conventions; USDJPY and index contracts are excluded from automation pending contract specifications.</div><div class="bb-paper-buttons"><button id="bb-paper-buy">BUY / LONG</button><button id="bb-paper-sell">SELL / SHORT</button></div><button id="bb-paper-auto" class="bb-paper-auto">AUTO STRATEGY: OFF</button><button id="bb-paper-stop" class="bb-paper-stop">EMERGENCY STOP</button><div id="bb-paper-message" class="bb-paper-alert"></div></div><div class="bb-paper-table-wrap"><div class="bb-paper-table-head"><h4>Open positions</h4><span id="bb-paper-open-count">0 / 5</span></div><div class="bb-paper-table-scroll"><table><thead><tr><th>Symbol</th><th>Side</th><th>Qty</th><th>Entry</th><th>Mark</th><th>Floating P/L</th><th></th></tr></thead><tbody id="bb-paper-positions"></tbody></table></div><h4>Trade history</h4><div class="bb-paper-table-scroll"><table><thead><tr><th>Symbol</th><th>Side</th><th>Qty</th><th>Entry</th><th>Exit</th><th>P/L</th><th>Reason</th></tr></thead><tbody id="bb-paper-history"></tbody></table></div></div></div><div class="bb-paper-foot">Cloud sync requires migration 009 in Supabase. FX/Gold prices use your server-side Twelve Data key via the market-data Edge Function; crypto uses Binance public spot. Index feeds are not enabled until a provider confirms the required index instruments and contract metadata. Auto mode is paper-only, requires score ≥80, fresh signal, price inside entry zone, SL/TP, risk checks and cooldown. No profitability or accuracy is guaranteed.</div>';
 host.insertAdjacentElement("afterend",panel);
 $("bb-paper-buy").onclick=()=>manual("BUY");$("bb-paper-sell").onclick=()=>manual("SELL");$("bb-paper-symbol").onchange=render;
 $("bb-paper-auto").onclick=()=>{state.autoEnabled=!state.autoEnabled;if(state.autoEnabled)state.emergencyStop=false;save();render();notify(state.autoEnabled?"AI paper automation enabled.":"AI paper automation paused.",false);if(state.autoEnabled)runBrain();};
 $("bb-paper-stop").onclick=()=>{state.autoEnabled=false;state.emergencyStop=true;save();render();notify("Emergency stop active. Open positions remain managed by SL/TP; close manually if required.",true);};
 $("bb-paper-positions").onclick=e=>{const b=e.target.closest("[data-paper-close]");if(!b)return;const p=state.positions.find(x=>x.id===b.dataset.paperClose),q=quote(p?.symbol);if(p&&Number.isFinite(q)){closePosition(p.id,q,"MANUAL CLOSE");save();render();notify("Paper position closed.",false);}};
 render();fetchQuotes();if(timer)clearInterval(timer);timer=setInterval(fetchQuotes,15000);if(brainTimer)clearInterval(brainTimer);brainTimer=setInterval(runBrain,60000);
}
async function initUser(){
 try{if(window.supabase?.createClient){client=window.supabase.createClient(SB_URL,SB_KEY);const {data}=await client.auth.getUser();user=data?.user||null;if(user)await loadCloud();}}
 catch(e){console.warn("Paper account init:",e.message);}
 attach();
}
function init(){initUser();observer=new MutationObserver(()=>{if(!$("bb-paper-terminal"))attach();});observer.observe(document.body,{childList:true,subtree:true});}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();
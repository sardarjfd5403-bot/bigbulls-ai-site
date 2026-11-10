(function(){
"use strict";
const SB_URL="https://ztiiyulusburxjkpcfxu.supabase.co",SB_KEY="sb_publishable_5hDwqvbcUHeSJdXFHf9ugw_VPYGN4J_";
const CRYPTO_API="https://data-api.binance.vision/api/v3/ticker/price";
const CRYPTO=["BTCUSDT","ETHUSDT","BNBUSDT","SOLUSDT","XRPUSDT","DOGEUSDT"];
const FX=["EUR/USD","GBP/USD","XAU/USD"];
const ALL=[...CRYPTO,...FX],START=10000;
let RISK=.01,DAILY=.03,AGGREGATE=.03,MAX_OPEN=5;
let quotes={},timer=null,brainTimer=null,observer=null,client=null,user=null,busy=false,saveTimer=null,scanBusy=false,historyRange="1d",historySymbol="ALL",historyFrom="",historyTo="",demoAccounts=[],realAccounts=[],activeAccountId=null,activeMode="demo",activeAccount=null,executionState={demo_enabled:false,live_effective:false,global_halt:true},legacyMode=true;
const $=id=>document.getElementById(id),money=n=>"$"+Number(n||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2}),fmt=n=>Number(n).toLocaleString("en-US",{maximumFractionDigits:6}),esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function blank(){return{balance:START,positions:[],pendingOrders:[],history:[],day:new Date().toISOString().slice(0,10),dailyRealized:0,autoEnabled:false,emergencyStop:false,lastSignalAt:null};}
let state=blank();
function quote(s){return Number(quotes[String(s).replaceAll("/","").toUpperCase()]);}
function contractSize(symbol){return symbol==="XAU/USD"?100:(symbol==="EUR/USD"||symbol==="GBP/USD"||symbol==="USD/JPY"?100000:1);}
function pnl(p){const q=quote(p.symbol);return Number.isFinite(q)?(p.side==="BUY"?q-p.entry:p.entry-q)*p.quantity*contractSize(p.symbol):0;}
function saveLocal(){try{localStorage.setItem("bb-paper-cache:"+user.id+":"+(activeAccountId||"legacy"),JSON.stringify(state));}catch(_){}}
function persist(){
 if(!user||!client||activeMode!=="demo")return;const ownerId=user.id,accountId=activeAccountId,snapshot={...state,lastQuotes:quotes,lastQuoteAt:new Date().toISOString()};clearTimeout(saveTimer);saveTimer=setTimeout(async()=>{
  try{const result=accountId?await client.from("bb_mt5_demo_accounts").upsert({account_id:accountId,user_id:ownerId,account_state:snapshot,updated_at:new Date().toISOString()},{onConflict:"account_id"}):await client.from("bb_paper_accounts").upsert({user_id:ownerId,account_state:snapshot,updated_at:new Date().toISOString()},{onConflict:"user_id"});if(result.error)throw result.error;const n=$("bb-paper-cloud");if(n)n.textContent="CLOUD SYNCED · "+new Date().toLocaleTimeString();}
  catch(e){const n=$("bb-paper-cloud");if(n)n.textContent="CLOUD SYNC ERROR · "+e.message;console.warn("Paper cloud sync:",e.message);}
 },350);
}
function save(){if(activeAccountId)return;if(activeMode!=="demo")return;saveLocal();persist();}
async function paperApi(action,extra={}){
 if(!client||!activeAccountId)throw new Error("Select an approved trading account first.");
 const {data,error}=await client.functions.invoke("paper-execution",{body:{action,account_id:activeAccountId,...extra}});
 if(error)throw error;if(!data||data.error)throw new Error(data?.error||"Paper execution service unavailable.");return data;
}
function mapPaperTrade(t){return{id:t.id,symbol:t.symbol,side:t.side,quantity:Number(t.quantity),entry:Number(t.entry_price),exit:t.exit_price==null?null:Number(t.exit_price),sl:Number(t.stop_loss),tp:Number(t.take_profit||0),risk:Number(t.risk_amount||0),source:t.source||"MANUAL",pnl:Number(t.realized_pnl||0),openedAt:t.opened_at,closedAt:t.closed_at,reason:t.close_reason||"CLOSED",mark:Number(t.mark_price||t.entry_price),executionMode:t.execution_mode||"PAPER"};}
async function syncPaper(action="status"){
 const d=await paperApi(action),trades=d.trades||[];
 state={...blank(),balance:Number(d.ledger.virtual_balance||0),dailyRealized:Number(d.ledger.daily_realized||0),day:d.ledger.current_day,emergencyStop:d.ledger.emergency_stop===true,autoEnabled:d.ledger.auto_enabled===true,positions:trades.filter(t=>t.status==="OPEN").map(mapPaperTrade),history:trades.filter(t=>t.status==="CLOSED").map(mapPaperTrade),pendingOrders:[]};
 executionState={...executionState,paper_enabled:true,paper_mode:true,global_halt:false};
 const n=$("bb-paper-cloud");if(n)n.textContent="SERVER LEDGER SYNCED · "+new Date().toLocaleTimeString();return d;
}
async function loadCloud(){
 if(!user||!client)return;
 try{
  const {data:gateway,error:gatewayError}=await client.functions.invoke("trading-gateway",{body:{action:"accounts"}});
  if(gatewayError||!gateway?.accounts)throw gatewayError||new Error(gateway?.error||"Account gateway unavailable");
  executionState=gateway.execution||{demo_enabled:false,live_effective:false,global_halt:false};
  const limits=executionState.risk_limits||{};RISK=Number(limits.max_risk_per_trade_pct??1)/100;DAILY=Number(limits.max_daily_loss_pct??3)/100;AGGREGATE=Number(limits.max_aggregate_risk_pct??3)/100;MAX_OPEN=Number(limits.max_open_positions??5);
  demoAccounts=gateway.accounts.filter(x=>x.account_mode==="demo"&&x.status==="approved"&&!x.archived_at&&!x.deleted_at);
  realAccounts=gateway.accounts.filter(x=>x.account_mode==="real"&&x.status==="approved"&&!x.archived_at&&!x.deleted_at);
  const storedMode=localStorage.getItem("bb-terminal-mode:"+user.id);if(storedMode==="real"||storedMode==="demo")activeMode=storedMode;
  const list=activeMode==="real"?realAccounts:demoAccounts;
  const saved=localStorage.getItem("bb-terminal-active:"+user.id+":"+activeMode);
  activeAccountId=list.some(x=>x.id===saved)?saved:(list[0]?.id||null);
  activeAccount=list.find(x=>x.id===activeAccountId)||null;
  if(activeAccountId){
   legacyMode=false;await syncPaper("status");render();return;
  }
  if(activeMode==="real"){state=blank();legacyMode=false;render();const n=$("bb-paper-cloud");if(n)n.textContent="NO APPROVED REAL ACCOUNT";return;}
  legacyMode=true;activeAccount=null;
  const {data,error}=await client.from("bb_paper_accounts").select("account_state").eq("user_id",user.id).maybeSingle();if(error)throw error;
  if(data?.account_state)state={...blank(),...data.account_state};else{try{const old=JSON.parse(localStorage.getItem("bb-paper-account-v1:"+user.id)||"null");if(old)state={...blank(),...old};}catch(_){}save();}
 }catch(e){
  const n=$("bb-paper-cloud");if(n)n.textContent="ACCOUNT GATEWAY ERROR · "+e.message;
  state=blank();activeAccount=null;activeAccountId=null;executionState={demo_enabled:false,live_effective:false,global_halt:true};console.warn("Trading account gateway:",e.message);
 }
}
async function switchAccountMode(mode){
 if(!["demo","real"].includes(mode)||mode===activeMode)return;
 activeMode=mode;localStorage.setItem("bb-terminal-mode:"+user.id,mode);state=blank();await loadCloud();render();
 notify(mode==="real"?"Real account selected · read-only until live execution approval.":"Demo account selected.",mode==="real");
}
async function switchDemoAccount(accountId){
 const list=activeMode==="real"?realAccounts:demoAccounts;
 if(!accountId||!list.some(x=>x.id===accountId)||accountId===activeAccountId)return;
 activeAccountId=accountId;activeAccount=list.find(x=>x.id===accountId)||null;
 localStorage.setItem("bb-terminal-active:"+user.id+":"+activeMode,accountId);
 state=blank();await loadCloud();render();notify(activeMode==="real"?"Real account selected · paper execution only during testing.":"Demo account switched.",false);
}
function closePosition(id,price,reason){if(activeMode!=="demo")return;
 const i=state.positions.findIndex(p=>p.id===id);if(i<0)return;const p=state.positions.splice(i,1)[0],result=(p.side==="BUY"?price-p.entry:p.entry-price)*p.quantity*contractSize(p.symbol);
 state.balance+=result;state.dailyRealized+=result;state.history.unshift({...p,exit:price,pnl:result,reason,closedAt:new Date().toISOString()});state.history=state.history.slice(0,10000);
}
function processPendingOrders(){
 const keep=[];let changed=false;
 for(const o of state.pendingOrders||[]){const q=quote(o.symbol);if(!Number.isFinite(q)){keep.push(o);continue;}
 let triggered=false;if(o.orderType==="BUY_LIMIT")triggered=q<=o.entryPrice;else if(o.orderType==="SELL_LIMIT")triggered=q>=o.entryPrice;else if(o.orderType==="BUY_STOP")triggered=q>=o.entryPrice;else if(o.orderType==="SELL_STOP")triggered=q<=o.entryPrice;else if(o.orderType==="BUY_STOP_LIMIT"){if(!o.stopTriggered&&q>=o.stopPrice)o.stopTriggered=true;triggered=!!o.stopTriggered&&q<=o.limitPrice;}else if(o.orderType==="SELL_STOP_LIMIT"){if(!o.stopTriggered&&q<=o.stopPrice)o.stopTriggered=true;triggered=!!o.stopTriggered&&q>=o.limitPrice;}
 if(!triggered){keep.push(o);continue;}
 state.pendingOrders=(state.pendingOrders||[]).filter(x=>x.id!==o.id);try{const fill=q;const p=place(o.side,o.symbol,o.sl,o.tp,o.quantity,"PENDING "+o.orderType,fill,o.trailingDistance);state.history.unshift({...o,exit:fill,pnl:0,reason:"PENDING ORDER FILLED",closedAt:new Date().toISOString(),status:"FILLED",positionId:p.id});changed=true;}catch(e){state.history.unshift({...o,exit:null,pnl:0,reason:"PENDING ORDER REJECTED: "+e.message,closedAt:new Date().toISOString(),status:"REJECTED"});changed=true;}
 }
 state.pendingOrders=keep;if(changed)save();
}
function markPositions(){state.positions.forEach(p=>{const q=quote(p.symbol);if(Number.isFinite(q))p.mark=q;});}
function riskUsed(){return state.positions.reduce((n,p)=>n+Number(p.risk||0),0)+(state.pendingOrders||[]).reduce((n,o)=>n+Number(o.risk||0),0);}
function placePending(side,symbol,orderType,entryPrice,stopPrice,limitPrice,sl,tp,quantity,trailingDistance){
 const market=quote(symbol),entry=orderType.endsWith("STOP_LIMIT")?Number(limitPrice):Number(entryPrice),buy=side==="BUY";if(!Number.isFinite(market)||market<=0)throw Error("Fresh quote unavailable.");if(!Number.isFinite(entry)||entry<=0)throw Error("Enter a valid pending price.");
 if(orderType==="BUY_LIMIT"&&entry>=market)throw Error("Buy Limit price must be below market.");if(orderType==="SELL_LIMIT"&&entry<=market)throw Error("Sell Limit price must be above market.");if(orderType==="BUY_STOP"&&entry<=market)throw Error("Buy Stop price must be above market.");if(orderType==="SELL_STOP"&&entry>=market)throw Error("Sell Stop price must be below market.");
 if(orderType==="BUY_STOP_LIMIT"&&Number(stopPrice)<=market)throw Error("Buy Stop trigger must be above market.");if(orderType==="SELL_STOP_LIMIT"&&Number(stopPrice)>=market)throw Error("Sell Stop trigger must be below market.");if(orderType.endsWith("STOP_LIMIT")&&(!Number.isFinite(Number(limitPrice))||Number(limitPrice)<=0))throw Error("Enter a valid stop-limit price.");if(orderType==="BUY_STOP_LIMIT"&&Number(limitPrice)>Number(stopPrice))throw Error("Buy Stop Limit price must not exceed its trigger.");if(orderType==="SELL_STOP_LIMIT"&&Number(limitPrice)<Number(stopPrice))throw Error("Sell Stop Limit price must not be below its trigger.");
 const sln=Number(sl),tpn=Number(tp)||0;if(!Number.isFinite(sln)||sln<=0||(buy?sln>=entry:sln<=entry))throw Error("Invalid stop-loss for pending entry.");if(tpn>0&&(buy?tpn<=entry:tpn>=entry))throw Error("Invalid take-profit for pending entry.");
 if(state.positions.length+(state.pendingOrders||[]).length>=MAX_OPEN)throw Error("Maximum 5 combined open positions and pending orders.");const risk=Math.abs(entry-sln)*Number(quantity)*contractSize(symbol),floating=state.positions.reduce((n,p)=>n+pnl(p),0);if(state.emergencyStop||state.dailyRealized+floating<=-state.balance*DAILY)throw Error("Risk lock / emergency stop active.");if(!Number.isFinite(Number(quantity))||Number(quantity)<=0||risk>state.balance*RISK||riskUsed()+risk>state.balance*AGGREGATE)throw Error("Pending order rejected by 1% trade / 3% aggregate risk limits.");
 const o={id:Date.now().toString(36)+Math.random().toString(36).slice(2,7),symbol,side,orderType,quantity:Number(quantity),entryPrice:entry,stopPrice:Number(stopPrice)||0,limitPrice:Number(limitPrice)||0,sl:sln,tp:tpn,risk,trailingDistance:Number(trailingDistance)||0,stopTriggered:false,status:"PENDING",createdAt:new Date().toISOString()};state.pendingOrders.push(o);save();return o;
}
function cancelPending(id){const i=(state.pendingOrders||[]).findIndex(o=>o.id===id);if(i<0)return;const o=state.pendingOrders.splice(i,1)[0];state.history.unshift({...o,exit:null,pnl:0,reason:"PENDING ORDER CANCELLED",status:"CANCELLED",closedAt:new Date().toISOString()});save();render();notify("Pending order cancelled.",false);}
async function modifyPosition(id){const p=state.positions.find(x=>x.id===id);if(!p)return;const sl=Number(window.prompt("New Stop Loss price",String(p.sl)));if(!Number.isFinite(sl)||sl<=0)return;const raw=window.prompt("New Take Profit price (0 to remove)",String(p.tp||0));if(raw===null)return;const tp=Number(raw)||null;try{await paperApi("modify",{trade_id:id,stop_loss:sl,take_profit:tp});await syncPaper("status");render();notify("Position protection updated on server.",false);}catch(e){notify(e.message,true);}}
function place(side,symbol,sl,tp,quantity,source,executionPrice,trailingDistance){
 const price=Number.isFinite(Number(executionPrice))?Number(executionPrice):quote(symbol);if(!Number.isFinite(price)||price<=0)throw Error("Fresh quote unavailable for "+symbol);
 if(!Number.isFinite(sl)||sl<=0||(side==="BUY"?sl>=price:sl<=price))throw Error("Invalid stop-loss.");
 if(tp>0&&(side==="BUY"?tp<=price:tp>=price))throw Error("Invalid take-profit.");
 if(state.positions.length+(state.pendingOrders||[]).length>=MAX_OPEN)throw Error("Maximum 5 combined open positions and pending orders.");
 const floating=state.positions.reduce((n,p)=>n+pnl(p),0),dayPnl=state.dailyRealized+floating;
 if(dayPnl<=-state.balance*DAILY||state.emergencyStop)throw Error("Risk lock / emergency stop active.");
 const risk=Math.abs(price-sl)*quantity*contractSize(symbol),cap=state.balance*RISK;
 if(!Number.isFinite(quantity)||quantity<=0||risk>cap||riskUsed()+risk>state.balance*AGGREGATE)throw Error("Position rejected by configured server risk limits.");
 const p={id:Date.now().toString(36)+Math.random().toString(36).slice(2,7),symbol,side,quantity,entry:price,sl,tp:tp||0,risk,source:source||"MANUAL",trailingDistance:Number(trailingDistance)||0,openedAt:new Date().toISOString()};
 state.positions.unshift(p);save();return p;
}
async function fetchQuotes(){
 try{
  const r=await fetch(CRYPTO_API+"?symbols="+encodeURIComponent(JSON.stringify(CRYPTO)),{cache:"no-store"});if(!r.ok)throw Error("Binance HTTP "+r.status);(await r.json()).forEach(x=>quotes[x.symbol]=Number(x.price));
 }catch(e){console.warn("Crypto quotes:",e.message);}
 if(client){try{const {data,error}=await client.functions.invoke("market-data",{body:{}});if(error)throw error;(data?.quotes||[]).forEach(x=>{const s=String(x.symbol||"").replace("/","").toUpperCase();const p=Number(x.close);if(Number.isFinite(p)&&p>0)quotes[s]=p;});}catch(e){console.warn("FX/metals feed:",e.message);}}
 if(activeAccountId&&client){try{await syncPaper("refresh");}catch(e){notify("Server ledger refresh failed: "+e.message,true);}}
 const n=$("bb-paper-feed");if(n)n.textContent="BINANCE CRYPTO + TWELVE DATA FX/GOLD · "+new Date().toLocaleTimeString();markPositions();render();
}
function render(){
 if(!$("bb-paper-terminal"))return;const accountSelect=$("bb-demo-account"),modeSelect=$("bb-account-mode"),accounts=activeMode==="real"?realAccounts:demoAccounts;if(modeSelect)modeSelect.value=activeMode;if(accountSelect){accountSelect.innerHTML=accounts.length?accounts.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.display_name||((activeMode==="real"?"Real #":"Demo #")+x.account_number))+" · $"+Number(x.balance||0).toFixed(2)+"</option>").join(""):activeMode==="real"?'<option value="">No approved Real account</option>':'<option value="">Personal Demo Account · not linked to a portal account</option>';accountSelect.value=activeAccountId||"";accountSelect.disabled=accounts.length<2;}const isReal=activeMode==="real",ticket=$("bb-paper-terminal").querySelector(".bb-paper-ticket"),tableWrap=$("bb-paper-terminal").querySelector(".bb-paper-table-wrap"),liveLock=$("bb-paper-live-locked");if(ticket)ticket.hidden=false;if(tableWrap)tableWrap.hidden=false;if(liveLock)liveLock.hidden=!isReal;const balance=state.balance,floating=state.positions.reduce((n,p)=>n+pnl(p),0),equity=balance+floating,day=state.dailyRealized+floating,locked=(!executionState.paper_enabled||(activeMode==="demo"&&!executionState.demo_enabled))||day<=-state.balance*DAILY||state.emergencyStop;
 $("bb-paper-summary").innerHTML='<div><small>'+(isReal?'REAL ACCOUNT · TEST EQUITY':'DEMO BALANCE')+'</small><b>'+money(balance)+'</b></div><div><small>EQUITY</small><b>'+money(equity)+'</b></div><div><small>OPEN P/L</small><b class="'+(floating>=0?"positive":"negative")+'">'+(isReal?'—':money(floating))+'</b></div><div><small>DAILY P/L</small><b>'+(isReal?'—':money(day))+'</b></div>';
 $("bb-paper-lock").textContent=isReal?"REAL ACCOUNT SELECTED · PAPER EXECUTION ONLY · TESTING LEDGER":!executionState.demo_enabled?(executionState.global_halt?"GLOBAL EXECUTION HALT ACTIVE":"PAPER EXECUTION DISABLED BY ADMIN"):state.emergencyStop?"EMERGENCY STOP ACTIVE":locked?"DAILY LOSS LIMIT REACHED — NEW ORDERS BLOCKED":"PAPER TEST MODE · "+(RISK*100).toFixed(2)+"% PER TRADE · "+(DAILY*100).toFixed(2)+"% DAILY · "+(AGGREGATE*100).toFixed(2)+"% AGGREGATE";
 $("bb-paper-lock").className=locked?"bb-paper-alert danger":"bb-paper-alert";
 $("bb-paper-positions").innerHTML=state.positions.length?state.positions.map(p=>'<tr><td>'+esc(p.symbol)+'</td><td>'+p.side+'</td><td>'+fmt(p.quantity)+'</td><td>'+fmt(p.entry)+'</td><td>'+fmt(quote(p.symbol)||p.entry)+'</td><td>'+fmt(p.sl)+'</td><td>'+fmt(p.tp)+'</td><td>'+money(pnl(p))+'</td><td><button data-paper-modify="'+p.id+'">Modify</button> <button data-paper-close="'+p.id+'">Close</button></td></tr>').join(""):'<tr><td colspan="9">No open positions.</td></tr>';
  $("bb-paper-pending").innerHTML=(state.pendingOrders||[]).map(o=>'<tr><td>'+esc(o.symbol)+'</td><td>'+esc(o.orderType)+'</td><td>'+fmt(o.quantity)+'</td><td>'+fmt(o.entryPrice)+'</td><td>'+fmt(o.sl)+'</td><td>'+fmt(o.tp)+'</td><td><button data-paper-cancel="'+o.id+'">Cancel</button></td></tr>').join("")||'<tr><td colspan="7">No pending orders.</td></tr>';
 const rangeMs=({"1d":86400000,"1m":30*86400000,"3m":90*86400000,"6m":180*86400000})[historyRange]||86400000;const from=historyRange==="custom"&&historyFrom?Date.parse(historyFrom+"T00:00:00Z"):Date.now()-rangeMs;const to=historyRange==="custom"&&historyTo?Date.parse(historyTo+"T23:59:59Z"):Date.now();const historyRows=state.history.filter(p=>{const ts=Date.parse(p.closedAt||p.openedAt);return ts>=from&&ts<=to&&(historySymbol==="ALL"||p.symbol===historySymbol);});
 $("bb-paper-history").innerHTML=historyRows.slice(0,500).map(p=>'<tr><td>'+esc(p.symbol)+'</td><td>'+p.side+'</td><td>'+fmt(p.quantity)+'</td><td>'+fmt(p.entry)+'</td><td>'+fmt(p.exit)+'</td><td>'+money(p.pnl)+'</td><td>'+esc(p.reason)+'</td></tr>').join("")||'<tr><td colspan="7">No closed trades.</td></tr>';
 $("bb-paper-open-count").textContent=state.positions.length+" / "+MAX_OPEN+" open · PAPER";$("bb-paper-auto").textContent=state.autoEnabled?"AUTO STRATEGY: ON":"AUTO STRATEGY: OFF";$("bb-paper-auto").className=state.autoEnabled?"active-auto":"";
 $("bb-paper-symbol").value=ALL.includes($("bb-paper-symbol").value)?$("bb-paper-symbol").value:CRYPTO[0];$("bb-paper-price").textContent=Number.isFinite(quote($("bb-paper-symbol").value))?fmt(quote($("bb-paper-symbol").value)):"Quote unavailable";
}
function notify(s,bad){const n=$("bb-paper-message");if(n){n.textContent=s;n.className=bad?"bb-paper-alert danger":"bb-paper-alert";}}
async function manual(requestedSide){
 try{
  if(!activeAccountId)throw new Error("No approved trading account is selected.");
  const type=$("bb-paper-order-type").value;if(type!=="MARKET")throw new Error("Server pending-order processing is not enabled yet. Use Market Execution for this test build.");
  const symbol=$("bb-paper-symbol").value,sl=Number($("bb-paper-sl").value),tp=Number($("bb-paper-tp").value||0)||null,qty=Number($("bb-paper-quantity").value);
  const result=await paperApi("open",{symbol,side:requestedSide,quantity:qty,stop_loss:sl,take_profit:tp,source:"MANUAL"});
  await syncPaper("status");render();notify(requestedSide+" paper order filled at "+fmt(result.trade?.entry_price||result.quote)+" · "+(activeMode==="real"?"Real account test ledger":"Demo account"),false);
 }catch(e){notify(e.message,true);}
}
async function runBrain(){
 if(!activeAccountId||(activeMode==="demo"&&!executionState.demo_enabled)||!executionState.paper_enabled||scanBusy||!state.autoEnabled||state.emergencyStop||!client)return;scanBusy=true;
 try{
  const {data,error}=await client.functions.invoke("market-brain",{body:{}});if(error)throw error;if(!data||data.error)throw Error(data?.error||"Market Brain unavailable");
  for(const s of data.signals||[]){
   if(s.direction!=="BUY"&&s.direction!=="SELL")continue;
   if(Number(s.score)<80||s.data_status!=="FRESH"||!s.stop_loss||!s.take_profit)continue;
   const sym=String(s.symbol||"").replace("/","").toUpperCase();if(!["EURUSD","GBPUSD","XAUUSD"].includes(sym))continue;const instrument=sym==="EURUSD"?"EUR/USD":sym==="GBPUSD"?"GBP/USD":"XAU/USD";
   if(state.positions.some(p=>p.symbol===instrument)||state.history.some(p=>p.symbol===instrument&&Date.now()-Date.parse(p.closedAt)<30*60*1000))continue;
   const q=quote(instrument);if(!Number.isFinite(q)||q<s.entry_low||q>s.entry_high)continue;
   const riskBudget=state.balance*RISK,perUnit=Math.abs(q-Number(s.stop_loss))*contractSize(instrument);if(!perUnit)continue;const qty=riskBudget/perUnit;
   try{await paperApi("open",{symbol:instrument,side:s.direction,quantity:qty,stop_loss:Number(s.stop_loss),take_profit:Number(s.take_profit),source:"AI MARKET BRAIN · "+s.score+"/100"});state.lastSignalAt=new Date().toISOString();notify("AI paper signal processed: "+s.direction+" "+sym+" · score "+s.score+"/100",false);}catch(e){console.info("AI setup filtered:",e.message);}
  }
  await syncPaper("status");render();
 }catch(e){notify("AI automation paused: "+e.message,true);}
 finally{scanBusy=false;}
}
function attach(){
 if(!$("client-page")||!document.querySelector('.terminal-sidebar button.active[data-page="terminal"]')||$("bb-paper-terminal"))return;
 const host=document.querySelector(".bb-terminal-layout");if(!host)return;
 const panel=document.createElement("section");panel.id="bb-paper-terminal";panel.className="bb-paper-terminal";
 panel.innerHTML='<div class="bb-paper-head"><div><span class="free-tag">BIGBULLS TRADING TERMINAL</span><h3>BIGBULLS Trading</h3><p>DEMO & REAL ACCOUNTS · ONE TERMINAL · SERVER CONTROLLED ACCESS</p></div><div><span id="bb-paper-feed">Connecting approved data feeds…</span><div id="bb-paper-cloud">Checking cloud account…</div></div></div><div class="bb-paper-account-switch"><label>Account mode<select id="bb-account-mode"><option value="demo">DEMO ACCOUNT</option><option value="real">REAL ACCOUNT</option></select></label><label>Trading account<select id="bb-demo-account"><option value="">Loading accounts…</option></select></label><span id="bb-account-switch-status">Separate account balances, orders and histories</span></div><div id="bb-paper-live-locked" class="bb-paper-alert danger" hidden><b>REAL ACCOUNT · PAPER EXECUTION ONLY</b><br>This is a separate test ledger using indicative market quotes. Orders do not reach a broker or affect your funded balance. Live execution remains locked until a verified broker/LP route is connected.</div><div id="bb-paper-summary" class="bb-paper-summary"></div><div id="bb-paper-lock" class="bb-paper-alert"></div><div class="bb-paper-work"><div class="bb-paper-ticket"><h4>Order ticket</h4><label>Instrument<select id="bb-paper-symbol">'+ALL.map(s=>'<option value="'+s+'">'+s+'</option>').join("")+'</select></label><div class="bb-paper-current">LATEST PRICE <b id="bb-paper-price">—</b></div><label>Order type<select id="bb-paper-order-type"><option value="MARKET">Market Execution</option><option value="BUY_LIMIT">Buy Limit</option><option value="SELL_LIMIT">Sell Limit</option><option value="BUY_STOP">Buy Stop</option><option value="SELL_STOP">Sell Stop</option><option value="BUY_STOP_LIMIT">Buy Stop Limit</option><option value="SELL_STOP_LIMIT">Sell Stop Limit</option></select></label><label>Entry / Limit Price<input id="bb-paper-entry" type="number" step="any" placeholder="Pending order price"></label><label>Stop trigger (Stop Limit only)<input id="bb-paper-stop-trigger" type="number" step="any" placeholder="Stop trigger price"></label><label>Stop-limit price<input id="bb-paper-limit-price" type="number" step="any" placeholder="Limit price after trigger"></label><label>Volume (lots / units)<input id="bb-paper-quantity" type="number" min="0.01" step="0.01" value="0.01"></label><label>Trailing stop distance (price units)<input id="bb-paper-trailing" type="number" min="0" step="any" value="0" placeholder="0 = disabled"></label><label>Stop loss<input id="bb-paper-sl" type="number" step="any" placeholder="Required"></label><label>Take profit<input id="bb-paper-tp" type="number" step="any" placeholder="Optional"></label><div class="bb-paper-risk-note">Contract model: FX 100,000 units/lot · Gold 100 oz/lot · Crypto 1 coin/unit. Indicative feed prices, simulated fills and P/L only; spread, swaps and broker slippage are not replicated.</div><div class="bb-paper-buttons"><button id="bb-paper-buy">BUY / LONG</button><button id="bb-paper-sell">SELL / SHORT</button></div><button id="bb-paper-auto" class="bb-paper-auto">AUTO STRATEGY: OFF</button><button id="bb-paper-stop" class="bb-paper-stop">EMERGENCY STOP</button><div id="bb-paper-message" class="bb-paper-alert"></div></div><div class="bb-paper-table-wrap"><div class="bb-paper-table-head"><h4>Open positions</h4><span id="bb-paper-open-count">0 / 5</span></div><div class="bb-paper-table-scroll"><table><thead><tr><th>Symbol</th><th>Side</th><th>Qty</th><th>Entry</th><th>Mark</th><th>SL</th><th>TP</th><th>Floating P/L</th><th>Actions</th></tr></thead><tbody id="bb-paper-positions"></tbody></table></div><h4>Pending orders</h4><div class="bb-paper-table-scroll"><table><thead><tr><th>Symbol</th><th>Type</th><th>Qty</th><th>Entry</th><th>SL</th><th>TP</th><th>Action</th></tr></thead><tbody id="bb-paper-pending"></tbody></table></div><div class="bb-history-toolbar"><button type="button" id="bb-history-toggle">History range ▾</button><select id="bb-history-symbol"><option value="ALL">All pairs</option><option value="BTCUSDT">BTCUSDT</option><option value="ETHUSDT">ETHUSDT</option><option value="BNBUSDT">BNBUSDT</option><option value="SOLUSDT">SOLUSDT</option><option value="XRPUSDT">XRPUSDT</option><option value="DOGEUSDT">DOGEUSDT</option><option value="EUR/USD">EUR/USD</option><option value="GBP/USD">GBP/USD</option><option value="XAU/USD">XAU/USD</option></select><span id="bb-history-range-label">Last 1 day</span></div><div id="bb-history-options" class="bb-history-options" hidden><button type="button" data-history-range="1d">1 Day</button><button type="button" data-history-range="1m">1 Month</button><button type="button" data-history-range="3m">3 Months</button><button type="button" data-history-range="6m">6 Months</button><button type="button" data-history-range="custom">Custom</button><div id="bb-history-custom" hidden><label>From <input id="bb-history-from" type="date"></label><label>To <input id="bb-history-to" type="date"></label><button type="button" id="bb-history-apply">Apply dates</button></div></div><h4>Trade history</h4><div class="bb-paper-table-scroll"><table><thead><tr><th>Symbol</th><th>Side</th><th>Qty</th><th>Entry</th><th>Exit</th><th>P/L</th><th>Reason</th></tr></thead><tbody id="bb-paper-history"></tbody></table></div></div></div><div class="bb-paper-foot">Cloud sync requires migration 009 in Supabase. FX/Gold prices use your server-side Twelve Data key via the market-data Edge Function; crypto uses Binance public spot. Index feeds are not enabled until a provider confirms the required index instruments and contract metadata. Auto mode is paper-only, requires score ≥80, fresh signal, price inside entry zone, SL/TP, risk checks and cooldown. No profitability or accuracy is guaranteed.</div>';
 host.insertAdjacentElement("afterend",panel);
 $("bb-paper-buy").onclick=()=>manual("BUY");$("bb-paper-sell").onclick=()=>manual("SELL");$("bb-paper-symbol").onchange=render;$("bb-paper-order-type").onchange=()=>{const t=$("bb-paper-order-type").value;$("bb-paper-entry").parentElement.style.display=t==="MARKET"?"none":"";$("bb-paper-stop-trigger").parentElement.style.display=t.endsWith("STOP_LIMIT")?"":"none";$("bb-paper-limit-price").parentElement.style.display=t.endsWith("STOP_LIMIT")?"":"none";};$("bb-paper-order-type").dispatchEvent(new Event("change"));$("bb-demo-account").onchange=e=>switchDemoAccount(e.target.value);$("bb-account-mode").onchange=e=>switchAccountMode(e.target.value);
 $("bb-history-toggle").onclick=()=>{$("bb-history-options").hidden=!$("bb-history-options").hidden;};$("bb-history-symbol").onchange=e=>{historySymbol=e.target.value;render();};document.querySelectorAll("[data-history-range]").forEach(btn=>btn.onclick=()=>{historyRange=btn.dataset.historyRange;$("bb-history-custom").hidden=historyRange!=="custom";$("bb-history-range-label").textContent=({"1d":"Last 1 day","1m":"Last 1 month","3m":"Last 3 months","6m":"Last 6 months",custom:"Custom range"})[historyRange];if(historyRange!=="custom")render();});$("bb-history-apply").onclick=()=>{historyFrom=$("bb-history-from").value;historyTo=$("bb-history-to").value;if(!historyFrom||!historyTo||historyTo<historyFrom){notify("Choose a valid custom date range.",true);return;}historyRange="custom";$("bb-history-range-label").textContent=historyFrom+" → "+historyTo;render();};
 $("bb-paper-auto").onclick=async()=>{try{await paperApi("auto_toggle",{enabled:!state.autoEnabled});await syncPaper("status");render();notify(state.autoEnabled?"AI paper automation enabled.":"AI paper automation paused.",false);if(state.autoEnabled)runBrain();}catch(e){notify(e.message,true);}};
 $("bb-paper-stop").onclick=async()=>{try{await paperApi("stop");await syncPaper("status");render();notify("Emergency stop active on server. Existing positions remain managed by server SL/TP.",true);}catch(e){notify(e.message,true);}};
 $("bb-paper-positions").onclick=async e=>{const m=e.target.closest("[data-paper-modify]");if(m){modifyPosition(m.dataset.paperModify);return;}const b=e.target.closest("[data-paper-close]");if(!b)return;try{await paperApi("close",{trade_id:b.dataset.paperClose,reason:"MANUAL CLOSE"});await syncPaper("status");render();notify("Paper position closed.",false);}catch(err){notify(err.message,true);}};$("bb-paper-pending").onclick=e=>{const b=e.target.closest("[data-paper-cancel]");if(b)cancelPending(b.dataset.paperCancel);};
 render();fetchQuotes();if(timer)clearInterval(timer);timer=setInterval(fetchQuotes,15000);if(brainTimer)clearInterval(brainTimer);brainTimer=setInterval(runBrain,60000);
}
async function initUser(){
 try{if(window.supabase?.createClient){client=window.supabase.createClient(SB_URL,SB_KEY);client.auth.onAuthStateChange(async(_event,session)=>{user=session?.user||null;if(user){await loadCloud();attach();render();}else{state=blank();}});const {data}=await client.auth.getUser();user=data?.user||null;if(user)await loadCloud();}}
 catch(e){console.warn("Paper account init:",e.message);}
 attach();
}
function init(){initUser();observer=new MutationObserver(()=>{if(!$("bb-paper-terminal"))attach();});observer.observe(document.body,{childList:true,subtree:true});}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();
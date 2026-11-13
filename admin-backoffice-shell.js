(function(){
"use strict";
const STYLE_ID="bb-admin-shell-style";
const ROOT_ID="bb-admin-shell";
const GROUPS=[
 {id:"overview",label:"Overview",icon:"▦",match:/^overview|^admin workspace|^operations control centre|^payment review|^product access|^market data|^broker execution/i},
 {id:"clients",label:"Client Operations",icon:"♙",match:/client & trading account|portal account requests|client account/i},
 {id:"finance",label:"Finance & Treasury",icon:"＄",match:/payment wallet|pending payment|wallet|payment|transaction|deposit|withdrawal|payout/i},
 {id:"compliance",label:"KYC & Compliance",icon:"✓",match:/kyc verification|kyc review|compliance/i},
 {id:"partners",label:"IB & Partners",icon:"♧",match:/partner application|ib commission|commission management|partner operations/i},
 {id:"support",label:"Support Desk",icon:"☏",match:/customer support|support desk/i},
 {id:"dealing",label:"Dealing & Execution",icon:"⌁",match:/mt5 trading|demo account monitor|trading account|market signals|publishing control/i},
 {id:"bbook",label:"B-Book Dealing",icon:"◈",match:/^b-book dealing/i},
 {id:"products",label:"Products & Licensing",icon:"⬡",match:/echo system|private echo|product order|license/i},
 {id:"system",label:"Platform Controls",icon:"⚙",match:/other platform controls|website theme|platform controls/i}
];
function addStyles(){
 if(document.getElementById(STYLE_ID))return;
 const s=document.createElement("style");s.id=STYLE_ID;s.textContent=`
 #${ROOT_ID}{--bb-ink:#14243b;--bb-muted:#718096;--bb-line:#e4eaf2;--bb-blue:#2563eb;color:var(--bb-ink);font:14px/1.5 Inter,system-ui,-apple-system,Segoe UI,sans-serif}
 #${ROOT_ID} *{box-sizing:border-box}
 #${ROOT_ID} .bb-admin-top{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:18px 22px;background:#fff;border:1px solid var(--bb-line);border-radius:18px;box-shadow:0 8px 26px #162b4808;margin-bottom:16px}
 #${ROOT_ID} .bb-admin-brand{display:flex;align-items:center;gap:12px;min-width:220px}
 #${ROOT_ID} .bb-admin-mark{display:grid;place-items:center;width:43px;height:43px;border-radius:13px;background:#111e33;color:#fff;font-size:23px;font-weight:900;letter-spacing:-2px}
 #${ROOT_ID} .bb-admin-brand strong{display:block;font-size:14px;letter-spacing:.11em}
 #${ROOT_ID} .bb-admin-brand small{display:block;color:var(--bb-muted);font-size:10px;letter-spacing:.15em;text-transform:uppercase}
 #${ROOT_ID} .bb-admin-subtitle{color:var(--bb-muted);font-size:12px;margin-top:3px}
 #${ROOT_ID} .bb-admin-statuses{display:flex;align-items:center;justify-content:flex-end;gap:9px;flex-wrap:wrap}
 #${ROOT_ID} .bb-admin-status{border:1px solid var(--bb-line);border-radius:11px;padding:8px 11px;background:#fbfcfe;min-width:115px}
 #${ROOT_ID} .bb-admin-status small{display:block;color:var(--bb-muted);font-size:9px;letter-spacing:.1em;text-transform:uppercase}
 #${ROOT_ID} .bb-admin-status b{display:block;font-size:11px;margin-top:2px}
 #${ROOT_ID} .bb-admin-notice{border:0;border-radius:10px;background:#172a45;color:#fff;padding:10px 15px;font-weight:700;cursor:pointer}
 #${ROOT_ID} .bb-admin-frame{display:grid;grid-template-columns:248px minmax(0,1fr);gap:16px;align-items:start}
 #${ROOT_ID} .bb-admin-sidebar{position:sticky;top:12px;background:#111e33;color:#d9e3f1;border-radius:18px;padding:16px 12px;min-height:620px}
 #${ROOT_ID} .bb-admin-live{padding:12px;border:1px solid #31435e;border-radius:12px;margin:0 3px 16px;background:#1a2b45}
 #${ROOT_ID} .bb-admin-live b{display:block;color:#fff;font-size:12px}
 #${ROOT_ID} .bb-admin-live small{display:block;color:#9fb1c9;font-size:10px;margin-top:4px}
 #${ROOT_ID} .bb-admin-live i{display:inline-block;width:7px;height:7px;border-radius:50%;background:#e0a63a;margin-right:6px}
 #${ROOT_ID} .bb-admin-nav-label{font-size:9px;letter-spacing:.15em;color:#8498b3;padding:8px 10px;text-transform:uppercase}
 #${ROOT_ID} .bb-admin-nav{display:grid;gap:4px}
 #${ROOT_ID} .bb-admin-nav button{display:flex;align-items:center;gap:10px;text-align:left;width:100%;border:0;border-radius:10px;padding:10px;color:#b8c7da;background:transparent;font:600 12px/1.4 Inter,system-ui,sans-serif;cursor:pointer}
 #${ROOT_ID} .bb-admin-nav button:hover{background:#20334f;color:#fff}
 #${ROOT_ID} .bb-admin-nav button[aria-current=true]{background:#29466d;color:#fff;box-shadow:inset 3px 0 #69a6ff}
 #${ROOT_ID} .bb-admin-nav button span{width:19px;text-align:center;font-size:15px}
 #${ROOT_ID} .bb-admin-foot{border-top:1px solid #31435e;margin-top:20px;padding:13px 8px 4px;color:#91a4bd;font-size:10px}
 #${ROOT_ID} .bb-admin-foot b{display:block;color:#dce6f3;font-size:10px;margin-bottom:4px}
 #${ROOT_ID} .bb-admin-workspace{min-width:0;background:#f6f8fb;border:1px solid var(--bb-line);border-radius:18px;padding:18px}
 #${ROOT_ID} .bb-admin-pagehead{display:flex;justify-content:space-between;align-items:end;gap:12px;margin:0 0 16px}
 #${ROOT_ID} .bb-admin-pagehead small{font-size:9px;color:var(--bb-muted);letter-spacing:.15em;text-transform:uppercase}
 #${ROOT_ID} .bb-admin-pagehead h2{font-size:22px;letter-spacing:-.03em;margin:3px 0 0}
 #${ROOT_ID} .bb-admin-pane{display:none}
 #${ROOT_ID} .bb-admin-pane.is-active{display:block}
 #${ROOT_ID} .bb-admin-pane>.admin-section-heading:first-child{margin-top:0}
 #${ROOT_ID} .admin-section-heading{margin:22px 0 10px}
 #${ROOT_ID} .admin-section-heading h3{font-size:15px}
 #${ROOT_ID} .client-panel{border-color:var(--bb-line);border-radius:14px;box-shadow:0 5px 20px #1b355008}
 #${ROOT_ID} .admin-overview,#${ROOT_ID} .admin-metrics{border-radius:14px}
 #${ROOT_ID} .bb-admin-mobile{display:none}
 #${ROOT_ID} .bb-bbook-admin{display:grid;gap:14px}
 #${ROOT_ID} .bb-bbook-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
 #${ROOT_ID} .bb-bbook-head small{font-size:9px;letter-spacing:.14em;color:var(--bb-muted)}
 #${ROOT_ID} .bb-bbook-head h3{margin:3px 0;font-size:16px}
 #${ROOT_ID} .bb-bbook-head p{margin:3px 0;color:var(--bb-muted);font-size:12px}
 #${ROOT_ID} .bb-bbook-head>button,#${ROOT_ID} .bb-bbook-enable{border:1px solid #cbd5e1;border-radius:9px;padding:9px 13px;background:#fff;color:#172a45;font-weight:700;cursor:pointer}
 #${ROOT_ID} .bb-bbook-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
 #${ROOT_ID} .bb-bbook-stats>div{background:#fff;border:1px solid var(--bb-line);border-radius:12px;padding:13px}
 #${ROOT_ID} .bb-bbook-stats small{display:block;color:var(--bb-muted);font-size:9px;letter-spacing:.1em}
 #${ROOT_ID} .bb-bbook-stats b{display:block;font-size:18px;margin-top:5px}
 #${ROOT_ID} .bb-bbook-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
 #${ROOT_ID} .bb-bbook-grid .client-panel{padding:15px}
 #${ROOT_ID} .bb-bbook-formgrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
 #${ROOT_ID} .bb-bbook-admin label{display:grid;gap:4px;font-size:11px;font-weight:700;margin:8px 0}
 #${ROOT_ID} .bb-bbook-admin input,#${ROOT_ID} .bb-bbook-admin select{width:100%;min-width:0;padding:9px;border:1px solid var(--bb-line);border-radius:8px;background:#fff}
 #${ROOT_ID} .bb-bbook-admin .notice{font-size:11px;white-space:normal}
 #${ROOT_ID} .bb-bbook-tablewrap{overflow:auto}
 #${ROOT_ID} .bb-bbook-tablewrap table{width:100%;border-collapse:collapse;min-width:720px;font-size:11px}
 #${ROOT_ID} .bb-bbook-tablewrap th,#${ROOT_ID} .bb-bbook-tablewrap td{padding:9px 8px;border-bottom:1px solid var(--bb-line);text-align:left;white-space:nowrap}
 #${ROOT_ID} .bb-bbook-tablewrap th{color:var(--bb-muted);font-size:9px;text-transform:uppercase}
 @media(max-width:700px){#${ROOT_ID} .bb-bbook-stats{grid-template-columns:repeat(2,minmax(0,1fr))}#${ROOT_ID} .bb-bbook-grid{grid-template-columns:1fr}}

 @media(max-width:900px){#${ROOT_ID} .bb-admin-frame{grid-template-columns:1fr}#${ROOT_ID} .bb-admin-sidebar{position:relative;min-height:0}#${ROOT_ID} .bb-admin-nav{grid-template-columns:repeat(2,minmax(0,1fr))}#${ROOT_ID} .bb-admin-foot{display:none}}
 @media(max-width:620px){#${ROOT_ID} .bb-admin-top{align-items:flex-start;padding:13px;flex-direction:column}#${ROOT_ID} .bb-admin-statuses{justify-content:flex-start;width:100%}#${ROOT_ID} .bb-admin-status{flex:1;min-width:0}#${ROOT_ID} .bb-admin-frame{gap:10px}#${ROOT_ID} .bb-admin-sidebar{padding:10px}#${ROOT_ID} .bb-admin-nav{grid-template-columns:repeat(2,minmax(0,1fr))}#${ROOT_ID} .bb-admin-nav button{font-size:11px;padding:9px 7px}#${ROOT_ID} .bb-admin-workspace{padding:12px}#${ROOT_ID} .bb-admin-pagehead h2{font-size:19px}}
 `;
 document.head.appendChild(s);
}
function labelFor(node){
 const h=node.matches?.(".admin-section-heading")?node.querySelector("h3"):node.querySelector?.("h3,h2");
 return (h?.textContent||node.textContent||"").trim().replace(/\s+/g," ").slice(0,100);
}
function chooseGroup(label){
 const hit=GROUPS.find(g=>g.match.test(label));
 return hit?.id||"overview";
}
function decorate(){
 const page=document.getElementById("client-page");
 if(!page||!document.getElementById("bb-admin-users-panel")||page.closest("#"+ROOT_ID))return;
 addStyles();
 const original=Array.from(page.children);
 const root=document.createElement("section");root.id=ROOT_ID;
 const top=document.createElement("header");top.className="bb-admin-top";
 top.innerHTML='<div class="bb-admin-brand"><span class="bb-admin-mark">B</span><div><strong>BIGBULLS GLOBAL</strong><small>Back-Office</small><div class="bb-admin-subtitle">Institutional Client Operations &amp; Dealing Desk</div></div></div><div class="bb-admin-statuses"><div class="bb-admin-status"><small>B-Book Engine</small><b data-bb-bbook-engine-status>Checking…</b></div><div class="bb-admin-status"><small>Master Liquidity Pool</small><b data-bb-bbook-pool-status>Loading…</b></div><button class="bb-admin-notice" type="button" data-bb-admin-notice>Notice</button><div class="bb-admin-status"><small>Desk</small><b>Quetta / Dubai · GMT+5</b></div></div>';
 const frame=document.createElement("div");frame.className="bb-admin-frame";
 const side=document.createElement("aside");side.className="bb-admin-sidebar";
 side.innerHTML='<div class="bb-admin-live"><b>SUPER ADMIN DESK</b><small><i></i> AUTHENTICATED WORKSPACE</small></div><div class="bb-admin-nav-label">Operations &amp; Compliance</div><nav class="bb-admin-nav" aria-label="Admin sections"></nav><div class="bb-admin-foot"><b>PLATFORM HEALTH</b>TwelveData Quote Engine · status shown in Market Data panel<br>Auto-Payout Rail · not configured until provider is connected</div>';
 const nav=side.querySelector("nav");
 const workspace=document.createElement("main");workspace.className="bb-admin-workspace";
 const pagehead=document.createElement("div");pagehead.className="bb-admin-pagehead";pagehead.innerHTML='<div><small>BIGBULLS GLOBAL / BACK-OFFICE</small><h2>Operations Overview</h2></div><span class="admin-secure">● ADMIN ROLE VERIFIED</span>';
 workspace.append(pagehead);
 const panes=new Map();GROUPS.forEach(g=>{const pane=document.createElement("section");pane.className="bb-admin-pane";pane.dataset.pane=g.id;workspace.append(pane);panes.set(g.id,pane);
 const btn=document.createElement("button");btn.type="button";btn.dataset.bbTab=g.id;btn.innerHTML='<span>'+g.icon+'</span>'+g.label;btn.addEventListener("click",()=>activate(g.id));nav.append(btn);});
 // Native B-Book back-office. All financial writes are routed through the authenticated Edge Function.
 const bbookPane=panes.get("bbook");
 bbookPane.innerHTML='<section class="bb-bbook-admin"><div class="bb-bbook-head"><div><small>IN-HOUSE MARKET MAKER</small><h3>B-Book Liquidity &amp; Execution Control</h3><p>REAL account counterparty ledger, liquidity reserve, spread controls and open exposure.</p></div><button type="button" data-bb-bbook-refresh>Refresh</button><button type="button" data-bb-bbook-worker-toggle>Pause risk worker</button></div><p class="notice" data-bb-bbook-worker-note>Server-side risk monitoring runs every minute, independently of an open client terminal. It uses indicative price references, not an external liquidity provider.</p><div class="bb-bbook-stats" data-bb-bbook-stats><div>Loading B-Book state…</div></div><div class="bb-bbook-grid"><section class="client-panel"><h3>Master B-Book Book Capital</h3><p class="notice">The opening balance is a configured internal book-capital ledger, not independently verified cash reserves. Only record capital movements backed by verified funding or payout references.</p><form data-bb-bbook-capital><label>Action<select name="direction"><option value="DEPOSIT">Record verified capital inflow</option><option value="WITHDRAWAL">Record capital withdrawal</option></select></label><label>Amount (USD)<input name="amount" type="number" min="0.01" step="0.01" required></label><label>Audit note<input name="note" maxlength="250" placeholder="Settled funding reference / bank proof ID" required></label><button type="submit" class="portal-primary">Record capital movement</button><p data-bb-bbook-capital-status class="notice">Only record capital already received and independently verified. Movements are audit logged; reserved payouts cannot be withdrawn.</p></form></section><section class="client-panel"><h3>Spread, Leverage &amp; Risk Controls</h3><form data-bb-bbook-settings><div class="bb-bbook-formgrid"><label>Default leverage<input name="default_leverage" type="number" min="1" max="500" step="1"></label><label>Maximum leverage<input name="max_leverage" type="number" min="1" max="1000" step="1"></label><label>FX spread (bps)<input name="FX" type="number" min="0" max="100" step=".1"></label><label>Gold spread (bps)<input name="XAUUSD" type="number" min="0" max="100" step=".1"></label><label>Crypto spread (bps)<input name="CRYPTO" type="number" min="0" max="100" step=".1"></label><label>Margin call level (%)<input name="margin_call_level_pct" type="number" min="50" max="1000"></label><label>Stop-out level (%)<input name="stop_out_level_pct" type="number" min="10" max="100"></label></div><button type="submit" class="portal-primary">Save dealing controls</button><p data-bb-bbook-settings-status class="notice">Execution status is synced from live B-Book settings. Risk, margin and liquidity controls remain enforced.</p></form><button type="button" data-bb-bbook-enable class="bb-bbook-enable">Enable REAL B-Book</button></section></div><section class="client-panel"><div class="bb-bbook-head"><h3>Live Open Positions &amp; House Exposure</h3><span data-bb-bbook-exposure>—</span></div><div class="bb-bbook-tablewrap"><table><thead><tr><th>Account</th><th>Symbol</th><th>Side</th><th>Lots</th><th>Entry</th><th>Margin</th><th>Floating P/L</th><th>Opened</th></tr></thead><tbody data-bb-bbook-positions><tr><td colspan="8">Loading positions…</td></tr></tbody></table></div></section><section class="client-panel"><h3>Liquidity Audit Ledger</h3><div class="bb-bbook-tablewrap"><table><thead><tr><th>Time</th><th>Type</th><th>Direction</th><th>Amount</th><th>Balance After</th><th>Note</th></tr></thead><tbody data-bb-bbook-ledger><tr><td colspan="6">Loading ledger…</td></tr></tbody></table></div></section></section>';
 const bbookClient=()=>window.__bbSupabaseClient||window.bigbullsSupabase||null;
 const bbookEsc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const bbookMoney=v=>"$"+Number(v||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
 async function refreshBbook(){
   if(bbookPane.dataset.refreshing==="1")return;
   bbookPane.dataset.refreshing="1";
   const client=bbookClient(),stats=bbookPane.querySelector("[data-bb-bbook-stats]");
   if(!client?.functions){if(stats)stats.textContent="Secure Supabase client unavailable.";bbookPane.dataset.refreshing="0";return;}
   const refresh=bbookPane.querySelector("[data-bb-bbook-refresh]");if(refresh)refresh.disabled=true;
   try{
     const result=await client.functions.invoke("bbook-engine",{body:{action:"admin_status"}});
     if(result.error||result.data?.error)throw new Error(result.data?.error||result.error?.message||"B-Book service unavailable.");
     const d=result.data||{},pool=d.pool||{},m=d.metrics||{},cfg=d.settings||{};
     const capital=Number(pool.capital_balance||0),reserved=Number(pool.reserved_payout||0);
     const worker=d.worker||{};bbookPane.dataset.workerEnabled=String(worker.enabled===true);stats.innerHTML='<div><small>MASTER BOOK CAPITAL</small><b>'+bbookMoney(capital)+'</b></div><div><small>RESERVED PAYOUT</small><b>'+bbookMoney(reserved)+'</b></div><div><small>AVAILABLE BOOK CAPITAL</small><b>'+bbookMoney(capital-reserved)+'</b></div><div><small>OPEN POSITIONS</small><b>'+Number(m.open_positions||0)+'</b></div><div><small>GROSS EXPOSURE</small><b>'+bbookMoney(m.gross_exposure)+'</b></div><div><small>HOUSE FLOATING P/L</small><b>'+bbookMoney(m.house_net_pnl)+'</b></div><div><small>CLIENT PROFIT SETTLED</small><b>'+bbookMoney(pool.total_client_profit)+'</b></div><div><small>CLIENT LOSS SETTLED</small><b>'+bbookMoney(pool.total_client_loss)+'</b></div><div><small>SERVER RISK WORKER</small><b>'+(worker.enabled?'ACTIVE':'PAUSED')+'</b></div><div><small>POSITIONS PROCESSED</small><b>'+Number(worker.last_processed||0)+'</b></div><div><small>AUTO-CLOSES</small><b>'+Number(worker.last_closed||0)+'</b></div><div><small>MARGIN-CALL ACCOUNTS</small><b>'+(worker.margin_call_accounts||[]).length+'</b></div>';
     const root=bbookPane.closest("#"+ROOT_ID);
     const engineStatus=root?.querySelector("[data-bb-bbook-engine-status]");
     const poolStatus=root?.querySelector("[data-bb-bbook-pool-status]");
     if(engineStatus)engineStatus.textContent=cfg.enabled?"ENABLED":"LOCKED";
     const workerButton=bbookPane.querySelector("[data-bb-bbook-worker-toggle]"),workerNote=bbookPane.querySelector("[data-bb-bbook-worker-note]");
     if(workerButton)workerButton.textContent=worker.enabled?"Pause risk worker":"Resume risk worker";
     if(workerNote)workerNote.textContent="Server-side risk monitoring runs every minute, independently of an open client terminal. Last run: "+(worker.last_run_at?new Date(worker.last_run_at).toLocaleString():"Waiting for first run")+(worker.last_error?" · Last error: "+worker.last_error:"")+". Price references are indicative; no external liquidity provider is used.";
     if(poolStatus)poolStatus.textContent=bbookMoney(capital);
     const exposure=bbookPane.querySelector("[data-bb-bbook-exposure]");if(exposure)exposure.textContent="Gross "+bbookMoney(m.gross_exposure)+" · House net "+bbookMoney(m.house_net_pnl);
     const pos=bbookPane.querySelector("[data-bb-bbook-positions]");
     pos.innerHTML=(d.positions||[]).length?(d.positions||[]).map(p=>'<tr><td>#'+bbookEsc(p.trading_accounts?.account_number||p.account_id)+'</td><td>'+bbookEsc(p.symbol)+'</td><td>'+bbookEsc(p.side)+'</td><td>'+Number(p.quantity||0).toFixed(2)+'</td><td>'+Number(p.entry_price||0).toFixed(5)+'</td><td>'+bbookMoney(p.margin_used)+'</td><td>'+bbookMoney(p.floating_pnl)+'</td><td>'+bbookEsc(new Date(p.opened_at).toLocaleString())+'</td></tr>').join(""):'<tr><td colspan="8">No open B-Book positions.</td></tr>';
     const ledger=bbookPane.querySelector("[data-bb-bbook-ledger]");
     ledger.innerHTML=(d.ledger||[]).length?(d.ledger||[]).map(x=>'<tr><td>'+bbookEsc(new Date(x.created_at).toLocaleString())+'</td><td>'+bbookEsc(x.entry_type)+'</td><td>'+bbookEsc(x.direction)+'</td><td>'+bbookMoney(x.amount)+'</td><td>'+bbookMoney(x.balance_after)+'</td><td>'+bbookEsc(x.note||"—")+'</td></tr>').join(""):'<tr><td colspan="6">No liquidity ledger entries yet.</td></tr>';
     const form=bbookPane.querySelector("[data-bb-bbook-settings]");
     if(form&&!form.dataset.loaded){form.elements.default_leverage.value=cfg.default_leverage||100;form.elements.max_leverage.value=cfg.max_leverage||500;form.elements.FX.value=cfg.spread_bps?.FX??2;form.elements.XAUUSD.value=cfg.spread_bps?.XAUUSD??4;form.elements.CRYPTO.value=cfg.spread_bps?.CRYPTO??10;form.elements.margin_call_level_pct.value=cfg.margin_call_level_pct||100;form.elements.stop_out_level_pct.value=cfg.stop_out_level_pct||50;form.dataset.loaded="1";}
   }catch(e){if(stats)stats.textContent="B-Book load failed: "+(e?.message||"Unknown error");const root=bbookPane.closest("#"+ROOT_ID);const engine=root?.querySelector("[data-bb-bbook-engine-status]"),poolStatus=root?.querySelector("[data-bb-bbook-pool-status]");if(engine)engine.textContent="UNAVAILABLE";if(poolStatus)poolStatus.textContent="UNAVAILABLE";}
   finally{if(refresh)refresh.disabled=false;bbookPane.dataset.refreshing="0";}
 }
 bbookPane.querySelector("[data-bb-bbook-refresh]").addEventListener("click",refreshBbook);
 bbookPane.querySelector("[data-bb-bbook-worker-toggle]").addEventListener("click",async()=>{
   const button=bbookPane.querySelector("[data-bb-bbook-worker-toggle]"),note=bbookPane.querySelector("[data-bb-bbook-worker-note]"),enabled=bbookPane.dataset.workerEnabled!=="true";
   button.disabled=true;if(note)note.textContent=enabled?"Enabling server-side risk monitoring…":"Pausing server-side risk monitoring…";
   try{const result=await bbookClient().functions.invoke("bbook-engine",{body:{action:"admin_worker_toggle",enabled}});
     if(result.error||result.data?.error)throw new Error(result.data?.error||result.error?.message||"Worker setting update failed.");
     await refreshBbook();
   }catch(err){if(note)note.textContent="Worker setting not changed: "+(err?.message||"Unknown error");}
   finally{button.disabled=false;}
 });
 bbookPane.querySelector("[data-bb-bbook-capital]").addEventListener("submit",async e=>{
   e.preventDefault();const form=e.currentTarget,button=form.querySelector('button[type="submit"]'),status=form.querySelector("[data-bb-bbook-capital-status]"),client=bbookClient();
   button.disabled=true;status.textContent="Submitting audited liquidity movement…";
   try{const result=await client.functions.invoke("bbook-engine",{body:{action:"admin_adjust_liquidity",direction:form.elements.direction.value,amount:Number(form.elements.amount.value),note:form.elements.note.value}});
     if(result.error||result.data?.error)throw new Error(result.data?.error||result.error?.message||"Capital adjustment failed.");
     status.textContent="Liquidity capital movement recorded successfully.";form.reset();await refreshBbook();
   }catch(err){status.textContent="Not completed: "+(err?.message||"Unknown error");}
   finally{button.disabled=false;}
 });
 bbookPane.querySelector("[data-bb-bbook-settings]").addEventListener("submit",async e=>{
   e.preventDefault();const form=e.currentTarget,button=form.querySelector('button[type="submit"]'),status=form.querySelector("[data-bb-bbook-settings-status]"),client=bbookClient();
   button.disabled=true;status.textContent="Saving dealing controls…";
   try{const result=await client.functions.invoke("bbook-engine",{body:{action:"admin_update_settings",default_leverage:Number(form.elements.default_leverage.value),max_leverage:Number(form.elements.max_leverage.value),spread_bps:{FX:Number(form.elements.FX.value),XAUUSD:Number(form.elements.XAUUSD.value),CRYPTO:Number(form.elements.CRYPTO.value)},margin_call_level_pct:Number(form.elements.margin_call_level_pct.value),stop_out_level_pct:Number(form.elements.stop_out_level_pct.value)}});
     if(result.error||result.data?.error)throw new Error(result.data?.error||result.error?.message||"Settings update failed.");
     status.textContent="Dealing settings saved.";await refreshBbook();
   }catch(err){status.textContent="Not saved: "+(err?.message||"Unknown error");}
   finally{button.disabled=false;}
 });
 const adminBbookRealtime=bbookClient();
 if(adminBbookRealtime?.channel){
   adminBbookRealtime.channel("bb-bbook-admin-live")
    .on("postgres_changes",{event:"*",schema:"public",table:"bb_bbook_positions"},()=>refreshBbook())
    .on("postgres_changes",{event:"*",schema:"public",table:"bb_bbook_liquidity_pool"},()=>refreshBbook())
    .on("postgres_changes",{event:"*",schema:"public",table:"bb_bbook_liquidity_ledger"},()=>refreshBbook())
    .subscribe();
 }
 bbookPane.querySelector("[data-bb-bbook-enable]").addEventListener("click",async()=>{
   const button=bbookPane.querySelector("[data-bb-bbook-enable]"),status=bbookPane.querySelector("[data-bb-bbook-settings-status]");
   button.disabled=true;status.textContent="Checking regulatory, liquidity, settlement and reconciliation readiness…";
   try{const result=await bbookClient().functions.invoke("bbook-engine",{body:{action:"admin_update_settings",enabled:true}});
     if(result.error||result.data?.error)throw new Error(result.data?.error||result.error?.message||"B-Book enable was rejected.");
     status.textContent="REAL B-Book enabled.";await refreshBbook();
   }catch(err){status.textContent="REAL execution remains locked: "+(err?.message||"Readiness checks incomplete.");}
   finally{button.disabled=false;}
 });

 // Keep each original node and its event handlers intact; only move it into its tab pane.
 let currentGroup="overview";
 original.forEach(node=>{
   const label=labelFor(node);
   if(node.classList.contains("admin-section-heading"))currentGroup=chooseGroup(label);
   const pane=panes.get(currentGroup)||panes.get("overview");
   pane.appendChild(node);
 });
 frame.append(side,workspace);root.append(top,frame);
 page.replaceChildren(root);
 function activate(id){
  panes.forEach((p,k)=>p.classList.toggle("is-active",k===id));
  nav.querySelectorAll("button").forEach(b=>b.setAttribute("aria-current",String(b.dataset.bbTab===id)));
  const group=GROUPS.find(g=>g.id===id);pagehead.querySelector("h2").textContent=group?.label||"Operations Overview";
  if(id==="bbook")refreshBbook();
 }
 activate("overview");
 refreshBbook();
 window.setInterval(()=>{if(document.getElementById(ROOT_ID))refreshBbook();},15000);
 top.querySelector("[data-bb-admin-notice]").addEventListener("click",()=>{
   const existing=document.getElementById("bb-admin-notice-dialog");if(existing){existing.remove();return;}
   const d=document.createElement("section");d.id="bb-admin-notice-dialog";d.className="client-panel";d.style.marginTop="12px";
   d.innerHTML='<h3>Client Notice Broadcast</h3><p>Send an announcement to registered client accounts. Each recipient receives an item in their in-app Notification Centre. This action is recorded in the Admin Audit Log.</p><form id="bb-admin-broadcast-form" class="client-form"><label>Notice title<input name="title" required minlength="3" maxlength="120" placeholder="Platform maintenance update"></label><label>Message<textarea name="message" required minlength="3" maxlength="2000" rows="4" placeholder="Write the client announcement…"></textarea></label><div data-bb-broadcast-status class="notice">Review the message before sending. Broadcasts cannot be recalled.</div><button type="submit" class="portal-primary">Send to all registered clients</button><button type="button" class="copy-wallet" data-close-bb-notice>Cancel</button></form>';
   root.insertBefore(d,frame);
   d.querySelector("[data-close-bb-notice]").addEventListener("click",()=>d.remove());
   d.querySelector("form").addEventListener("submit",async e=>{
     e.preventDefault();const form=e.currentTarget,button=form.querySelector('button[type="submit"]'),status=form.querySelector("[data-bb-broadcast-status]");
     const title=String(form.elements.title.value||"").trim(),message=String(form.elements.message.value||"").trim();
     if(!title||!message)return;
     const client=window.__bbSupabaseClient;if(!client){status.textContent="Secure database connection unavailable. Nothing was sent.";return;}
     button.disabled=true;status.textContent="Sending announcement securely…";
     try{const result=await client.rpc("admin_broadcast_client_notice",{p_title:title,p_message:message});
       if(result.error)throw result.error;
       status.textContent="Sent successfully to "+Number(result.data||0).toLocaleString()+" registered client accounts. Audit record created.";
       form.reset();button.textContent="Broadcast sent";button.disabled=true;
     }catch(err){status.textContent="Broadcast failed: "+(err?.message||"Unknown error")+". No success was reported.";button.disabled=false;}
   });
 });
}
const observer=new MutationObserver(()=>{if(document.getElementById("client-page")&&!document.getElementById(ROOT_ID))decorate();});
observer.observe(document.documentElement,{childList:true,subtree:true});
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",decorate);else decorate();
})();
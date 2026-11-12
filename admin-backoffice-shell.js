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
 top.innerHTML='<div class="bb-admin-brand"><span class="bb-admin-mark">B</span><div><strong>BIGBULLS GLOBAL</strong><small>Back-Office</small><div class="bb-admin-subtitle">Institutional Client Operations &amp; Dealing Desk</div></div></div><div class="bb-admin-statuses"><div class="bb-admin-status"><small>MT5 Bridge</small><b>Not connected</b></div><div class="bb-admin-status"><small>Broker Liquidity Pool</small><b>Not configured</b></div><button class="bb-admin-notice" type="button" data-bb-admin-notice>Notice</button><div class="bb-admin-status"><small>Desk</small><b>Quetta / Dubai · GMT+5</b></div></div>';
 const frame=document.createElement("div");frame.className="bb-admin-frame";
 const side=document.createElement("aside");side.className="bb-admin-sidebar";
 side.innerHTML='<div class="bb-admin-live"><b>SUPER ADMIN DESK</b><small><i></i> AUTHENTICATED WORKSPACE</small></div><div class="bb-admin-nav-label">Operations &amp; Compliance</div><nav class="bb-admin-nav" aria-label="Admin sections"></nav><div class="bb-admin-foot"><b>PLATFORM HEALTH</b>TwelveData Quote Engine · status shown in Market Data panel<br>Auto-Payout Rail · not configured until provider is connected</div>';
 const nav=side.querySelector("nav");
 const workspace=document.createElement("main");workspace.className="bb-admin-workspace";
 const pagehead=document.createElement("div");pagehead.className="bb-admin-pagehead";pagehead.innerHTML='<div><small>BIGBULLS GLOBAL / BACK-OFFICE</small><h2>Operations Overview</h2></div><span class="admin-secure">● ADMIN ROLE VERIFIED</span>';
 workspace.append(pagehead);
 const panes=new Map();GROUPS.forEach(g=>{const pane=document.createElement("section");pane.className="bb-admin-pane";pane.dataset.pane=g.id;workspace.append(pane);panes.set(g.id,pane);
 const btn=document.createElement("button");btn.type="button";btn.dataset.bbTab=g.id;btn.innerHTML='<span>'+g.icon+'</span>'+g.label;btn.addEventListener("click",()=>activate(g.id));nav.append(btn);});
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
 }
 activate("overview");
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
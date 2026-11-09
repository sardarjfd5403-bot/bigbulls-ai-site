(function(){
"use strict";
const SUPABASE_URL="https://ztiiyulusburxjkpcfxu.supabase.co";
const SUPABASE_KEY="sb_publishable_5hDwqvbcUHeSJdXFHf9ugw_VPYGN4J_";
let client=null,sessionUser=null,adminLoaded=false;
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const date=v=>{try{return new Date(v).toLocaleString()}catch(_){return ""}};
function init(){
 if(!window.supabase?.createClient)return;
 client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
 client.auth.getSession().then(({data})=>{sessionUser=data.session?.user||null;renderCurrent();});
 client.auth.onAuthStateChange((_e,s)=>{sessionUser=s?.user||null;adminLoaded=false;renderCurrent();});
 const root=document.getElementById("app-shell");
 if(root)new MutationObserver(()=>renderCurrent()).observe(root,{childList:true,subtree:true});
 document.addEventListener("submit",handleSubmit);
 document.addEventListener("click",handleClick);
}
function renderCurrent(){
 const page=document.getElementById("client-page");
 if(!page||!sessionUser)return;
 if(location.hash==="#support"){} // Portal navigation is state-based; inspect visible page heading.
 const heading=document.querySelector(".terminal-page-head h2")?.textContent||"";
 if(heading==="Support"){
  if(page.dataset.supportReady==="1")return;
  page.dataset.supportReady="1";
  page.innerHTML='<div class="action-grid"><section class="client-panel"><h3>Open a support ticket</h3><p>Send your question to the BIGBULLS support team. You can track replies below.</p><form id="bb-support-form" class="client-form"><label>Subject<input name="subject" minlength="4" maxlength="160" required placeholder="How can we help?"></label><label>Category<select name="category"><option value="general">General</option><option value="account">Account</option><option value="wallet">Wallet / Payment</option><option value="technical">Technical</option><option value="license">License / Download</option><option value="kyc">KYC</option></select></label><label>Message<textarea name="message" minlength="10" maxlength="5000" rows="5" required placeholder="Describe your issue…"></textarea></label><button class="portal-primary" type="submit">Submit ticket</button></form><div id="bb-support-message" class="notice" hidden></div></section><section class="client-panel"><h3>My support tickets</h3><div id="bb-my-tickets">Loading tickets…</div></section></div>';
  loadMyTickets();
 }
 if(heading==="Admin Control Panel"&&sessionUser.app_metadata?.role==="admin"){
  const admin=document.getElementById("client-page");
  if(admin&&!admin.querySelector("#bb-admin-support")){
   const section=document.createElement("section");section.id="bb-admin-support";section.className="client-panel";section.style.marginTop="22px";section.innerHTML='<div class="admin-section-heading"><h3>Customer support queue</h3><span>REPLY · UPDATE STATUS</span></div><div id="bb-admin-tickets">Loading support tickets…</div>';admin.append(section);loadAdminTickets();
  }
 }
}
async function loadMyTickets(){
 const box=document.getElementById("bb-my-tickets");if(!box||!client)return;
 const {data,error}=await client.from("support_tickets").select("id,subject,category,message,status,admin_reply,created_at,updated_at").eq("user_id",sessionUser.id).order("created_at",{ascending:false}).limit(30);
 if(error){box.textContent="Could not load tickets: "+error.message;return;}
 box.innerHTML=data?.length?data.map(t=>'<article class="admin-row" style="display:block;margin:10px 0;padding:14px"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><b>'+esc(t.subject)+'</b><em class="status-'+esc(t.status)+'">'+esc(t.status)+'</em></div><small>'+esc(t.category)+' · '+esc(date(t.created_at))+'</small><p>'+esc(t.message)+'</p>'+(t.admin_reply?'<div class="notice"><b>Support reply</b><p>'+esc(t.admin_reply)+'</p></div>':'<small>Awaiting support response</small>')+'</article>').join(""):'<div class="empty-state">You have not submitted any support tickets yet.</div>';
}
async function loadAdminTickets(){
 const box=document.getElementById("bb-admin-tickets");if(!box||!client)return;
 const {data,error}=await client.from("support_tickets").select("id,user_id,subject,category,message,status,admin_reply,created_at").in("status",["open","in_progress"]).order("created_at",{ascending:true}).limit(100);
 if(error){box.textContent="Could not load support queue: "+error.message;return;}
 box.innerHTML=data?.length?data.map(t=>'<article class="admin-row" style="display:block;margin:12px 0;padding:14px"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><b>'+esc(t.subject)+'</b><em>'+esc(t.status)+'</em></div><small>'+esc(t.category)+' · Client '+esc(t.user_id)+' · '+esc(date(t.created_at))+'</small><p>'+esc(t.message)+'</p><form class="client-form bb-admin-ticket-form" data-ticket="'+esc(t.id)+'"><label>Reply<textarea name="admin_reply" rows="3" maxlength="5000">'+esc(t.admin_reply||"")+'</textarea></label><label>Status<select name="status"><option value="open" '+(t.status==="open"?"selected":"")+'>Open</option><option value="in_progress" '+(t.status==="in_progress"?"selected":"")+'>In progress</option><option value="resolved">Resolved</option><option value="closed">Closed</option></select></label><button class="portal-primary" type="submit">Save reply & status</button></form></article>').join(""):'<div class="empty-state">No open support tickets.</div>';
}
function showMessage(text,isError){const el=document.getElementById("bb-support-message");if(!el)return;el.hidden=false;el.textContent=text;el.className="notice"+(isError?" error":"");}
async function handleSubmit(e){
 const f=e.target;
 if(f.id==="bb-support-form"){
  e.preventDefault();const d=new FormData(f),btn=f.querySelector("button[type=submit]");btn.disabled=true;
  const {error}=await client.from("support_tickets").insert({user_id:sessionUser.id,subject:String(d.get("subject")).trim(),category:String(d.get("category")),message:String(d.get("message")).trim(),status:"open"});
  btn.disabled=false;if(error){showMessage("Ticket could not be submitted: "+error.message,true);return;}
  f.reset();showMessage("Your ticket has been submitted. Support will respond in your ticket history.",false);loadMyTickets();return;
 }
 if(f.classList.contains("bb-admin-ticket-form")){
  e.preventDefault();const d=new FormData(f),btn=f.querySelector("button[type=submit]");btn.disabled=true;
  const {error}=await client.from("support_tickets").update({admin_reply:String(d.get("admin_reply")||"").trim()||null,status:String(d.get("status")),updated_at:new Date().toISOString()}).eq("id",f.dataset.ticket);
  btn.disabled=false;if(error){btn.textContent="Save failed";alert("Ticket update failed: "+error.message);return;}
  loadAdminTickets();
 }
}
function handleClick(e){if(e.target.closest('[data-page="support"]')){setTimeout(renderCurrent,0);}}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();
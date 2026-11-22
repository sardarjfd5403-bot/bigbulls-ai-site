(function(){
"use strict";
const ROOT="bb-deposit-method-admin";
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const client=()=>window.__bbSupabaseClient||window.bigbullsSupabase||null;
async function mount(){
 const pane=document.querySelector("#bb-admin-shell [data-pane='finance']");
 if(!pane||document.getElementById(ROOT))return;
 const host=document.createElement("section");host.id=ROOT;host.className="client-panel";
 host.style.cssText="margin:16px 0;padding:18px;border:1px solid #e4eaf2;border-radius:16px;background:#fff;color:#14243b";
 host.innerHTML='<div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap"><div><h3 style="margin:0">Deposit Method Settings</h3><p style="margin:5px 0;color:#718096">Configure payment instructions and availability independently for Web and App. Existing transaction review and payout controls are unchanged.</p></div><button type="button" data-dm-refresh>Refresh methods</button></div><div data-dm-status role="status" style="margin:12px 0;color:#52647a">Loading secure settings…</div><div data-dm-list></div>';
 pane.prepend(host);
 const status=host.querySelector("[data-dm-status]"),list=host.querySelector("[data-dm-list]");
 async function load(){
  const db=client();if(!db){status.textContent="Secure Supabase client unavailable.";return;}
  status.textContent="Verifying administrator access…";
  const role=await db.rpc("is_bigbulls_admin");
  if(role.error||role.data!==true){status.textContent="Administrator permission required.";return;}
  const result=await db.from("deposit_method_settings").select("*").order("sort_order").order("display_name");
  if(result.error){status.textContent="Could not load deposit settings: "+result.error.message;return;}
  const rows=result.data||[];
  status.textContent=rows.length+" methods · changes save only to deposit-method configuration; transaction records and approval RPCs are not modified.";
  list.innerHTML=rows.map((m,i)=>'<form data-dm-form="'+esc(m.id)+'" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px;padding:14px 0;border-top:1px solid #e8edf4"><div style="grid-column:1/-1;display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap"><b>'+esc(m.display_name)+' <small style="color:#718096">('+esc(m.method_type)+')</small></b><code>'+esc(m.method_key)+'</code></div><label>Display name<input name="display_name" value="'+esc(m.display_name)+'" required></label><label>Asset<input name="asset" value="'+esc(m.asset)+'" required></label><label>Network / rail<input name="network" value="'+esc(m.network)+'" required></label><label>Account title<input name="account_title" value="'+esc(m.account_title||"")+'"></label><label>Account number / IBAN / wallet / Skrill email<input name="account_number" value="'+esc(m.account_number||"")+'"></label><label>Destination details<input name="destination_details" value="'+esc(m.destination_details||"")+'"></label><label>PNG logo URL / path<input name="logo_url" value="'+esc(m.logo_url||"")+'" placeholder="/assets/payment-logos/example.png"></label><label>Minimum (USD)<input name="min_amount_usd" type="number" min="0" step=".01" value="'+esc(m.min_amount_usd)+'" required></label><label>Maximum (USD; blank = no cap)<input name="max_amount_usd" type="number" min="0" step=".01" value="'+esc(m.max_amount_usd??"")+'"></label><label style="grid-column:1/-1">Client instructions<textarea name="instructions" rows="2">'+esc(m.instructions||"")+'</textarea></label><label><input name="active_web" type="checkbox" '+(m.active_web?"checked":"")+'> Active on Web</label><label><input name="active_app" type="checkbox" '+(m.active_app?"checked":"")+'> Active on App</label><div style="grid-column:1/-1"><button type="submit" style="background:#0b3d91;color:white;border:0;border-radius:9px;padding:10px 16px;font-weight:700">Save '+esc(m.display_name)+' settings</button><span data-dm-row-status style="margin-left:10px;color:#64748b"></span></div></form>').join("")||"No methods configured.";
 }
 host.querySelector("[data-dm-refresh]").addEventListener("click",load);
 list.addEventListener("submit",async e=>{
  const form=e.target.closest("[data-dm-form]");if(!form)return;e.preventDefault();
  const db=client(),out=form.querySelector("[data-dm-row-status]"),button=form.querySelector('button[type="submit"]');
  const role=await db.rpc("is_bigbulls_admin");if(role.error||role.data!==true){out.textContent="Admin permission required.";return;}
  const v=new FormData(form),max=String(v.get("max_amount_usd")||"").trim();
  const patch={display_name:String(v.get("display_name")||"").trim(),asset:String(v.get("asset")||"").trim(),network:String(v.get("network")||"").trim(),account_title:String(v.get("account_title")||"").trim()||null,account_number:String(v.get("account_number")||"").trim()||null,destination_details:String(v.get("destination_details")||"").trim(),logo_url:String(v.get("logo_url")||"").trim()||null,instructions:String(v.get("instructions")||"").trim()||null,min_amount_usd:Number(v.get("min_amount_usd")),max_amount_usd:max?Number(max):null,active_web:v.has("active_web"),active_app:v.has("active_app"),updated_at:new Date().toISOString()};
  if(!patch.display_name||!patch.asset||!patch.network||!Number.isFinite(patch.min_amount_usd)||patch.min_amount_usd<0||(patch.max_amount_usd!==null&&(!Number.isFinite(patch.max_amount_usd)||patch.max_amount_usd<patch.min_amount_usd))){out.textContent="Check required fields and min/max limits.";return;}
  button.disabled=true;out.textContent="Saving…";
  const saved=await db.from("deposit_method_settings").update(patch).eq("id",form.dataset.dmForm);
  button.disabled=false;
  if(saved.error){out.textContent="Not saved: "+saved.error.message;return;}
  out.textContent="Saved.";status.textContent="Settings updated. Client method visibility will follow the Web/App activation flags.";
 });
 await load();
}
const observer=new MutationObserver(()=>{if(document.querySelector("#bb-admin-shell [data-pane='finance']")&&!document.getElementById(ROOT))mount();});
observer.observe(document.documentElement,{childList:true,subtree:true});
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",mount);else mount();
})();
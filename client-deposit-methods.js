(function(){
"use strict";
const ROOT="bb-configured-deposit-methods";
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const db=()=>window.__bbSupabaseClient||window.bigbullsSupabase||null;
let methods=[],loading=false;
const style=`
#bb-config-deposit-wrap{margin:12px 0}
.bb-cdm-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin:10px 0}
.bb-cdm-choice{display:flex;align-items:center;gap:9px;border:1px solid #dbe3ee;border-radius:12px;padding:10px;background:#fff;cursor:pointer;min-width:0}
.bb-cdm-choice:has(input:checked){border:2px solid #0066ff;background:#f3f7ff}
.bb-cdm-choice img{width:38px;height:38px;object-fit:contain;flex:0 0 38px}
.bb-cdm-choice span{font-size:12px;font-weight:700;overflow-wrap:anywhere}
.bb-cdm-card{border:1px solid #e2e8f0;border-radius:12px;padding:13px;margin:10px 0;background:#fff}
.bb-cdm-card code{display:block;overflow-wrap:anywhere;white-space:normal;margin:8px 0}
.bb-cdm-card label{display:block;margin:10px 0;font-size:13px;font-weight:600}
.bb-cdm-card input,.bb-cdm-card textarea{display:block;width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:8px;margin-top:5px;background:#fff;color:#172235}
.bb-cdm-card button{padding:11px 15px;border:0;border-radius:9px;background:#0066ff;color:#fff;font-weight:700}
.bb-cdm-muted{font-size:12px;color:#64748b}
`;
function addStyle(){if(!document.getElementById("bb-cdm-style")){const s=document.createElement("style");s.id="bb-cdm-style";s.textContent=style;document.head.append(s);}}
async function loadMethods(){
 if(loading||!db())return methods;loading=true;
 try{const {data,error}=await db().from("deposit_method_settings").select("*").eq("active_web",true).order("sort_order").order("display_name");if(error)throw error;methods=data||[];}
 catch(e){console.warn("[BIGBULLS deposit config]",e.message||e);}
 finally{loading=false;}
 return methods;
}
function methodMarkup(m,i){
 const logo=m.logo_url?'<img src="'+esc(m.logo_url)+'" alt="'+esc(m.display_name)+'" onerror="this.style.display=\'none\'">':'<span>BB</span>';
 return '<label class="bb-cdm-choice"><input type="radio" name="bb_method_id" value="'+esc(m.id)+'" '+(i===0?'checked':'')+'><'+ 'span>'+logo+'</span><span>'+esc(m.display_name)+'<small class="bb-cdm-muted" style="display:block">'+esc(m.asset)+' · '+esc(m.network)+'</small></span></label>';
}
function formMarkup(context){
 const crypto=context.method_type==="crypto";
 const destination=crypto?context.destination_details:[context.account_title,context.account_number,context.destination_details].filter(Boolean).join(" · ");
 return '<div class="bb-cdm-card"><b>'+esc(context.display_name)+' · '+esc(context.network)+'</b>'+
  (context.logo_url?'<img src="'+esc(context.logo_url)+'" alt="" style="width:48px;height:48px;object-fit:contain;display:block;margin:8px 0">':'')+
  '<div class="bb-cdm-muted">'+esc(context.instructions||"Use the exact payment details shown below.")+'</div>'+
  '<code>'+esc(destination||"Payment details will be provided by Admin.")+'</code>'+
  '<button type="button" data-bb-copy="'+esc(destination)+'">Copy payment details</button>'+
  '<form class="bb-cdm-card" id="bb-config-deposit-form" data-context="'+(context.account_id?"account":"wallet")+'">'+
  '<label>Deposit amount (USD)<input name="amount_usd" type="number" min="'+Number(context.min_amount_usd||1)+'" '+(context.max_amount_usd?'max="'+Number(context.max_amount_usd)+'"':'')+' step=".01" required></label>'+
  '<label>'+(crypto?'Amount sent in crypto':'Amount paid in payment currency')+'<input name="amount_crypto" type="number" min=".00000001" step="any" required></label>'+
  (crypto?'<label>Blockchain TXID<input name="tx_hash" minlength="11" required></label>':'<label>Transfer reference (optional)<input name="tx_hash"></label>')+
  '<label>Payment proof '+(crypto?'(optional)':'(required)')+'<input name="proof" type="file" accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf" '+(!crypto?'required':'')+'></label>'+
  '<div class="bb-cdm-muted">Proof: JPG, PNG, WEBP or PDF · 100 KB–10 MB</div>'+
  '<button type="submit">Submit deposit request</button><p class="bb-cdm-status" role="status"></p></form></div>';
}
async function mountWallet(){
 const picker=document.getElementById("crypto-wallet-picker");if(!picker||picker.dataset.bbCdmMounted)return;
 const rows=await loadMethods();if(!rows.length)return;
 picker.dataset.bbCdmMounted="1";
 picker.innerHTML='<div id="bb-config-deposit-wrap"><b>Choose payment method</b><div class="bb-cdm-list">'+rows.map(methodMarkup).join("")+'</div><div id="bb-cdm-wallet-detail"></div></div>';
 const render=()=>{const chosen=rows.find(m=>m.id===picker.querySelector('input[name="bb_method_id"]:checked')?.value);if(!chosen)return;document.getElementById("bb-cdm-wallet-detail").innerHTML=formMarkup({...chosen,account_id:null});};
 picker.addEventListener("change",e=>{if(e.target.name==="bb_method_id")render();});render();
}
async function mountAccountModal(){
 const old=document.getElementById("account-deposit-form");if(!old||old.dataset.bbCdmMounted)return;
 const rows=await loadMethods();if(!rows.length)return;
 old.dataset.bbCdmMounted="1";
 const account=window.bbFinancialContext?.accountId;
 if(!account)return;
 const accountForm=old.parentElement;
 const wrap=document.createElement("div");wrap.id="bb-config-account-deposit";
 wrap.innerHTML='<b>Choose payment method</b><div class="bb-cdm-list">'+rows.map(methodMarkup).join("")+'</div><div id="bb-cdm-account-detail"></div>';
 old.hidden=true;old.insertAdjacentElement("afterend",wrap);
 const render=()=>{const chosen=rows.find(m=>m.id===wrap.querySelector('input[name="bb_method_id"]:checked')?.value);if(!chosen)return;document.getElementById("bb-cdm-account-detail").innerHTML=formMarkup({...chosen,account_id:account});};
 wrap.addEventListener("change",e=>{if(e.target.name==="bb_method_id")render();});render();
}
async function uploadProof(file,userId){
 if(!file)return null;
 if(file.size<100*1024||file.size>10*1024*1024)throw new Error("Payment proof must be 100 KB–10 MB.");
 const ext=(file.name.split(".").pop()||"jpg").toLowerCase();
 if(!["jpg","jpeg","png","webp","pdf"].includes(ext))throw new Error("Use JPG, PNG, WEBP or PDF.");
 const path=userId+"/"+Date.now()+"-deposit-proof."+ext;
 const {data,error}=await db().storage.from("payment-proofs").upload(path,file,{upsert:false,contentType:file.type||"application/octet-stream"});
 if(error)throw error;return data.path;
}
document.addEventListener("click",e=>{
 const b=e.target.closest("[data-bb-copy]");if(b){const v=b.getAttribute("data-bb-copy")||"";if(navigator.clipboard?.writeText)navigator.clipboard.writeText(v).then(()=>{b.textContent="Copied";}).catch(()=>{});}
},true);
document.addEventListener("submit",async e=>{
 const form=e.target.closest("#bb-config-deposit-form");if(!form)return;
 e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
 const out=form.querySelector(".bb-cdm-status"),button=form.querySelector('button[type="submit"]');
 const d=new FormData(form),methodId=form.closest("#bb-config-deposit-wrap,#bb-config-account-deposit")?.querySelector('input[name="bb_method_id"]:checked')?.value;
 const method=methods.find(m=>m.id===methodId),amountUsd=Number(d.get("amount_usd")),amountCrypto=Number(d.get("amount_crypto")),txHash=String(d.get("tx_hash")||"").trim(),proof=d.get("proof");
 try{
  if(!method)throw new Error("Choose an active payment method.");
  if(!(amountUsd>0)||!(amountCrypto>0))throw new Error("Enter valid payment amounts.");
  if(amountUsd<Number(method.min_amount_usd||0)||(method.max_amount_usd!==null&&amountUsd>Number(method.max_amount_usd)))throw new Error("Amount is outside the admin-configured limits.");
  if(method.method_type==="crypto"&&txHash.length<11)throw new Error("Enter a valid blockchain TXID.");
  if(method.method_type==="fiat"&&(!(proof instanceof File)||!proof.size))throw new Error("Attach your payment receipt.");
  const {data:{user},error:userError}=await db().auth.getUser();if(userError||!user)throw new Error("Please sign in again.");
  const ctx=window.bbFinancialContext,accountId=form.dataset.context==="account"?ctx?.accountId:null;
  if(form.dataset.context==="account"){
   const a=(window.bbClientAccounts||[]).find(x=>x.id===accountId);
   if(!a||a.account_mode!=="real"||a.status!=="approved"||a.archived_at||a.deleted_at)throw new Error("An active approved Real account is required.");
  }
  button.disabled=true;button.textContent="Submitting…";
  const proofPath=proof instanceof File&&proof.size?await uploadProof(proof,user.id):null;
  const dest=method.method_type==="crypto"?method.destination_details:[method.account_title,method.account_number,method.destination_details].filter(Boolean).join(" · ");
  const payload={user_id:user.id,account_id:accountId,kind:"deposit",asset:method.asset,network:method.network,destination_address:dest,amount_usd:amountUsd,amount_crypto:amountCrypto,tx_hash:txHash||null,proof_path:proofPath,status:"pending"};
  const {data:tx,error}=await db().from("wallet_transactions").insert(payload).select("id,invoice_id").single();
  if(error)throw error;
  out.textContent="Deposit request "+(tx.invoice_id||"")+" submitted for Admin verification.";
  button.textContent="Submitted";button.disabled=true;
  if(accountId&&typeof window.loadClientTradingAccounts==="function")await window.loadClientTradingAccounts();
 }catch(err){out.textContent=err.message||"Deposit request failed.";button.disabled=false;button.textContent="Submit deposit request";}
},true);
function scan(){if(!db())return;addStyle();mountWallet();mountAccountModal();}
const observer=new MutationObserver(scan);
function start(){if(!document.body)return;observer.observe(document.body,{childList:true,subtree:true});scan();}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();

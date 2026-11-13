(()=>{"use strict";
const $=s=>document.querySelector(s);
let client=null,channel=null,busy=false,lastAdmin=false;
const esc=v=>String(v??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const note=(s,bad)=>'<div class="notice'+(bad?' error':'')+'">'+esc(s)+'</div>';
async function signedProof(path){if(!path)return null;const r=await client.storage.from("payment-proofs").createSignedUrl(path,300);return r.data?.signedUrl||null}
async function refresh(){
 if(busy)return;client=window.__bbSupabaseClient||client;if(!client)return;
 const host=$("#admin-transactions");if(!host||!document.querySelector("#app-shell:not([hidden])"))return;
 busy=true;
 try{
  const auth=await client.auth.getUser();if(auth.error||!auth.data.user)return;
  const admin=await client.rpc("is_bigbulls_admin");if(admin.error||admin.data!==true){lastAdmin=false;return}lastAdmin=true;
  const {data,error}=await client.from("wallet_transactions").select("*").in("status",["pending","otp_pending","processing"]).order("created_at",{ascending:true});
  if(error){host.innerHTML=note("Finance Desk could not read wallet requests: "+error.message,true)+'<button type="button" data-bb-finance-refresh>Retry finance queue</button>';return}
  const rows=await Promise.all((data||[]).map(async x=>{
   const proof=await signedProof(x.proof_path),processing=x.status==="processing",otp=x.status==="otp_pending";
   return '<article class="admin-transaction"><b>'+esc(String(x.kind||"").toUpperCase())+' · '+esc(x.asset)+' / '+esc(x.network)+' · '+esc(String(x.status||"").toUpperCase())+'</b><small>Invoice '+esc(x.invoice_id||x.id)+' · Client '+esc(x.user_id)+' · Account '+esc(x.account_id||"Main Wallet")+'</small><small>Amount $'+Number(x.amount_usd||0).toFixed(2)+' · '+esc(x.amount_crypto||"")+' · '+(x.created_at?new Date(x.created_at).toLocaleString():"")+'</small><small>'+(x.kind==="withdrawal"?"Receiving address: ":"Deposit TXID: ")+esc(x.kind==="withdrawal"?x.destination_address:x.tx_hash||"")+'</small>'+(proof?'<a href="'+esc(proof)+'" target="_blank" rel="noopener">View payment proof</a>':(x.proof_path?'<small>Payment proof unavailable</small>':""))+(otp?'<small>Awaiting client email OTP verification.</small><button type="button" data-review="'+esc(x.id)+'" data-status="rejected">Reject unverified request</button>':processing?'<button type="button" data-complete-withdrawal="'+esc(x.id)+'">Confirm payout sent</button>':'<button type="button" data-review="'+esc(x.id)+'" data-status="approved">Approve / process</button><button type="button" data-review="'+esc(x.id)+'" data-status="rejected">Reject</button>')+(x.rejection_reason?'<small>Rejection: '+esc(x.rejection_reason)+'</small>':"")+'</article>';
  }));
  host.innerHTML='<div class="bb-finance-queue-head"><b>Live wallet requests · '+rows.length+'</b><button type="button" data-bb-finance-refresh>Refresh queue</button></div>'+(rows.join("")||note("No pending deposits or withdrawals."));
 }catch(e){const host=$("#admin-transactions");if(host)host.innerHTML=note("Finance Desk refresh failed: "+(e?.message||"Unknown error"),true)+'<button type="button" data-bb-finance-refresh>Retry finance queue</button>'}
 finally{busy=false}
}
function start(){
 client=window.__bbSupabaseClient||client;if(!client)return;
 if(!channel&&client.channel){channel=client.channel("bb-admin-finance-queue").on("postgres_changes",{event:"*",schema:"public",table:"wallet_transactions"},()=>{if($("#admin-transactions"))refresh()}).subscribe()}
}
document.addEventListener("click",e=>{
 const t=e.target instanceof Element?e.target:null;if(!t)return;
 if(t.closest('[data-bb-tab="finance"]'))setTimeout(refresh,120);
 if(t.closest("[data-bb-finance-refresh]")){e.preventDefault();refresh()}
});
document.addEventListener("click",async e=>{
 const target=e.target instanceof Element?e.target:null;if(!target)return;
 const review=target.closest("[data-review]"),complete=target.closest("[data-complete-withdrawal]");
 const button=review||complete;if(!button||button.disabled)return;
 e.preventDefault();
 client=window.__bbSupabaseClient||client;if(!client)return;
 const id=String(review?review.dataset.review:complete.dataset.completeWithdrawal||"");
 if(!id)return;
 let status=null,noteText="",payoutReference="";
 if(review){
  status=String(review.dataset.status||"");
  if(!["approved","rejected"].includes(status))return;
  const noteAnswer=prompt(status==="rejected"?"Required rejection reason (minimum 4 characters):":"Admin note (optional):","");
  if(noteAnswer===null)return;
  noteText=String(noteAnswer);
  if(status==="rejected"&&noteText.trim().length<4){alert("Please enter a clear rejection reason of at least 4 characters.");return;}
 }else{
  const payoutAnswer=prompt("Enter the confirmed payout TXID / payment reference (minimum 5 characters):","");
  if(payoutAnswer===null)return;
  payoutReference=String(payoutAnswer);
  if(payoutReference.trim().length<5){alert("A payout reference of at least 5 characters is required.");return;}
 }
 button.disabled=true;
 try{
  const auth=await client.auth.getUser();if(auth.error||!auth.data.user)throw new Error("Your admin session has expired. Sign in again.");
  const role=await client.rpc("is_bigbulls_admin");if(role.error)throw role.error;if(role.data!==true)throw new Error("Administrator permission required.");
  const result=review
   ?await client.rpc("admin_review_wallet_transaction",{p_transaction_id:id,p_status:status,p_admin_note:noteText.trim()||null})
   :await client.rpc("admin_complete_withdrawal",{p_transaction_id:id,p_payout_reference:payoutReference.trim()});
  if(result.error)throw result.error;
  const host=$("#admin-transactions");
  if(host)host.innerHTML=note(review?(status==="approved"?"Wallet request approved / withdrawal reserved.":"Wallet request rejected and audited."):"Withdrawal payout marked completed and reconciled.",false);
  await refresh();
 }catch(err){
  const host=$("#admin-transactions");
  if(host)host.innerHTML=note("Finance action failed: "+(err?.message||"Unknown error"),true)+'<button type="button" data-bb-finance-refresh>Retry finance queue</button>';
 }finally{button.disabled=false;}
});
document.addEventListener("DOMContentLoaded",()=>{start();setTimeout(refresh,700)});
const observer=new MutationObserver(()=>{if(window.__bbSupabaseClient){start();if($("#admin-transactions")&&!lastAdmin)refresh()}});
observer.observe(document.documentElement,{childList:true,subtree:true});
setInterval(()=>{if($("#admin-transactions")&&document.querySelector("#app-shell:not([hidden])"))refresh()},30000);
})();
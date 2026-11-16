(()=>{"use strict";
let fallbackShown=false;
function showFallback(kind,error){
 try{
  console.error("[BIGBULLS runtime]",kind,error);
  const render=()=>{
   const host=document.body||document.documentElement;
   if(!host)return;
   let note=document.getElementById("bb-runtime-fallback");
   if(!note){
    note=document.createElement("section");
    note.id="bb-runtime-fallback";
    note.setAttribute("role","alert");
    note.setAttribute("aria-live","assertive");
    note.style.cssText="position:fixed;z-index:2147483000;left:12px;right:12px;top:12px;max-width:680px;margin:0 auto;padding:16px;border:1px solid #f0c36d;border-radius:14px;background:#fffaf0;color:#493b20;box-shadow:0 12px 36px rgba(15,23,42,.18);font:14px/1.5 Inter,Arial,sans-serif";
    const title=document.createElement("strong");title.textContent="BIGBULLS encountered a page error";
    const detail=document.createElement("p");detail.dataset.runtimeDetail="";detail.style.cssText="margin:6px 0 12px;overflow-wrap:anywhere";
    const actions=document.createElement("div");actions.style.cssText="display:flex;gap:8px;align-items:center;flex-wrap:wrap";
    const reload=document.createElement("button");reload.type="button";reload.textContent="Reload page";reload.style.cssText="border:0;border-radius:9px;padding:10px 16px;background:#0066ff;color:#fff;font-weight:700;cursor:pointer";reload.addEventListener("click",()=>location.reload());
    const help=document.createElement("span");help.textContent="Your account data is stored securely; reloading will not submit a transaction.";
    actions.append(reload,help);note.append(title,detail,actions);host.prepend(note);
   }
   const detail=note.querySelector("[data-runtime-detail]");
   if(detail){const raw=String(error&&((error.message)||(error.reason&&error.reason.message))||error||"Unknown error");detail.textContent=kind+": "+raw.slice(0,320);}
   fallbackShown=true;
  };
  if(document.body||document.documentElement)render();else document.addEventListener("DOMContentLoaded",render,{once:true});
 }catch(fallbackError){console.error("[BIGBULLS fallback failed]",fallbackError);}
}
window.addEventListener("error",event=>showFallback("JavaScript loading/runtime error",event.error||event.message),true);
window.addEventListener("unhandledrejection",event=>showFallback("Background request failed",event.reason),true);
window.__bbShowRuntimeFallback=showFallback;
const original=window.renderVipOffer;
if(typeof original==="function"&&!original.__bbGuarded){
 const guarded=async function(...args){
  try{return await original.apply(this,args);}
  catch(error){
   showFallback("VIP offer unavailable",error);
   const host=document.getElementById("bb-vip-offer-card");
   if(host)host.innerHTML='<section class="bb-vip-card" role="status"><div class="bb-vip-kicker">VIP PROMOTION</div><h3>100% Deposit Bonus</h3><p>VIP eligibility could not be loaded right now. Your dashboard is still available; please retry later.</p></section>';
   return null;
  }
 };
 guarded.__bbGuarded=true;window.renderVipOffer=guarded;
}

function checkBlankClientWorkspace(){
 try{
  if(!document.body||!document.body.classList.contains("app-mode"))return;
  const shell=document.getElementById("app-shell");
  if(!shell||shell.hidden||!shell.children.length){
   showFallback("Client workspace failed to render",new Error("The client workspace is empty. Reload the page to restore the public site."));
  }
 }catch(error){console.error("[BIGBULLS blank-screen check]",error);}
}
if(document.readyState==="loading"){
 document.addEventListener("DOMContentLoaded",()=>window.setTimeout(checkBlankClientWorkspace,4500),{once:true});
}else{
 window.setTimeout(checkBlankClientWorkspace,4500);
}

})();
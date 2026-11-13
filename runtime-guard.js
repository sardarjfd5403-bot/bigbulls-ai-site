(()=>{"use strict";
const report=(kind,error)=>{
 try{console.error("[BIGBULLS runtime]",kind,error);
  const shell=document.getElementById("app-shell");
  if(!shell||shell.hidden||!document.body.classList.contains("app-mode"))return;
  let note=document.getElementById("bb-runtime-fallback");
  if(!note){note=document.createElement("section");note.id="bb-runtime-fallback";note.className="portal-load-error";note.setAttribute("role","alert");note.style.cssText="margin:16px;padding:16px;border:1px solid #f0c36d;border-radius:12px;background:#fffaf0;color:#493b20";
   note.innerHTML="<strong>Some workspace content could not load.</strong><p style='margin:6px 0 0'>Your sign-in session is still active. Other portal sections remain available. Please navigate to another section or try again later.</p>";
   shell.prepend(note);
  }
  const detail=String(error&&((error.message)||(error.reason&&error.reason.message))||error||"Unknown error").slice(0,240);
  let log=note.querySelector("[data-runtime-detail]");
  if(!log){log=document.createElement("small");log.dataset.runtimeDetail="";log.style.cssText="display:block;margin-top:8px;opacity:.75";note.append(log);}
  log.textContent=kind+": "+detail;
 }catch(fallbackError){console.error("[BIGBULLS fallback failed]",fallbackError);}
};
window.addEventListener("error",event=>report("JavaScript error",event.error||event.message),true);
window.addEventListener("unhandledrejection",event=>report("Async workflow error",event.reason),true);
const original=window.renderVipOffer;
if(typeof original==="function"&&!original.__bbGuarded){
 const guarded=async function(...args){
  try{return await original.apply(this,args);}
  catch(error){
   report("VIP offer unavailable",error);
   const host=document.getElementById("bb-vip-offer-card");
   if(host)host.innerHTML='<section class="bb-vip-card" role="status"><div class="bb-vip-kicker">VIP PROMOTION</div><h3>100% Deposit Bonus</h3><p>VIP eligibility could not be loaded right now. Your dashboard is still available; please retry later.</p></section>';
   return null;
  }
 };
 guarded.__bbGuarded=true;
 window.renderVipOffer=guarded;
}
})();
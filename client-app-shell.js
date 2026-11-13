(function(){
"use strict";
const $=(s,r=document)=>r.querySelector(s);
const money=(v,c="USD")=>c+" "+Number(v||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
let activeId="",walletObserver=null;
function accounts(){return Array.isArray(window.bbClientAccounts)?window.bbClientAccounts.filter(a=>!a.archived_at&&!a.deleted_at&&a.status==="approved"):[];}
function active(){const rows=accounts();return rows.find(a=>a.id===activeId)||rows.find(a=>a.id===window.bbActiveAccountId)||rows[0]||null;}
function renderMetrics(){
 const host=$("#bb-live-account-metrics");if(!host)return;
 const a=active();
 if(!a){host.innerHTML='<span class="bb-app-no-account">No approved trading account yet</span>';return;}
 activeId=a.id;window.bbActiveAccountId=a.id;
 const real=a.account_mode==="real",margin=real?Number(a.margin_used||0):null,free=real?Number(a.free_margin??(a.equity-margin)):null,level=real&&margin>0?Number(a.margin_level||0):null;
 host.innerHTML=[
  ["CASH BALANCE",money(a.balance,a.currency)],
  ["CREDIT BONUS",money(a.credit_bonus||0,a.currency)],
  ["TOTAL EQUITY",money(a.equity,a.currency)],
  ["MARGIN",real?money(margin,a.currency):"—"],
  ["FREE MARGIN",real?money(free,a.currency):"—"],
  ["LEVERAGE",a.requested_leverage||"1:100"],
  ["MARGIN LEVEL",level===null?"—":level.toFixed(1)+"%"]
 ].map(x=>'<div class="bb-app-metric"><small>'+x[0]+'</small><b>'+x[1]+'</b></div>').join("");
 const label=$("#bb-active-account-label");if(label)label.textContent=(a.account_mode||"").toUpperCase()+" · #"+(a.account_number||"—");
 const sel=$("#bb-active-account-select");if(sel&&sel.value!==a.id)sel.value=a.id;
 document.querySelectorAll(".bb-account-card").forEach(n=>n.classList.toggle("bb-account-selected",n.querySelector('[data-account-terminal="'+CSS.escape(a.id)+'"]')!==null||n.textContent.includes("#"+a.account_number)));
}
function ensureTopbar(){
 const main=$(".terminal-main"),page=$("#client-page");if(!main||!page||!document.body.classList.contains("bb-v3-active"))return;
 let bar=$("#bb-client-appbar",main);
 if(!bar){bar=document.createElement("section");bar.id="bb-client-appbar";bar.className="bb-client-appbar";bar.innerHTML='<div class="bb-appbar-switch"><small>ACTIVE TRADING ACCOUNT</small><b id="bb-active-account-label">Select account</b><select id="bb-active-account-select" aria-label="Switch trading account"></select></div><div id="bb-live-account-metrics" class="bb-live-account-metrics"></div><button type="button" class="bb-app-terminal" id="bb-app-open-terminal">OPEN TERMINAL ↗</button>';const head=$(".terminal-page-head",main)||$(".bb-v3-page-head",main);if(head)head.insertAdjacentElement("afterend",bar);else main.insertBefore(bar,page);}
 const select=$("#bb-active-account-select",bar),rows=accounts(),current=active();
 if(select){const previous=activeId||select.value;select.innerHTML=rows.map(a=>'<option value="'+a.id+'">'+(a.account_mode||"").toUpperCase()+" · #"+(a.account_number||"—")+" · "+(a.display_name||a.account_type||"Account")+'</option>').join("");if(rows.length){activeId=rows.some(a=>a.id===previous)?previous:(current?.id||rows[0].id);select.value=activeId;}else select.innerHTML='<option value="">No approved accounts</option>';}
 renderMetrics();
}
function openTerminal(){
 const a=active();if(!a){alert("No approved trading account is available yet.");return;}
 window.__bbTerminalLaunchAccountId=a.id;
 let btn=document.querySelector('[data-account-terminal="'+CSS.escape(a.id)+'"]');
 if(!btn){const nav=document.querySelector('[data-page="accounts"]');if(nav){nav.click();window.setTimeout(()=>document.querySelector('[data-account-terminal="'+CSS.escape(a.id)+'"]')?.click(),350);}return;}
 btn.click();
}
function accountToolModal(){
 const box=$("#bb-account-tools");if(!box)return;
 const visible=!box.hidden;
 document.body.classList.toggle("bb-account-modal-active",visible);
 if(visible&&!box.querySelector("[data-bb-account-close]")){const close=document.createElement("button");close.type="button";close.className="bb-modal-close";close.dataset.bbAccountClose="";close.textContent="×";close.setAttribute("aria-label","Close account action");box.prepend(close);}
 if(!visible)box.querySelector("[data-bb-account-close]")?.remove();
}
function walletModal(){
 const host=$("#wallet-content");if(!host)return;
 const page=host.closest("#client-page");if(!page)return;
 if(!page.querySelector(".wallet-actions")){host.classList.remove("bb-wallet-modal-open");return;}
 if(host.classList.contains("bb-wallet-modal-open")&&!host.querySelector("[data-bb-wallet-close]")){const b=document.createElement("button");b.type="button";b.className="bb-modal-close";b.dataset.bbWalletClose="";b.textContent="×";b.setAttribute("aria-label","Close wallet action");host.prepend(b);}
}
function init(){
 ensureTopbar();
 const main=$(".terminal-main");if(!main)return;
 if(!main.dataset.bbAppShellEvents){
  main.dataset.bbAppShellEvents="1";
  main.addEventListener("change",e=>{if(e.target.id==="bb-active-account-select"){activeId=e.target.value;window.bbActiveAccountId=activeId;const a=active();if(a&&a.account_mode!=="archived"){const tab=document.querySelector('[data-account-mode="'+a.account_mode+'"]');if(tab&&!tab.classList.contains("active"))tab.click();}renderMetrics();}});
  main.addEventListener("click",e=>{
   if(e.target.closest("#bb-app-open-terminal")){openTerminal();return;}
   if(e.target.closest("[data-bb-account-close]")){const box=$("#bb-account-tools");if(box){box.hidden=true;box.innerHTML="";}accountToolModal();return;}
   if(e.target.closest("[data-bb-wallet-close]")){$("#wallet-content")?.classList.remove("bb-wallet-modal-open");document.body.classList.remove("bb-wallet-modal-active");return;}
   if(e.target.closest(".wallet-action")){window.setTimeout(()=>{const host=$("#wallet-content");if(host){host.classList.add("bb-wallet-modal-open");document.body.classList.add("bb-wallet-modal-active");walletModal();}},0);}
  });
  main.addEventListener("click",e=>{if(e.target.closest("[data-account-tool]"))window.setTimeout(accountToolModal,0);});
 }
 if(!main.dataset.bbAccountModalObserver){main.dataset.bbAccountModalObserver="1";const box=$("#bb-account-tools");if(box)new MutationObserver(accountToolModal).observe(box,{attributes:true,attributeFilter:["hidden"],childList:true,subtree:true});}
 const wallet=$("#wallet-content");if(wallet&&!wallet.dataset.bbWalletObserver){wallet.dataset.bbWalletObserver="1";new MutationObserver(walletModal).observe(wallet,{childList:true,subtree:true});}
 if(activePageIsWallet())walletModal();
}
function activePageIsWallet(){return !!$("#wallet-content");}
window.addEventListener("bb:account-sync",()=>{ensureTopbar();renderMetrics();});
window.addEventListener("bb:realtime",()=>{ensureTopbar();renderMetrics();});
const observer=new MutationObserver(()=>{if(document.body.classList.contains("bb-v3-active"))init();});
function boot(){observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:["class","hidden"]});init();setInterval(()=>{if(document.body.classList.contains("bb-v3-active")){ensureTopbar();renderMetrics();accountToolModal();}},1500);}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();
(function(){
"use strict";
var deferredPrompt=null,installed=window.matchMedia("(display-mode: standalone)").matches||window.navigator.standalone===true;
function installMessage(){
 var old=document.getElementById("bb-pwa-help");if(old)old.remove();
 var box=document.createElement("div");box.id="bb-pwa-help";box.className="bb-pwa-help";
 box.innerHTML='<b>Install BIGBULLS Global</b><p>In Chrome, open the browser menu (⋮) and choose <strong>Install app</strong> or <strong>Add to Home screen</strong>. If this option is not shown yet, refresh the page and try again.</p><button type="button" data-pwa-dismiss>Got it</button>';
 document.body.appendChild(box);
}
function isClientPortal(){
 return !!document.querySelector(".bb-v3-drawer, #client-profile-menu, #client-area, #client-portal, .bb-v3-portal, [data-client-portal]");
}
function removeInstallCards(){
 ["bb-pwa-public-card","bb-pwa-sidebar-card"].forEach(function(id){var node=document.getElementById(id);if(node)node.remove();});
 var profile=null;
 if(profile)profile.querySelectorAll("[data-pwa-install]").forEach(function(node){node.remove();});
}
function addCard(){
 if(installed||isClientPortal()){removeInstallCards();return;}
 var hero=document.querySelector(".hero");
 var footer=document.querySelector("body>footer");
 if(hero&&!document.getElementById("bb-pwa-public-card")){
  var card=document.createElement("section");card.id="bb-pwa-public-card";card.className="bb-pwa-card bb-pwa-public";
  card.innerHTML='<div class="bb-pwa-mark" aria-hidden="true">B</div><div class="bb-pwa-copy"><span class="bb-pwa-kicker">TRADE WHEREVER YOU ARE</span><h2>Download BIGBULLS Mobile App</h2><p>Trade on the go with our lightning-fast Android Web App. Instant execution, zero desktop clutter.</p></div><button type="button" class="bb-pwa-action" data-pwa-install>📥 Install BIGBULLS App</button>';
  if(footer)footer.insertAdjacentElement("beforebegin",card);else hero.insertAdjacentElement("afterend",card);
 }
 var drawer=null;
 if(drawer&&!document.getElementById("bb-pwa-sidebar-card")){
  var card=document.createElement("section");card.id="bb-pwa-sidebar-card";card.className="bb-pwa-card bb-pwa-sidebar";
  card.innerHTML='<span class="bb-pwa-kicker">MOBILE TRADING</span><b>Download BIGBULLS Mobile App</b><p>Trade on the go with our lightning-fast Android Web App.</p><button type="button" class="bb-pwa-action" data-pwa-install>📥 Install App</button>';
  var wallet=drawer.querySelector(".bb-wallet-quick");if(wallet)wallet.insertAdjacentElement("afterend",card);else drawer.appendChild(card);
 }
 var profile=document.getElementById("client-profile-menu");
 if(profile&&!profile.querySelector("[data-pwa-install]")){
  var button=document.createElement("button");button.type="button";button.dataset.pwaInstall="";button.textContent="📥 Install BIGBULLS Mobile App";profile.insertBefore(button,profile.firstChild);
 }
}
window.addEventListener("beforeinstallprompt",function(event){event.preventDefault();deferredPrompt=event;document.documentElement.classList.add("bb-pwa-installable");});
window.addEventListener("appinstalled",function(){installed=true;deferredPrompt=null;document.documentElement.classList.remove("bb-pwa-installable");removeInstallCards();});
document.addEventListener("click",function(event){
 var install=event.target.closest("[data-pwa-install]");if(install){event.preventDefault();event.stopPropagation();
  if(installed){installMessage();return;}
  if(deferredPrompt){deferredPrompt.prompt();deferredPrompt.userChoice.then(function(choice){if(choice.outcome==="accepted"){deferredPrompt=null;} }).catch(function(){installMessage();});}
  else installMessage();
  return;
 }
 if(event.target.closest("[data-pwa-dismiss]")){var help=document.getElementById("bb-pwa-help");if(help)help.remove();}
});
function boot(){addCard();var observer=new MutationObserver(addCard);observer.observe(document.body,{childList:true,subtree:true});if("serviceWorker" in navigator){window.addEventListener("load",function(){navigator.serviceWorker.register("./service-worker.js",{scope:"./"}).catch(function(error){console.warn("BIGBULLS PWA service worker registration failed:",error);});},{once:true});}}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();
(function(){
"use strict";
function initPortal(){
 const modal=document.getElementById("portal-modal");
 const body=document.getElementById("portal-body");
 if(!modal||!body){console.error("BIGBULLS portal elements missing");return;}
 function closePortal(){modal.classList.remove("show");modal.setAttribute("aria-hidden","true");document.body.classList.remove("portal-open");}
 function openPortal(kind){
  let content="";
  if(kind==="buy"){
   content='<p class="eyebrow">PACKAGE & PAYMENT DETAILS · PREVIEW</p><h2>BIGBULLS AI Echo System</h2><p class="muted">Full package · <strong>$199 USD</strong> · one-time payment</p><div class="steps"><b>1. Review package price</b><b>2. Official payment checkout</b><b>3. Submit transaction ID</b><b>4. Payment verification</b><b>5. License + private download</b></div><div class="wallet-box"><small>USDT · TRON (TRC20) ADDRESS — REFERENCE ONLY</small><code id="wallet-address">TGHzwHhJ1XULyUmf6B8zf4djkyoeh6eiYY</code><button type="button" class="copy-wallet" id="copy-wallet">Copy wallet address</button></div><div class="notice"><strong>Checkout is not live.</strong> Payment submission, on-chain verification, account activation and automatic license/download delivery are not enabled yet. Do not transfer funds to this address until official checkout is activated.</div><button class="portal-primary" type="button" data-close>Close</button>';
  }else if(kind==="signup"){
   content='<p class="eyebrow">CUSTOMER PORTAL</p><h2>Create account</h2><p class="muted">Secure registration is being prepared.</p><label>Email<input type="email" placeholder="you@example.com" disabled></label><label>Password<input type="password" placeholder="Create a strong password" disabled></label><button class="portal-primary" disabled>Registration not active</button><p class="fine">Do not enter real credentials in this preview.</p>';
  }else{
   content='<p class="eyebrow">CUSTOMER PORTAL</p><h2>Login</h2><p class="muted">Secure login and 2FA are being prepared.</p><label>Email<input type="email" placeholder="Registered email" disabled></label><label>Password<input type="password" placeholder="Password" disabled></label><button class="portal-primary" disabled>Login not active</button><p class="fine">Do not enter real credentials in this preview.</p>';
  }
  body.innerHTML=content;modal.classList.add("show");modal.setAttribute("aria-hidden","false");document.body.classList.add("portal-open");
 }
 document.addEventListener("click",function(e){
  const opener=e.target.closest("[data-open]");
  if(opener){e.preventDefault();openPortal(opener.getAttribute("data-open"));return;}
  if(e.target.closest("[data-close]")||e.target.classList.contains("portal-close")||e.target===modal){closePortal();return;}
  if(e.target.closest("#copy-wallet")){
   const address="TGHzwHhJ1XULyUmf6B8zf4djkyoeh6eiYY";
   if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(address).then(()=>alert("Wallet address copied")).catch(()=>prompt("Copy wallet address:",address));}
   else{prompt("Copy wallet address:",address);}
  }
 });
 document.addEventListener("keydown",e=>{if(e.key==="Escape")closePortal();});
 window.openPortal=openPortal;window.closePortal=closePortal;
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",initPortal);else initPortal();
})();
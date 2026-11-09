(function(){
"use strict";
const SUPABASE_URL = "https://ztiiyulusburxjkpcfxu.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_5hDwqvbcUHeSJdXFHf9ugw_VPYGN4J_";
let client = null;

function initPortal(){
 const modal=document.getElementById("portal-modal");
 const body=document.getElementById("portal-body");
 if(!modal||!body){console.error("BIGBULLS portal elements missing");return;}

 if(window.supabase && typeof window.supabase.createClient==="function"){
  client=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);
 }else{
  console.error("Supabase JS library did not load.");
 }

 function closePortal(){
  modal.classList.remove("show");
  modal.setAttribute("aria-hidden","true");
  document.body.classList.remove("portal-open");
 }
 function showMessage(message,isError){
  const box=body.querySelector("[data-auth-message]");
  if(box){box.textContent=message;box.className="notice auth-message"+(isError?" error":"");}
 }
 function accountView(user){
  body.innerHTML='<p class="eyebrow">CUSTOMER PORTAL</p><h2>You are signed in</h2><p class="muted">Account email</p><p id="account-email" class="account-email"></p><div class="notice">Your account is connected. Payment verification, lifetime license activation and private downloads will be enabled after the secure backend is completed.</div><button class="portal-primary" type="button" data-auth-action="logout">Log out</button>';
  const email=body.querySelector("#account-email");
  if(email) email.textContent=user.email||"Signed-in customer";
 }
 async function openPortal(kind){
  if(kind==="buy"){
   body.innerHTML='<p class="eyebrow">PACKAGE & PAYMENT DETAILS · PREVIEW</p><h2>BIGBULLS AI Echo System</h2><p class="muted">Full package · <strong>$199 USD</strong> · one-time payment</p><div class="steps"><b>1. Review package price</b><b>2. Official payment checkout</b><b>3. Submit transaction ID</b><b>4. Payment verification</b><b>5. License + private download</b></div><div class="wallet-box"><small>USDT · TRON (TRC20) ADDRESS — REFERENCE ONLY</small><code id="wallet-address">TGHzwHhJ1XULyUmf6B8zf4djkyoeh6eiYY</code><button type="button" class="copy-wallet" id="copy-wallet">Copy wallet address</button></div><div class="notice"><strong>Checkout is not live.</strong> Payment submission, on-chain verification, account activation and automatic license/download delivery are not enabled yet. Do not transfer funds to this address until official checkout is activated.</div><button class="portal-primary" type="button" data-close>Close</button>';
  }else{
   let session=null;
   if(client){
    try{const result=await client.auth.getSession();session=result.data.session;}catch(e){console.error(e);}
   }
   if(session&&session.user){accountView(session.user);}
   else if(kind==="signup"){
    body.innerHTML='<p class="eyebrow">CUSTOMER PORTAL</p><h2>Create account</h2><p class="muted">Register with your email address.</p><form id="signup-form"><label>Full name<input name="full_name" type="text" autocomplete="name" placeholder="Your full name" required></label><label>Email<input name="email" type="email" autocomplete="email" placeholder="you@example.com" required></label><label>Password<input name="password" type="password" autocomplete="new-password" minlength="8" placeholder="At least 8 characters" required></label><button class="portal-primary" type="submit">Create account</button></form><div data-auth-message aria-live="polite"></div><p class="fine">After registration, check your email for a verification link if email confirmation is enabled.</p><button class="copy-wallet" type="button" data-open="login">Already registered? Login</button>';
   }else{
    body.innerHTML='<p class="eyebrow">CUSTOMER PORTAL</p><h2>Login</h2><p class="muted">Sign in to your BIGBULLS customer account.</p><form id="login-form"><label>Email<input name="email" type="email" autocomplete="email" placeholder="Registered email" required></label><label>Password<input name="password" type="password" autocomplete="current-password" placeholder="Password" required></label><button class="portal-primary" type="submit">Login</button></form><div data-auth-message aria-live="polite"></div><p class="fine">Use the email and password you registered with.</p><button class="copy-wallet" type="button" data-open="signup">Create a new account</button>';
   }
  }
  modal.classList.add("show");
  modal.setAttribute("aria-hidden","false");
  document.body.classList.add("portal-open");
  requestAnimationFrame(()=>{const first=body.querySelector("input:not([disabled])");if(first){first.focus({preventScroll:true});}});
 }
 document.addEventListener("click",async function(e){
  if(!(e.target instanceof Element))return;
  const opener=e.target.closest("[data-open]");
  if(opener){e.preventDefault();openPortal(opener.getAttribute("data-open"));return;}
  if(e.target.closest("[data-close]")||e.target.classList.contains("portal-close")||e.target===modal){closePortal();return;}
  if(e.target.closest("#copy-wallet")){
   const address="TGHzwHhJ1XULyUmf6B8zf4djkyoeh6eiYY";
   if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(address).then(()=>alert("Wallet address copied")).catch(()=>prompt("Copy wallet address:",address));}
   else{prompt("Copy wallet address:",address);}
  }
  if(e.target.closest('[data-auth-action="logout"]')&&client){
   const result=await client.auth.signOut();
   if(result.error){showMessage(result.error.message,true);}
   else{body.innerHTML='<p class="eyebrow">CUSTOMER PORTAL</p><h2>You are logged out</h2><p class="muted">Your session has ended.</p><button class="portal-primary" type="button" data-open="login">Login again</button>';}
  }
 });
 document.addEventListener("submit",async function(e){
  if(e.target.id!=="signup-form"&&e.target.id!=="login-form")return;
  e.preventDefault();
  if(!client){showMessage("Authentication service could not load. Refresh the page and try again.",true);return;}
  const form=e.target;
  const data=new FormData(form);
  const email=String(data.get("email")||"").trim();
  const password=String(data.get("password")||"");
  const submit=form.querySelector('button[type="submit"]');
  submit.disabled=true;submit.textContent="Please wait…";
  try{
   if(form.id==="signup-form"){
    const fullName=String(data.get("full_name")||"").trim();
    const result=await client.auth.signUp({
     email,password,
     options:{
      emailRedirectTo:window.location.origin+window.location.pathname,
      data:{full_name:fullName}
     }
    });
    if(result.error)throw result.error;
    if(result.data.session&&result.data.user){accountView(result.data.user);}
    else{showMessage("Registration received. Check your email and open the verification link to activate your account.",false);form.reset();}
   }else{
    const result=await client.auth.signInWithPassword({email,password});
    if(result.error)throw result.error;
    accountView(result.data.user);
   }
  }catch(error){
   showMessage(error.message||"Authentication failed. Please try again.",true);
   submit.disabled=false;
   submit.textContent=form.id==="signup-form"?"Create account":"Login";
  }
 });
 document.addEventListener("keydown",e=>{if(e.key==="Escape")closePortal();});
 window.openPortal=openPortal;
 window.closePortal=closePortal;
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",initPortal);else initPortal();
})();
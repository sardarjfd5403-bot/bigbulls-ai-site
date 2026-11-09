(function(){
"use strict";
const SUPABASE_URL="https://ztiiyulusburxjkpcfxu.supabase.co";
const SUPABASE_KEY="sb_publishable_5hDwqvbcUHeSJdXFHf9ugw_VPYGN4J_";
let sb=null, modal, body, currentUser=null;
function init(){
 modal=document.getElementById("portal-modal");body=document.getElementById("portal-body");
 if(!modal||!body){console.error("BIGBULLS portal markup missing");return;}
 if(window.supabase&&typeof window.supabase.createClient==="function"){
  sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
  sb.auth.onAuthStateChange((_event,session)=>{currentUser=session&&session.user?session.user:null;});
 }else console.error("Supabase SDK did not load");
 document.addEventListener("click",handleClick);
 document.addEventListener("submit",handleSubmit);
 document.addEventListener("keydown",e=>{if(e.key==="Escape")close();});
 window.openPortal=open;window.closePortal=close;
}
function show(){modal.classList.add("show");modal.setAttribute("aria-hidden","false");document.body.classList.add("portal-open");}
function close(){if(!modal)return;modal.classList.remove("show");modal.setAttribute("aria-hidden","true");document.body.classList.remove("portal-open");}
function msg(t,bad){let n=body.querySelector("[data-auth-message]");if(!n){n=document.createElement("div");n.setAttribute("data-auth-message","");body.appendChild(n);}n.className="notice auth-message"+(bad?" error":"");n.textContent=t;}
function safe(v){return String(v||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
async function open(kind){
 if(!modal)return;
 if(kind==="buy"){if(typeof window.openPortalBuy==="function"){window.openPortalBuy();return;}buyView();show();return;}
 if(!sb){body.innerHTML='<h2>Account service unavailable</h2><p class="muted">Authentication library could not load. Please refresh and try again.</p>';show();return;}
 try{const {data}=await sb.auth.getSession();currentUser=data.session?data.session.user:null;}catch(e){console.error(e);}
 if(currentUser){dashboardView();}else if(kind==="signup"){signupView();}else{loginView();}
 show();
}
function signupView(){body.innerHTML='<p class="eyebrow">CUSTOMER PORTAL</p><h2>Create account</h2><p class="muted">Create your secure BIGBULLS customer account.</p><form id="bb-signup"><label>Full name<input name="full_name" autocomplete="name" required></label><label>Email<input name="email" type="email" autocomplete="email" required></label><label>Password<input name="password" type="password" minlength="8" autocomplete="new-password" required></label><button class="portal-primary" type="submit">Create account</button></form><div data-auth-message aria-live="polite"></div><p class="fine">Email verification may be required before login.</p><button class="copy-wallet" type="button" data-view="login">Already registered? Login</button>';}
function loginView(){body.innerHTML='<p class="eyebrow">CUSTOMER PORTAL</p><h2>Login</h2><p class="muted">Sign in to your customer account.</p><form id="bb-login"><label>Email<input name="email" type="email" autocomplete="email" required></label><label>Password<input name="password" type="password" autocomplete="current-password" required></label><button class="portal-primary" type="submit">Login</button></form><div data-auth-message aria-live="polite"></div><button class="copy-wallet" type="button" data-action="forgot">Forgot password?</button><br><button class="copy-wallet" type="button" data-view="signup">Create a new account</button>';}
function dashboardView(){
 const u=currentUser||{}, meta=u.user_metadata||{}, name=meta.full_name||"Customer";
 body.innerHTML='<p class="eyebrow">BIGBULLS CUSTOMER PORTAL</p><h2>Welcome, '+safe(name)+'</h2><p class="muted">Your account workspace</p><div class="cards portal-cards"><article><small>ACCOUNT</small><h3>Profile</h3><p id="portal-email"></p><button class="copy-wallet" type="button" data-view="profile">Edit profile</button></article><article><small>LICENSE</small><h3>Pending activation</h3><p>License will be issued only after payment verification.</p></article><article><small>DOWNLOADS</small><h3>Not available yet</h3><p>Private download access is waiting for verified license activation.</p></article><article><small>ECHO SYSTEM</small><h3>Not connected</h3><p>Live trading engine and broker integration are not deployed.</p></article><article><small>SECURITY</small><h3>Account security</h3><p>Password reset is available. Authenticator-app 2FA is not enabled yet.</p><button class="copy-wallet" type="button" data-action="forgot">Reset password</button></article><article><small>PAYMENT</small><h3>No verified order</h3><p>Checkout is not live. Do not transfer funds yet.</p></article></div><button class="portal-primary" type="button" data-action="logout">Log out</button>';
 const e=body.querySelector("#portal-email");if(e)e.textContent=u.email||"";
}
function profileView(){const u=currentUser||{},meta=u.user_metadata||{};body.innerHTML='<p class="eyebrow">ACCOUNT SETTINGS</p><h2>Your profile</h2><form id="bb-profile"><label>Full name<input name="full_name" value="'+safe(meta.full_name||"")+'" required></label><label>Email<input value="'+safe(u.email||"")+'" disabled></label><button class="portal-primary" type="submit">Save profile</button></form><div data-auth-message aria-live="polite"></div><button class="copy-wallet" type="button" data-view="dashboard">Back to dashboard</button>';}
function buyView(){body.innerHTML='<p class="eyebrow">PACKAGE & PAYMENT · PREVIEW</p><h2>BIGBULLS AI Echo System</h2><p class="muted">Full package · <strong>$199 USD</strong> · one-time proposed price</p><div class="notice"><strong>Checkout is not live.</strong> Payment verification, license activation and private downloads are not enabled. Do not transfer funds.</div><button class="portal-primary" type="button" data-close>Close</button>';}
async function handleSubmit(e){
 const f=e.target;if(!(f instanceof HTMLFormElement))return;
 if(!["bb-signup","bb-login","bb-profile"].includes(f.id))return;
 e.preventDefault();if(!sb){msg("Authentication service is unavailable. Refresh and try again.",true);return;}
 const d=new FormData(f),b=f.querySelector('button[type="submit"]');b.disabled=true;b.textContent="Please wait…";
 try{
  if(f.id==="bb-signup"){
   const {data,error}=await sb.auth.signUp({email:String(d.get("email")).trim(),password:String(d.get("password")),options:{emailRedirectTo:location.origin+location.pathname,data:{full_name:String(d.get("full_name")).trim()}}});
   if(error)throw error;
   if(data.session){currentUser=data.user;dashboardView();}else{msg("Registration submitted. Check your email and open the verification link before logging in.",false);f.reset();b.disabled=false;b.textContent="Create account";}
  }else if(f.id==="bb-login"){
   const {data,error}=await sb.auth.signInWithPassword({email:String(d.get("email")).trim(),password:String(d.get("password"))});if(error)throw error;currentUser=data.user;dashboardView();
  }else{
   const {data,error}=await sb.auth.updateUser({data:{full_name:String(d.get("full_name")).trim()}});if(error)throw error;currentUser=data.user;dashboardView();msg("Profile updated successfully.",false);
  }
 }catch(err){msg(err.message||"Request failed. Please try again.",true);b.disabled=false;b.textContent=f.id==="bb-signup"?"Create account":f.id==="bb-login"?"Login":"Save profile";}
}
async function handleClick(e){
 const el=e.target instanceof Element?e.target:null;if(!el)return;
 const trigger=el.closest("[data-open]");if(trigger){e.preventDefault();open(trigger.getAttribute("data-open"));return;}
 const view=el.closest("[data-view]");if(view){e.preventDefault();if(view.dataset.view==="profile")profileView();else if(view.dataset.view==="dashboard")dashboardView();else if(view.dataset.view==="signup")signupView();else loginView();return;}
 const action=el.closest("[data-action]");if(action){
  if(action.dataset.action==="logout"){const {error}=await sb.auth.signOut();if(error)msg(error.message,true);else{currentUser=null;loginView();}return;}
  if(action.dataset.action==="forgot"){const email=prompt("Enter your registered email address:");if(!email)return;const {error}=await sb.auth.resetPasswordForEmail(email.trim(),{redirectTo:location.origin+location.pathname});if(error)msg(error.message,true);else msg("Password reset email requested. Check your inbox.",false);return;}
 }
 if(el.closest("[data-close]")||el.classList.contains("portal-close")||el===modal)close();
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();
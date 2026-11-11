(function(){
"use strict";
const SUPABASE_URL="https://ztiiyulusburxjkpcfxu.supabase.co";
const SUPABASE_KEY="sb_publishable_5hDwqvbcUHeSJdXFHf9ugw_VPYGN4J_";
function start(){
 const modal=document.getElementById("portal-modal");
 const body=document.getElementById("portal-body");
 if(!modal||!body){console.error("Auth portal markup missing");return;}
 let sb=null;
 try{
  if(window.supabase&&window.supabase.createClient) sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
 }catch(err){console.error("Supabase init:",err);}
 function message(t,bad){
  let n=body.querySelector("[data-auth-message]");
  if(!n){n=document.createElement("div");n.setAttribute("data-auth-message","");body.appendChild(n);}
  n.className="notice auth-message"+(bad?" error":"");n.textContent=t;
 }
 function open(kind){
  if(kind==="buy"){if(typeof window.openPortal==="function"){window.openPortal("buy");return;}return;}
  if(!sb){body.innerHTML='<h2>Account service unavailable</h2><p>Supabase library did not load. Reload the page or try again shortly.</p>';show();return;}
  if(kind==="signup"){
   body.innerHTML='<p class="eyebrow">CUSTOMER PORTAL</p><h2>Create account</h2><form id="bb-signup"><label>Full name<input name="full_name" type="text" autocomplete="name" required></label><label>Email<input name="email" type="email" autocomplete="email" required></label><label>Password<input name="password" type="password" autocomplete="new-password" minlength="8" required></label><button class="portal-primary" type="submit">Create account</button></form><div data-auth-message aria-live="polite"></div><button class="copy-wallet" type="button" data-bb-open="login">Already registered? Login</button>';
  }else{
   body.innerHTML='<p class="eyebrow">CUSTOMER PORTAL</p><h2>Login</h2><form id="bb-login"><label>Email<input name="email" type="email" autocomplete="email" required></label><label>Password<input name="password" type="password" autocomplete="current-password" required></label><button class="portal-primary" type="submit">Login</button></form><div data-auth-message aria-live="polite"></div><button class="copy-wallet" type="button" data-bb-open="signup">Create a new account</button>';
  }
  show();
  setTimeout(()=>{const i=body.querySelector("input");if(i)i.focus();},80);
 }
 function show(){modal.classList.add("show");modal.setAttribute("aria-hidden","false");document.body.classList.add("portal-open");}
 function close(){modal.classList.remove("show");modal.setAttribute("aria-hidden","true");document.body.classList.remove("portal-open");}
 document.addEventListener("click",function(e){
  const el=e.target instanceof Element?e.target:null;if(!el)return;
  const switcher=el.closest("[data-bb-open]");
  if(switcher){e.preventDefault();open(switcher.getAttribute("data-bb-open"));return;}
  const trigger=el.closest('[data-open="signup"],[data-open="login"]');
  if(trigger){e.preventDefault();open(trigger.getAttribute("data-open"));return;}
  if(el.closest("[data-close]")||el.classList.contains("portal-close")||el===modal)close();
 });
 document.addEventListener("submit",async function(e){
  const f=e.target;if(!(f instanceof HTMLFormElement)||!["bb-signup","bb-login"].includes(f.id))return;
  e.preventDefault();const d=new FormData(f),email=String(d.get("email")||"").trim(),password=String(d.get("password")||"");
  const b=f.querySelector('button[type="submit"]');b.disabled=true;b.textContent="Please wait…";
  try{
   if(f.id==="bb-signup"){
    const fullName=String(d.get("full_name")||"").trim();
    const {data,error}=await sb.auth.signUp({email,password,options:{emailRedirectTo:location.origin+location.pathname,data:{full_name:fullName}}});
    if(error)throw error;
    if(data.session){body.innerHTML="<h2>Account created</h2><p>You are signed in.</p>";}
    else{message("Registration received. Check your email and click the verification link to activate your account.",false);f.reset();}
   }else{
    const {data,error}=await sb.auth.signInWithPassword({email,password});
    if(error)throw error;
    body.innerHTML='<h2>Welcome</h2><p class="account-email"></p><button class="portal-primary" id="bb-logout" type="button">Log out</button>';
    body.querySelector(".account-email").textContent=data.user.email||email;
   }
  }catch(err){message(err.message||"Authentication failed. Please try again.",true);b.disabled=false;b.textContent=f.id==="bb-signup"?"Create account":"Login";}
 });
 document.addEventListener("click",async function(e){
  const el=e.target instanceof Element?e.target:null;if(el&&el.id==="bb-logout"){const {error}=await sb.auth.signOut();if(error)message(error.message,true);else open("login");}
 });
 document.addEventListener("keydown",e=>{if(e.key==="Escape")close();});
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start);else start();
})();
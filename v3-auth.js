(()=>{"use strict";
const URL="https://ztiiyulusburxjkpcfxu.supabase.co";
const KEY="sb_publishable_5hDwqvbcUHeSJdXFHf9ugw_VPYGN4J_";
const root=document.getElementById("auth-content"),q=new URLSearchParams(location.search);
let mode=["login","signup","reset","forgot"].includes(q.get("mode"))?q.get("mode"):"login",sb,redirecting=false;
const esc=s=>String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/\'/g,"&#39;");function msg(t,bad=false){let n=root.querySelector("[data-msg]");if(!n){n=document.createElement("div");n.dataset.msg="";root.append(n)}n.className="auth-message"+(bad?" error":"");n.textContent=t}
function tabs(){document.getElementById("tab-login").classList.toggle("active",mode==="login");document.getElementById("tab-signup").classList.toggle("active",mode==="signup")}
function verificationNotice(email,text="Check your inbox and confirm your email before logging in."){msg(text+" Email: "+email);let n=root.querySelector("[data-msg]");const b=document.createElement("button");b.type="button";b.className="auth-submit";b.style.marginTop="12px";b.textContent="Resend confirmation email";b.addEventListener("click",async()=>{b.disabled=true;b.textContent="Sending…";try{const {error}=await sb.auth.resend({type:"signup",email,options:{emailRedirectTo:location.origin+location.pathname+"?mode=login&verified=1"}});if(error)throw error;b.textContent="Confirmation email resent";}catch(e){b.disabled=false;b.textContent="Resend confirmation email";msg(e.message||"Could not resend confirmation email.",true)}});n.appendChild(document.createElement("br"));n.appendChild(b)}
function render(){tabs();
 if(mode==="signup"){root.innerHTML='<h2>Create your account</h2><p class="auth-subtitle">Set up your BIGBULLS client profile.</p><form class="auth-form" id="signup"><label>Full name<input name="full_name" autocomplete="name" required></label><label>Email address<input name="email" type="email" autocomplete="email" required></label><div class="form-row"><label>Country<input name="country" autocomplete="country-name" required></label><label>Phone (optional)<input name="phone" type="tel" autocomplete="tel"></label></div><label>Account type<select name="account_type"><option>Individual</option><option>Corporate</option></select></label><label>Referral code (optional)<input name="referral_code" value="'+esc((q.get("ref")||"").toUpperCase())+'"></label><label>Password<input name="password" type="password" minlength="8" autocomplete="new-password" required></label><label class="auth-check"><input name="terms" type="checkbox" required><span>I agree to the Terms, Privacy Policy and risk disclosure.</span></label><button type="submit" class="auth-submit">Create secure account →</button></form><div class="auth-links"><button type="button" data-mode="login">Already registered? Log in</button></div><div data-msg></div>'}
 else if(mode==="reset"){root.innerHTML='<h2>Set a new password</h2><p class="auth-subtitle">Choose a strong password for your account.</p><form class="auth-form" id="reset"><label>New password<input name="password" type="password" minlength="8" autocomplete="new-password" required></label><label>Confirm new password<input name="confirm_password" type="password" minlength="8" autocomplete="new-password" required></label><button type="submit" class="auth-submit">Update password</button></form><div data-msg></div>'}
 else if(mode==="forgot"){root.innerHTML='<h2>Reset your password</h2><p class="auth-subtitle">We will email you a secure reset link.</p><form class="auth-form" id="forgot"><label>Email address<input name="email" type="email" autocomplete="email" required></label><button type="submit" class="auth-submit">Send reset link</button></form><div class="auth-links"><button type="button" data-mode="login">Back to login</button></div><div data-msg></div>'}
 else{root.innerHTML='<h2>Welcome back</h2><p class="auth-subtitle">Sign in to continue to your secure client portal.</p><form class="auth-form" id="login"><label>Email address<input name="email" type="email" autocomplete="username" required placeholder="you@example.com"></label><label>Password<input name="password" type="password" autocomplete="current-password" required></label><button type="submit" class="auth-submit">Secure login →</button></form><div class="auth-links"><button type="button" data-mode="signup">Create an account</button><button type="button" data-mode="forgot">Forgot password?</button></div><div data-msg></div>'}
}
function portal(){if(redirecting)return;redirecting=true;const next=q.get("next");const destination=next==="terminal.html"?"terminal.html"+(location.search.includes("account_id=")?"?"+new URLSearchParams(location.search).get("account_id"):""):"index.html#dashboard";location.replace(destination)}
document.addEventListener("click",e=>{const target=e.target instanceof Element?e.target:null,b=target?target.closest("[data-mode]"):null;if(b){mode=b.dataset.mode;render()}});
document.addEventListener("keydown",e=>{if(e.key==="Enter"&&e.target instanceof HTMLInputElement&&["login","signup"].includes((e.target.form&&e.target.form.id)))e.preventDefault()},true);
document.addEventListener("submit",async e=>{
 const f=e.target;if(!["login","signup","forgot","reset"].includes(f&&f.id))return;
 e.preventDefault();
 if(["login","signup"].includes(f.id)){const submit=f.querySelector('button[type="submit"]');if(!e.isTrusted||e.submitter!==submit)return;}
 const b=f.querySelector('button[type="submit"]'),d=new FormData(f);if(!b)return;
 b.disabled=true;b.textContent="Please wait…";
 try{
  if(f.id==="login"){const email=String(d.get("email")).trim();const {data,error}=await sb.auth.signInWithPassword({email,password:String(d.get("password"))});if(error){if(/email not confirmed/i.test(error.message)){verificationNotice(email,"Your email is not verified yet. Confirm it first, then log in.");b.disabled=false;b.textContent="Secure login →";return}throw error}if(!data.session)throw new Error("No active session returned. Please retry.");portal()}
  else if(f.id==="signup"){const {data,error}=await sb.auth.signUp({email:String(d.get("email")).trim(),password:String(d.get("password")),options:{emailRedirectTo:location.origin+location.pathname+"?mode=login&verified=1",data:{full_name:String(d.get("full_name")).trim(),country:String(d.get("country")||""),phone:String(d.get("phone")||""),account_type:String(d.get("account_type")||"Individual"),referral_code:String(d.get("referral_code")||"")}}});if(error)throw error;if(data.session){await sb.auth.signOut();verificationNotice(String(d.get("email")).trim(),"Registration received. Please check your inbox and confirm your email before logging in.");}else{verificationNotice(String(d.get("email")).trim(),"Registration received. A BIGBULLS confirmation email has been requested. Please confirm your email before logging in.");}f.reset();b.disabled=false;b.textContent="Create secure account →"}
  else if(f.id==="forgot"){const {error}=await sb.auth.resetPasswordForEmail(String(d.get("email")).trim(),{redirectTo:location.origin+location.pathname+"?mode=reset"});if(error)throw error;msg("If an account exists for that email, a password reset link has been sent.");b.disabled=false;b.textContent="Send reset link";return}
  else{const password=String(d.get("password")||""),confirm=String(d.get("confirm_password")||"");if(password.length<8)throw new Error("Password must be at least 8 characters.");if(password!==confirm)throw new Error("Passwords do not match.");const {error}=await sb.auth.updateUser({password});if(error)throw error;await sb.auth.signOut();mode="login";render();msg("Password updated successfully. Please log in with your new password.")}
 }catch(err){msg(err.message||"Authentication failed. Please retry.",true);b.disabled=false;b.textContent=f.id==="login"?"Secure login →":f.id==="signup"?"Create secure account →":f.id==="forgot"?"Send reset link":"Update password"}
});
(async()=>{try{
 if(!window.supabase||typeof window.supabase.createClient!=="function")throw new Error("Authentication library failed to load. Refresh the page.");
 sb=window.supabase.createClient(URL,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
 // Handle both Supabase PKCE (?code=...) and implicit-token (#access_token=...) recovery callbacks.
 const callbackParams=new URLSearchParams(location.search),callbackHash=new URLSearchParams(location.hash.replace(/^#/,""));
 if(mode==="reset"&&callbackParams.has("code")){
  const {error:exchangeError}=await sb.auth.exchangeCodeForSession(callbackParams.get("code"));if(exchangeError)throw exchangeError;
  history.replaceState(null,"",location.pathname+"?mode=reset");
 }else if(mode==="reset"&&callbackHash.has("access_token")&&callbackHash.has("refresh_token")){
  const {error:setError}=await sb.auth.setSession({access_token:callbackHash.get("access_token"),refresh_token:callbackHash.get("refresh_token")});if(setError)throw setError;
  history.replaceState(null,"",location.pathname+"?mode=reset");
 }
 const {data,error}=await sb.auth.getSession();if(error)throw error;
 if(data&&data.session&&q.get("verified")==="1"){await sb.auth.signOut();render();msg("Your email has been successfully verified. Please log in with your email and password.");return}
 if(data&&data.session&&mode!=="reset"){portal();return}
 sb.auth.onAuthStateChange((event,session)=>{if(session&&["SIGNED_IN","TOKEN_REFRESHED","INITIAL_SESSION"].includes(event)&&mode!=="reset")portal()});
 render();
 if(q.get("verified")==="1")msg("Email verified. Please log in to access your client portal.");
 if(mode==="reset"&&!(data&&data.session))msg("This reset link is invalid or expired. Request a fresh password reset email and open the newest link.",true);
}catch(e){root.innerHTML='<div class="auth-message error">'+esc(e.message)+'</div>'}})();
})();
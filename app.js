(function(){
"use strict";
const URL="https://ztiiyulusburxjkpcfxu.supabase.co";
const KEY="sb_publishable_5hDwqvbcUHeSJdXFHf9ugw_VPYGN4J_";
let sb=null,modal,body,shell,user=null,activePage="dashboard",licenseActive=false,financialChannel=null,calendarEvents=[],calendarRefreshTimer=null;
const pages=["course-forex","course-smc","course-ict","course-vsa","dashboard","terminal","accounts","wallet","market-analysis","signals","learning","services","portfolio","orders","license","echo-system","downloads","profile","settings","support","verification","partner","economic-calendar","trading-central","admin"];
function init(){
 modal=document.getElementById("portal-modal");body=document.getElementById("portal-body");shell=document.getElementById("app-shell");
 if(!modal||!body||!shell){console.error("Portal markup missing");return;}
 document.addEventListener("click",e=>{clickHandler(e).catch(err=>{console.error("Portal click workflow failed:",err);message("This action could not be completed: "+(err?.message||"Please retry."),true);});},true);
 document.addEventListener("submit",e=>{submitHandler(e).catch(err=>{console.error("Portal form workflow failed:",err);const out=e.target?.querySelector?.("[data-page-message]");if(out)out.textContent="This request could not be completed: "+(err?.message||"Please retry.");else message("This request could not be completed: "+(err?.message||"Please retry."),true);});},true);
 document.addEventListener("change",e=>{kycFileChangeHandler(e).catch(err=>{console.error("Secure upload workflow failed:",err);message("Secure upload failed: "+(err?.message||"Please retry."),true);});},true);
 startAICarousel();
 if(window.supabase&&window.supabase.createClient){connectSupabase();}
 else{
  // Keep the login visible even if the primary CDN is blocked; retry through a fallback CDN.
  const fallback=document.createElement("script");
  fallback.src="https://unpkg.com/@supabase/supabase-js@2";
  fallback.onload=()=>connectSupabase();
  fallback.onerror=()=>{
   console.error("Supabase SDK failed to load from both CDNs");
   message("Secure connection could not be loaded. Check your internet connection and refresh.",true);
  };
  document.head.appendChild(fallback);
 }
}
function connectSupabase(){
 if(!window.supabase||!window.supabase.createClient){
  console.error("Supabase client library is unavailable.");return;
 }
 sb=window.supabase.createClient(URL,KEY,{
  auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
 });
 window.__bbSupabaseClient=sb;
 document.addEventListener("keydown",e=>{
  if(e.key==="Escape"){
   closeModal();
   document.querySelectorAll(".top-menu-dropdown,.sidebar-submenu").forEach(x=>x.hidden=true);
   document.querySelectorAll("[data-menu-toggle]").forEach(x=>x.setAttribute("aria-expanded","false"));
  }
 });
 window.openPortal=openModal;window.closePortal=closeModal;
 updateHeader();
 // Keep the public landing page visible; authentication opens only when the visitor selects Login or Sign up.
 // Keep this callback synchronous to avoid waiting on the Supabase auth lock.
 sb.auth.onAuthStateChange((event,session)=>{
  user=session?session.user:null;
  updateHeader();
  if(event==="SIGNED_OUT")hideApp();
 });
 // Restore the persisted session outside the auth callback.
 sb.auth.getSession().then(({data,error})=>{
  if(error)throw error;
  user=data?.session?.user||null;
  updateHeader();
  if(user)showApp("dashboard");
  else hideApp();
 }).catch(error=>{
  console.error("Unable to restore the client session:",error);
  user=null;updateHeader();hideApp();
  console.error("Could not restore client session:",error);
 });
}

function startAICarousel(){
 const grid=document.getElementById("ai-feature-grid");if(!grid)return;
 const cards=Array.from(grid.querySelectorAll(".ai-feature-card"));if(cards.length<4)return;
 let start=0;
 const count=document.getElementById("ai-feature-count"),bar=document.getElementById("ai-feature-progress");
 const rotate=()=>{cards.forEach((card,i)=>card.classList.toggle("is-visible",i>=start&&i<start+3));if(count)count.textContent=String(start+1).padStart(2,"0")+"—"+String(Math.min(start+3,cards.length)).padStart(2,"0")+" / "+String(cards.length).padStart(2,"0");if(bar){bar.style.transition="none";bar.style.width="0%";requestAnimationFrame(()=>{bar.style.transition="width 4s linear";bar.style.width="100%";});}start=(start+3)%cards.length;};
 rotate();if(!window.matchMedia("(prefers-reduced-motion: reduce)").matches){window.setInterval(rotate,4000);}
}
function updateHeader(){
 const login=document.querySelector('header button[data-open="login"],header button[data-action="logout"]');
 if(login){if(user){login.textContent="Logout";login.removeAttribute("data-open");login.setAttribute("data-action","logout");}else{login.textContent="Login";login.removeAttribute("data-action");login.setAttribute("data-open","login");}}
 const client=document.querySelector('header nav a[href="#dashboard"]');
 if(client){if(user){client.removeAttribute("data-open");client.setAttribute("data-app-open","dashboard");}else{client.removeAttribute("data-app-open");client.setAttribute("data-open","login");}}
}
function openModal(kind){
 if(kind==="buy"){
 const address="TGHzwHhJ1XULyUmf6B8zf4djkyoeh6eiYY";
 body.innerHTML='<p class="eyebrow">BIGBULLS AI · FULL PACKAGE</p><h2>Echo System · $199</h2><p class="muted">One-time package payment · USDT on TRON (TRC20) only.</p><div class="wallet-address-card"><small>OFFICIAL BIGBULLS PAYMENT ADDRESS · USDT TRC20</small><code>'+address+'</code><button type="button" data-copy-address="'+address+'">Copy USDT address</button></div><div class="notice">Send exactly 199 USDT using the TRC20 network only. Do not use ERC20, BEP20 or another network. Submit your blockchain TXID below. The order stays pending until an administrator verifies the transaction and blockchain confirmations.</div>'+
 (user?'<form id="echo-purchase-form" class="client-form"><label>Blockchain transaction ID (TXID)<input name="txid" minlength="11" required placeholder="Paste your TRON transaction hash"></label><button class="portal-primary" type="submit">Submit payment for verification</button><div data-page-message></div></form>':'<div class="notice">To submit your TXID and create an order, first log in or create your BIGBULLS client account.</div><button class="portal-primary" type="button" data-open="login">Login to continue</button><button class="portal-secondary" type="button" data-open="signup">Create account</button>')+
 '<h3>Included AI intelligence functions</h3><ul><li>Multi-timeframe chart and candle-structure analysis</li><li>Forex, Gold, Crypto and supported Indices research</li><li>SMC, VSA, liquidity, price action and trend confluence</li><li>Economic calendar and news-event sentiment monitoring</li><li>Volatility, spread and market-condition filters</li><li>AI-assisted entry, stop-loss and take-profit planning</li><li>Position sizing, exposure limits and risk controls</li><li>Trade monitoring, journal, analytics and performance reports</li><li>Automation controls, broker connectivity and emergency stop when integrations are enabled</li></ul><p class="fine">Order approval and license/download activation follow payment verification. Features requiring live data or broker connectivity become operational as those integrations are deployed.</p><button class="portal-secondary" type="button" data-close>Close</button>';
 showModal();return;
}
 if(!sb){body.innerHTML="<h2>Account service unavailable</h2><p>Please refresh and try again.</p>";showModal();return;}
 if(user){closeModal();showApp("dashboard");return;}
 if(kind==="signup")signupForm();else loginForm();showModal();
}
async function kycFileChangeHandler(e){
 const input=e.target;if(!(input instanceof HTMLInputElement)||input.type!=="file")return;
 const form=input.form;if(!form||!["kyc-form","account-deposit-form"].includes(form.id))return;
 e.stopPropagation();if(typeof e.stopImmediatePropagation==="function")e.stopImmediatePropagation();
 const isKyc=form.id==="kyc-form",status=form.querySelector(isKyc?"[data-kyc-file-name=\""+input.name+"\"]":"[data-deposit-file-name]"),file=input.files?.[0],button=form.querySelector('button[type="submit"]');
 const bucket=isKyc?"kyc-documents":"payment-proofs",max=isKyc?20*1024*1024:10*1024*1024;
 const fail=message=>{input.dataset.uploadedPath="";if(status){status.textContent=message;status.classList.add("error");}if(button)button.disabled=false;};
 if(!file){input.dataset.uploadedPath="";if(status){status.textContent="No file selected";status.classList.remove("error");}return;}
 const ext=String(file.name||"").split(".").pop().toLowerCase(),typed=String(file.type||"").toLowerCase(),byExt={jpg:"image/jpeg",jpeg:"image/jpeg",png:"image/png",webp:"image/webp",pdf:"application/pdf"};
 const mime=["image/jpeg","image/png","image/webp","application/pdf"].includes(typed)?typed:(typed==="image/jpg"||typed==="image/pjpeg"?"image/jpeg":byExt[ext]||"");
 if(file.size<100*1024)return fail("File must be at least 100 KB.");
 if(file.size>max)return fail("File exceeds the "+(max/1024/1024)+" MB limit.");
 if(!mime)return fail("Use JPG, PNG, WEBP or PDF.");
 if(!sb||!user?.id)return fail("Please sign in again before uploading.");
 if(button)button.disabled=true;
 if(status){status.textContent="Uploading securely to private storage…";status.classList.remove("error");}
 try{
  const safeName=String(file.name||"document").replace(/[^a-zA-Z0-9._-]/g,"_").slice(-110);
  const path=user.id+"/"+Date.now()+"-"+(isKyc?input.name:"deposit-proof")+"-"+safeName;
  const {error}=await sb.storage.from(bucket).upload(path,file,{contentType:mime,cacheControl:"3600",upsert:false});
  if(error)throw error;
  const previous=input.dataset.uploadedPath;input.dataset.uploadedPath=path;
  if(previous)await sb.storage.from(bucket).remove([previous]);
  if(status){status.textContent="✓ Uploaded securely · "+file.name+" · "+(file.size/1024/1024).toFixed(2)+" MB";status.classList.remove("error");}
 }catch(err){fail("Upload failed: "+(err?.message||"Storage error. Please choose the file again."));}
 finally{if(button){const pending=[...form.querySelectorAll('input[type="file"]')].some(el=>el.files?.[0]&&!el.dataset.uploadedPath);button.disabled=pending;}}
}
function showModal(){modal.classList.add("show");modal.setAttribute("aria-hidden","false");document.body.classList.add("portal-open");}
function closeModal(){modal.classList.remove("show");modal.setAttribute("aria-hidden","true");document.body.classList.remove("portal-open");}
function signupForm(){body.innerHTML='<p class="eyebrow">CUSTOMER ACCOUNT</p><h2>Create your BIGBULLS profile</h2><form id="signup-form"><label>Full name<input name="full_name" autocomplete="name" required></label><label>Email<input name="email" type="email" autocomplete="email" required></label><div class="form-two"><label>Country<input name="country" autocomplete="country-name" placeholder="Country" required></label><label>Phone number<input name="phone" type="tel" autocomplete="tel" placeholder="+ country code"></label></div><label>Account type<select name="account_type"><option>Individual</option><option>Corporate</option></select></label><label>Referral code (optional)<input name="referral_code"></label><label>Password<input name="password" type="password" minlength="8" autocomplete="new-password" required></label><label class="check-line"><input type="checkbox" name="terms" required> I agree to the Terms, Privacy Policy and risk disclosure.</label><button class="portal-primary" type="submit">Create account</button></form><div data-msg></div><button class="copy-wallet" data-auth-view="login">Already registered? Login</button>';const referral=new URLSearchParams(location.search).get("ref");const referralInput=body.querySelector('#signup-form [name="referral_code"]');if(referral&&referralInput)referralInput.value=referral.trim().toUpperCase();}
function loginForm(){body.innerHTML='<p class="eyebrow">CUSTOMER ACCOUNT</p><h2>Welcome back</h2><form id="login-form"><label>Email<input name="email" type="email" autocomplete="username" required></label><label>Password<input name="password" type="password" autocomplete="current-password" required></label><label class="check-line"><input type="checkbox" name="remember" checked> Remember me on this device</label><button class="portal-primary" type="submit">Secure login</button></form><div data-msg></div><button class="copy-wallet" data-auth-view="signup">Create account</button><button class="copy-wallet" data-action="forgot">Forgot password?</button><div class="notice">Authenticator-based 2FA will be added in the security backend phase.</div>';}
function message(t,bad){let el=body.querySelector("[data-msg]");if(!el){el=document.createElement("div");el.dataset.msg="";body.append(el);}el.className="notice auth-message"+(bad?" error":"");el.textContent=t;}
function esc(v){return String(v||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function hideApp(){
 if(shell)shell.hidden=true;
 document.body.classList.remove("app-mode");
 activePage="landing";
 const main=document.querySelector("main"),footer=document.querySelector("footer");
 if(main)main.removeAttribute("hidden");
 if(footer)footer.removeAttribute("hidden");
 updateHeader();
 if(body)closeModal();
}
function isAdmin(){return user?.app_metadata?.role==="admin";}
function showFinancialNotice(row){
 if(!row||!["approved","rejected","processing","completed"].includes(row.status))return;
 const node=document.createElement("div");node.className="bb-financial-toast";
 const title=row.status==="approved"?"Deposit approved":row.status==="completed"?"Withdrawal completed":row.status==="processing"?"Withdrawal processing":"Request rejected";
 const heading=document.createElement("b");heading.textContent=title;
 const detail=document.createElement("span");detail.textContent=(row.invoice_id||"BIGBULLS invoice")+" · $"+Number(row.amount_usd||0).toFixed(2);
 node.append(heading,detail);
 if(row.rejection_reason){const reason=document.createElement("small");reason.textContent=row.rejection_reason;node.append(reason);}
 document.body.append(node);window.setTimeout(()=>node.remove(),9000);
}
function showAccountBalanceNotice(account){
 const node=document.createElement("div");node.className="bb-financial-toast";
 const heading=document.createElement("b");heading.textContent="Trading account balance updated";
 const detail=document.createElement("span");detail.textContent="Account #"+account.account_number+" · "+account.currency+" "+Number(account.balance||0).toFixed(2);
 node.append(heading,detail);document.body.append(node);window.setTimeout(()=>node.remove(),9000);
}
function startFinancialRealtime(){
 if(!sb||!user)return;
 if(financialChannel){sb.removeChannel(financialChannel);financialChannel=null;}
 const channel=sb.channel("bb-financial-"+user.id);
 if(isAdmin()){
  channel.on("postgres_changes",{event:"*",schema:"public",table:"wallet_transactions"},()=>{if(activePage==="admin")loadPageData();});
  channel.on("postgres_changes",{event:"UPDATE",schema:"public",table:"trading_accounts"},()=>{if(activePage==="admin")loadPageData();});
  channel.on("postgres_changes",{event:"*",schema:"public",table:"bb_paper_accounts"},()=>{if(activePage==="admin")loadPageData();});
  channel.on("postgres_changes",{event:"*",schema:"public",table:"bb_mt5_demo_accounts"},()=>{if(activePage==="admin")loadPageData();});
 }else{
  channel.on("postgres_changes",{event:"UPDATE",schema:"public",table:"wallet_transactions",filter:"user_id=eq."+user.id},payload=>{showFinancialNotice(payload.new);if(activePage==="accounts"){loadClientTradingAccounts();const tools=document.getElementById("bb-account-tools");if(tools?.dataset.accountTool==="transactions")showAccountTool(tools.dataset.accountId,"transactions");}});
  channel.on("postgres_changes",{event:"UPDATE",schema:"public",table:"trading_accounts",filter:"user_id=eq."+user.id},payload=>{if(activePage==="accounts")loadClientTradingAccounts();if(payload.new&&payload.old&&Number(payload.new.balance)!==Number(payload.old.balance))showAccountBalanceNotice(payload.new);});
  channel.on("postgres_changes",{event:"INSERT",schema:"public",table:"client_notifications",filter:"user_id=eq."+user.id},()=>{loadClientNotifications();});
 }
 financialChannel=channel.subscribe();
}
async function applyReferenceClientUI(attempt=0){
 const terminal=shell&&shell.querySelector(".terminal");
 if(!terminal)return;
 const enhance=window.__bbEnhanceClientPortal;
 if(typeof enhance==="function"){
  try{
   enhance();
   if(terminal.dataset.bbReference==="yes")return;
  }catch(error){console.error("BIGBULLS reference dashboard enhancement failed:",error);}
 }
 if(attempt<12)window.setTimeout(()=>applyReferenceClientUI(attempt+1),Math.min(50*(attempt+1),300));
}
function showApp(page){
 if(!user||!shell)return;
 // Every authenticated customer enters the client portal. Admin routes remain role-gated.

 let requested=pages.includes(page)?page:"accounts";
 if(requested==="dashboard")requested="accounts";

 // The client portal itself must remain accessible while KYC is pending.
 // Financial/account mutations continue to use the existing Supabase RPC/RLS checks.
 window.__bbUserName=user.user_metadata?.full_name||user.email?.split("@")[0]||"Client";
 window.__bbUserEmail=user.email||"";
 window.__bbUserId=user.id;
 window.__bbIsAdmin=()=>isAdmin();
 activePage=requested;
 startFinancialRealtime();
 if(activePage==="accounts")window.bbAccountMode="real";
 if(activePage==="admin"&&!isAdmin())activePage="accounts";

 shell.hidden=false;
 document.body.classList.add("app-mode");
 const main=document.querySelector("main"),footer=document.querySelector("footer");
 if(main)main.setAttribute("hidden","");
 if(footer)footer.setAttribute("hidden","");
 closeModal();

 try{
  renderApp();
  // Apply the approved broker reference UI after the terminal has entered the DOM.
  // Retry briefly if the enhancement layer is still initializing or the browser schedules scripts late.
  applyReferenceClientUI();
  window.requestAnimationFrame(()=>applyReferenceClientUI());
  window.setTimeout(()=>applyReferenceClientUI(),80);
 }catch(error){
  console.error("Client portal render failed:",error);
  shell.innerHTML='<div class="portal-load-error" role="alert"><h2>Workspace could not be rendered</h2><p>Please refresh the page. Your sign-in session is still active.</p><button type="button" onclick="location.reload()">Reload workspace</button></div>';
  return;
 }
 Promise.resolve(refreshHeaderBalance()).catch(error=>console.error("Wallet balance refresh failed:",error));
 Promise.resolve(loadPageData()).catch(error=>{
  console.error("Portal data loading failed:",error);
  const host=document.getElementById("client-page");
  if(host){const note=document.createElement("div");note.className="notice error";note.setAttribute("role","alert");note.textContent="Live page data could not be loaded: "+(error?.message||"Please refresh and try again.");host.prepend(note);}
 });
 Promise.resolve(loadClientNotifications()).catch(error=>console.error("Notifications loading failed:",error));
}
async function renderMfaControl(host){
 if(!host||!user||isAdmin())return;
 host.hidden=false;
 const {data:factors,error}=await sb.auth.mfa.listFactors();
 if(error){host.innerHTML='<div class="notice error">2FA service unavailable: '+esc(error.message)+'</div>';return;}
 const verified=(factors?.totp||[]).find(x=>x.status==="verified");
 if(verified){
  const {data:aal}=await sb.auth.mfa.getAuthenticatorAssuranceLevel();
  if(aal?.currentLevel==="aal2"){host.innerHTML='<h3>Authenticator 2FA · ENABLED</h3><p>Your account is protected with two-factor authentication.</p>';return;}
  const challenge=await sb.auth.mfa.challenge({factorId:verified.id});
  if(challenge.error){host.innerHTML='<div class="notice error">'+esc(challenge.error.message)+'</div>';return;}
  host.innerHTML='<h3>Complete two-factor verification</h3><p>Enter the current code from your authenticator app to unlock the platform.</p><form id="mfa-verify-form" data-factor-id="'+esc(verified.id)+'" data-challenge-id="'+esc(challenge.data.id)+'" class="client-form"><label>Authenticator code<input name="code" inputmode="numeric" autocomplete="one-time-code" minlength="6" maxlength="8" required></label><button class="portal-primary" type="submit">Verify 2FA</button><div data-page-message></div></form>';
  return;
 }
 host.innerHTML='<h3>Secure your account with 2FA</h3><p>KYC is approved. Set up an authenticator app and verify its code to unlock the client platform.</p><button type="button" class="portal-primary" data-mfa-enroll>Set up authenticator 2FA</button>';
}
async function loadClientNotifications(){
 if(!sb||!user||isAdmin())return;
 const panel=document.getElementById("client-notification-panel");if(!panel)return;
 const {data,error}=await sb.from("client_notifications").select("id,title,message,metadata,read_at,created_at").eq("user_id",user.id).order("created_at",{ascending:false}).limit(10);
 if(error){panel.innerHTML='<b>Notification Centre</b><p>Notifications are temporarily unavailable.</p>';return;}
 const labels={document_blurry:"Blurry / unreadable document",expired_document:"Expired document",name_mismatch:"Name mismatch",photo_mismatch:"Photo mismatch",missing_back:"Missing back side",address_incomplete:"Incomplete address",dob_mismatch:"Date of birth mismatch",unsupported_document:"Unsupported document",document_tampering:"Altered / damaged document",other:"Other"};
 panel.innerHTML='<b>Notification Centre</b>'+(data?.length?data.map(x=>{const reasons=x.metadata?.rejection_reasons||[];const reasonText=reasons.length?" Reasons: "+reasons.map(k=>labels[k]||k).join("; "):"";const adminNote=x.metadata?.admin_note?" Admin response: "+x.metadata.admin_note:"";return '<article class="admin-row"><span><b>'+esc(x.title)+'</b><small>'+esc(x.message+reasonText+adminNote)+' · '+new Date(x.created_at).toLocaleString()+'</small></span>'+(x.read_at?'':'<button type="button" data-notification-read="'+esc(x.id)+'">Mark read</button>')+'</article>';}).join(""):'<p>No new notifications.</p>');
}
function pageIcon(id){const paths={"dashboard":"M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z","accounts":"M4 4h16v16H4z M8 8h8 M8 12h8 M8 16h5","wallet":"M3 6h18v14H3z M3 9h18 M16 14h2","terminal":"M4 5h16v14H4z M7 9l3 3-3 3 M12 15h4","market-analysis":"M4 19V5 M4 19h17 M7 15l4-5 3 3 6-8","economic-calendar":"M4 5h16v16H4z M8 3v4 M16 3v4 M4 9h16 M8 13h3 M13 13h3","trading-central":"M12 3a9 9 0 1 0 9 9 M12 7v5l4 2 M16 3h5v5","signals":"M4 17 9 12l3 3 8-9 M15 6h5v5","portfolio":"M4 5h16v15H4z M8 9h8 M8 13h8 M8 17h5","orders":"M6 4h12v17H6z M9 8h6 M9 12h6 M9 16h6","partner":"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 M20 8v6 M17 11h6","learning":"M3 5h18v14H3z M7 9h10 M7 13h7","services":"M12 3v4 M12 17v4 M3 12h4 M17 12h4 M5.6 5.6l2.8 2.8 M15.6 15.6l2.8 2.8 M18.4 5.6l-2.8 2.8 M8.4 15.6l-2.8 2.8","echo-system":"M12 2 20 7v10l-8 5-8-5V7z M8 12h8 M12 8v8","downloads":"M12 3v12 M7 10l5 5 5-5 M4 20h16","profile":"M20 21a8 8 0 0 0-16 0 M12 12a4 4 0 1 0 0-8","settings":"M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M19 12h2 M3 12h2 M12 3v2 M12 19v2","verification":"M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11 M8 12l3 3 5-6","support":"M4 12a8 8 0 0 1 16 0v5a2 2 0 0 1-2 2h-2v-6h4 M4 13H2v4a2 2 0 0 0 2 2h2v-6z M9 20h6","admin":"M3 4h18v16H3z M7 8h10 M7 12h6 M7 16h8"};return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="'+(paths[id]||"M12 3 21 12 12 21 3 12z")+'"/></svg>';}
function sideNavGroup(label,items){
 return '<section class="side-group"><small>'+label+'</small>'+items.map(([id,icon,text,desc])=>'<button type="button" data-page="'+id+'" class="'+(activePage===id?"active":"")+'" aria-current="'+(activePage===id?"page":"false")+'"><span class="side-icon">'+pageIcon(id)+'</span><span class="side-copy"><b>'+text+'</b><em>'+desc+'</em></span>'+(id==="echo-system"&&!licenseActive?'<i>PRO</i>':"")+'</button>').join("")+'</section>';
}
async function refreshHeaderBalance(){
 const node=document.getElementById("header-wallet-balance");if(!node||!sb||!user)return;
 const {data,error}=await sb.from("trading_accounts").select("balance,status").eq("user_id",user.id).is("archived_at",null).is("deleted_at",null);
 if(error){console.error("Account balance sync failed:",error);node.textContent="—";return;}
 const total=(data||[]).filter(row=>row.status==="approved").reduce((sum,row)=>sum+Number(row.balance||0),0);
 node.textContent="$"+total.toFixed(2);
}
function renderApp(){
 const meta=user.user_metadata||{},name=meta.full_name||user.email?.split("@")[0]||"Client";
 const groups=[
 {id:"profile",label:"Profile details",icon:"◉",items:[["profile","Profile information","Manage your personal details"],["verification","KYC verification","Identity verification and status"],["settings","Security & settings","Password and account security"],["downloads","Downloads","Your available platform files"]]},
 {id:"accounts",label:"Accounts",icon:"▣",columns:[{title:"TRADING ACCOUNTS",items:[["accounts","Real Account","Live trading account"],["accounts","Demo Account","Practice account"]]},{title:"FUNDING",items:[["wallet","Deposit","Add funds to your account"],["wallet","Withdrawal","Request a withdrawal"],["wallet","Funds Transfer","Move funds between accounts"]]},{title:"ACTIVITY & SERVICES",items:[["wallet","Transactions","Review account transactions"],["wallet","Wallet & Payments","Payment methods and wallet"],["services","Client Services","Get help with your account"]]}]},
 {id:"trading",label:"Trading",icon:"⌁",columns:[{title:"EXECUTION",items:[["terminal","PRO Terminal","Trading terminal and charts"],["echo-system","Echo System","BIGBULLS AI workspace"]]},{title:"INSIGHTS",items:[["portfolio","Portfolio","View trading portfolio"],["signals","Signals","Market signal centre"],["market-analysis","Market Desk","Market analysis and research"]]},{title:"TOOLS & HISTORY",items:[["trading-central","Trading Central","Technical research tools"],["orders","Orders History","Review your orders"],["wallet","Trading Wallet","Wallet and funding overview"]]}]},
 {id:"economic",label:"Economic",icon:"▤",items:[["economic-calendar","News & Economic Calendar","Economic releases and event schedule"]]},
 {id:"ib-partner",label:"IB Partner",icon:"♧",items:[["partner","IB Partner Dashboard","Partner overview and referrals"]]}
 ];
 if(isAdmin())groups.push({id:"admin",label:"Admin",icon:"⚙",items:[["admin","Admin Panel","Platform administration"]]});
 const active=activePage==="profile"||activePage==="verification"||activePage==="settings"||activePage==="downloads"?"profile":activePage==="accounts"||activePage==="wallet"||activePage==="services"?"accounts":activePage==="terminal"||activePage==="portfolio"||activePage==="signals"||activePage==="market-analysis"||activePage==="trading-central"||activePage==="orders"||activePage==="echo-system"?"trading":activePage==="economic-calendar"?"economic":activePage==="partner"?"ib-partner":activePage==="admin"?"admin":"";
 const link=([page,label,desc])=>'<button type="button" class="sidebar-sub-link '+(activePage===page?"active":"")+'" data-page="'+page+'"><b>'+label+'</b><small>'+desc+'</small></button>';
 const sidebar='<aside class="client-sidebar" aria-label="Client navigation"><div class="sidebar-user"><span class="sidebar-avatar">'+esc((name||"C").slice(0,1).toUpperCase())+'</span><span><b>'+esc(name)+'</b><small>PERSONAL AREA</small></span></div><nav class="client-nav sidebar-nav" aria-label="Main menu"><button type="button" class="sidebar-main-link '+(activePage==="dashboard"?"active":"")+'" data-page="dashboard"><span>⌂</span><b>Home Dashboard</b></button>'+groups.map(g=>'<section class="sidebar-group '+(active===g.id?"is-active":"")+'"><button type="button" class="sidebar-main-link '+(active===g.id?"active":"")+'" data-menu-toggle="'+g.id+'" aria-expanded="'+(active===g.id)+'"><span>'+g.icon+'</span><b>'+g.label+'</b><i>⌄</i></button><div class="sidebar-submenu" data-menu-dropdown="'+g.id+'" '+(active===g.id?'':'hidden')+'>'+(g.columns?g.columns.map(c=>'<div class="sidebar-subgroup"><h4>'+c.title+'</h4>'+c.items.map(link).join("")+'</div>').join(""):g.items.map(link).join(""))+'</div></section>').join("")+'</nav><button class="sidebar-logout" type="button" data-action="logout">↗ &nbsp; Sign out</button></aside>';
 shell.innerHTML='<div class="terminal"><header class="terminal-head"><a class="terminal-brand" href="#" data-page="dashboard"><span class="mark">B</span><span>BIGBULLS <b>FX</b><small>PERSONAL AREA</small></span></a><div class="terminal-head-right"><div class="header-balance"><small>WALLET BALANCE</small><b id="header-wallet-balance">Loading…</b><em>Trading equity sync pending</em></div><div class="header-pop-wrap"><button class="header-icon-btn" type="button" data-notification-toggle aria-expanded="false" aria-label="Notifications">♧<i></i></button><div class="header-popover" id="client-notification-panel" hidden><b>Notification Centre</b><p>No new notifications.</p><small>Account and transaction updates will appear here when notification services are connected.</small></div></div><div class="header-pop-wrap"><button class="profile-trigger" type="button" data-profile-toggle aria-expanded="false"><span class="profile-avatar">'+esc((name||"C").slice(0,1).toUpperCase())+'</span><span><b>'+esc(name)+'</b><small>Personal Area ▾</small></span></button><div class="header-popover profile-menu" id="client-profile-menu" hidden><button type="button" data-page="profile">Profile details</button><button type="button" data-page="settings">Settings & security</button><button type="button" data-page="verification">KYC verification</button><button type="button" data-page="downloads">Downloads</button><button type="button" data-action="logout">Log out</button></div></div></div></header><div class="terminal-layout">'+sidebar+'<main class="terminal-main"><div class="terminal-page-head"><div><small>BIGBULLS FX MARKET / PERSONAL AREA</small><h2>'+title(activePage)+'</h2></div><span class="terminal-session"><i></i> Secure session</span></div><div id="client-page">'+pageContent(activePage,name)+'</div></main></div><footer class="terminal-footer"><span>BIGBULLS FX MARKET</span><span>Client services · Risk-first trading</span><button data-action="logout">Sign out</button></footer></div>';
}
function title(p){return ({"course-forex":"Forex Mastery","course-smc":"Smart Money Concepts","course-ict":"ICT Trading Blueprint","course-vsa":"Volume Spread Analysis",dashboard:"Dashboard",terminal:"BIGBULLS PRO Trading Terminal",accounts:"Trading Accounts",wallet:"Wallet & Payments",profile:"My Profile",services:"Services","market-analysis":"Market Analysis",signals:"Live Signals",learning:"Learning Centre", "copy-trading":"Copy Trading",portfolio:"Portfolio",orders:"Orders",license:"License","echo-system":"Echo System",downloads:"Downloads",settings:"Settings",support:"Support",verification:"KYC Verification",partner:"IB / Partner Area","economic-calendar":"Economic Calendar","trading-central":"Trading Central",admin:"Admin Control Panel"})[p]||"Dashboard";}
function stat(label,value,sub){return '<div class="client-stat"><small>'+label+'</small><b>'+value+'</b><span>'+sub+'</span></div>';}
function tile(id,icon,heading,desc,tag){return '<button class="service-tile" data-page="'+id+'"><span>'+icon+'</span><b>'+heading+'</b><small>'+desc+'</small><i>'+tag+' →</i></button>';}
const BB_COURSES={
 forex:{id:"forex",route:"course-forex",short:"FOREX",title:"BIGBULLS Forex Mastery",level:"Beginner → Advanced",intro:"Learn how the currency market works, how orders are executed and how to build a risk-first trading routine.",modules:[
 ["Forex market foundations","Understand currency pairs, base/quote currencies, majors, minors, crosses and why exchange rates move.","A currency pair compares two currencies. EUR/USD = 1.0850 means one euro is worth 1.0850 US dollars. If EUR/USD rises, EUR is strengthening relative to USD.","fx"],
 ["Pips, lots and position size","Calculate pip movement, contract size, pip value and the exposure created by each lot size.","For most non-JPY pairs, one pip is 0.0001. A 20-pip move on 0.10 lot is not the same cash result on every account currency; calculate contract and pip value first.","risk"],
 ["Spread, commission and swaps","Identify bid/ask spread, commission, overnight financing, slippage and total trading costs.","If EUR/USD bid is 1.0849 and ask is 1.0851, spread is 2 pips. Price must move beyond costs before a position reaches net break-even.","cost"],
 ["Leverage, margin and stop-out","Understand margin, free margin, margin level and how leverage magnifies both gains and losses.","Leverage changes required margin; it does not reduce market risk. A 1% adverse move on a $10,000 notional position is about $100 before costs.","risk"],
 ["Order types and execution","Use market, limit, stop, stop-loss and take-profit orders correctly.","A buy limit is placed below current price; a buy stop is placed above it. Always check the broker's execution and gap rules.","orders"],
 ["Sessions and economic news","Plan around Asia, London and New York sessions, scheduled releases and volatility.","Before CPI or central-bank decisions, spreads and slippage can widen. Define a no-trade window and maximum risk before the release.","sessions"],
 ["Candles, trend and chart structure","Read OHLC candles, swing highs/lows, support/resistance and multi-timeframe context.","A higher high followed by a higher low can indicate an uptrend, but wait for a defined trigger and invalidation level rather than buying every green candle.","chart"],
 ["Build a complete trading plan","Create setup rules, position sizing, journaling, demo practice and review routines.","Write down market, timeframe, entry trigger, stop, target, risk percentage and conditions that cancel the setup. Test at least a meaningful sample before live use.","plan"]
 ]},
 smc:{id:"smc",route:"course-smc",short:"SMC",title:"BIGBULLS Smart Money Concepts",level:"Intermediate → Advanced",intro:"Study structure, liquidity, displacement, order blocks and fair value gaps as a complete evidence-based framework.",modules:[
 ["Market structure: BOS & CHoCH","Map swing highs and lows, break of structure and change of character without over-labelling noise.","A bullish BOS is a decisive break above a meaningful prior swing high. A CHoCH is an early shift against the prior structure; neither guarantees continuation.","structure"],
 ["Liquidity pools","Locate equal highs/lows, buy-side liquidity, sell-side liquidity and obvious stop clusters.","Equal highs can attract buy stops above them; equal lows can attract sell stops beneath them. Treat these as areas of interest, not guaranteed targets.","liquidity"],
 ["Liquidity sweep & inducement","Distinguish a sweep and rejection from a genuine breakout; require follow-through.","Price trades above equal highs, then closes back below and displaces down. That is a possible buy-side sweep; wait for structure confirmation before considering a short.","sweep"],
 ["Order blocks","Identify the last opposing candle before displacement and define invalidation and mitigation.","A bullish order-block candidate is the final down candle before a strong bullish displacement that breaks structure. The zone is invalidated if price decisively trades through its defined low.","ob"],
 ["Fair Value Gaps","Read three-candle imbalances, midpoint and mitigation in market context.","A bullish FVG exists when candle 3 low is above candle 1 high. The gap is the untraded interval; a revisit is not automatically an entry signal.","fvg"],
 ["Premium, discount & equilibrium","Use a dealing range midpoint to frame location and avoid chasing extended price.","For a range from 1.0800 to 1.0900, equilibrium is 1.0850. Below is discount and above is premium for that range; direction still needs independent confirmation.","range"],
 ["Supply, demand & breaker zones","Compare zones, failed order blocks and breaker concepts with structure.","A failed bullish block that price breaks through may later act as resistance on a retest. Define the exact zone and invalidation before testing it.","breaker"],
 ["Multi-timeframe alignment","Build higher-timeframe bias, intermediate context and lower-timeframe execution rules.","Use H4 for broad dealing range, H1 for structure and M5 for trigger. If the timeframes conflict, reduce risk or wait rather than forcing alignment.","mtf"],
 ["SMC execution model & review","Combine liquidity, displacement, retracement, stop placement and journaling into one repeatable model.","Example checklist: HTF location → liquidity taken → displacement/MSS → retrace into FVG/OB → stop beyond invalidation → target opposing liquidity. Backtest with costs.","model"]
 ]},
 ict:{id:"ict",route:"course-ict",short:"ICT",title:"BIGBULLS ICT Trading Blueprint",level:"Intermediate → Advanced",intro:"Learn time-and-price concepts, liquidity delivery, dealing ranges, PD arrays and structured session models.",modules:[
 ["ICT framework & terminology","Understand the time-and-price approach and distinguish concepts from fixed trading rules.","Start with a defined dealing range and liquidity objective. ICT terms describe a framework; they do not remove uncertainty or replace testing.","framework"],
 ["Liquidity & draw on liquidity","Map internal/external range liquidity, previous highs/lows and likely objectives.","Mark previous day high/low and current range extremes. A draw on liquidity is a hypothesis to test, not a promise that price must reach it.","liquidity"],
 ["Dealing range & PD arrays","Study premium/discount, FVGs, order blocks, breakers and mitigation blocks.","Mark the swing low and swing high of the chosen range, then its 50% equilibrium. Only compare PD arrays that fit the larger context.","range"],
 ["Displacement & market structure shift","Recognise impulsive repricing and a meaningful shift in short-term structure.","A strong candle closing through a prior swing with range expansion can support an MSS thesis. A wick through a level alone is weaker evidence.","structure"],
 ["Kill zones & session timing","Understand London/New York session windows and adjust for daylight-saving changes.","Session windows are time filters, not signals. Convert the reference timezone correctly and avoid trading simply because a kill zone has started.","sessions"],
 ["Daily bias & higher-timeframe context","Use previous day/week levels, opening prices and range context to prepare scenarios.","Write bullish and bearish scenarios before the session. Include the price level that invalidates each scenario and the condition for no trade.","bias"],
 ["ICT entry models","Study sweep, displacement, FVG retracement and clear invalidation as a sequence.","A sample model: sweep a prior low → bullish displacement → MSS → retrace into bullish FVG → stop below sweep low. Require your own tested filters.","entry"],
 ["Silver Bullet & session setups","Learn model prerequisites, time filters, context and when to stand aside.","The time window alone is not an edge. Record the setup, pair, volatility, spread and whether all prerequisites were present before scoring the trade.","model"],
 ["Backtesting & execution discipline","Measure sample size, expectancy, drawdown, spread and slippage without curve fitting.","Track wins, losses, average R, max drawdown and rule adherence. Keep in-sample and out-of-sample periods separate.","testing"]
 ]},
 vsa:{id:"vsa",route:"course-vsa",short:"VSA",title:"BIGBULLS Volume Spread Analysis",level:"Beginner → Advanced",intro:"Learn to interpret volume, candle spread and close location through effort-versus-result and market background.",modules:[
 ["VSA foundations","Read volume, candle range, close location and the effort-versus-result principle.","Volume shows activity, spread shows price range and close location shows where price finished. Read all three together and compare with the background.","basics"],
 ["Volume and spread relationship","Compare current activity with recent bars and identify wide/narrow spreads.","High volume with a narrow spread can suggest opposing activity or absorption, but the next bars and location determine whether the clue matters.","volume"],
 ["Stopping volume & climactic action","Study high activity near extremes and require confirmation.","A high-volume bar near support may indicate demand absorbing supply. Wait for a successful test or bullish follow-through before forming a trade idea.","stopping"],
 ["No Demand & No Supply","Recognise low-activity tests in the correct trend and location.","A narrow up bar on low volume after weakness can be a no-demand clue. It is meaningful only with bearish background and confirmation.","nodemand"],
 ["Upthrusts & springs","Study failed breakouts, rejection, shakeouts and follow-through.","An upthrust pushes above resistance but closes back in its range. A spring dips below support and recovers. Context and later confirmation are essential.","spring"],
 ["Effort versus result","Spot high effort with limited progress and possible absorption.","If volume expands sharply but price makes little upward progress near resistance, supply may be meeting demand. Do not infer direction from one bar alone.","effort"],
 ["Trend & background analysis","Read sequences, trend condition and support/resistance before interpreting a signal bar.","Ask what happened in the previous 20–50 bars, where price is in the range and whether supply/demand is dominant. Background comes first.","background"],
 ["VSA with structure & liquidity","Combine volume clues with support/resistance, market structure and liquidity.","A low-volume test after a downside sweep at higher-timeframe support is more interesting than the same candle in the middle of a range.","confluence"],
 ["Build and test a VSA strategy","Write objective rules and measure expectancy after spread, commission and slippage.","For every setup capture background, signal bar, next-bar confirmation, entry, stop, target and result in R. Tick volume differs by broker in OTC forex.","testing"]
 ]}
};
function courseDiagram(type){
 const common='<defs><linearGradient id="bbChartBg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#172b43"/><stop offset="1" stop-color="#0b1422"/></linearGradient></defs><rect width="720" height="300" rx="18" fill="url(#bbChartBg)"/><g stroke="#31465e" stroke-width="1" opacity=".7"><path d="M30 55H690M30 105H690M30 155H690M30 205H690M30 255H690"/><path d="M100 25V275M200 25V275M300 25V275M400 25V275M500 25V275M600 25V275"/></g>';
 const candles=[[70,210,35,25],[120,180,40,28],[170,190,30,24],[220,130,55,32],[270,150,40,30],[320,90,65,36],[370,115,38,28],[420,75,50,30],[470,95,38,26],[520,55,58,34],[570,72,40,28],[620,38,55,32]];
 const bars=candles.map((c,i)=>'<g><path d="M'+(c[0]+12)+' '+(c[1]-c[2]/2)+'V'+(c[1]+c[2]/2)+'" stroke="'+(i%3===0?'#ef7272':'#54d6a0')+'" stroke-width="2"/><rect x="'+c[0]+'" y="'+(c[1]-c[3]/2)+'" width="24" height="'+c[3]+'" rx="3" fill="'+(i%3===0?'#ef7272':'#54d6a0')+'"/></g>').join('');
 let overlay='';
 if(type==="structure")overlay='<path d="M55 225L185 185L315 150L445 105L620 42" fill="none" stroke="#f1c76d" stroke-width="3" stroke-dasharray="8 6"/><text x="455" y="88" fill="#f1c76d" font-size="15">BOS</text>';
 if(type==="liquidity"||type==="sweep")overlay='<path d="M35 65H685" stroke="#f1c76d" stroke-width="2" stroke-dasharray="8 6"/><text x="42" y="52" fill="#f1c76d" font-size="15">BUY-SIDE LIQUIDITY</text><path d="M510 35L560 75L610 115" fill="none" stroke="#ff8b8b" stroke-width="3"/>';
 if(type==="ob")overlay='<rect x="200" y="135" width="170" height="48" rx="5" fill="#54d6a0" opacity=".2" stroke="#54d6a0" stroke-width="2"/><text x="210" y="165" fill="#8ce8c1" font-size="15">BULLISH ORDER BLOCK</text>';
 if(type==="fvg")overlay='<rect x="280" y="105" width="165" height="50" rx="5" fill="#62b8ff" opacity=".2" stroke="#62b8ff" stroke-width="2"/><text x="300" y="135" fill="#9bd3ff" font-size="15">FAIR VALUE GAP</text>';
 if(type==="range")overlay='<rect x="40" y="75" width="640" height="150" fill="#f1c76d" opacity=".06" stroke="#f1c76d" stroke-dasharray="7 6"/><path d="M40 150H680" stroke="#f1c76d" stroke-width="2" stroke-dasharray="5 5"/><text x="45" y="140" fill="#f1c76d" font-size="14">EQUILIBRIUM 50%</text>';
 if(type==="volume"||type==="effort"||type==="stopping"||type==="nodemand")overlay='<g fill="#62b8ff" opacity=".7"><rect x="90" y="238" width="20" height="34"/><rect x="150" y="220" width="20" height="52"/><rect x="210" y="190" width="20" height="82"/><rect x="270" y="230" width="20" height="42"/><rect x="330" y="170" width="20" height="102"/><rect x="390" y="215" width="20" height="57"/><rect x="450" y="185" width="20" height="87"/><rect x="510" y="225" width="20" height="47"/><rect x="570" y="200" width="20" height="72"/></g><text x="35" y="290" fill="#9bd3ff" font-size="12">ILLUSTRATIVE VOLUME HISTOGRAM</text>';

 if(type==="fx"||type==="chart"||type==="entry"||type==="plan")overlay='<path d="M45 230L135 190L225 205L315 130L405 145L495 80L600 100L670 42" fill="none" stroke="#f2c66d" stroke-width="4"/><text x="45" y="35" fill="#f2c66d" font-size="15">PRICE STRUCTURE · EXAMPLE</text>';
 if(type==="risk")overlay='<rect x="90" y="65" width="540" height="170" rx="8" fill="#ed6677" opacity=".08" stroke="#ed6677" stroke-width="2"/><path d="M90 105H630M90 195H630" stroke="#ed6677" stroke-width="2" stroke-dasharray="7 5"/><text x="100" y="95" fill="#ff9aaa" font-size="15">STOP / INVALIDATION</text><text x="100" y="220" fill="#ff9aaa" font-size="15">RISK ZONE</text>';
 if(type==="cost")overlay='<rect x="115" y="85" width="210" height="110" rx="9" fill="#62b8ff" opacity=".15" stroke="#62b8ff" stroke-width="2"/><text x="145" y="125" fill="#9bd3ff" font-size="17">BID 1.0849</text><text x="145" y="165" fill="#9bd3ff" font-size="17">ASK 1.0851</text><path d="M335 140H585" stroke="#f1c76d" stroke-width="3"/><text x="395" y="125" fill="#f1c76d" font-size="16">2 PIP SPREAD</text>';
 if(type==="orders")overlay='<path d="M70 80H650M70 150H650M70 225H650" stroke="#f1c76d" stroke-width="2" stroke-dasharray="7 6"/><text x="80" y="68" fill="#f1c76d" font-size="15">BUY STOP</text><text x="80" y="138" fill="#f1c76d" font-size="15">MARKET PRICE</text><text x="80" y="213" fill="#f1c76d" font-size="15">BUY LIMIT</text>';
 if(type==="sessions")overlay='<rect x="65" y="60" width="175" height="165" fill="#62b8ff" opacity=".12"/><rect x="250" y="60" width="210" height="165" fill="#ed6677" opacity=".16"/><rect x="470" y="60" width="180" height="165" fill="#f1c76d" opacity=".13"/><text x="95" y="85" fill="#9bd3ff" font-size="16">ASIA</text><text x="290" y="85" fill="#ff9aaa" font-size="16">LONDON</text><text x="510" y="85" fill="#f1c76d" font-size="16">NEW YORK</text>';
 if(type==="breaker"||type==="framework"||type==="bias"||type==="mtf")overlay='<rect x="80" y="85" width="190" height="125" fill="#62b8ff" opacity=".12" stroke="#62b8ff" stroke-width="2"/><rect x="450" y="85" width="190" height="125" fill="#ed6677" opacity=".12" stroke="#ed6677" stroke-width="2"/><path d="M270 145H445" stroke="#f1c76d" stroke-width="3" stroke-dasharray="8 5"/><text x="105" y="115" fill="#9bd3ff" font-size="15">HIGHER TF</text><text x="475" y="115" fill="#ff9aaa" font-size="15">LOWER TF</text>';
 if(type==="model"||type==="testing"||type==="confluence")overlay='<g fill="#ed6677"><rect x="75" y="85" width="120" height="125" rx="8" opacity=".22"/><rect x="225" y="85" width="120" height="125" rx="8" opacity=".3"/><rect x="375" y="85" width="120" height="125" rx="8" opacity=".38"/><rect x="525" y="85" width="120" height="125" rx="8" opacity=".46"/></g><g fill="#fff" font-size="14"><text x="95" y="150">CONTEXT</text><text x="247" y="150">SIGNAL</text><text x="398" y="150">ENTRY</text><text x="548" y="150">REVIEW</text></g><path d="M195 148H220M345 148H370M495 148H520" stroke="#f1c76d" stroke-width="3"/>';
 if(type==="spring")overlay='<path d="M40 120H680" stroke="#f1c76d" stroke-width="2" stroke-dasharray="8 5"/><path d="M410 110L460 210L510 155L570 115L630 65" fill="none" stroke="#54d6a0" stroke-width="4"/><text x="430" y="238" fill="#8ce8c1" font-size="15">SPRING & RECOVERY</text>';
 if(type==="background")overlay='<path d="M50 220L130 195L210 210L290 165L370 175L450 125L530 145L650 90" fill="none" stroke="#62b8ff" stroke-width="3"/><rect x="65" y="55" width="580" height="190" fill="none" stroke="#f1c76d" stroke-dasharray="7 5"/><text x="80" y="45" fill="#f1c76d" font-size="15">READ THE BACKGROUND FIRST</text>';
 if(type==="nodemand")overlay+='<text x="450" y="70" fill="#f1c76d" font-size="15">LOW VOLUME TEST</text>';
 return '<svg class="course-chart-svg" viewBox="0 0 720 300" role="img" aria-label="Illustrative trading chart">'+common+'<g>'+bars+'</g>'+overlay+'</svg>';
}
function courseLessonView(course,index){
 const m=course.modules[index];if(!m)return "";
 return '<section class="course-lesson-panel"><div class="course-lesson-kicker">MODULE '+String(index+1).padStart(2,"0")+' / '+course.modules.length+'</div><h2>'+m[0]+'</h2><p class="course-lesson-intro">'+m[1]+'</p><div class="course-visual-card"><div class="course-visual-head"><b>BIGBULLS CHART LAB</b><span>ILLUSTRATIVE · NOT LIVE MARKET DATA</span></div>'+courseDiagram(m[3])+'<div class="course-visual-caption">Concept diagram · use this to understand the idea, then verify it on historical charts.</div></div><div class="course-explain-card"><span>CORE CONCEPT</span><p>'+m[2]+'</p></div><div class="course-practice-card"><b>YOUR PRACTICE TASK</b><p>Open a demo chart, find two historical examples of this concept, mark the level and invalidation, then save a screenshot in your trading journal. Do not risk real money while learning.</p></div><div class="course-lesson-actions"><button type="button" class="course-nav-btn" data-course-prev="'+index+'" '+(index===0?'disabled':'')+'>← Previous</button><span>Module '+(index+1)+' of '+course.modules.length+'</span><button type="button" class="course-nav-btn primary" data-course-next="'+index+'" '+(index===course.modules.length-1?'disabled':'')+'>Next module →</button></div></section>';
}

function courseModuleEmblem(type,index){
 const palettes={structure:["#ff5368","#8d172e"],liquidity:["#48c9e8","#145b83"],sweep:["#f5b94d","#8d431d"],ob:["#e75d72","#711d3c"],fvg:["#7b8cff","#303d91"],range:["#f4c75f","#866020"],breaker:["#dc667f","#69233e"],mtf:["#56c7a8","#145c50"],model:["#ed6c75","#761f32"],fx:["#ed5266","#761a2c"],risk:["#f5b94d","#80501e"],cost:["#57c9dc","#155b75"],orders:["#9c8cff","#49368a"],sessions:["#f0a95d","#854321"],chart:["#5ccead","#17624e"],plan:["#d77bba","#6e285e"],framework:["#f4bd63","#82531f"],bias:["#e56d78","#79233b"],entry:["#5ec4e8","#185d82"],testing:["#a78bfa","#4c3988"],basics:["#5bc9ae","#155e50"],volume:["#65b8ed","#174d7c"],stopping:["#e5a65b","#7d421e"],nodemand:["#9a8cf5","#45368a"],spring:["#e86b7e","#74203a"],effort:["#5dc7b4","#155c50"],background:["#7da5ec","#304b87"],confluence:["#d78bca","#6e3267"]};
 const colors=palettes[type]||["#ed5266","#761a2c"],id="bbem"+index;
 let glyph='<path d="M26 55L49 33L70 53L50 75Z" fill="none" stroke="#fff" stroke-width="4" stroke-linejoin="round"/><path d="M49 33V10M26 55V31M70 53V29" stroke="#fff" stroke-width="3" opacity=".7"/>';
 if(["structure","chart","fx","entry"].includes(type))glyph='<path d="M15 69L29 56L40 61L55 36L68 44L84 18" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><path d="M72 18H84V30" fill="none" stroke="#fff" stroke-width="4"/>';
 if(["liquidity","sweep","spring","breaker"].includes(type))glyph='<path d="M14 30H82M14 70H82" stroke="#fff" stroke-width="3" stroke-dasharray="5 4"/><path d="M48 15L67 43L49 70" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/>';
 if(["ob","fvg","range","mtf","framework","bias"].includes(type))glyph='<rect x="18" y="20" width="62" height="48" rx="7" fill="none" stroke="#fff" stroke-width="4"/><path d="M18 44H80M49 20V68" stroke="#fff" stroke-width="3"/><path d="M25 58L40 46L54 51L72 30" fill="none" stroke="#fff" stroke-width="3"/>';
 if(["volume","stopping","nodemand","effort","background","confluence"].includes(type))glyph='<path d="M18 72V49H29V72M39 72V27H50V72M60 72V12H71V72M80 72V39H91V72" fill="#fff" opacity=".95"/>';
 if(["risk","cost","orders","sessions","plan","testing"].includes(type))glyph='<circle cx="50" cy="46" r="31" fill="none" stroke="#fff" stroke-width="4"/><path d="M50 24V47L67 58" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/>';
 return '<svg class="module-3d-emblem" viewBox="0 0 100 100" aria-hidden="true"><defs><linearGradient id="'+id+'a" x1="0" y1="0" x2="1" y2="1"><stop stop-color="'+colors[0]+'"/><stop offset="1" stop-color="'+colors[1]+'"/></linearGradient><linearGradient id="'+id+'b" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#fff" stop-opacity=".48"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs><path d="M50 5L91 27V74L50 96L9 74V27Z" fill="#050a12" opacity=".5" transform="translate(0 3)"/><path d="M50 4L91 26V72L50 94L9 72V26Z" fill="url(#'+id+'a)" stroke="#ffffff" stroke-opacity=".48" stroke-width="2"/><path d="M50 4L91 26L50 49L9 26Z" fill="url(#'+id+'b)"/><path d="M50 49V94L9 72V26Z" fill="#080d19" opacity=".16"/>'+glyph+'</svg>';
}

function coursePage(key,index=0){
 const course=BB_COURSES[key];if(!course)return '<div class="notice">Course not found. Return to Learning Centre.</div>';
 const safeIndex=Math.max(0,Math.min(index,course.modules.length-1));
 const moduleCards=course.modules.map((m,i)=>'<button type="button" class="course-module-card '+(i===safeIndex?'active':'')+'" data-course-module="'+i+'"><span class="module-card-number">MODULE '+String(i+1).padStart(2,'0')+'</span>'+courseModuleEmblem(m[3],i)+'<b>'+m[0]+'</b><small>'+m[1]+'</small><span class="module-card-open">OPEN LESSON <i>↗</i></span></button>').join('');
 return '<div class="course-page-top"><button class="course-back-btn" type="button" data-page="learning">← ALL COURSES</button><span class="free-tag">FREE · SELF PACED</span></div><div class="course-hero course-hero-premium"><div><span class="course-hero-kicker">BIGBULLS FX MARKET · PROFESSIONAL STUDY ROOM</span><h1>'+course.title+'</h1><p>'+course.intro+'</p><div class="course-hero-tags"><span>'+course.level+'</span><span>'+course.modules.length+' interactive modules</span><span>Illustrated chart labs</span></div></div><div class="course-hero-mark">'+course.short+'</div></div><div class="course-module-heading"><div><span>YOUR LEARNING PATH</span><h2>Explore the modules</h2><p>Select any 3D module card to open its lesson and chart example.</p></div><div class="course-module-count">'+course.modules.length+' <small>LESSONS</small></div></div><div class="course-module-grid">'+moduleCards+'</div><div id="course-lesson-view">'+courseLessonView(course,safeIndex)+'</div><div class="course-disclaimer">EDUCATIONAL CONTENT ONLY · Examples are illustrative, not live market data or trade signals. Validate concepts with historical data, realistic costs and strict risk controls.</div>';
}

function pageContent(p,name){
 if(p==="course-forex")return coursePage("forex");
 if(p==="course-smc")return coursePage("smc");
 if(p==="course-ict")return coursePage("ict");
 if(p==="course-vsa")return coursePage("vsa");
 if(p==="dashboard")return '<div class="welcome-row"><div><h3>Welcome back, '+esc(name)+'</h3><p>Your brokerage services, wallet and trading tools in one terminal.</p></div><span class="client-status">● CUSTOMER ACCOUNT</span></div><div class="client-stats">'+stat("ACCOUNT STATUS","ACTIVE","Secure sign-in connected")+stat("WALLET BALANCE","$0.00","Wallet ledger setup pending")+stat("TRADING ACCOUNTS","0","Create your first account")+stat("ECHO LICENSE","LOCKED","Premium purchase required")+'</div><div class="market-strip"><div><small>MARKET DESK</small><b><i></i> DATA CONNECTION PENDING</b></div><span>FOREX</span><span>GOLD</span><span>CRYPTO</span><span>INDICES</span><span class="market-pulse">● MONITORING</span></div><h3 class="client-section-title">Your brokerage services</h3><div class="service-grid">'+tile("accounts","▤","Trading Accounts","Create and manage platform accounts","Free")+tile("wallet","◇","Wallet & Payments","Deposit and withdrawal workspace","Free")+tile("market-analysis","⌁","Market Desk","Multi-asset market workspace","Free")+tile("signals","↗","Live Signals","Signal feed and trade ideas","Open")+tile("learning","▣","Learning Centre","Lessons, sessions and resources","Free")+tile("services","✧","Client Services","Account and customer services","Explore")+tile("portfolio","◫","Portfolio","Account performance overview","Open")+tile("echo-system","⬡","Echo System","Premium AI trading software","PRO LOCKED")+'</div><div class="client-banner"><div><small>PREMIUM SOFTWARE · $199 ONE TIME</small><h3>BIGBULLS AI Echo System</h3><p>Private download is unlocked only after verified payment and license activation.</p></div><button data-page="echo-system">View package</button></div>';
 if(p==="accounts")return '<div class="page-intro accounts-page-intro"><span class="accounts-kicker">BIGBULLS · ACCOUNT CENTRE</span><h3>Your trading accounts</h3><p>Switch between Real and Demo portal accounts. These IDs are website references, not MT4/MT5 broker logins.</p></div><div class="bb-account-tabs"><button type="button" class="active" data-account-mode="real">REAL ACCOUNTS</button><button type="button" data-account-mode="demo">DEMO ACCOUNTS</button><button type="button" data-account-mode="archived">ARCHIVED</button></div><div class="action-grid accounts-workspace"><article class="client-panel account-request-panel"><span class="free-tag">CREATE ACCOUNT</span><h3>Open a website account</h3><form class="client-form" id="account-form"><label>Environment<select name="account_mode"><option value="real">Real</option><option value="demo">Demo</option></select></label><label>Account type<select name="account_type"><option>Pro</option><option>Zero</option><option>Speed</option><option>Cent</option></select></label><label>Currency<select name="currency"><option value="USD">USD</option></select></label><label>Requested platform<select name="platform"><option value="MT5">MT5</option><option value="MT4">MT4</option></select></label><label>Requested leverage<select name="leverage"><option>1:100</option><option>1:200</option><option>1:500</option><option>1:1000</option><option>1:2000</option></select></label><label>Account display name<input name="display_name" maxlength="40" placeholder="e.g. My Gold Account" required></label><button class="portal-primary" type="submit">Create account</button><div class="fine">USD portal accounts only. Platform and leverage are saved as requests; this does not create a live broker login.</div><div data-page-message></div></form></article><article class="client-panel account-list-panel"><div class="account-list-heading"><div><span class="accounts-kicker">ACCOUNT CENTRE</span><h3 id="bb-account-list-title">My Real Accounts</h3></div><span class="account-list-mark">BB</span></div><div id="my-trading-accounts" class="empty-state">Loading accounts…</div></article></div><section id="bb-account-tools" class="client-panel bb-account-tools" hidden></section><div class="notice">Deposits and withdrawals are requests linked to the selected account and require admin verification. Transfers are submitted for admin approval. Trading history requires a future MT5/broker feed connection.</div>'; if(p==="wallet")return '<div class="client-stats">'+stat("AVAILABLE BALANCE","$0.00","Approved ledger only")+stat("PENDING DEPOSITS","—","Admin review")+stat("PENDING WITHDRAWALS","—","Admin review")+stat("WALLET STATUS","SECURE","Approval controlled")+'</div><div class="wallet-actions"><button class="wallet-action active" data-wallet-tab="deposit">＋ Deposit</button><button class="wallet-action" data-wallet-tab="withdraw">↗ Withdraw</button><button class="wallet-action" data-wallet-tab="history">▤ History</button><button class="wallet-action" data-wallet-tab="transfer">⇄ Internal Transfer</button></div><section class="client-panel" id="wallet-content"><h3>Deposit cryptocurrency</h3><div id="crypto-wallet-picker">Loading admin wallet addresses…</div></section>';
 if(p==="terminal")return '<style>.bb-paper-shell{display:grid;grid-template-columns:minmax(0,1fr) 330px;gap:14px;margin-top:16px}.bb-paper-quotes{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin:14px 0}.bb-paper-quote,.bb-paper-card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:12px;color:#172033}.bb-paper-quote small,.bb-paper-muted{display:block;color:#64748b;font-size:11px}.bb-paper-quote b{display:block;font-size:18px;margin:5px 0}.bb-paper-chart{background:#fff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden}.bb-paper-chart iframe{width:100%;height:510px;border:0;display:block}.bb-paper-order{background:#0f172a;color:#fff;border-radius:14px;padding:16px}.bb-paper-order label{display:block;font-size:12px;color:#cbd5e1;margin:12px 0}.bb-paper-order input,.bb-paper-order select{width:100%;margin-top:5px;padding:10px;border-radius:8px;border:1px solid #334155;background:#020617;color:#fff}.bb-paper-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.bb-paper-actions button{padding:13px 8px;border-radius:9px;color:#fff;font-weight:800}.bb-paper-actions .buy{background:#059669}.bb-paper-actions .sell{background:#dc2626}.bb-paper-table{width:100%;border-collapse:collapse;font-size:12px}.bb-paper-table th,.bb-paper-table td{padding:9px 7px;border-bottom:1px solid #e2e8f0;text-align:left;white-space:nowrap}.bb-paper-table-wrap{overflow:auto}.bb-paper-note{background:#eff6ff;border:1px solid #bfdbfe;padding:10px;border-radius:10px;color:#1e3a8a;font-size:12px;margin-top:12px}.bb-paper-error{color:#b91c1c;background:#fef2f2;border:1px solid #fecaca;padding:9px;border-radius:9px}.bb-paper-success{color:#047857;background:#ecfdf5;border:1px solid #a7f3d0;padding:9px;border-radius:9px}@media(max-width:950px){.bb-paper-shell{grid-template-columns:1fr}.bb-paper-chart iframe{height:430px}}@media(max-width:560px){.bb-paper-chart iframe{height:360px}.bb-paper-order{padding:12px}}</style><div class="bb-terminal-intro"><div><span class="free-tag">BIGBULLS FX MARKET · BUILT-IN DEMO TERMINAL</span><h3>Trading Terminal</h3><p>Live indicative quotes, interactive charting and server-side simulated order execution. Select Demo mode to practice with virtual funds.</p></div><span class="feed-badge">PAPER EXECUTION · NO BROKER ROUTING</span></div><div class="bb-paper-quotes" id="bb-live-quotes"><div class="bb-paper-quote">Connecting to Twelve Data…</div></div><div class="bb-paper-shell"><div><div class="bb-paper-chart"><div class="bb-chart-toolbar"><div><small>CHART SYMBOL</small><b id="bb-current-symbol">EURUSD</b></div><div class="bb-chart-actions"><button data-term-tool="fullscreen">Full screen</button></div></div><div class="bb-timeframes"><button data-term-interval="1">1m</button><button data-term-interval="5" class="active">5m</button><button data-term-interval="15">15m</button><button data-term-interval="60">1H</button><button data-term-interval="240">4H</button><button data-term-interval="D">1D</button><button data-term-interval="W">1W</button></div><div class="bb-symbol-list" style="display:flex;gap:6px;flex-wrap:wrap;padding:10px"><button data-term-symbol="FX:EURUSD" class="active">EURUSD</button><button data-term-symbol="FX:GBPUSD">GBPUSD</button><button data-term-symbol="FX:USDJPY">USDJPY</button><button data-term-symbol="OANDA:XAUUSD">XAUUSD</button><button data-term-symbol="BINANCE:BTCUSDT">BTCUSDT</button><button data-term-symbol="BINANCE:ETHUSDT">ETHUSDT</button></div><iframe id="bb-tv-chart" title="BIGBULLS interactive market chart" src="https://www.tradingview.com/widgetembed/?symbol=FX%3AEURUSD&interval=5&hidesidetoolbar=0&symboledit=1&saveimage=1&toolbarbg=f1f3f6&theme=light&style=1&timezone=Etc%2FUTC&withdateranges=1&hideideas=1&allow_symbol_change=1&details=1&hotlist=1&calendar=0" loading="lazy" allowfullscreen></iframe></div><section class="bb-paper-card" style="margin-top:14px"><div class="flex justify-between items-center gap-2"><h3 style="font-weight:800">Positions & Trade History</h3><span id="bb-paper-status" class="bb-paper-muted">Connecting paper engine…</span></div><div id="bb-paper-account-summary" class="bb-paper-muted" style="margin:8px 0">Demo virtual account · $10,000 starting balance</div><div class="bb-paper-table-wrap"><table class="bb-paper-table"><thead><tr><th>Symbol</th><th>Side</th><th>Lots</th><th>Entry</th><th>Mark</th><th>Floating / Realized P&L</th><th>SL / TP</th><th>Action</th></tr></thead><tbody id="bb-paper-trades"><tr><td colspan="8">Loading trades…</td></tr></tbody></table></div><div id="bb-paper-message" class="bb-paper-muted" role="status" style="margin-top:10px"></div></section></div><aside class="bb-paper-order"><div class="flex justify-between items-center"><b>ORDER TICKET</b><span style="font-size:10px;background:#334155;padding:5px 7px;border-radius:7px">DEMO ONLY</span></div><label>Execution account<select id="bb-paper-account"><option value="demo">Built-in Demo · Virtual $10,000</option></select></label><form id="bb-paper-order-form"><label>Instrument<select name="symbol" id="bb-paper-symbol"><option value="EURUSD">EURUSD</option><option value="GBPUSD">GBPUSD</option><option value="USDJPY">USDJPY</option><option value="XAUUSD">XAUUSD · Gold</option><option value="BTCUSDT">BTCUSDT</option><option value="ETHUSDT">ETHUSDT</option><option value="BNBUSDT">BNBUSDT</option><option value="SOLUSDT">SOLUSDT</option><option value="XRPUSDT">XRPUSDT</option><option value="DOGEUSDT">DOGEUSDT</option></select></label><label>Volume (lots / units)<input name="quantity" type="number" min="0.01" max="10" step="0.01" value="0.01" required></label><label>Stop Loss · required<input name="stop_loss" type="number" min="0.00000001" step="any" placeholder="Enter stop-loss price" required></label><label>Take Profit · optional<input name="take_profit" type="number" min="0.00000001" step="any" placeholder="Enter take-profit price"></label><div class="bb-paper-actions"><button class="buy" type="submit" name="side" value="BUY">BUY</button><button class="sell" type="submit" name="side" value="SELL">SELL</button></div></form><div class="bb-paper-note">Orders are simulated by the BIGBULLS paper engine using provider quotes with modeled spread, commission and slippage. No real funds or broker orders are involved.</div><button type="button" data-paper-refresh style="width:100%;margin-top:12px;padding:10px;border:1px solid #475569;border-radius:9px">Refresh positions & quotes</button></aside></div>'; if(p==="economic-calendar")return '<div class="page-intro"><span class="free-tag">LIVE MACRO DATA · UTC SOURCE</span><h3>Economic Calendar</h3><p>Upcoming releases and central-bank events for major FX currencies. Event times are converted to your device time zone.</p></div><div class="client-panel bb-calendar-panel"><div class="bb-calendar-toolbar"><label>Impact<select id="bb-calendar-impact"><option value="all">All impact levels</option><option value="high">High impact</option><option value="medium">Medium impact</option><option value="low">Low impact</option><option value="holiday">Market holidays</option></select></label><label>Currency<select id="bb-calendar-currency"><option value="ALL">All currencies</option><option>USD</option><option>EUR</option><option>GBP</option><option>JPY</option><option>AUD</option><option>NZD</option><option>CAD</option><option>CHF</option><option>CNY</option></select></label><button type="button" class="portal-primary" id="bb-calendar-refresh">Refresh events</button><span id="bb-calendar-status">Connecting to calendar…</span></div><div id="bb-calendar-events" class="bb-calendar-events">Loading events…</div><p class="fine">Source: <a href="https://showmytrades.com/tools/economic-calendar" target="_blank" rel="noopener">ShowMyTrades Economic Calendar</a> · Public free feed, no API key. Schedule times are UTC at source. Verify important releases with official agencies; not financial advice.</p></div>';
 if(p==="trading-central")return '<div class="page-intro"><span class="free-tag">ANALYTICS & INSIGHTS</span><h3>Trading Central Insights</h3><p>Technical research, market commentary and instrument-level analysis in one workspace.</p></div><div class="client-panel"><h3>Research integration pending</h3><p>Trading Central or an approved research provider can be connected here for technical views, analyst insights and instrument reports.</p><div class="notice">This is a frontend placeholder. No third-party research feed or trade recommendation is active yet.</div></div>';
 if(p==="market-analysis")return '<div class="market-strip large"><div><small>MARKET DATA STATUS</small><b><i></i> BINANCE CRYPTO + TWELVE DATA FX · CONNECTING</b></div><span class="market-pulse">CRYPTO · 15 SEC / FX · 15 MIN</span></div><div class="page-intro"><h3>Live Crypto Market</h3><p>Public Binance spot-market quotes. Prices are exchange spot data, not broker CFD quotes or executable trading prices.</p></div><div class="bb-crypto-grid" id="bb-crypto-market-grid">Connecting to public market data…</div><div class="client-panel"><h3>Forex & Gold Market</h3><p>Authenticated Twelve Data feed. 1-minute candle close, refreshed every 15 minutes to conserve the free API quota.</p><div id="bb-fx-status" class="fine">Twelve Data · Waiting for secure provider setup</div><div class="bb-crypto-grid" id="bb-fx-market-grid">Waiting for Twelve Data Edge Function and API key setup…</div><p class="fine">Provider data is indicative market research, not broker CFD execution pricing. US30 / NAS100 are not included in this free-feed integration.</p></div>'
 if(p==="signals")return '<div class="signal-head"><div><span class="live-indicator"><i></i> BIGBULLS AI MARKET BRAIN</span><h3>AI Signals & Market Intelligence</h3><p>Multi-timeframe research across trend, candle structure, SMC-style liquidity, VSA where volume is available, and strategy confluence.</p></div><div class="signal-orbit"><span>BB</span></div></div><div class="signal-ticker"><span>MARKET WATCH</span><b>EURUSD</b><b>GBPUSD</b><b>USDJPY</b><b>XAUUSD</b><span id="bb-brain-status" class="ticker-wait">ENGINE INITIALISING <i></i></span></div><div class="bb-brain-toolbar"><div><b>TOP PAIRS WATCHLIST</b><small>Research signals only · no orders are sent</small></div><button type="button" id="bb-brain-refresh" class="portal-secondary">Refresh analysis</button></div><div id="bb-brain-summary" class="bb-brain-summary"><article><small>ENGINE</small><b>CONNECTING</b></article><article><small>MARKETS SCANNED</small><b>—</b></article><article><small>ACTIVE SETUPS</small><b>—</b></article><article><small>LAST SCAN</small><b>—</b></article></div><div id="bb-brain-signals" class="bb-brain-signals"><div class="empty-state">Connecting BIGBULLS AI Market Brain…</div></div><section class="client-panel bb-backtest-panel"><div class="bb-brain-toolbar"><div><h3>Strategy Backtest Snapshot</h3><small>EMA trend strategy on historical 5-minute candles · estimated spread/slippage included</small></div></div><div id="bb-brain-backtests" class="bb-backtests"><div class="empty-state">Waiting for historical candle data…</div></div></section><div class="notice">Signals are analytical research, not financial advice or guaranteed outcomes. WAIT is valid when evidence is insufficient. Backtest results are historical simulations and do not predict future performance. Live auto-trading is disabled.</div>';
 if(p==="learning")return `
<div class="page-intro"><span class="free-tag">100% FREE · ALL CLIENTS</span><h3>BIGBULLS Learning Centre</h3><p>Four structured learning paths from beginner to advanced. Open any course and study the modules at your own pace.</p></div>
<div class="learning-grid learning-grid-pro">
<article class="learning-course forex-course"><div class="course-top"><span class="course-index">01</span><span class="course-level">BEGINNER → ADVANCED</span></div><div class="course-icon">FX</div><h3>BIGBULLS Forex Mastery</h3><p>Forex market foundations, currency pairs, pips, spreads, leverage, order types, sessions and a complete trading routine.</p><div class="course-meta"><span>8 modules</span><span>Free course</span></div><button type="button" class="course-open-btn" data-course-open="forex">Open Forex course →</button><details class="course-syllabus"><summary>Open course curriculum <b>＋</b></summary><ol>
<li><b>Forex market fundamentals</b><small>What is forex, base and quote currency, majors, minors, crosses and how prices move.</small></li>
<li><b>Pips, lots and contract size</b><small>Calculate pip value, micro/mini/standard lots and understand profit and loss.</small></li>
<li><b>Spread, commission and swaps</b><small>Bid/ask, variable spread, trading costs, overnight swap and slippage.</small></li>
<li><b>Leverage, margin and stop out</b><small>Used/free margin, margin level, liquidation risk and why high leverage magnifies losses.</small></li>
<li><b>Orders and execution</b><small>Market, limit, stop, stop-loss, take-profit and pending-order execution.</small></li>
<li><b>Sessions and economic calendar</b><small>Asian, London and New York sessions, overlap, news impact and event preparation.</small></li>
<li><b>Chart reading essentials</b><small>Candlesticks, timeframes, trend, support/resistance and basic market structure.</small></li>
<li><b>Build a beginner trading plan</b><small>Choose one setup, define entry/exit rules, journal trades and practise on demo.</small></li>
</ol></details></article>
<article class="learning-course smc-course"><div class="course-top"><span class="course-index">02</span><span class="course-level">INTERMEDIATE → ADVANCED</span></div><div class="course-icon">SMC</div><h3>BIGBULLS Smart Money Concepts</h3><p>Institutional market structure concepts, liquidity, order blocks, fair value gaps, premium/discount and trade models.</p><div class="course-meta"><span>9 modules</span><span>Free course</span></div><button type="button" class="course-open-btn" data-course-open="smc">Open SMC course →</button><details class="course-syllabus"><summary>Open course curriculum <b>＋</b></summary><ol>
<li><b>Market structure framework</b><small>Swing highs/lows, BOS, CHoCH and distinguishing continuation from reversal.</small></li>
<li><b>Liquidity fundamentals</b><small>Buy-side and sell-side liquidity, equal highs/lows, stops and liquidity pools.</small></li>
<li><b>Liquidity sweeps and inducement</b><small>Identify stop runs, false breaks and the context needed before considering a reversal.</small></li>
<li><b>Order blocks</b><small>Understand bullish/bearish order-block zones, displacement, mitigation and invalidation.</small></li>
<li><b>Fair Value Gaps</b><small>Imbalance, three-candle FVG, consequent encroachment and gap mitigation.</small></li>
<li><b>Premium, discount and equilibrium</b><small>Use dealing ranges and the 50% equilibrium to frame location, not predict direction.</small></li>
<li><b>Supply, demand and breaker blocks</b><small>Compare zone-based methods, breaker concepts and failed structure areas.</small></li>
<li><b>Multi-timeframe alignment</b><small>Higher-timeframe bias, lower-timeframe confirmation and avoiding conflicting signals.</small></li>
<li><b>SMC trade model and review</b><small>Build a repeatable checklist, define invalidation, risk, target and journal evidence.</small></li>
</ol></details></article>
<article class="learning-course ict-course"><div class="course-top"><span class="course-index">03</span><span class="course-level">INTERMEDIATE → ADVANCED</span></div><div class="course-icon">ICT</div><h3>BIGBULLS ICT Trading Blueprint</h3><p>Time and price concepts, dealing ranges, kill zones, PD arrays, liquidity delivery and structured ICT-style models.</p><div class="course-meta"><span>9 modules</span><span>Free course</span></div><button type="button" class="course-open-btn" data-course-open="ict">Open ICT course →</button><details class="course-syllabus"><summary>Open course curriculum <b>＋</b></summary><ol>
<li><b>ICT methodology overview</b><small>Core terminology, time-and-price framework and how to test concepts objectively.</small></li>
<li><b>Liquidity and draw on liquidity</b><small>External/internal range liquidity, previous highs/lows and likely liquidity objectives.</small></li>
<li><b>Dealing range and PD arrays</b><small>Premium/discount, FVG, order blocks, breakers and mitigation blocks in context.</small></li>
<li><b>Displacement and market structure shift</b><small>Recognise impulsive repricing, MSS and the difference between a move and confirmation.</small></li>
<li><b>Kill zones and trading sessions</b><small>London and New York timing concepts, session windows and timezone adjustment.</small></li>
<li><b>Daily bias and higher-timeframe analysis</b><small>Previous day/week levels, opening prices, range context and scenario planning.</small></li>
<li><b>ICT entry models</b><small>Study liquidity sweep plus displacement, FVG retracement and model invalidation.</small></li>
<li><b>Silver Bullet and session setups</b><small>Understand the model rules, time filters, prerequisites and when to stand aside.</small></li>
<li><b>Backtest and execution discipline</b><small>Record screenshots, sample size, spread, slippage, win rate and expectancy without curve fitting.</small></li>
</ol></details></article>
<article class="learning-course vsa-course"><div class="course-top"><span class="course-index">04</span><span class="course-level">BEGINNER → ADVANCED</span></div><div class="course-icon">VSA</div><h3>BIGBULLS Volume Spread Analysis</h3><p>Read volume, candle spread and close location to study supply, demand, effort versus result and market context.</p><div class="course-meta"><span>9 modules</span><span>Free course</span></div><button type="button" class="course-open-btn" data-course-open="vsa">Open VSA course →</button><details class="course-syllabus"><summary>Open course curriculum <b>＋</b></summary><ol>
<li><b>VSA foundations</b><small>Volume, candle range, close position and the effort-versus-result principle.</small></li>
<li><b>Volume and spread relationship</b><small>Compare current activity with recent bars and interpret wide/narrow spreads.</small></li>
<li><b>Professional activity clues</b><small>Study stopping volume, buying/selling climax and high-volume tests with context.</small></li>
<li><b>No Demand and No Supply</b><small>Recognise low-activity bars and require the correct trend and confirmation.</small></li>
<li><b>Upthrusts and springs</b><small>Study failed breakouts, rejection, shakeouts and follow-through evidence.</small></li>
<li><b>Effort versus result</b><small>Spot high effort with limited progress, absorption clues and possible opposing pressure.</small></li>
<li><b>Trend and background analysis</b><small>Read the background first, compare sequences and avoid interpreting one candle alone.</small></li>
<li><b>VSA with structure and levels</b><small>Combine volume clues with support/resistance, liquidity and higher-timeframe context.</small></li>
<li><b>Build and test a VSA strategy</b><small>Write objective rules, log examples and measure expectancy after costs.</small></li>
</ol></details></article>
</div>
<div class="client-panel learning-note"><h3>BIGBULLS Study Method</h3><p>Study modules in order, mark key terms, capture chart examples and practise on a demo account. Each course is educational: no guaranteed profits, signals or personal financial advice. Forex/CFD volume may be broker tick volume rather than a centralised market-wide volume feed.</p><div class="learning-badges"><span>Self-paced learning</span><span>No course fee</span><span>Demo practice recommended</span><span>Risk-first approach</span></div></div>` ;
 if(p==="services")return '<h3 class="client-section-title">Free client services</h3><div class="service-grid">'+tile("accounts","▤","Account Management","Trading account profile and requests","Free")+tile("wallet","◇","Wallet Management","Deposit, withdrawal and ledger workspace","Free")+tile("learning","▣","Learning Sessions","Education and scheduled sessions","Free")+tile("market-analysis","⌁","Market Desk","Market research workspace","Free")+tile("signals","↗","Signals","Live feed status and signal stream","Open")+tile("support","?","Client Support","Support and service requests","Free")+'</div><div class="notice">Free account services are available in the portal. Broker execution, live market data and payment processing require secure provider integrations.</div>';
 if(p==="portfolio")return '<div class="page-intro"><span class="free-tag">ACCOUNT PERFORMANCE</span><h3>Portfolio overview</h3><p>Balances from approved BIGBULLS portal accounts and simulated paper positions. This is not a live MT4/MT5 broker statement.</p></div><div id="portfolio-stats" class="client-stats">'+stat("APPROVED ACCOUNTS","—","Loading account records")+stat("ACCOUNT BALANCE","—","Approved portal balances")+stat("OPEN PAPER POSITIONS","—","Simulation ledger")+stat("FLOATING PAPER P/L","—","Simulation only")+'</div><section class="client-panel"><h3>Trading accounts</h3><div id="portfolio-accounts">Loading accounts…</div></section><section class="client-panel"><h3>Paper positions</h3><div id="portfolio-positions">Loading positions…</div></section>';
 if(p==="orders")return '<div class="client-panel"><h3>My Orders & Trading History</h3><p>Product payment orders, trading-engine order requests and paper execution history are shown separately. Paper trades are simulations, not broker fills.</p><div id="client-product-orders">Loading product orders…</div><h3>Trading engine orders</h3><div id="client-trading-orders">Loading trading orders…</div><h3>Paper trade history</h3><div id="client-paper-history">Loading paper trades…</div></div>';
 if(p==="license")return '<div class="client-panel"><h3>Product license</h3><div id="client-license-status">Checking your license…</div></div>';
 if(p==="echo-system")return '<div class="echo-product"><div class="echo-visual"><span>⬡</span><small>BIGBULLS AI</small><b>INTELLIGENCE ENGINE</b></div><div class="echo-details"><span class="lock-label">PREMIUM · LICENSE REQUIRED</span><h3>BIGBULLS AI Echo System</h3><p>Premium AI trading software package. Access and private download are restricted to customers with a verified active license.</p><ul><li>Multi-timeframe market analysis</li><li>Strategy research and validation</li><li>Risk controls and emergency stop</li><li>Broker connection readiness and execution monitoring design</li><li>Multi-asset research: Forex, Gold, Crypto and supported Indices</li><li>Strategy confluence: SMC, VSA, price action and liquidity concepts</li><li>News-event awareness and volatility safeguards planned</li><li>Trade journal, monitoring and emergency-stop design</li></ul><div class="price">$199 <span>USD · one time</span></div><div class="package-flow"><span>01 · Create account</span><span>02 · Pay through official checkout</span><span>03 · Admin verifies payment</span><span>04 · License & private download unlock</span></div><div class="package-functions"><b>AI INTELLIGENCE TOOLKIT</b><p>Multi-timeframe analysis · SMC / VSA / liquidity confluence · news and volatility monitoring · AI-assisted trade planning · risk sizing and protection · trade journal and performance analytics · automation and emergency controls when broker integrations are enabled.</p></div><button class="portal-primary" data-open="buy">Buy full package · $199 USDT</button></div></div>';
 if(p==="downloads")return '<div class="client-panel"><h3>My Downloads</h3><p>Private download links are available only for active licenses.</p><div id="client-downloads-status">Checking package access…</div></div>';
 if(p==="settings")return '<div class="settings-tabs"><button class="active" data-settings-tab="profile">Profile</button><button data-settings-tab="security">Security</button><button data-settings-tab="preferences">Preferences</button></div><div class="client-panel" id="settings-content"><h3>Manage profile</h3><form id="profile-form" class="client-form"><label>Full name<input name="full_name" value="'+esc(user.user_metadata?.full_name||"")+'" required></label><label>Email address<input value="'+esc(user.email||"")+'" disabled></label><button class="portal-primary">Save profile</button></form><div data-page-message></div></div>';
 if(p==="profile")return '<div class="client-panel"><h3>Personal information</h3><p>Identity status: <strong id="client-kyc-profile-status">Unverified</strong></p><form id="profile-form" class="client-form"><label>Full name<input name="full_name" value="'+esc(user.user_metadata?.full_name||"")+'" required></label><label>Email address<input value="'+esc(user.email||"")+'" disabled></label><button class="portal-primary">Save profile</button></form><div data-page-message></div></div>';
 if(p==="verification")return '<div class="page-intro"><span class="free-tag">IDENTITY VERIFICATION</span><h3>Complete your KYC profile</h3><p>Submit your details and identity documents through private KYC storage. Only you and authorized administrators can access the files.</p></div><div class="kyc-status-row"><span class="lock-label" id="kyc-current-status">STATUS: LOADING</span><span class="client-status">● PRIVATE DOCUMENT STORAGE</span></div><div id="mfa-control" class="client-panel" hidden></div><div class="client-panel"><form class="client-form" id="kyc-form" method="post" enctype="multipart/form-data" autocomplete="off"><div class="form-two"><label>First name<input name="first_name" autocomplete="given-name" placeholder="Enter your first name" required></label><label>Last name<input name="last_name" autocomplete="family-name" placeholder="Enter your last name" required></label></div><div class="form-two"><label>Date of birth<input type="date" name="dob" placeholder="Select your date of birth" aria-label="Select your date of birth" required><small>Select your date of birth</small></label><label>Country of residence<input name="country" value="'+esc(user.user_metadata?.country||"") +'" placeholder="Enter your country" required></label></div><label>CNIC / ID card number<input name="document_number" autocomplete="off" placeholder="e.g. 12345-1234567-1" required></label><label>Residential address<input name="address" placeholder="House, street, city and postal code" required></label><label>Document type<select name="document_type" required><option value="CNIC">CNIC / National ID</option><option value="Passport">Passport</option><option value="Driving License">Driving License</option></select></label><div class="form-two"><label>Document front (required)<input type="file" accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf" name="document_front" required><small data-kyc-file-name="document_front">No file selected</small></label><label>Document back (CNIC / Driving License required)<input type="file" accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf" name="document_back"><small data-kyc-file-name="document_back">No file selected</small></label></div><div class="notice">Accepted files: JPG, PNG, WEBP or PDF. Each document must be at least 100 KB and no larger than 20 MB. Upload only genuine documents belonging to you.</div><button class="portal-primary" type="submit">Submit KYC securely</button><div data-page-message role="status" aria-live="polite"></div></form><div id="kyc-history" class="wallet-history"></div></div>';
 if(p==="partner")return '<div class="partner-dashboard-hero"><div><span class="free-tag">PARTNER WORKSPACE</span><h3>Grow your introducing business</h3><p>Apply for partner approval and track attributed referrals and verified commission records.</p></div><span class="client-status" id="partner-current-status">● LOADING STATUS</span></div><div class="client-panel"><h3>Partner application</h3><form class="client-form" id="partner-form"><label>Partner type<select name="partner_type"><option>IB</option><option>Educator</option><option>Content Creator</option><option>Other</option></select></label><label>Business / academy name<input name="business_name" maxlength="160"></label><label>Website or social profile<input name="website_or_social" type="url" placeholder="https://"></label><label>Approximate audience size<input name="audience_size" type="number" min="0"></label><label>Relevant experience<textarea name="experience" rows="3" maxlength="2000"></textarea></label><button class="portal-primary">Submit partner application</button><div data-page-message></div></form></div><div class="partner-dashboard-grid"><article class="client-panel"><span class="free-tag">01 / REFERRAL TOOLS</span><h3>Your referral link</h3><div id="partner-referral-link" class="referral-preview">Available after partner approval.</div></article><article class="client-panel"><span class="free-tag">02 / REFERRALS</span><h3>Referred clients</h3><div id="partner-referrals">Loading referrals…</div></article><article class="client-panel"><span class="free-tag">03 / COMMISSIONS</span><h3>Commission ledger</h3><div id="partner-commissions">Loading commission records…</div></article><article class="client-panel"><span class="free-tag">04 / IMPORTANT</span><h3>Partner terms</h3><p>Commission rates and payouts require a signed agreement and verified broker-side data. Earnings are not guaranteed.</p></article></div>';
 if(p==="admin")return isAdmin()?'<div id="bb-seo-admin-panel" class="admin-client-block"><div class="bb-seo-head"><div><small>AI SEO & GROWTH CONTROL</small><h3>Website Growth Intelligence</h3><p>Live site events, client activity, SEO content and verified business metrics.</p></div><button type="button" id="bb-seo-refresh" class="bb-exec-halt">Refresh data</button><button type="button" id="bb-seo-run-audit" class="bb-exec-halt">Run SEO audit</button><button type="button" id="bb-gsc-sync" class="bb-exec-halt">Sync Google Search Console</button></div><div id="bb-seo-status" class="notice">Loading verified data from Supabase…</div><section class="client-panel"><h3>Google Search Console · Organic Search</h3><p>28-day clicks, impressions, click-through rate, average position and top queries. Search Console sync is admin-only.</p><div id="bb-gsc-summary" class="bb-seo-metrics"><div class="bb-seo-metric">Waiting for Search Console sync</div></div><div id="bb-gsc-queries"></div></section><div id="bb-seo-metrics" class="bb-seo-metrics"></div><section class="client-panel"><h3>Top pages by visits · 30 days</h3><div id="bb-seo-top-pages"></div></section><div class="bb-seo-grid"><section class="client-panel"><h3>AI & Publishing Controls</h3><label class="bb-seo-toggle"><input type="checkbox" id="bb-seo-ai-enabled"> AI optimization enabled</label><label class="bb-seo-toggle"><input type="checkbox" id="bb-seo-publishing-enabled"> Publishing enabled</label><label class="bb-seo-toggle"><input type="checkbox" id="bb-seo-auto-publish"> Auto-publish approved website insights <small>Publishes generated educational articles to the Insights page, within the daily limit.</small></label><label class="bb-seo-toggle"><input type="checkbox" id="bb-growth-monitoring"> Run autonomous growth monitor every 10 minutes</label><label class="bb-seo-toggle"><input type="checkbox" id="bb-social-drafts" checked> Generate social captions, hashtags & banners</label><label>Maximum daily posts<input id="bb-seo-max-posts" type="number" min="0" max="5" value="1"></label><button type="button" id="bb-seo-save-settings" class="portal-primary">Save SEO settings</button></section><section class="client-panel"><h3>Autonomous Growth Engine</h3><p>Every 10 minutes the engine reviews recorded traffic, search queries, tracked keywords and page audits, then stores the next SEO strategy. New social creative is generated only when there is a useful content gap; website publishing obeys the daily limit.</p><button type="button" id="bb-growth-run-now" class="portal-primary">Run growth cycle now</button><div id="bb-growth-status" class="notice">Growth engine status will appear here.</div><h4>Recent growth strategies</h4><div id="bb-growth-runs"></div><h4>Generated social posts · Hashtags · Banners</h4><div id="bb-growth-posts"></div></section><section class="client-panel"><h3>Keyword Research Tracker</h3><form id="bb-seo-keyword-form" class="client-form"><label>Keyword<input name="keyword" required maxlength="180" placeholder="forex trading platform"></label><label>Search intent<select name="intent"><option value="informational">Informational</option><option value="commercial">Commercial</option><option value="navigational">Navigational</option><option value="transactional">Transactional</option></select></label><label>Target page<input name="target_path" value="/" maxlength="500"></label><button class="portal-primary">Save keyword</button></form><div id="bb-seo-keywords"></div></section></div><section class="client-panel"><h3>Create SEO content card</h3><p>Generate an SEO article draft with Gemini, review it, then publish manually while publishing is enabled.</p><button type="button" id="bb-seo-generate-content" class="portal-primary">Generate draft with Gemini AI</button><form id="bb-seo-card-form" class="client-form"><label>Title<input name="title" required maxlength="180"></label><label>Slug<input name="slug" required maxlength="180" placeholder="forex-market-insights"></label><div class="form-two"><label>Focus keyword<input name="focus_keyword" maxlength="180"></label><label>Target page<input name="page_path" value="/insights.html" maxlength="500"></label></div><label>Short description<textarea name="excerpt" rows="2" maxlength="400"></textarea></label><label>Article content<textarea name="content" rows="7" required maxlength="30000"></textarea></label><button class="portal-primary">Save SEO card draft</button></form><div id="bb-seo-cards"></div></section><div class="bb-seo-grid"><section class="client-panel"><h3>Page SEO Audit Records</h3><form id="bb-seo-page-form" class="client-form"><label>Page path<input name="path" required value="/"></label><label>Page title<input name="page_title" maxlength="180"></label><label>Meta description<textarea name="meta_description" rows="2" maxlength="320"></textarea></label><div class="form-two"><label>Focus keyword<input name="focus_keyword"></label><label>SEO score (0–100)<input name="seo_score" type="number" min="0" max="100" value="0"></label></div><button class="portal-primary">Save page audit</button></form><div id="bb-seo-pages"></div></section><section class="client-panel"><h3>AI Admin Intelligence</h3><p>Ask questions about recorded deposits, withdrawals, registrations, orders, traders and website growth. Answers use database facts only.</p><form id="bb-seo-assistant-form" class="client-form"><label>Your question<textarea name="question" rows="3" required placeholder="Aaj kitne deposits aur withdrawals aaye?"></textarea></label><button class="portal-primary">Ask Admin Intelligence</button></form><div id="bb-seo-assistant-answer" class="notice">Ready for a business question.</div></section></div></div><div class="admin-overview"><div><small>ADMIN WORKSPACE</small><h3>Operations control centre</h3><p>Manage customer requests and platform setup from one secure workspace.</p></div><span class="admin-secure">● ADMIN ROLE VERIFIED</span></div><div class="admin-metrics"><div><small>PAYMENT REVIEW</small><b>Manual verification</b><span>Blockchain checks required</span></div><div><small>PRODUCT ACCESS</small><b>License gated</b><span>Private download remains locked</span></div><div><small>MARKET DATA</small><b>Not connected</b><span>Provider integration pending</span></div><div><small>BROKER EXECUTION</small><b>Not connected</b><span>No live accounts provisioned</span></div></div><div class="admin-section-heading"><h3>Client & trading account control</h3><span>ADMIN ONLY · BALANCE LEDGER</span></div><div class="client-panel"><p>Only Admin can edit account balances. Every change is logged.</p><div id="admin-client-accounts">Loading client accounts…</div></div><div class="admin-section-heading"><h3>Payment wallet configuration</h3><span>ADMIN ONLY</span></div><div class="client-panel"><p>Set the receiving address and exact network. Clients will only see wallets marked active.</p><form id="admin-wallet-form" class="client-form"><div class="form-two"><label>Asset<select name="asset"><option>USDT</option><option>BTC</option><option>ETH</option><option>BNB</option><option>SOL</option><option>LTC</option></select></label><label>Network<input name="network" placeholder="TRC20 / ERC20 / BEP20 / Bitcoin" required></label></div><label>Wallet address<input name="address" required></label><label>Display label<input name="label" placeholder="Official deposit wallet"></label><button class="portal-primary">Save / update wallet</button></form><div data-page-message></div><div id="admin-wallet-list"></div></div><div class="admin-section-heading"><h3>Pending payment requests</h3><span>VERIFY TXID BEFORE APPROVAL</span></div><div class="client-panel"><button type="button" class="portal-primary" data-wallet-queue-refresh>Refresh deposit / withdrawal requests</button><div id="admin-transactions">Loading payment queue…</div></div><div class="admin-section-heading"><h3>Echo System order approvals</h3><span>VERIFY TRC20 TXID BEFORE LICENSE ISSUE</span></div><div class="client-panel"><div id="admin-product-orders">Loading product orders…</div></div><div class="admin-section-heading"><h3>Private Echo System package</h3><span>ADMIN UPLOAD · LICENSED DOWNLOADS ONLY</span></div><div class="client-panel"><form id="admin-package-form" class="client-form"><label>Upload the current Echo System ZIP package (maximum 100 MB)<input type="file" name="package" accept=".zip,application/zip,application/x-zip-compressed" required></label><button class="portal-primary" type="submit">Upload / replace private package</button><div data-page-message></div></form><p class="fine">After upload, active licensed customers receive a short-lived private download link.</p></div><div class="admin-section-heading"><h3>Portal account requests & internal transfers</h3><span>MANUAL REVIEW · NO BROKER LOGIN</span></div><div class="client-panel"><div id="admin-account-requests">Loading account queue…</div></div><div class="admin-section-heading"><h3>KYC verification centre</h3><span>PRIVATE DOCUMENT REVIEW</span></div><div class="client-panel"><button type="button" class="portal-primary" data-kyc-refresh>Refresh KYC submissions</button><div id="admin-kyc-queue">Loading KYC submissions…</div></div><div class="admin-section-heading"><h3>Partner application queue</h3><span>APPROVAL ISSUES REFERRAL CODE</span></div><div class="client-panel"><div id="admin-partner-queue">Loading partner applications…</div></div><div class="admin-section-heading"><h3>Customer Support Desk</h3><span>ADMIN REPLY · STATUS CONTROL</span></div><div class="client-panel"><button type="button" class="portal-primary" data-support-queue-refresh>Refresh support tickets</button><div id="admin-support-queue">Loading support tickets…</div></div><div class="admin-section-heading"><h3>IB commission management</h3><span>VERIFIED BROKER STATEMENT · ADMIN ONLY</span></div><div class="client-panel"><form id="admin-commission-form" class="client-form"><label>Approved partner user ID<input name="partner_user_id" required placeholder="Partner user UUID"></label><label>Referred client user ID (optional)<input name="referred_user_id" placeholder="Referred client UUID"></label><div class="form-two"><label>Verified lots<input name="verified_lots" type="number" min="0" step="0.01" value="0" required></label><label>Commission (USD)<input name="commission_usd" type="number" min="0.01" step="0.01" required></label></div><label>Broker statement / source reference<input name="source_reference" maxlength="160" required></label><label>Admin note<textarea name="admin_note" rows="2" maxlength="1000"></textarea></label><button class="portal-primary" type="submit">Record commission</button><div data-page-message></div></form><div id="admin-commission-ledger">Loading commission ledger…</div></div><div class="admin-section-heading"><h3>MT5 Trading · Demo account monitor</h3><span>ADMIN ONLY · SIMULATED ACCOUNT STATE</span></div><div class="client-panel"><p>Review each customer’s demo balance, open positions, floating P/L snapshot and closed trade history. These are simulated fills, not broker MT5 accounts.</p><div id="admin-demo-accounts">Loading demo accounts…</div></div><div class="admin-section-heading"><h3>Other platform controls</h3><span>BACKEND PHASE</span></div><div class="admin-control-grid"><article><b>Echo System licensing</b><p>Manual TXID review, license issuance and private ZIP delivery are connected. Admin must verify payment before approval.</p><span>MANUAL REVIEW ACTIVE</span></article><article><b>KYC review centre</b><p>Private document storage and Admin review/status updates are connected.</p><span>CONNECTED</span></article><article><b>IB / Partner operations</b><p>Referral attribution is active. Verified lot-based commissions and payouts still require broker-side data integration.</p><span>BROKER DATA REQUIRED</span></article><article><b>Website theme & content</b><p>Public site layout and brand theme are version-controlled in the GitHub repository.</p><span>GITHUB CONTROLLED</span></article></div>' : '<div class="notice error">Admin access restricted.</div>';
 if(p==="support")return '<div class="page-intro"><span class="free-tag">CLIENT CARE</span><h3>Customer Support</h3><p>Send a secure support ticket and follow replies from the BIGBULLS team.</p></div><div class="client-panel"><form id="support-ticket-form" class="client-form"><label>Subject<input name="subject" maxlength="160" required placeholder="How can we help?"></label><label>Category<select name="category"><option value="account">Account</option><option value="payments">Payments & wallet</option><option value="trading">Trading</option><option value="verification">KYC / verification</option><option value="technical">Technical issue</option><option value="other">Other</option></select></label><label>Message<textarea name="message" rows="5" minlength="10" maxlength="5000" required placeholder="Describe the issue and include any relevant reference number."></textarea></label><button class="portal-primary" type="submit">Submit support ticket</button><div data-page-message role="status" aria-live="polite"></div></form></div><section class="client-panel"><h3>Your support tickets</h3><div id="client-support-tickets">Loading your tickets…</div></section>';
 return '<div class="client-panel">Page not found.</div>';
}

async function renderWalletTransfer(){
 const box=document.getElementById("wallet-content");
 if(!box||!sb||!user)return;
 box.innerHTML='<span class="free-tag">FINANCE HUB</span><h3>Internal transfer</h3><p>Request a transfer between your own active USD accounts. Admin approval moves the balance and records both ledger entries.</p><div id="wallet-transfer-form-state">Loading eligible accounts…</div>';
 const {data,error}=await sb.from("trading_accounts").select("id,account_number,display_name,currency,account_mode,balance").eq("user_id",user.id).eq("status","approved").eq("currency","USD").is("archived_at",null).is("deleted_at",null).order("created_at");
 const state=document.getElementById("wallet-transfer-form-state");
 if(!state)return;
 if(error){state.textContent="Could not load accounts: "+error.message;return;}
 const accounts=data||[];
 if(accounts.length<2){state.innerHTML='<div class="notice">You need at least two active, approved USD accounts to request an internal transfer.</div><button type="button" class="portal-secondary" data-page="accounts">Open Trading Accounts</button>';return;}
 const options=accounts.map(a=>'<option value="'+esc(a.id)+'">'+esc(a.display_name||a.account_type||"Trading account")+' · #'+esc(a.account_number||"Pending")+' · '+esc(a.account_mode.toUpperCase())+' · $'+Number(a.balance||0).toFixed(2)+'</option>').join("");
 state.innerHTML='<form id="transfer-form" class="client-form"><label>From account<select name="from_account" required>'+options+'</select></label><label>To account<select name="to_account" required>'+options+'</select></label><label>Transfer amount (USD)<input name="amount" type="number" min="0.01" step="0.01" required></label><button class="portal-primary" type="submit">Submit transfer request</button><div data-page-message></div></form><div class="notice">Funds move only after Admin approval. Processing withdrawals remain reserved and cannot be transferred.</div>';
}
async function refreshPaperTerminal(forceQuotes=false){
 const host=document.getElementById("bb-paper-trades");if(!host||!sb||!user)return;
 const status=document.getElementById("bb-paper-status"),message=document.getElementById("bb-paper-message");
 try{
  const result=await sb.functions.invoke("paper-execution",{body:{action:"refresh",account_mode:"demo"}});
  if(result.error||result.data?.error)throw new Error(result.data?.error||result.error?.message||"Paper engine unavailable.");
  const data=result.data||{},ledger=data.ledger||{},trades=Array.isArray(data.trades)?data.trades:[];
  const open=trades.filter(x=>x.status==="OPEN");
  const floating=open.reduce((n,x)=>n+Number(x.unrealized_pnl||0),0);
  const balance=Number(ledger.virtual_balance||0),equity=balance+floating;
  const summary=document.getElementById("bb-paper-account-summary");
  if(summary)summary.textContent="Virtual balance $"+balance.toFixed(2)+" · Equity $"+equity.toFixed(2)+" · Floating P/L "+(floating>=0?"+":"")+"$"+floating.toFixed(2)+" · Daily realized $"+Number(ledger.daily_realized||0).toFixed(2);
  if(status)status.textContent="PAPER ENGINE ONLINE · "+open.length+" OPEN";
  host.innerHTML=trades.length?trades.map(t=>'<tr><td><b>'+esc(t.symbol)+'</b></td><td>'+esc(t.side)+'</td><td>'+Number(t.quantity||0).toFixed(2)+'</td><td>'+Number(t.entry_price||0).toFixed(5)+'</td><td>'+Number(t.mark_price||t.entry_price||0).toFixed(5)+'</td><td style="color:'+(Number(t.status==="OPEN"?t.unrealized_pnl:t.realized_pnl)>=0?"#047857":"#b91c1c")+'">'+(t.status==="OPEN"?Number(t.unrealized_pnl||0):Number(t.realized_pnl||0)).toFixed(2)+'</td><td>'+Number(t.stop_loss||0).toFixed(5)+' / '+(t.take_profit==null?"—":Number(t.take_profit).toFixed(5))+'</td><td>'+(t.status==="OPEN"?'<button type="button" data-paper-close="'+esc(t.id)+'" style="padding:6px 9px;border-radius:7px;background:#fee2e2;color:#991b1b">Close</button>':esc(t.status))+'</td></tr>').join(""):'<tr><td colspan="8">No trades yet. Use the order ticket to open your first simulated position.</td></tr>';
  if(message){message.className="bb-paper-muted";message.dataset.kind="";message.textContent="Last synced "+new Date(data.generated_at||Date.now()).toLocaleTimeString()+" · Quotes are indicative and may be delayed by provider limits."; }
  const now=Date.now();
  if(forceQuotes||!window.__bbQuotesUpdatedAt||now-window.__bbQuotesUpdatedAt>55000){
   const q=await sb.functions.invoke("market-data",{body:{}});
   const grid=document.getElementById("bb-live-quotes");
   if(grid){
    if(q.error||q.data?.error){grid.innerHTML='<div class="bb-paper-quote">Twelve Data unavailable: '+esc(q.data?.error||q.error?.message||"Provider error")+'</div>';}
    else{
     const names={"EUR/USD":"EURUSD","GBP/USD":"GBPUSD","USD/JPY":"USDJPY","XAU/USD":"XAUUSD","NDX":"NASDAQ 100"};
     grid.innerHTML=(q.data?.quotes||[]).map(x=>'<div class="bb-paper-quote"><small>'+esc(names[x.symbol]||x.symbol)+' · TWELVE DATA</small><b>'+(Number.isFinite(Number(x.close))?Number(x.close).toLocaleString("en-US",{maximumFractionDigits:5}):"—")+'</b><small style="color:'+(Number(x.percent_change)>=0?"#047857":"#b91c1c")+'">'+(x.percent_change==null?"—":Number(x.percent_change).toFixed(2)+"%")+' · '+esc(x.datetime||"Latest quote")+'</small></div>').join("")||'<div class="bb-paper-quote">No quotes returned.</div>';
     window.__bbQuotesUpdatedAt=now;
    }
   }
  }
 }catch(error){
  if(status)status.textContent="PAPER ENGINE ERROR";
  if(message){message.textContent=error.message||"Unable to load paper execution.";message.className="bb-paper-error";message.dataset.kind="error";}
  host.innerHTML='<tr><td colspan="8">Paper engine unavailable. Check the Edge Function and account settings.</td></tr>';
 }
}
function initPaperTerminalEvents(){
 if(window.__bbPaperEventsAttached)return;
 window.__bbPaperEventsAttached=true;
 document.addEventListener("submit",async function(e){
  const form=e.target;if(!(form instanceof HTMLFormElement)||form.id!=="bb-paper-order-form")return;
  e.preventDefault();
  const d=new FormData(form),side=String(e.submitter?.value||d.get("side")||"").toUpperCase();
  const symbol=String(d.get("symbol")||""),quantity=Number(d.get("quantity")),sl=Number(d.get("stop_loss")),tpRaw=String(d.get("take_profit")||"");
  const buttons=Array.from(form.querySelectorAll("button[type=submit]")),message=document.getElementById("bb-paper-message");
  if(!["BUY","SELL"].includes(side)||!(quantity>0)||!(sl>0)){if(message)message.textContent="Select BUY or SELL, a valid volume and a stop-loss price.";return;}
  buttons.forEach(b=>b.disabled=true);
  if(message){message.className="bb-paper-muted";message.dataset.kind="";message.textContent="Submitting simulated "+side+" order…";}
  try{
   const result=await sb.functions.invoke("paper-execution",{body:{action:"open",account_mode:"demo",symbol,side,quantity,stop_loss:sl,take_profit:tpRaw?Number(tpRaw):null,source:"MANUAL"}});
   if(result.error||result.data?.error)throw new Error(result.data?.error||result.error?.message||"Order rejected.");
   if(message){message.className="bb-paper-success";message.dataset.kind="success";message.textContent="Simulated "+side+" position opened at "+Number(result.data?.trade?.entry_price||result.data?.trade?.fill_price||result.data?.quote||0).toFixed(5)+". No broker order was sent.";}
   form.querySelector('[name="stop_loss"]').value="";
   form.querySelector('[name="take_profit"]').value="";
   await refreshPaperTerminal(true);
  }catch(error){if(message){message.className="bb-paper-error";message.dataset.kind="error";message.textContent=error.message||"Order could not be submitted.";}}
  finally{buttons.forEach(b=>b.disabled=false);}
 });
 document.addEventListener("click",async function(e){
  const target=e.target instanceof Element?e.target:null;if(!target)return;
  if(target.closest("[data-paper-refresh]")){await refreshPaperTerminal(true);return;}
  const close=target.closest("[data-paper-close]");if(close){
   close.disabled=true;
   const message=document.getElementById("bb-paper-message");
   try{
    const result=await sb.functions.invoke("paper-execution",{body:{action:"close",account_mode:"demo",trade_id:close.dataset.paperClose,reason:"MANUAL CLOSE"}});
    if(result.error||result.data?.error)throw new Error(result.data?.error||result.error?.message||"Close failed.");
    if(message){message.className="bb-paper-success";message.dataset.kind="success";message.textContent="Position closed and paper ledger updated.";}
    await refreshPaperTerminal(true);
   }catch(error){if(message){message.className="bb-paper-error";message.dataset.kind="error";message.textContent=error.message||"Unable to close position.";}}
   finally{close.disabled=false;}
  }
 });
 document.addEventListener("change",function(e){
  const target=e.target;if(!(target instanceof HTMLSelectElement))return;
  if(target.id==="bb-paper-symbol"){
   const map={EURUSD:"FX:EURUSD",GBPUSD:"FX:GBPUSD",USDJPY:"FX:USDJPY",XAUUSD:"OANDA:XAUUSD",BTCUSDT:"BINANCE:BTCUSDT",ETHUSDT:"BINANCE:ETHUSDT"};
   const button=document.querySelector('[data-term-symbol="'+map[target.value]+'"]');if(button)button.click();
  }
 });
}
async function loadPageData(){
 if(!sb||!user)return;
 if(activePage==="terminal"){initPaperTerminalEvents();await refreshPaperTerminal();if(!window.__bbPaperRefreshTimer)window.__bbPaperRefreshTimer=setInterval(()=>{if(activePage==="terminal")refreshPaperTerminal();},15000);return;}
 if(activePage==="economic-calendar"){
  const box=document.getElementById("bb-calendar-events");if(!box)return;
  const status=document.getElementById("bb-calendar-status");if(status)status.textContent="Refreshing live event feed…";
  const {data,error}=await sb.functions.invoke("economic-calendar",{body:{}});
  if(error||!data||data.error){if(status)status.textContent="Calendar feed unavailable";box.innerHTML='<div class="notice error">'+esc(error?.message||data?.error||"Calendar provider unavailable")+'</div>';return;}
  calendarEvents=Array.isArray(data.events)?data.events:[];
  if(status)status.textContent=calendarEvents.length+" events · Updated "+new Date(data.generated_at||Date.now()).toLocaleString();
  const renderCalendar=()=>{
   const impact=document.getElementById("bb-calendar-impact")?.value||"all",currency=document.getElementById("bb-calendar-currency")?.value||"ALL";
   const rows=calendarEvents.filter(e=>(impact==="all"||String(e.impact).toLowerCase()===impact)&&(currency==="ALL"||e.currency===currency)).sort((x,y)=>Number(x.timestamp)-Number(y.timestamp));
   box.innerHTML=rows.length?'<div class="bb-calendar-table-wrap"><table class="bb-calendar-table"><thead><tr><th>Time (local)</th><th>Currency</th><th>Impact</th><th>Event</th><th>Previous</th><th>Forecast</th><th>Actual</th><th>Status</th></tr></thead><tbody>'+rows.map(e=>'<tr><td>'+new Date(Number(e.timestamp)*1000).toLocaleString()+'</td><td><b>'+esc(e.currency)+'</b></td><td><span class="bb-impact '+esc(e.impact)+'">'+esc(String(e.impact).toUpperCase())+'</span></td><td>'+esc(e.title)+'<small>'+esc(e.confidence||"")+' · '+esc(e.period||"")+'</small></td><td>'+esc(e.previous||"—")+'</td><td>'+esc(e.forecast||"—")+'</td><td>'+esc(e.actual||"—")+'</td><td>'+esc(e.status||"scheduled")+'</td></tr>').join("")+'</tbody></table></div>':'<div class="empty-state">No events match these filters.</div>';
  };
  document.getElementById("bb-calendar-impact").onchange=renderCalendar;
  document.getElementById("bb-calendar-currency").onchange=renderCalendar;
  document.getElementById("bb-calendar-refresh").onclick=()=>loadPageData();
  renderCalendar();
  if(calendarRefreshTimer)clearInterval(calendarRefreshTimer);
  calendarRefreshTimer=setInterval(()=>{if(activePage==="economic-calendar"&&document.getElementById("bb-calendar-events"))loadPageData();},15*60*1000);
  return;
 }
 if(activePage==="wallet"){
  const picker=document.getElementById("crypto-wallet-picker");
  if(picker){
   const {data,error}=await sb.from("crypto_wallets").select("id,asset,network,label,address").eq("active",true).order("asset");
   if(error){picker.textContent="Wallet database setup required. Please contact admin.";return;}
   const wallets=data||[];
   picker.innerHTML=wallets.length?'<label>Choose crypto / network<select id="deposit-asset">'+wallets.map(w=>'<option value="'+esc(w.id)+'">'+esc(w.asset)+' · '+esc(w.network)+'</option>').join("")+'</select></label><div id="selected-wallet"></div>':'No deposit wallet is currently enabled by admin.';
   const sel=document.getElementById("deposit-asset");if(sel){sel.addEventListener("change",()=>showSelectedWallet(wallets));showSelectedWallet(wallets);}
  }
  // No wallet_balances table exists in this project; use approved account balances.
  const {data:balances,error:balanceError}=await sb.from("trading_accounts").select("balance,status").eq("user_id",user.id).is("archived_at",null).is("deleted_at",null);
  if(balanceError)console.error("Wallet balance query failed:",balanceError);
  const total=(balances||[]).filter(x=>x.status==="approved").reduce((n,x)=>n+Number(x.balance||0),0);
  const statValue=document.querySelector(".client-stat b");if(statValue)statValue.textContent="$"+total.toFixed(2);
  const headerBalance=document.getElementById("header-wallet-balance");if(headerBalance)headerBalance.textContent="$"+total.toFixed(2);
  const {data:history}=await sb.from("wallet_transactions").select("id,kind,asset,network,amount_usd,status,created_at").eq("user_id",user.id).order("created_at",{ascending:false}).limit(8);
  const content=document.getElementById("wallet-content");
  if(content&&history){let box=content.querySelector(".wallet-history");if(box)box.remove();box=document.createElement("div");box.className="wallet-history";box.innerHTML="<h3>Recent wallet activity</h3>"+(history.length?history.map(x=>'<div class="admin-row"><span>'+esc(x.kind)+' · '+esc(x.asset)+' / '+esc(x.network)+'</span><b>$'+Number(x.amount_usd||0).toFixed(2)+'</b><em class="status-'+esc(x.status)+'">'+esc(x.status)+'</em></div>').join(""):"<p>No wallet requests yet.</p>");content.append(box);}
 }
 
async function loadSeoAdminPanel(){
 const root=document.getElementById("bb-seo-admin-panel");if(!root||!sb||!user||!isAdmin())return;
 const invoke=async(action,payload)=>{const r=await sb.functions.invoke("seo-admin",{body:Object.assign({action},payload||{})});if(r.error)throw r.error;if(r.data&&r.data.error)throw new Error(r.data.error);return r.data;};
 const status=root.querySelector("#bb-seo-status");
 try{
  const d=await invoke("dashboard"),seo=d.seo||{},settings=seo.settings||{},traffic=d.traffic||{},clients=d.clients||{},finance=d.finance||{},trading=d.trading||{};
  status.textContent="Verified database snapshot · "+new Date(d.generated_at).toLocaleString()+" · "+d.note;
  const metrics=[["Page views · 24h",traffic.page_views_24h],["Page views · 7d",traffic.page_views_7d],["Page views · 30d",traffic.page_views_30d],["Unique sessions · 30d",traffic.unique_sessions_30d],["Clicks · 30d",traffic.clicks_30d],["New clients · 24h",clients.registrations_24h],["Deposits · 24h",finance.deposit_requests_24h],["Withdrawals · 24h",finance.withdrawal_requests_24h],["Pending orders · 24h",trading.pending_orders_24h],["Filled orders · 24h",trading.filled_orders_24h],["Open positions",trading.active_positions]];
  root.querySelector("#bb-seo-metrics").innerHTML=metrics.map(x=>'<div class="bb-seo-metric"><small>'+esc(x[0])+'</small><b>'+Number(x[1]||0).toLocaleString()+'</b></div>').join("");
  root.querySelector("#bb-seo-top-pages").innerHTML=(traffic.top_pages_30d||[]).map(p=>'<div class="admin-row"><span>'+esc(p.path)+'</span><b>'+Number(p.views||0).toLocaleString()+' views</b></div>').join("")||'<p class="fine">No page-view events recorded yet. Tracking starts when this site branch is deployed.</p>';
  const integrations=d.integrations||{};
  const gsc=d.search_console||{};
  root.querySelector("#bb-gsc-summary").innerHTML=[
   ["Clicks · 28 days",gsc.clicks_28d||0],
   ["Impressions · 28 days",gsc.impressions_28d||0],
   ["CTR · 28 days",(Number(gsc.ctr_28d||0)*100).toFixed(2)+"%"],
   ["Average position",gsc.average_position_28d==null?"—":Number(gsc.average_position_28d).toFixed(1)]
  ].map(x=>'<div class="bb-seo-metric"><small>'+esc(x[0])+'</small><b>'+esc(x[1])+'</b></div>').join("");
  root.querySelector("#bb-gsc-queries").innerHTML=(gsc.top_queries||[]).slice(0,8).map(q=>'<div class="admin-row"><span>'+esc(q.dimension_value)+'</span><b>'+Number(q.clicks||0).toLocaleString()+' clicks · '+Number(q.impressions||0).toLocaleString()+' impressions · pos '+Number(q.average_position||0).toFixed(1)+'</b></div>').join("")||'<p class="fine">No Google search data stored yet. Add the service-account secret, grant property access, then sync.</p>';
  status.textContent+=" · AI provider: "+(integrations.gemini_model_configured?"Gemini connected":"Gemini key not detected")+" · Search Console: "+(integrations.search_console_connected?"connected":"not connected");
  root.querySelector("#bb-seo-ai-enabled").checked=settings.ai_enabled===true;
  root.querySelector("#bb-seo-ai-enabled").disabled=!integrations.gemini_model_configured;
  root.querySelector("#bb-seo-publishing-enabled").checked=settings.publishing_enabled===true;
  root.querySelector("#bb-seo-auto-publish").checked=settings.auto_publish_enabled===true;
  root.querySelector("#bb-seo-auto-publish").disabled=!integrations.gemini_model_configured;
  root.querySelector("#bb-growth-monitoring").checked=settings.growth_monitoring_enabled===true;
  root.querySelector("#bb-growth-monitoring").disabled=!integrations.gemini_model_configured;
  root.querySelector("#bb-social-drafts").checked=settings.social_drafts_enabled!==false;
  root.querySelector("#bb-social-drafts").disabled=!integrations.gemini_model_configured;
  root.querySelector("#bb-seo-max-posts").value=Number(settings.max_daily_posts||1);
  root.querySelector("#bb-seo-keywords").innerHTML=(seo.keywords||[]).map(k=>'<div class="admin-row"><span><b>'+esc(k.keyword)+'</b><small>'+esc(k.intent)+' · '+esc(k.target_path||"/")+'</small></span><em>'+esc(k.status)+'</em></div>').join("")||'<p class="fine">No tracked keywords yet. Search volume and ranking remain blank until Search Console/provider data is connected.</p>';
  root.querySelector("#bb-seo-cards").innerHTML=(seo.cards||[]).map(c=>'<div class="admin-row"><span><b>'+esc(c.title)+'</b><small>'+esc(c.slug)+' · '+esc(c.focus_keyword||"No focus keyword")+' · '+esc(c.status)+'</small></span>'+(c.status==="draft"?'<button type="button" data-seo-publish="'+esc(c.id)+'">Publish</button>':"")+'</div>').join("")||'<p class="fine">No SEO cards created yet.</p>';
  root.querySelector("#bb-seo-pages").innerHTML=(seo.pages||[]).map(p=>'<div class="admin-row"><span><b>'+esc(p.path)+'</b><small>'+esc(p.page_title||"Untitled")+' · '+esc(p.focus_keyword||"No keyword")+'</small></span><b>'+Number(p.seo_score||0)+'/100</b></div>').join("")||'<p class="fine">No page audit records yet.</p>';
  root.querySelector("#bb-seo-save-settings").onclick=async()=>{const b=root.querySelector("#bb-seo-save-settings");b.disabled=true;try{await invoke("save_settings",{ai_enabled:root.querySelector("#bb-seo-ai-enabled").checked,publishing_enabled:root.querySelector("#bb-seo-publishing-enabled").checked,auto_publish_enabled:root.querySelector("#bb-seo-auto-publish").checked,growth_monitoring_enabled:root.querySelector("#bb-growth-monitoring").checked,social_drafts_enabled:root.querySelector("#bb-social-drafts").checked,max_daily_posts:Number(root.querySelector("#bb-seo-max-posts").value||1)});status.textContent="SEO and growth settings saved.";await loadSeoAdminPanel();}catch(e){status.textContent=e.message;}finally{b.disabled=false;}};
  root.querySelector("#bb-seo-keyword-form").onsubmit=async ev=>{ev.preventDefault();const f=ev.currentTarget,b=f.querySelector("button");b.disabled=true;try{await invoke("save_keyword",Object.fromEntries(new FormData(f)));f.reset();await loadSeoAdminPanel();}catch(e){status.textContent=e.message;}finally{b.disabled=false;}};
  root.querySelector("#bb-seo-generate-content").onclick=async()=>{const f=root.querySelector("#bb-seo-card-form"),b=root.querySelector("#bb-seo-generate-content");const title=f.elements.title.value.trim(),keyword=f.elements.focus_keyword.value.trim();if(!title||!keyword){status.textContent="Enter an article title and focus keyword first.";return;}b.disabled=true;status.textContent="Gemini is researching and drafting SEO content…";try{const r=await invoke("generate_seo_draft",{title,focus_keyword:keyword,page_path:f.elements.page_path.value});f.elements.slug.value=r.card.slug;f.elements.excerpt.value=r.card.excerpt;f.elements.content.value=r.card.content;status.textContent="Gemini draft created and saved. Review facts and wording before publishing.";}catch(e){status.textContent=e.message;}finally{b.disabled=false;}};
  root.querySelector("#bb-seo-card-form").onsubmit=async ev=>{ev.preventDefault();const f=ev.currentTarget,b=f.querySelector("button");b.disabled=true;try{await invoke("save_card",Object.fromEntries(new FormData(f)));f.reset();await loadSeoAdminPanel();}catch(e){status.textContent=e.message;}finally{b.disabled=false;}};
  root.querySelector("#bb-seo-page-form").onsubmit=async ev=>{ev.preventDefault();const f=ev.currentTarget,b=f.querySelector("button");b.disabled=true;try{const data=Object.fromEntries(new FormData(f));data.seo_score=Number(data.seo_score||0);await invoke("save_page",data);await loadSeoAdminPanel();}catch(e){status.textContent=e.message;}finally{b.disabled=false;}};
  root.querySelectorAll("[data-seo-publish]").forEach(b=>b.onclick=async()=>{b.disabled=true;try{await invoke("publish_card",{id:b.dataset.seoPublish});await loadSeoAdminPanel();}catch(e){status.textContent=e.message;b.disabled=false;}});
  const growthStatus=root.querySelector("#bb-growth-status");
  const refreshGrowth=async()=>{
   const response=await sb.functions.invoke("growth-engine",{body:{action:"dashboard"}});
   if(response.error)throw response.error;
   const data=response.data||{};
   const runs=data.runs||[],posts=data.posts||[];
   growthStatus.textContent=(data.settings?.growth_monitoring_enabled?"10-minute monitoring ENABLED":"10-minute monitoring PAUSED")+" · Last run: "+(data.settings?.last_growth_run_at?new Date(data.settings.last_growth_run_at).toLocaleString():"not run yet")+" · Latest cycle: "+(runs[0]?.status||"none");
   root.querySelector("#bb-growth-runs").innerHTML=runs.map(x=>'<div class="admin-row"><span><b>'+esc(x.status.toUpperCase())+'</b><small>'+new Date(x.started_at).toLocaleString()+' · '+esc(x.error||x.summary||"No strategy returned")+'</small></span></div>').join("")||'<p class="fine">No growth cycles recorded yet.</p>';
   root.querySelector("#bb-growth-posts").innerHTML=posts.map(x=>'<article class="admin-transaction">'+(x.banner_url?'<a href="'+esc(x.banner_url)+'" target="_blank" rel="noopener"><img src="'+esc(x.banner_url)+'" alt="Generated BIGBULLS banner" style="width:100%;max-width:520px;border-radius:12px"></a>':"")+'<b>'+esc(x.title)+'</b><p>'+esc(x.caption)+'</p><p>'+esc((x.hashtags||[]).join(" "))+'</p><small>'+esc(x.status)+' · '+new Date(x.created_at).toLocaleString()+'</small>'+(x.target_url?'<p><a href="'+esc(x.target_url)+'" target="_blank" rel="noopener">Open related article</a></p>':"")+'</article>').join("")||'<p class="fine">No AI social creatives generated yet.</p>';
  };
  try{await refreshGrowth();}catch(e){growthStatus.textContent="Growth engine unavailable: "+(e.message||String(e));}
  root.querySelector("#bb-growth-run-now").onclick=async()=>{const b=root.querySelector("#bb-growth-run-now");b.disabled=true;growthStatus.textContent="AI is checking traffic, keywords and SEO opportunities…";try{const r=await sb.functions.invoke("growth-engine",{body:{action:"run"}});if(r.error)throw r.error;if(r.data?.error)throw new Error(r.data.error);growthStatus.textContent=r.data?.skipped?"Cycle skipped: "+r.data.reason:"Growth cycle completed · "+(r.data?.strategy||"Strategy saved");await refreshGrowth();await loadSeoAdminPanel();}catch(e){growthStatus.textContent="Growth cycle failed: "+(e.message||String(e));}finally{b.disabled=false;}};
  root.querySelector("#bb-seo-refresh").onclick=()=>loadSeoAdminPanel();
  root.querySelector("#bb-gsc-sync").onclick=async()=>{const b=root.querySelector("#bb-gsc-sync");b.disabled=true;status.textContent="Connecting to Google Search Console and importing the latest available 28-day data…";try{const r=await invoke("sync_search_console");status.textContent="Search Console sync successful · "+r.page_rows+" pages · "+r.query_rows+" queries · "+r.start_date+" to "+r.end_date;await loadSeoAdminPanel();}catch(e){status.textContent=e.message;}finally{b.disabled=false;}};
  root.querySelector("#bb-seo-run-audit").onclick=async()=>{const b=root.querySelector("#bb-seo-run-audit");b.disabled=true;status.textContent="Auditing live website pages…";try{const r=await invoke("audit_pages");status.textContent="SEO audit completed for "+r.results.length+" pages. Average score: "+Math.round(r.results.reduce((n,p)=>n+p.seo_score,0)/r.results.length)+"/100.";await loadSeoAdminPanel();}catch(e){status.textContent=e.message;}finally{b.disabled=false;}};
  root.querySelector("#bb-seo-assistant-form").onsubmit=async ev=>{ev.preventDefault();const f=ev.currentTarget,b=f.querySelector("button"),out=root.querySelector("#bb-seo-assistant-answer");b.disabled=true;out.textContent="Checking recorded database facts…";try{const r=await invoke("assistant",{question:new FormData(f).get("question")});out.textContent=r.answer+(r.ai_model?"":" AI provider key is not configured; live factual snapshot is shown in the dashboard.");}catch(e){out.textContent=e.message;}finally{b.disabled=false;}};
 }catch(e){status.textContent="SEO dashboard unavailable: "+(e.message||String(e));}
}

if(activePage==="admin"&&isAdmin()){
  loadSeoAdminPanel();
  const [profiles,allAccounts]=await Promise.all([
   sb.from("profiles").select("id,full_name,email,country,phone").order("full_name"),
   sb.from("trading_accounts").select("id,user_id,account_mode,account_number,display_name,account_type,currency,balance,status,archived_at,deleted_at").is("deleted_at",null).order("created_at",{ascending:false})
  ]);
  const {data:paperAccounts,error:paperAccountsError}=await sb.from("bb_paper_accounts").select("user_id,account_state,updated_at").order("updated_at",{ascending:false});
  const {data:mt5DemoRows,error:mt5DemoError}=await sb.from("bb_mt5_demo_accounts").select("account_id,user_id,account_state,updated_at").order("updated_at",{ascending:false});
  const {data:commissionRows,error:commissionRowsError}=await sb.from("partner_commission_ledger").select("*").order("created_at",{ascending:false}).limit(100);
  const clientBox=document.getElementById("admin-client-accounts");
  if(clientBox){
   let dossierPanel=document.getElementById("bb-client-dossier-panel");
   if(!dossierPanel){dossierPanel=document.createElement("section");dossierPanel.id="bb-client-dossier-panel";dossierPanel.className="admin-client-block";clientBox.parentElement.insertBefore(dossierPanel,clientBox);}
   dossierPanel.innerHTML='<div class="bb-exec-admin-head"><div><small>PRIVATE CLIENT RECORDS</small><h3>Client Dossier / Digital File</h3><p>Search by Client File ID or Trading Account Number.</p></div><span class="bb-exec-status ready">ADMIN ONLY</span></div><div class="bb-dossier-search"><input id="bb-dossier-lookup" inputmode="numeric" placeholder="Enter Client File ID / Account Number"><button type="button" id="bb-dossier-open" class="bb-exec-halt">Open Client File</button></div><div id="bb-dossier-result">Each registered client receives a separate backend dossier.</div>';
   const dossierButton=dossierPanel.querySelector("#bb-dossier-open");
   dossierButton.onclick=async()=>{
    const lookup=dossierPanel.querySelector("#bb-dossier-lookup").value.trim(),out=dossierPanel.querySelector("#bb-dossier-result");
    if(!lookup){out.textContent="Enter a Client File ID or Trading Account Number.";return;}
    dossierButton.disabled=true;out.textContent="Loading secure client file…";
    const response=await sb.functions.invoke("trading-gateway",{body:{action:"client_dossier",lookup}});
    dossierButton.disabled=false;
    const d=response.data;
    if(response.error||!d?.profile){out.textContent=d?.error||response.error?.message||"Client file unavailable.";return;}
    const p=d.profile;
    const section=(heading,items,render)=>'<h4>'+heading+' ('+items.length+')</h4>'+(items.length?items.map(render).join(""):'<p class="fine">No records yet.</p>');
    const row=(left,right,sub)=>'<div class="admin-row"><span><b>'+left+'</b><small>'+sub+'</small></span><b>'+right+'</b></div>';
    out.innerHTML='<div class="bb-dossier-profile"><div><small>CLIENT FILE · BB-'+esc(d.dossier?.dossier_number||"—")+'</small><h3>'+esc(p.full_name||"Client")+'</h3><p>'+esc(p.email||"")+' · '+esc(p.phone||"")+' · '+esc(p.country||"")+'</p><p>UUID: '+esc(p.id)+' · '+esc(p.status||"")+'</p></div><span class="bb-exec-status ready">'+esc(d.dossier?.folder_status||"ACTIVE")+'</span></div>'+
    section("Trading Accounts",d.accounts,x=>row("#"+esc(x.account_number)+" · "+esc((x.account_mode||"").toUpperCase()),esc(x.currency)+" "+Number(x.balance||0).toFixed(2),esc(x.account_type||"")+" · "+esc(x.status||"")))+
    section("Wallet / Deposit / Withdrawal Ledger",d.wallet_transactions,x=>row(esc(x.kind)+" · "+esc(x.asset)+" · "+esc(x.status),"$"+Number(x.amount_usd||0).toFixed(2),esc(x.tx_hash||"No TX hash")+" · "+new Date(x.created_at).toLocaleString()))+
    section("Payment Submissions",d.payment_submissions,x=>row(esc(x.status),esc(x.txid||""),new Date(x.submitted_at).toLocaleString()))+
    section("Orders",d.orders,x=>row(esc(x.symbol)+" · "+esc(x.side)+" · "+esc(x.order_type),esc(x.quantity)+" @ "+esc(x.requested_price??"Market"),esc(x.status)+" · "+new Date(x.created_at).toLocaleString()))+
    section("Positions",d.positions,x=>row(esc(x.symbol)+" · "+esc(x.side)+" · "+esc(x.status),esc(x.quantity)+" · P/L "+Number(x.unrealized_pnl||x.realized_pnl||0).toFixed(2),"Opened "+new Date(x.opened_at).toLocaleString()))+
    section("Fills / Executions",d.fills,x=>row(esc(x.symbol)+" · "+esc(x.side),esc(x.quantity)+" @ "+esc(x.fill_price),new Date(x.filled_at).toLocaleString()))+
    section("Audit Trail",d.audit_events,x=>row(esc(x.event_type),esc(x.account_mode||""),esc(x.entity_type||"")+" · "+new Date(x.created_at).toLocaleString()));
   };
  }
  if(clientBox){
   let executionPanel=document.getElementById("bb-execution-admin-status");
   if(!executionPanel){executionPanel=document.createElement("section");executionPanel.id="bb-execution-admin-status";executionPanel.className="admin-client-block";clientBox.parentElement.insertBefore(executionPanel,clientBox);}
   const {data:executionData,error:executionError}=await sb.functions.invoke("trading-gateway",{body:{action:"admin_status"}});
   if(executionError||!executionData?.execution){executionPanel.innerHTML='<b>Execution controls unavailable</b><p>'+esc(executionError?.message||"Trading gateway is unavailable.")+'</p>';}
   else{
    const ex=executionData.execution,limits=ex.risk_limits||{},checks=Object.entries(ex.readiness||{}).map(([k,v])=>'<div class="bb-exec-check"><span>'+esc(k.replaceAll("_"," "))+'</span><b class="'+(v?"ready":"blocked")+'">'+(v?"VERIFIED":"NOT VERIFIED")+'</b></div>').join("");
    executionPanel.innerHTML='<div class="bb-exec-admin-head"><div><small>BIGBULLS SERVER CONTROL</small><h3>Execution & Risk Control</h3></div><span class="bb-exec-status '+(ex.global_halt?"blocked":"ready")+'">'+(ex.global_halt?"GLOBAL HALT ACTIVE":"SERVER ONLINE")+'</span></div><div class="bb-exec-admin-grid"><div><small>Demo engine</small><b>'+(ex.demo_enabled?"AVAILABLE":"HALTED")+'</b></div><div><small>Live execution</small><b class="blocked">'+(ex.live_effective?"ENABLED":"LOCKED")+'</b></div><div><small>Trading accounts</small><b>'+Number(executionData.totals?.accounts||0)+'</b></div><div><small>Open positions</small><b>'+Number(executionData.totals?.open_positions||0)+'</b></div><div><small>Recorded orders</small><b>'+Number(executionData.totals?.orders||0)+'</b></div></div><h4>Global risk limits</h4><div class="bb-exec-admin-grid"><div><small>Risk / trade</small><b>'+Number(limits.max_risk_per_trade_pct||1).toFixed(2)+'%</b></div><div><small>Daily loss cap</small><b>'+Number(limits.max_daily_loss_pct||3).toFixed(2)+'%</b></div><div><small>Aggregate risk</small><b>'+Number(limits.max_aggregate_risk_pct||3).toFixed(2)+'%</b></div><div><small>Max open positions</small><b>'+Number(limits.max_open_positions||5)+'</b></div><div><small>Max leverage</small><b>1:'+Number(limits.max_leverage||100)+'</b></div></div><button type="button" id="bb-exec-risk-config" class="bb-exec-halt">Configure global risk limits</button><h4>Live execution readiness</h4><div class="bb-exec-checks">'+checks+'<div class="bb-exec-check"><span>Execution adapter configured</span><b class="'+(ex.adapter_ready?"ready":"blocked")+'">'+(ex.adapter_ready?"READY":"NOT CONFIGURED")+'</b></div></div><p class="bb-exec-warning">Live execution stays locked until every verification and a real execution adapter are configured. A BIGBULLS server alone does not create external liquidity, settlement or regulatory authorization.</p><button type="button" id="bb-exec-halt-toggle" class="bb-exec-halt">'+(ex.global_halt?"Resume Demo engine":"Emergency halt all execution")+'</button>';
    const riskButton=executionPanel.querySelector("#bb-exec-risk-config");
    if(riskButton)riskButton.onclick=async()=>{const next={max_risk_per_trade_pct:Number(window.prompt("Maximum risk per trade (%)",String(limits.max_risk_per_trade_pct||1))),max_daily_loss_pct:Number(window.prompt("Maximum daily loss (%)",String(limits.max_daily_loss_pct||3))),max_aggregate_risk_pct:Number(window.prompt("Maximum aggregate open risk (%)",String(limits.max_aggregate_risk_pct||3))),max_open_positions:Number(window.prompt("Maximum open positions",String(limits.max_open_positions||5))),max_leverage:Number(window.prompt("Maximum leverage (e.g. 100 for 1:100)",String(limits.max_leverage||100)))};if(Object.values(next).some(v=>!Number.isFinite(v)))return;riskButton.disabled=true;const result=await sb.functions.invoke("trading-gateway",{body:{action:"set_global_risk",...next}});if(result.error){riskButton.disabled=false;alert(result.error.message);return;}await loadPageData();};
    const haltButton=executionPanel.querySelector("#bb-exec-halt-toggle");
    if(haltButton)haltButton.onclick=async()=>{const enabled=!ex.global_halt;const reason=enabled?(window.prompt("Reason for emergency halt","Administrator emergency stop")||"Administrator emergency stop"):"Administrator resumed Demo execution";if(enabled&&!reason)return;haltButton.disabled=true;const result=await sb.functions.invoke("trading-gateway",{body:{action:"set_global_halt",enabled,reason}});if(result.error){haltButton.disabled=false;alert(result.error.message);return;}await loadPageData();};
   }
  }
  if(clientBox){
   if(profiles.error||allAccounts.error)clientBox.textContent="Client list unavailable: "+(profiles.error||allAccounts.error).message;
   else{
    const accs=allAccounts.data||[];
    clientBox.innerHTML=(profiles.data||[]).map(p=>{
     const owned=accs.filter(a=>a.user_id===p.id);
     return '<div class="admin-client-block"><div class="admin-row"><span><b>'+esc(p.full_name||"Client")+'</b><small>'+esc(p.country||"")+' · '+esc(p.phone||"")+' · '+esc(p.id)+'</small></span><b>'+owned.filter(a=>a.account_mode==="real").length+' Real / '+owned.filter(a=>a.account_mode==="demo").length+' Demo</b></div>'+
      (owned.map(a=>'<div class="admin-row"><span><b>#'+esc(a.account_number)+' · '+esc(a.account_mode.toUpperCase())+' · '+esc(a.account_type)+'</b><small>'+esc(a.currency)+' · '+esc(a.status)+(a.archived_at?' · Archived':'')+'</small></span><b>'+esc(a.currency)+' '+Number(a.balance||0).toFixed(2)+'</b><button type="button" data-admin-adjust="'+esc(a.id)+'">Adjust balance</button></div>').join("")||'<p>No trading accounts.</p>')+'</div>';
    }).join("")||"No clients found.";
   }
  }
  const [w,t,ac,tr,kyc,partners,productOrders,supportTickets]=await Promise.all([
   sb.from("crypto_wallets").select("*").order("asset"),
   sb.from("wallet_transactions").select("*").in("status",["pending","otp_pending","processing"]).order("created_at"),
   sb.from("trading_accounts").select("*").eq("status","pending").order("created_at"),
   sb.from("account_transfers").select("*").eq("status","pending").order("created_at"),
   sb.from("kyc_submissions").select("*").order("created_at",{ascending:false}).limit(100),
   sb.from("partner_applications").select("*").eq("status","pending").order("created_at"),
   sb.from("product_orders").select("*").eq("status","pending").order("created_at"),
   sb.from("support_tickets").select("*").order("created_at",{ascending:false}).limit(100)
  ]);
  const wl=document.getElementById("admin-wallet-list");
  if(wl)wl.innerHTML=w.error?"Wallet table not ready. Run the SQL setup first.":(w.data||[]).map(x=>'<div class="admin-row"><span><b>'+esc(x.asset)+' · '+esc(x.network)+'</b><small>'+esc(x.address)+'</small></span><button data-wallet-toggle="'+esc(x.id)+'" data-active="'+String(x.active)+'">'+(x.active?"Disable":"Enable")+'</button></div>').join("")||"No wallets configured.";
  const tl=document.getElementById("admin-transactions");
  if(tl){
   if(t.error)tl.textContent="Transaction table not ready: "+t.error.message;
   else {
    const rows=await Promise.all((t.data||[]).map(async x=>{
     const proof=x.proof_path?await sb.storage.from("payment-proofs").createSignedUrl(x.proof_path,300):null;
     const processing=x.status==="processing",otpPending=x.status==="otp_pending";
     return '<div class="admin-transaction"><b>'+esc(x.kind.toUpperCase())+' · '+esc(x.asset)+' / '+esc(x.network)+' · '+esc(x.status.toUpperCase())+'</b><small>Invoice '+esc(x.invoice_id||x.id)+' · Client '+esc(x.user_id)+' · Account '+esc(x.account_id||"—")+'</small><small>Amount $'+Number(x.amount_usd||0).toFixed(2)+' · '+esc(x.amount_crypto||"")+' · '+new Date(x.created_at).toLocaleString()+'</small><small>'+(x.kind==="withdrawal"?'Receiving address / Binance ID: ':'Deposit TXID: ')+esc(x.kind==="withdrawal"?x.destination_address:x.tx_hash||"")+'</small>'+(proof?.data?.signedUrl?'<a href="'+esc(proof.data.signedUrl)+'" target="_blank" rel="noopener">View payment proof</a>':'')+(otpPending?'<small>Awaiting client email OTP verification. Review actions unlock after successful verification.</small>':(processing?'<button data-complete-withdrawal="'+esc(x.id)+'">Confirm payout sent</button>':'<button data-review="'+esc(x.id)+'" data-status="approved">Approve / process</button>')+(processing?'':'<button data-review="'+esc(x.id)+'" data-status="rejected">Reject</button>'))+(x.rejection_reason?'<small>Rejection: '+esc(x.rejection_reason)+'</small>':'')+'</div>';
    }));
    tl.innerHTML=rows.join("")||"No pending wallet requests.";
   }
  }
  const po=document.getElementById("admin-product-orders");
  if(po)po.innerHTML=productOrders.error?'<div class="notice error">'+esc(productOrders.error.message)+'</div>':(productOrders.data||[]).map(o=>'<div class="admin-transaction"><b>'+esc(o.product_code)+' · $'+Number(o.amount_usd||0).toFixed(2)+'</b><small>Client '+esc(o.user_id)+' · '+new Date(o.created_at).toLocaleString()+'</small><small>Payment '+esc(o.payment_method||"")+' · TXID '+esc(o.payment_reference||"Missing")+'</small><button data-product-order-review="'+esc(o.id)+'" data-status="paid">Verify payment & issue license</button><button data-product-order-review="'+esc(o.id)+'" data-status="rejected">Reject order</button></div>').join("")||"No pending Echo System orders.";
  const kq=document.getElementById("admin-kyc-queue");
   if(kq){
    if(kyc.error)kq.innerHTML='<div class="notice error">KYC queue unavailable: '+esc(kyc.error.message)+'</div>';
    else if(!kyc.data?.length)kq.textContent="No KYC submissions have been received yet.";
    else{
     const rows=await Promise.all(kyc.data.map(async x=>{
      const front=await sb.storage.from("kyc-documents").createSignedUrl(x.document_front_path,300);
      const back=x.document_back_path?await sb.storage.from("kyc-documents").createSignedUrl(x.document_back_path,300):null;
      const pending=x.status==="pending";
      return '<div class="admin-transaction"><b>'+esc(x.legal_name)+' · '+esc(x.document_type)+' · '+esc(String(x.status||"unknown").toUpperCase())+'</b><small>'+esc(x.country)+' · '+esc(x.date_of_birth)+' · '+esc(x.residential_address)+'</small>'+(x.document_number?'<small>Identity number: '+esc(x.document_number)+'</small>':'')+'<small>Submitted '+new Date(x.created_at).toLocaleString()+' · Client '+esc(x.user_id)+'</small>'+(front.data?.signedUrl?'<a target="_blank" rel="noopener" href="'+esc(front.data.signedUrl)+'">View front document</a>':'<small>Front document unavailable: '+esc(front.error?.message||"private file not found")+'</small>')+(back?.data?.signedUrl?'<a target="_blank" rel="noopener" href="'+esc(back.data.signedUrl)+'">View back document</a>':(x.document_back_path?'<small>Back document unavailable: '+esc(back?.error?.message||"private file not found")+'</small>':""))+(pending?'<label>Rejection reasons (select all that apply)<select multiple data-kyc-reasons style="min-height:120px"><option value="document_blurry">Blurry / unreadable document</option><option value="expired_document">Expired document</option><option value="name_mismatch">Name mismatch</option><option value="photo_mismatch">Photo mismatch</option><option value="missing_back">Missing back side</option><option value="address_incomplete">Incomplete address</option><option value="dob_mismatch">Date of birth mismatch</option><option value="unsupported_document">Unsupported document</option><option value="document_tampering">Altered / damaged document</option><option value="other">Other</option></select></label><label>Admin response<textarea data-kyc-admin-note rows="2" maxlength="1000" placeholder="Optional guidance for client"></textarea></label><button data-kyc-review="'+esc(x.id)+'" data-status="approved">Approve KYC</button><button data-kyc-review="'+esc(x.id)+'" data-status="rejected">Reject with selected reasons</button>':'<small>Reviewed '+(x.reviewed_at?new Date(x.reviewed_at).toLocaleString():"—")+(x.admin_note?' · Admin: '+esc(x.admin_note):"")+'</small>')+'</div>';
     }));kq.innerHTML=rows.join("");
    }
   }
   const pq=document.getElementById("admin-partner-queue");
  if(pq)pq.innerHTML=partners.error?"Partner queue unavailable: "+esc(partners.error.message):(partners.data||[]).map(x=>'<div class="admin-transaction"><b>'+esc(x.partner_type)+' · '+esc(x.business_name||"No business name")+'</b><small>'+esc(x.website_or_social||"No website")+' · Audience '+esc(x.audience_size??"—")+'</small><span>Client '+esc(x.user_id)+' · '+esc(x.experience||"")+'</span><button data-partner-review="'+esc(x.id)+'" data-status="approved">Approve partner</button><button data-partner-review="'+esc(x.id)+'" data-status="rejected">Reject</button></div>').join("")||"No pending partner applications.";
  const supportBox=document.getElementById("admin-support-queue");
  if(supportBox){
   if(supportTickets.error)supportBox.innerHTML='<div class="notice error">'+esc(supportTickets.error.message)+'</div>';
   else supportBox.innerHTML=(supportTickets.data||[]).map(ticket=>'<article class="admin-transaction"><b>'+esc(ticket.subject)+' · '+esc(String(ticket.status).toUpperCase())+'</b><small>'+esc(ticket.category)+' · Client '+esc(ticket.user_id)+' · '+new Date(ticket.created_at).toLocaleString()+'</small><p>'+esc(ticket.message)+'</p>'+(ticket.admin_reply?'<div class="notice"><b>Previous reply:</b> '+esc(ticket.admin_reply)+'</div>':'')+'<div class="bb-support-review-actions"><button type="button" data-support-review="'+esc(ticket.id)+'" data-status="open">Reopen</button><button type="button" data-support-review="'+esc(ticket.id)+'" data-status="in_progress">In progress</button><button type="button" data-support-review="'+esc(ticket.id)+'" data-status="resolved">Resolve</button><button type="button" data-support-review="'+esc(ticket.id)+'" data-status="closed">Close</button></div></article>').join("")||'<div class="empty-state">No support tickets have been submitted.</div>';
  }
  const commissionBox=document.getElementById("admin-commission-ledger");
  if(commissionBox)commissionBox.innerHTML=commissionRowsError?'<div class="notice error">'+esc(commissionRowsError.message)+'</div>':(commissionRows||[]).map(x=>'<div class="admin-transaction"><b>'+esc(x.partner_user_id)+' · $'+Number(x.commission_usd||0).toFixed(2)+' · '+esc(String(x.status).toUpperCase())+'</b><small>'+Number(x.verified_lots||0).toFixed(2)+' lots · '+esc(x.source_reference||"")+(x.referred_user_id?' · Client '+esc(x.referred_user_id):"")+'</small><small>'+esc(x.admin_note||"No admin note")+'</small>'+(x.status==="pending"?'<button data-commission-status="'+esc(x.id)+'" data-status="approved">Approve commission</button>':"")+(x.status==="approved"?'<button data-commission-status="'+esc(x.id)+'" data-status="paid">Mark as paid</button>':"")+(x.status!=="paid"&&x.status!=="rejected"?'<button data-commission-status="'+esc(x.id)+'" data-status="rejected">Reject</button>':"")+(x.paid_at?'<small>Paid '+new Date(x.paid_at).toLocaleString()+'</small>':"")+'</div>').join("")||"No commission records yet.";
  const demoBox=document.getElementById("admin-demo-accounts");
  if(demoBox){
   if(paperAccountsError||mt5DemoError)demoBox.innerHTML='<div class="notice error">'+esc((paperAccountsError||mt5DemoError).message)+'</div>';
   else{
    const profilesById=new Map((profiles.data||[]).map(p=>[p.id,p]));
    const accountsById=new Map((allAccounts.data||[]).map(x=>[x.id,x]));
    const rows=[...(mt5DemoRows||[]).map(x=>({...x,source:"MT5 DEMO"})),...(paperAccounts||[]).map(x=>({...x,source:"LEGACY DEMO"}))];
    demoBox.innerHTML=rows.map(row=>{
     const st=row.account_state||{},profile=profilesById.get(row.user_id)||{},account=accountsById.get(row.account_id)||{};
     const positions=Array.isArray(st.positions)?st.positions:[],pending=Array.isArray(st.pendingOrders)?st.pendingOrders:[],history=Array.isArray(st.history)?st.history:[],quotes=st.lastQuotes||{};
     const floating=positions.reduce((sum,x)=>{const key=String(x.symbol||"").replaceAll("/","").toUpperCase(),price=Number(quotes[key]);if(!Number.isFinite(price))return sum;const mult=x.symbol==="XAU/USD"?100:(["EUR/USD","GBP/USD","USD/JPY"].includes(x.symbol)?100000:1);let value=(x.side==="BUY"?price-Number(x.entry):Number(x.entry)-price)*Number(x.quantity||0)*mult;if(x.symbol==="USD/JPY"&&price>0)value/=price;return sum+value;},0);
     const equity=Number(st.balance||0)+floating;
     const recent=history.filter(x=>{const ts=Date.parse(x.closedAt||x.openedAt);return Number.isFinite(ts)&&Date.now()-ts<=180*86400000;});
     return '<article class="bb-admin-demo-account"><div class="bb-admin-demo-head"><div><b>'+esc(profile.full_name||"Client")+' · '+esc(account.display_name||("MT5 #"+(account.account_number||"—")))+'</b><small>'+esc(profile.email||row.user_id)+'</small><small>'+esc(row.source)+' · Last cloud sync: '+new Date(row.updated_at).toLocaleString()+'</small></div><span class="free-tag">DEMO · SIMULATED</span></div><div class="bb-admin-demo-stats"><div><small>Balance</small><b>$'+Number(st.balance||0).toFixed(2)+'</b></div><div><small>Equity snapshot</small><b>$'+equity.toFixed(2)+'</b></div><div><small>Floating P/L snapshot</small><b>'+(floating>=0?"+":"")+'$'+floating.toFixed(2)+'</b></div><div><small>Realized P/L</small><b>'+(Number(st.balance||0)-10000>=0?"+":"")+'$'+(Number(st.balance||0)-10000).toFixed(2)+'</b></div><div><small>Pending orders</small><b>'+pending.length+'</b></div><div><small>Closed trades</small><b>'+history.length+'</b></div></div><details><summary>Open positions ('+positions.length+') · Pending orders ('+pending.length+') · Trade history ('+history.length+')</summary><div class="bb-admin-demo-trades"><h4>Pending orders</h4>'+(pending.map(x=>'<p><b>'+esc(x.symbol)+' '+esc(x.orderType)+'</b> · '+esc(x.quantity)+' · Entry '+esc(x.entryPrice)+' · SL '+esc(x.sl)+' · TP '+esc(x.tp)+' · '+esc(x.status||"PENDING")+'</p>').join("")||"<p>No pending orders.</p>")+'<h4>Open positions</h4>'+(positions.map(x=>{const q=Number(quotes[String(x.symbol||"").replaceAll("/","").toUpperCase()]),mult=x.symbol==="XAU/USD"?100:(["EUR/USD","GBP/USD","USD/JPY"].includes(x.symbol)?100000:1),mark=Number.isFinite(q)?q:Number(x.entry),pl=Number.isFinite(q)?(x.side==="BUY"?q-Number(x.entry):Number(x.entry)-q)*Number(x.quantity||0)*mult:0;return '<p><b>'+esc(x.symbol)+' '+esc(x.side)+'</b> · '+esc(x.quantity)+' lots · Entry '+esc(x.entry)+' · Mark '+esc(mark)+' · Floating P/L $'+pl.toFixed(2)+' · SL '+esc(x.sl)+' · TP '+esc(x.tp)+'</p>';}).join("")||"<p>No open positions.</p>")+'<h4>Closed history · Last 6 months</h4>'+(recent.slice(0,250).map(x=>'<p>'+esc(x.symbol)+' '+esc(x.side)+' · '+new Date(x.closedAt||x.openedAt).toLocaleString()+' · P/L $'+Number(x.pnl||0).toFixed(2)+' · '+esc(x.reason||"")+'</p>').join("")||"<p>No closed trades in last 6 months.</p>")+'</div></details></article>';
    }).join("")||"No demo trading accounts have synced yet.";
   }
  }
  const ar=document.getElementById("admin-account-requests");
  if(ar)ar.innerHTML=(ac.error?'<div class="notice error">Trading accounts: '+esc(ac.error.message)+'</div>':'')+(tr.error?'<div class="notice error">Transfers: '+esc(tr.error.message)+'</div>':'')+'<h4>Trading account requests</h4>'+((ac.error?[]:ac.data||[]).map(x=>'<div class="admin-transaction"><b>'+esc(x.platform)+' · '+esc(x.account_type)+' · '+esc(x.currency)+' · '+esc(x.requested_leverage||"1:100")+'</b><small>Portal account request · Client '+esc(x.user_id)+'</small><button data-account-review="'+esc(x.id)+'" data-status="approved">Approve portal account</button><button data-account-review="'+esc(x.id)+'" data-status="rejected">Reject</button></div>').join("")||"No pending account requests.")+'<h4>Internal transfer requests</h4>'+((tr.error?[]:tr.data||[]).map(x=>'<div class="admin-transaction"><b>Transfer · $'+Number(x.amount_usd||0).toFixed(2)+'</b><small>'+esc(x.from_account)+' → '+esc(x.to_account)+' · Client '+esc(x.user_id)+'</small><button data-transfer-review="'+esc(x.id)+'" data-status="approved">Approve</button><button data-transfer-review="'+esc(x.id)+'" data-status="rejected">Reject</button></div>').join("")||"No pending transfer requests.");
 }
 if(activePage==="support"){
  const box=document.getElementById("client-support-tickets");
  if(box){
   const {data,error}=await sb.from("support_tickets").select("id,subject,category,message,status,admin_reply,created_at").eq("user_id",user.id).order("created_at",{ascending:false}).limit(30);
   box.innerHTML=error?'<div class="notice error">'+esc(error.message)+'</div>':(data||[]).map(t=>'<article class="admin-row"><span><b>'+esc(t.subject)+'</b><small>'+esc(t.category)+' · '+new Date(t.created_at).toLocaleString()+'</small><small>'+esc(t.message)+'</small>'+(t.admin_reply?'<small><b>BIGBULLS reply:</b> '+esc(t.admin_reply)+'</small>':'')+'</span><em class="status-'+esc(t.status)+'">'+esc(t.status.toUpperCase())+'</em></article>').join("")||'<div class="empty-state">You have not submitted a support ticket yet.</div>';
  }
 }
 if(activePage==="portfolio"){
  const [accounts,positions]=await Promise.all([
   sb.from("trading_accounts").select("id,account_number,account_mode,account_type,currency,balance,status,display_name").eq("user_id",user.id).is("archived_at",null).is("deleted_at",null).order("created_at",{ascending:false}),
   sb.from("bb_paper_execution_trades").select("id,symbol,side,quantity,entry_price,mark_price,unrealized_pnl,status,opened_at,execution_mode").eq("user_id",user.id).eq("status","OPEN").order("opened_at",{ascending:false}).limit(100)
  ]);
  const approved=(accounts.data||[]).filter(a=>a.status==="approved"),total=approved.reduce((n,a)=>n+Number(a.balance||0),0),open=positions.data||[],floating=open.reduce((n,p)=>n+Number(p.unrealized_pnl||0),0);
  const stats=document.getElementById("portfolio-stats");
  if(stats)stats.innerHTML='<div class="client-stat"><small>APPROVED ACCOUNTS</small><b>'+approved.length+'</b><span>Portal accounts</span></div><div class="client-stat"><small>ACCOUNT BALANCE</small><b>$'+total.toFixed(2)+'</b><span>Approved account balances</span></div><div class="client-stat"><small>OPEN PAPER POSITIONS</small><b>'+open.length+'</b><span>Simulation ledger</span></div><div class="client-stat"><small>FLOATING PAPER P/L</small><b>$'+floating.toFixed(2)+'</b><span>Simulation only</span></div>';
  const accountBox=document.getElementById("portfolio-accounts");
  if(accountBox)accountBox.innerHTML=accounts.error?'<div class="notice error">'+esc(accounts.error.message)+'</div>':(accounts.data||[]).map(a=>'<div class="admin-row"><span><b>'+esc(a.display_name||a.account_type)+' · '+esc(a.account_mode.toUpperCase())+' #'+esc(a.account_number)+'</b><small>'+esc(a.currency)+' · '+esc(a.status)+'</small></span><b>'+esc(a.currency)+' '+Number(a.balance||0).toFixed(2)+'</b></div>').join("")||'<div class="empty-state">No portal accounts yet.</div>';
  const positionBox=document.getElementById("portfolio-positions");
  if(positionBox)positionBox.innerHTML=positions.error?'<div class="notice error">'+esc(positions.error.message)+'</div>':open.map(p=>'<div class="admin-row"><span><b>'+esc(p.symbol)+' · '+esc(p.side)+'</b><small>'+Number(p.quantity).toLocaleString()+' · Entry '+Number(p.entry_price).toFixed(5)+' · Mark '+Number(p.mark_price||p.entry_price).toFixed(5)+' · '+esc(p.execution_mode||"PAPER")+'</small></span><b>$'+Number(p.unrealized_pnl||0).toFixed(2)+'</b></div>').join("")||'<div class="empty-state">No open paper positions.</div>';
 }
 if(activePage==="orders"){
  const [products,trades,paper]=await Promise.all([
   sb.from("product_orders").select("id,product_code,amount_usd,payment_method,payment_reference,status,created_at").eq("user_id",user.id).order("created_at",{ascending:false}).limit(50),
   sb.from("bb_trade_orders").select("id,symbol,side,order_type,quantity,requested_price,status,reject_reason,created_at").eq("user_id",user.id).order("created_at",{ascending:false}).limit(100),
   sb.from("bb_paper_execution_trades").select("id,symbol,side,quantity,entry_price,exit_price,status,realized_pnl,close_reason,opened_at,closed_at,execution_mode").eq("user_id",user.id).order("opened_at",{ascending:false}).limit(100)
  ]);
  const box=document.getElementById("client-product-orders");
  if(box)box.innerHTML=products.error?'<div class="notice error">'+esc(products.error.message)+'</div>':(products.data||[]).map(o=>'<div class="admin-row"><span><b>'+esc(String(o.product_code||"Product").replace(/_/g," "))+'</b><small>'+esc(o.payment_method||"Manual payment")+' · '+esc(o.payment_reference||"No TXID")+' · '+new Date(o.created_at).toLocaleString()+'</small></span><b>$'+Number(o.amount_usd||0).toFixed(2)+'</b><em class="status-'+esc(o.status)+'">'+esc(String(o.status||"pending").toUpperCase())+'</em></div>').join("")||'<div class="empty-state">No product orders yet.</div>';
  const tradeBox=document.getElementById("client-trading-orders");
  if(tradeBox)tradeBox.innerHTML=trades.error?'<div class="notice error">'+esc(trades.error.message)+'</div>':(trades.data||[]).map(o=>'<div class="admin-row"><span><b>'+esc(o.symbol)+' · '+esc(o.side)+' · '+esc(o.order_type)+'</b><small>'+Number(o.quantity).toLocaleString()+' · '+(o.requested_price==null?"Market":Number(o.requested_price).toFixed(5))+' · '+new Date(o.created_at).toLocaleString()+(o.reject_reason?' · '+esc(o.reject_reason):"")+'</small></span><em class="status-'+esc(o.status)+'">'+esc(String(o.status).toUpperCase())+'</em></div>').join("")||'<div class="empty-state">No trading-engine orders recorded.</div>';
  const paperBox=document.getElementById("client-paper-history");
  if(paperBox)paperBox.innerHTML=paper.error?'<div class="notice error">'+esc(paper.error.message)+'</div>':(paper.data||[]).map(p=>'<div class="admin-row"><span><b>'+esc(p.symbol)+' · '+esc(p.side)+' · '+esc(p.status)+'</b><small>'+Number(p.quantity).toLocaleString()+' · Entry '+Number(p.entry_price).toFixed(5)+(p.exit_price==null?"":" · Exit "+Number(p.exit_price).toFixed(5))+' · '+new Date(p.opened_at).toLocaleString()+(p.close_reason?' · '+esc(p.close_reason):"")+'</small></span><b>$'+Number(p.realized_pnl||0).toFixed(2)+'</b><em>'+esc(p.execution_mode||"PAPER")+'</em></div>').join("")||'<div class="empty-state">No paper trades recorded.</div>';
 }
 if(activePage==="license"){
  const {data,error}=await sb.from("licenses").select("license_key,status,expires_at,created_at").eq("user_id",user.id).maybeSingle();
  const box=document.getElementById("client-license-status");
  if(box)box.innerHTML=error?'<div class="notice error">'+esc(error.message)+'</div>':data?'<span class="lock-label">'+esc(data.status.toUpperCase())+'</span><p>Your BIGBULLS AI Echo System license</p><div class="wallet-address-card"><small>PRIVATE LICENSE KEY</small><code>'+esc(data.license_key)+'</code><button type="button" data-copy-address="'+esc(data.license_key)+'">Copy license key</button></div><p>Expires: '+(data.expires_at?new Date(data.expires_at).toLocaleDateString():"No expiry set")+'</p>':'<span class="lock-label">NOT ACTIVATED</span><p>No active Echo System license is linked to this account yet.</p><button class="portal-primary" data-page="echo-system">View Echo System</button>';
 }
 if(activePage==="downloads"){
  const {data:license,error}=await sb.from("licenses").select("status,download_path").eq("user_id",user.id).maybeSingle();
  const box=document.getElementById("client-downloads-status");
  if(box){
   if(error)box.innerHTML='<div class="notice error">'+esc(error.message)+'</div>';
   else if(!license||license.status!=="active")box.innerHTML='<div class="empty-state">An active Echo System license is required before downloads unlock.</div>';
   else if(!license.download_path)box.innerHTML='<div class="notice">Your license is active. The private package has not been uploaded by Admin yet.</div>';
   else{
    const {data:link,error:linkError}=await sb.storage.from("product-downloads").createSignedUrl(license.download_path,300);
    box.innerHTML=linkError?'<div class="notice">Your license is active, but the package file is not published yet.</div>':'<div class="wallet-address-card"><b>BIGBULLS AI Echo System</b><p>Private download link expires in 5 minutes.</p><a class="portal-primary" href="'+esc(link.signedUrl)+'" target="_blank" rel="noopener">Download package</a></div>';
   }
  }
 }
 if(activePage==="profile"){
  const {data}=await sb.from("kyc_submissions").select("status").eq("user_id",user.id).order("created_at",{ascending:false}).limit(1).maybeSingle();
  const badge=document.getElementById("client-kyc-profile-status");if(badge)badge.textContent=data?.status==="approved"?"Verified":data?.status==="pending"?"Under Review":data?.status==="rejected"?"Rejected":"Unverified";
 }
 if(activePage==="verification"){
  const {data,error}=await sb.from("kyc_submissions").select("id,status,admin_note,rejection_reasons,created_at").eq("user_id",user.id).order("created_at",{ascending:false}).limit(5);
  const status=document.getElementById("kyc-current-status"),history=document.getElementById("kyc-history"),form=document.getElementById("kyc-form"),mfa=document.getElementById("mfa-control");
  const latest=data?.[0],state=latest?.status||"unverified";
  if(status)status.textContent=error?"STATUS: UNAVAILABLE":state==="approved"?"STATUS: VERIFIED":state==="pending"?"STATUS: UNDER REVIEW":state==="rejected"?"STATUS: REJECTED":"STATUS: UNVERIFIED";
  if(form){const lock=state==="pending"||state==="approved";Array.from(form.elements).forEach(el=>el.disabled=lock);const btn=form.querySelector("button[type=submit]");if(btn)btn.textContent=state==="pending"?"KYC under review":state==="approved"?"KYC verified":"Submit KYC securely";}
  const reasonLabels={document_blurry:"Blurry / unreadable document",expired_document:"Expired document",name_mismatch:"Name mismatch",photo_mismatch:"Photo mismatch",missing_back:"Missing back side",address_incomplete:"Incomplete residential address",dob_mismatch:"Date of birth mismatch",unsupported_document:"Unsupported document",document_tampering:"Altered / damaged document",other:"Other"};
  if(history)history.innerHTML=error?'<p>'+esc(error.message)+'</p>':(data||[]).map(x=>'<div class="admin-row"><span><b>KYC · '+esc(x.status==="approved"?"VERIFIED":x.status.toUpperCase())+'</b><small>'+new Date(x.created_at).toLocaleString()+(x.rejection_reasons?.length?' · '+x.rejection_reasons.map(k=>reasonLabels[k]||k).join("; "):"")+(x.admin_note?' · Admin: '+esc(x.admin_note):"")+'</small></span></div>').join("")||"No KYC submission history.";
  if(mfa){mfa.hidden=state!=="approved";if(state==="approved")await renderMfaControl(mfa);}
 }
 if(activePage==="partner"){
  const {data:application,error}=await sb.from("partner_applications").select("*").eq("user_id",user.id).maybeSingle();
  const status=document.getElementById("partner-current-status"),link=document.getElementById("partner-referral-link"),form=document.getElementById("partner-form");
  if(status)status.textContent=error?"● STATUS UNAVAILABLE":application?"● STATUS: "+application.status.toUpperCase():"● NOT APPLIED";
  if(form&&application){Array.from(form.elements).forEach(el=>{if(el.name&&application[el.name]!==null&&application[el.name]!==undefined)el.value=application[el.name];});form.querySelector("button").disabled=true;form.querySelector("button").textContent="Application already submitted";}
  const referralUrl=application?.referral_code?location.origin+location.pathname+"?ref="+encodeURIComponent(application.referral_code):"";if(link)link.innerHTML=application?.referral_code?'<code>'+esc(referralUrl)+'</code><button type="button" data-copy-address="'+esc(referralUrl)+'">Copy referral link</button>':application?"Referral code will appear after approval.":"Apply to receive a referral code after approval.";
  const [refs,comm]=await Promise.all([
   sb.from("partner_referrals").select("id,referred_user_id,created_at").eq("partner_user_id",user.id).order("created_at",{ascending:false}),
   sb.from("partner_commission_ledger").select("id,source_reference,verified_lots,commission_usd,status,created_at").eq("partner_user_id",user.id).order("created_at",{ascending:false})
  ]);
  const rb=document.getElementById("partner-referrals"),cb=document.getElementById("partner-commissions");
  if(rb)rb.innerHTML=refs.error?esc(refs.error.message):(refs.data||[]).map(x=>'<div class="admin-row"><span>Client '+esc(x.referred_user_id)+'<small>'+new Date(x.created_at).toLocaleDateString()+'</small></span></div>').join("")||"No referred clients recorded.";
  if(cb)cb.innerHTML=comm.error?esc(comm.error.message):(comm.data||[]).map(x=>'<div class="admin-row"><span><b>$'+Number(x.commission_usd||0).toFixed(2)+' · '+esc(x.status)+'</b><small>'+Number(x.verified_lots||0).toFixed(2)+' lots · '+esc(x.source_reference||"")+'</small></span></div>').join("")||"No commission records yet.";
  }
  if(activePage==="accounts"){ await loadClientTradingAccounts(); }
 }
async function loadClientTradingAccounts(){
 const box=document.getElementById("my-trading-accounts");if(!box||!sb||!user)return;
 box.textContent="Loading accounts…";
 const {data,error}=await sb.from("trading_accounts").select("id,account_mode,account_number,account_type,currency,balance,status,display_name,server_name,platform,requested_leverage,archived_at,deleted_at,created_at").eq("user_id",user.id).is("deleted_at",null).order("created_at",{ascending:false});
 if(error){box.textContent="Trading accounts unavailable: "+error.message;return;}
 window.bbClientAccounts=data||[];
 const mode=window.bbAccountMode||"real";
 const title=document.getElementById("bb-account-list-title");if(title)title.textContent=mode==="archived"?"Archived Accounts":"My "+(mode==="real"?"Real":"Demo")+" Accounts";
 const rows=window.bbClientAccounts.filter(x=>mode==="archived"?!!x.archived_at:!x.archived_at&&x.account_mode===mode);
 if(!rows.length){box.innerHTML='<div class="empty-state">No '+(mode==="archived"?"archived":mode)+" accounts found.</div>";return;}
 box.innerHTML=rows.map(x=>'<div class="bb-account-card"><div class="bb-account-card-top"><div><small>'+esc(x.server_name||"BIGBULLS")+' · '+esc(String(x.account_mode||"real").toUpperCase())+'</small><h4>'+esc(x.display_name||x.account_type||"Trading account")+'</h4></div><span class="bb-account-number">#'+esc(x.account_number||"—")+'</span></div><div class="bb-account-meta"><span>TYPE <b>'+esc(x.account_type)+'</b></span><span>PLATFORM <b>'+esc(x.platform||"—")+'</b></span><span>LEVERAGE REQUEST <b>'+esc(x.requested_leverage||"1:100")+'</b></span><span>CURRENCY <b>'+esc(x.currency)+'</b></span><span>BALANCE <b>'+esc(x.currency)+" "+Number(x.balance||0).toFixed(2)+'</b></span><span>STATUS <b>'+esc(x.archived_at?"ARCHIVED":x.status||"ACTIVE")+'</b></span></div>'+(x.archived_at?'':x.status==="approved"&&x.account_mode==="real"?'<div class="bb-account-actions account-financial-actions"><button type="button" data-account-tool="trades" data-account-id="'+esc(x.id)+'">Trading History</button><button type="button" data-account-tool="transactions" data-account-id="'+esc(x.id)+'">Transaction History</button><button type="button" data-account-tool="transfer" data-account-id="'+esc(x.id)+'">Transfer Funds</button><button type="button" data-account-tool="deposit" data-account-id="'+esc(x.id)+'">Deposit</button><button type="button" data-account-tool="withdraw" data-account-id="'+esc(x.id)+'">Withdraw</button></div>':x.status==="approved"?'<div class="notice">Demo account funding is managed separately with demo funds. Crypto deposits and cash withdrawals are available only on approved Real accounts.</div>':'<div class="notice">Awaiting Admin approval. Portal ID only; funding access is not available yet.</div>')+'<div class="bb-account-actions">'+(x.archived_at?'<button type="button" data-account-action="restore" data-account-id="'+esc(x.id)+'">Restore</button>':'<button type="button" data-account-action="rename" data-account-id="'+esc(x.id)+'">Rename</button><button type="button" data-account-action="archive" data-account-id="'+esc(x.id)+'">Archive</button>')+'<button class="danger" type="button" data-account-action="delete" data-account-id="'+esc(x.id)+'">Delete</button></div></div>').join("");
 const tools=document.getElementById("bb-account-tools");if(tools){tools.hidden=true;tools.innerHTML="";}
}
async function showAccountTool(id,action){
 const account=(window.bbClientAccounts||[]).find(x=>x.id===id);const box=document.getElementById("bb-account-tools");if(!account||!box)return;
 box.hidden=false;box.dataset.accountId=id;box.dataset.accountTool=action;
 const heading=esc(account.display_name||account.account_type)+" · #"+esc(account.account_number);
 if(action==="trades"){box.innerHTML='<span class="accounts-kicker">TRADING HISTORY</span><h3>'+heading+'</h3><div class="empty-state">No live trading history is available yet. This website account is not connected to MT5 or a broker execution feed.</div>';box.scrollIntoView({behavior:"smooth",block:"start"});return;}
 if(action==="transactions"){
  box.innerHTML='<span class="accounts-kicker">TRANSACTION HISTORY</span><h3>'+heading+'</h3><p>Deposits, withdrawals and transfers for this account.</p><div id="bb-account-transactions">Loading…</div>';
  const [wallets,from,to,ledger]=await Promise.all([
   sb.from("wallet_transactions").select("id,kind,asset,network,amount_usd,status,tx_hash,invoice_id,rejection_reason,admin_note,destination_address,payout_reference,created_at,completed_at").eq("account_id",id).order("created_at",{ascending:false}),
   sb.from("account_transfers").select("id,from_account,to_account,amount_usd,status,created_at").eq("from_account",id).order("created_at",{ascending:false}),
   sb.from("account_transfers").select("id,from_account,to_account,amount_usd,status,created_at").eq("to_account",id).order("created_at",{ascending:false}),
   sb.from("account_balance_ledger").select("id,entry_type,amount,balance_before,balance_after,note,created_at").eq("account_id",id).in("entry_type",["admin_credit","admin_debit"]).order("created_at",{ascending:false})
  ]);
  const list=document.getElementById("bb-account-transactions");if(!list)return;
  if(wallets.error||from.error||to.error||ledger.error){list.textContent="History unavailable: "+(wallets.error||from.error||to.error||ledger.error).message;return;}
  const items=[...(wallets.data||[]).map(x=>({date:x.created_at,label:x.kind.toUpperCase()+" · "+x.asset+"/"+x.network,amount:"$"+Number(x.amount_usd).toFixed(2),status:x.status,ref:x.invoice_id||x.tx_hash||x.destination_address||"",note:x.rejection_reason||x.admin_note||x.payout_reference||""})),...(from.data||[]).map(x=>({date:x.created_at,label:"TRANSFER OUT",amount:"$"+Number(x.amount_usd).toFixed(2),status:x.status,ref:"To "+x.to_account})),...(to.data||[]).map(x=>({date:x.created_at,label:"TRANSFER IN",amount:"$"+Number(x.amount_usd).toFixed(2),status:x.status,ref:"From "+x.from_account})),...(ledger.data||[]).map(x=>({date:x.created_at,label:x.entry_type==="admin_credit"?"ADMIN BALANCE CREDIT":"ADMIN BALANCE DEBIT",amount:(x.entry_type==="admin_debit"?"-":"+")+"$"+Number(x.amount).toFixed(2),status:"posted",ref:"Balance "+Number(x.balance_before).toFixed(2)+" → "+Number(x.balance_after).toFixed(2),note:x.note||""}))].sort((a,b)=>new Date(b.date)-new Date(a.date));
  list.innerHTML=items.length?items.map(x=>'<div class="admin-row"><span><b>'+esc(x.label)+'</b><small>'+new Date(x.date).toLocaleString()+(x.ref?' · '+esc(x.ref):'')+(x.note?' · '+esc(x.note):'')+'</small></span><b>'+esc(x.amount)+'</b><em>'+esc(x.status)+'</em></div>').join(""):'<div class="empty-state">No transactions recorded for this account.</div>';
  box.scrollIntoView({behavior:"smooth",block:"start"});return;
 }
 if(action==="transfer"){
  const choices=(window.bbClientAccounts||[]).filter(x=>x.id!==id&&!x.archived_at&&!x.deleted_at&&x.status==="approved"&&x.account_mode===account.account_mode&&x.currency===account.currency);
  box.innerHTML='<span class="accounts-kicker">INTERNAL TRANSFER REQUEST</span><h3>'+heading+'</h3><form class="client-form" id="account-transfer-form"><input type="hidden" name="from_account" value="'+esc(id)+'"><label>Destination account<select name="to_account" required>'+choices.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.display_name||x.account_type)+' · #'+esc(x.account_number)+' · '+esc(x.currency)+'</option>').join("")+'</select></label><label>Amount ('+esc(account.currency)+')<input name="amount" type="number" min="0.01" step="0.01" required></label><button class="portal-primary" type="submit" '+(!choices.length?'disabled':'')+'>Submit transfer request</button><div data-page-message></div></form><div class="notice">Only active accounts in the same Real/Demo environment and currency are eligible. Admin approval is required; this request does not instantly move a balance.</div>';
  if(!choices.length)box.querySelector("[data-page-message]").textContent="No eligible destination account. Create another approved "+account.account_mode+" account in "+account.currency+" first.";
  box.scrollIntoView({behavior:"smooth",block:"start"});return;
 }
 const {data:methods,error}=await sb.from("crypto_wallets").select("id,asset,network,label,address").eq("active",true).order("asset");
 if(error){box.innerHTML='<h3>'+heading+'</h3><p>Payment methods unavailable: '+esc(error.message)+'</p>';return;}
 const list=methods||[];
 if(action==="deposit"||action==="withdraw"){openAccountFinancialModal(id,action,list);return;}
 box.scrollIntoView({behavior:"smooth",block:"start"});
}

async function openAccountFinancialModal(accountId,action,providedMethods){
 const account=(window.bbClientAccounts||[]).find(x=>x.id===accountId);if(!account)return;
 const methods=providedMethods||[];window.bbFinancialContext={accountId,action,methods};
 if(action==="deposit"){
  body.innerHTML='<p class="eyebrow">ACCOUNT DEPOSIT · #'+esc(account.account_number)+'</p><h2>Deposit funds</h2>'+(methods.length?'<form id="account-deposit-form" class="client-form" method="post" enctype="multipart/form-data" autocomplete="off" novalidate><label>Payment method / network<select name="wallet_id">'+methods.map(w=>'<option value="'+esc(w.id)+'">'+esc(w.asset)+' · '+esc(w.network)+'</option>').join("")+'</select></label><div id="bb-deposit-address"></div><label>Deposit amount (USD)<input name="amount_usd" type="number" min="1" step=".01" required></label><label>Amount sent in crypto<input name="amount_crypto" type="number" min="0.00000001" step="any" required></label><label>Blockchain TXID<input name="tx_hash" minlength="11" required></label><label>Payment screenshot / proof (required)<input name="proof" type="file" accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf" required><small data-deposit-file-name>No file selected</small></label><p class="fine">Proof file: minimum 100 KB · maximum 10 MB · JPG, PNG, WEBP or PDF.</p><button class="portal-primary" type="submit">Submit deposit request</button><div data-page-message role="status" aria-live="polite"></div></form>':'<div class="empty-state">No deposit methods are enabled by Admin yet.</div>')+'<p class="fine">Funds are credited only after Admin verifies your payment.</p>';
  const form=document.getElementById("account-deposit-form");if(form){const select=form.elements.wallet_id;const render=()=>{const w=methods.find(x=>x.id===select.value),slot=document.getElementById("bb-deposit-address");if(slot){slot.innerHTML=w?'<div class="wallet-address-card"><small>ADMIN DEPOSIT ADDRESS · '+esc(w.asset)+' / '+esc(w.network)+'</small><div class="deposit-qr" id="bb-account-deposit-qr" aria-label="QR code for the selected deposit address"></div><code>'+esc(w.address)+'</code><button type="button" data-copy-address="'+esc(w.address)+'">Copy address</button><p>'+esc(w.label||"Official deposit wallet")+'</p></div>':'';if(w)renderDepositQr(document.getElementById("bb-account-deposit-qr"),w.address);}};select.addEventListener("change",render);render();}
  showModal();return;
 }
 body.innerHTML='<p class="eyebrow">SECURE WITHDRAWAL · #'+esc(account.account_number)+'</p><h2>Select withdrawal network</h2>'+(methods.length?'<div class="client-form"><label>Available method<select id="bb-withdraw-method">'+methods.map(w=>'<option value="'+esc(w.id)+'">'+esc(w.asset)+' · '+esc(w.network)+'</option>').join("")+'</select></label><button class="portal-primary" type="button" id="bb-withdraw-next">Continue</button></div>':'<div class="empty-state">No withdrawal methods are enabled by Admin.</div>')+'<p class="fine">You will enter your receiving address and amount in the next step.</p>';
 const next=document.getElementById("bb-withdraw-next");if(next)next.addEventListener("click",()=>{const chosen=methods.find(w=>w.id===document.getElementById("bb-withdraw-method")?.value);if(!chosen)return;renderWithdrawalDetails(account,chosen);});
 showModal();
}
function renderWithdrawalDetails(account,method){
 body.innerHTML='<p class="eyebrow">WITHDRAWAL DETAILS · #'+esc(account.account_number)+'</p><h2>'+esc(method.asset)+' · '+esc(method.network)+'</h2><form id="account-withdrawal-form" class="client-form"><input type="hidden" name="asset" value="'+esc(method.asset)+'"><input type="hidden" name="network" value="'+esc(method.network)+'"><label>Amount (USD)<input name="amount_usd" type="number" min="1" step=".01" max="'+Number(account.balance||0).toFixed(2)+'" required></label><label>Amount in crypto<input name="amount_crypto" type="number" min="0.00000001" step="any" required></label><label>Your receiving wallet address / Binance ID<input name="destination_address" minlength="6" maxlength="180" placeholder="Paste your own address or Binance Pay ID" required></label><button class="portal-primary" type="submit">Submit withdrawal request</button><div data-page-message></div></form><div class="notice">Available account balance: '+esc(account.currency)+' '+Number(account.balance||0).toFixed(2)+'. Payout is sent manually by Admin after review.</div><button type="button" class="copy-wallet" data-financial-back>Back to methods</button>';
}
async function manageClientAccount(id,action){
 let displayName=null;
 if(action==="rename"){displayName=prompt("Enter a new display name (1–40 characters):");if(displayName===null)return;displayName=displayName.trim();if(!displayName||displayName.length>40){alert("Name must contain 1–40 characters.");return;}}
 if(action==="delete"&&!confirm("Delete this account record from your active account view?"))return;
 if(action==="archive"&&!confirm("Archive this account?"))return;
 const {error}=await sb.rpc("manage_client_trading_account",{p_account_id:id,p_action:action,p_display_name:displayName});
 if(error){alert("Account action failed: "+error.message);return;}
 await loadClientTradingAccounts();
}
async function loadWalletHistory(){
 const box=document.getElementById('wallet-history-list');
 if(!box||!sb||!user)return;
 box.textContent='Loading wallet history…';
 const {data,error}=await sb.from('wallet_transactions').select('id,kind,asset,network,amount_usd,status,tx_hash,created_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(50);
 if(error){box.textContent='Wallet history unavailable: '+error.message;return;}
 box.innerHTML='';
 if(!data||!data.length){box.textContent='No wallet activity yet.';return;}
 data.forEach(x=>{
  const row=document.createElement('div');row.className='admin-row';
  const info=document.createElement('span');
  const heading=document.createElement('b');heading.textContent=x.kind+' · '+x.asset+' / '+x.network;
  const detail=document.createElement('small');detail.textContent=new Date(x.created_at).toLocaleString()+(x.tx_hash?' · '+x.tx_hash:'');
  info.append(heading,detail);
  const amount=document.createElement('b');amount.textContent='$'+Number(x.amount_usd||0).toFixed(2);
  const status=document.createElement('em');status.className='status-'+x.status;status.textContent=x.status;
  row.append(info,amount,status);box.append(row);
 });
}
function loadQrLibrary(url){return new Promise((resolve,reject)=>{const script=document.createElement("script");script.src=url;script.async=true;script.onload=()=>window.QRCode?resolve():reject(new Error("QR library unavailable"));script.onerror=()=>reject(new Error("QR library failed"));document.head.appendChild(script);});}
async function renderDepositQr(node,address){if(!node)return;node.innerHTML="";node.setAttribute("aria-label","QR code for the selected deposit address");try{if(!window.QRCode){try{await loadQrLibrary("https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js");}catch(_){await loadQrLibrary("https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js");}}if(!node.isConnected)return;new window.QRCode(node,{text:address,width:192,height:192,colorDark:"#101827",colorLight:"#ffffff",correctLevel:window.QRCode.CorrectLevel.M});}catch(error){node.textContent="QR could not load. Use the Copy address button.";node.classList.add("qr-unavailable");console.error("Deposit QR generation failed:",error);}}
function showSelectedWallet(wallets){const id=document.getElementById("deposit-asset")?.value,w=wallets.find(x=>String(x.id)===String(id)),box=document.getElementById("selected-wallet");if(!box||!w)return;box.innerHTML='<div class="wallet-address-card"><small>ADMIN CONTROLLED · '+esc(w.asset)+' / '+esc(w.network)+'</small><div class="deposit-qr" id="deposit-wallet-qr" aria-label="Deposit wallet QR code"></div><code>'+esc(w.address)+'</code><button type="button" data-copy-address="'+esc(w.address)+'">Copy address</button><p>'+esc(w.label||"Official deposit wallet")+'</p></div><form class="client-form" id="wallet-form"><label>Amount (USD equivalent)<input name="amount_usd" type="number" min="1" step=".01" required></label><label>Amount in crypto<input name="amount_crypto" required></label><label>Blockchain TXID<input name="tx_hash" required></label><button class="portal-primary">Submit for verification</button></form><div data-page-message></div><div class="notice">Only send the selected asset on the exact network. Admin must verify the blockchain transaction before approval.</div>';renderDepositQr(document.getElementById("deposit-wallet-qr"),w.address);}
async function submitHandler(e){
 const f=e.target;if(!(f instanceof HTMLFormElement))return;
 if(f.id==="mfa-verify-form"){
  e.preventDefault();const d=new FormData(f),code=String(d.get("code")||"").trim(),button=f.querySelector("button[type=submit]"),out=f.querySelector("[data-page-message]");
  if(!/^\d{6,8}$/.test(code)){if(out)out.textContent="Enter the current authenticator code.";return;}
  button.disabled=true;
  try{
   const {error}=await sb.auth.mfa.verify({factorId:f.dataset.factorId,challengeId:f.dataset.challengeId,code});
   if(error)throw error;
   const {data:aal}=await sb.auth.mfa.getAuthenticatorAssuranceLevel();
   if(aal?.currentLevel!=="aal2")throw new Error("2FA verification did not reach the required security level.");
   alert("Authenticator 2FA verified. Your client platform is now unlocked.");showApp("dashboard");
  }catch(err){if(out)out.textContent=err.message||"Authenticator verification failed.";button.disabled=false;}
  return;
 }
 if(f.id==="signup-form"||f.id==="login-form"){
  e.preventDefault();
  const d=new FormData(f),b=f.querySelector('button[type="submit"]');
  if(!sb){message("Account service is unavailable. Refresh the page and try again.",true);return;}
  b.disabled=true;b.textContent="Please wait…";
  try{
   if(f.id==="signup-form"){
    const {data,error}=await sb.auth.signUp({
     email:String(d.get("email")).trim(),
     password:String(d.get("password")),
     options:{emailRedirectTo:location.origin+location.pathname,data:{
      full_name:String(d.get("full_name")).trim(),
      country:String(d.get("country")||""),
      phone:String(d.get("phone")||""),
      account_type:String(d.get("account_type")||"Individual"),
      referral_code:String(d.get("referral_code")||"")
     }}
    });
    if(error)throw error;
    if(data?.session&&data?.user){
     user=data.user;
     await showApp("dashboard");
    }else{
     message("Registration submitted. Check your email and verify your address, then log in.",false);
     b.disabled=false;b.textContent="Create account";
    }
   }else{
    const {data,error}=await sb.auth.signInWithPassword({
     email:String(d.get("email")).trim(),
     password:String(d.get("password"))
    });
    if(error)throw error;
    user=data?.user||data?.session?.user||null;
    if(!user)throw new Error("Login succeeded but no active session was returned. Please try again.");
    await showApp("dashboard");
   }
  }catch(err){
   console.error("Authentication / portal opening error:",err);
   message(err?.message||"Authentication failed. Please try again.",true);
   b.disabled=false;b.textContent=f.id==="signup-form"?"Create account":"Secure login";
  }
  return;
 }
 if(f.id==="echo-purchase-form"){e.preventDefault();if(!user||!sb){alert("Please log in before submitting your payment TXID.");return;}const d=new FormData(f),txid=String(d.get("txid")||"").trim(),button=f.querySelector("button[type=submit]"),out=f.querySelector("[data-page-message]");if(txid.length<11){if(out)out.textContent="Enter a valid blockchain TXID.";return;}button.disabled=true;button.textContent="Submitting order…";const {error}=await sb.from("product_orders").insert({user_id:user.id,product_code:"BIGBULLS_AI_ECHO",amount_usd:199,payment_method:"USDT_TRC20",payment_reference:txid,status:"pending"});button.disabled=false;button.textContent="Submit payment for verification";if(out)out.textContent=error?"Order submission failed: "+error.message:"Payment TXID submitted. Your order is pending admin blockchain verification.";if(!error)button.disabled=true;return;}
 if(f.id==="account-deposit-form"){
  e.preventDefault();e.stopPropagation();if(typeof e.stopImmediatePropagation==="function")e.stopImmediatePropagation();
  const d=new FormData(f),out=f.querySelector("[data-page-message]"),button=f.querySelector('button[type="submit"]'),proof=d.get("proof"),ctx=window.bbFinancialContext,accountId=ctx?.accountId;
  const amountUsd=Number(d.get("amount_usd")),amountCrypto=Number(d.get("amount_crypto")),txHash=String(d.get("tx_hash")||"").trim();
  if(!accountId||!ctx||!user){if(out)out.textContent="Your secure account session expired. Refresh and sign in again.";return;}
  const account=(window.bbClientAccounts||[]).find(x=>x.id===accountId);
  if(!account||account.account_mode!=="real"||account.status!=="approved"||account.archived_at||account.deleted_at){if(out)out.textContent="Funding is available only for active, approved Real accounts.";return;}
  if(!(amountUsd>0)||!(amountCrypto>0)||txHash.length<11){if(out)out.textContent="Enter a valid USD amount, crypto amount and blockchain TXID (at least 11 characters).";return;}
  if(!(proof instanceof File)||!proof.size){if(out)out.textContent="Payment proof is required. Please attach your transfer screenshot or PDF.";return;}
  const uploadedPath=f.elements.proof.dataset.uploadedPath;
  if(!uploadedPath){if(out)out.textContent="Payment proof is not uploaded yet. Wait for the secure upload to finish or select it again.";return;}
  if(button.disabled){if(out)out.textContent="Please wait for the proof upload to finish.";return;}
  button.disabled=true;button.textContent="Submitting deposit request…";
  try{
   const walletId=String(d.get("wallet_id")),w=ctx.methods.find(x=>x.id===walletId);
   if(!w)throw new Error("Select a valid active Admin payment method.");
   const {data:tx,error}=await sb.from("wallet_transactions").insert({user_id:user.id,account_id:accountId,kind:"deposit",asset:w.asset,network:w.network,destination_address:w.address,amount_usd:amountUsd,amount_crypto:amountCrypto,tx_hash:txHash,proof_path:uploadedPath,status:"pending"}).select("id,invoice_id").single();
   if(error)throw error;
   body.innerHTML='<p class="eyebrow">DEPOSIT SUBMITTED</p><h2>Request received</h2><div class="notice">Invoice '+esc(tx.invoice_id)+' is pending Admin verification. Your Real account balance will update only after payment verification and approval.</div><button class="portal-primary" type="button" data-close>Close</button>';
   await loadClientTradingAccounts();
  }catch(err){
   if(out){out.classList.add("error");out.textContent="Deposit request failed: "+(err?.message||"Please check the details and try again.");}
   button.disabled=false;button.textContent="Submit deposit request";
  }
  return;
 }
 if(f.id==="account-withdrawal-form"){
  e.preventDefault();
  const d=new FormData(f),out=f.querySelector("[data-page-message]"),button=f.querySelector('button[type="submit"]'),ctx=window.bbFinancialContext,account=(window.bbClientAccounts||[]).find(x=>x.id===ctx?.accountId);
  if(!ctx||!account||account.account_mode!=="real"||account.status!=="approved"||account.archived_at||account.deleted_at){if(out)out.textContent="Withdrawals are available only from an active, approved Real account.";return;}
  const method=ctx.methods.find(w=>w.asset===String(d.get("asset"))&&w.network===String(d.get("network")));
  if(!method){if(out)out.textContent="Withdrawal network is no longer active. Reopen the withdrawal form.";return;}
  const amount=Number(d.get("amount_usd")),amountCrypto=Number(d.get("amount_crypto")),destination=String(d.get("destination_address")||"").trim();
  if(!(amount>0)||!(amountCrypto>0)||destination.length<6){if(out)out.textContent="Enter a valid amount, crypto quantity and receiving address.";return;}
  button.disabled=true;button.textContent="Checking available balance…";
  const {data:reservedRows,error:reserveError}=await sb.from("wallet_transactions").select("amount_usd").eq("account_id",ctx.accountId).eq("kind","withdrawal").eq("status","processing");
  if(reserveError){if(out)out.textContent="Could not verify available balance: "+reserveError.message;button.disabled=false;button.textContent="Submit withdrawal request";return;}
  const reserved=(reservedRows||[]).reduce((sum,x)=>sum+Number(x.amount_usd||0),0),available=Math.max(0,Number(account.balance||0)-reserved);
  if(amount>available){if(out)out.textContent="Amount exceeds available balance after already-approved withdrawals. Available: "+account.currency+" "+available.toFixed(2);button.disabled=false;button.textContent="Submit withdrawal request";return;}
  button.textContent="Submitting withdrawal request…";
  const {data:tx,error}=await sb.from("wallet_transactions").insert({user_id:user.id,account_id:ctx.accountId,kind:"withdrawal",asset:method.asset,network:method.network,destination_address:destination,amount_usd:amount,amount_crypto:amountCrypto,status:"pending"}).select("id,invoice_id").single();
  if(error){if(out)out.textContent="Withdrawal request failed: "+error.message;button.disabled=false;button.textContent="Submit withdrawal request";return;}
  button.textContent="Sending email verification…";
  const otp=await sb.functions.invoke("withdrawal-otp",{body:{action:"request",transaction_id:tx.id}});
  if(otp.error||otp.data?.error){
   body.innerHTML='<p class="eyebrow">WITHDRAWAL SAVED</p><h2>Verification email unavailable</h2><div class="notice">Request '+esc(tx.invoice_id||"saved")+' is recorded as pending. Email OTP could not be sent: '+esc(otp.data?.error||otp.error?.message||"Email service unavailable")+'. Please contact Support before submitting another request.</div><button class="portal-primary" type="button" data-close>Close</button>';
   await loadClientTradingAccounts();return;
  }
  body.innerHTML='<p class="eyebrow">EMAIL VERIFICATION</p><h2>Verify withdrawal</h2><p>A six-digit code was sent to your registered email. It expires in 10 minutes.</p><form id="bb-account-withdrawal-otp" class="client-form"><label>Verification code<input name="otp" inputmode="numeric" autocomplete="one-time-code" minlength="6" maxlength="6" pattern="[0-9]{6}" required></label><button class="portal-primary" type="submit">Verify & send for Admin review</button><div data-page-message role="status" aria-live="polite"></div></form>';
  const otpForm=document.getElementById("bb-account-withdrawal-otp");
  otpForm?.addEventListener("submit",async ev=>{
   ev.preventDefault();const form=ev.currentTarget,verifyButton=form.querySelector('button[type="submit"]'),messageBox=form.querySelector("[data-page-message]"),code=String(new FormData(form).get("otp")||"").trim();
   verifyButton.disabled=true;verifyButton.textContent="Verifying…";
   const result=await sb.functions.invoke("withdrawal-otp",{body:{action:"verify",transaction_id:tx.id,otp:code}});
   if(result.error||result.data?.error){if(messageBox)messageBox.textContent=result.data?.error||result.error?.message||"OTP verification failed.";verifyButton.disabled=false;verifyButton.textContent="Verify & send for Admin review";return;}
   form.innerHTML='<div class="notice">Email verified. Withdrawal '+esc(tx.invoice_id||"request")+' is now pending Admin approval. Your account is debited only after Admin confirms the payout.</div><button type="button" class="portal-primary" data-close>Close</button>';
   await loadClientTradingAccounts();
  });
  return;
 }
 if(f.id==="wallet-form"){e.preventDefault();const d=new FormData(f),kind=String(d.get("kind")||"deposit"),accountId=String(d.get("account_id")||"")||null;if(!accountId){const msg=f.querySelector("[data-page-message]")||f.parentElement.querySelector("[data-page-message]");if(msg)msg.textContent="Please submit deposits and withdrawals from a specific Trading Account.";return;}let payload;if(kind==="withdrawal"){const pair=String(d.get("asset_network")).split("|");payload={user_id:user.id,account_id:accountId,kind:"withdrawal",asset:pair[0],network:pair[1],destination_address:String(d.get("destination_address")).trim(),amount_usd:Number(d.get("amount_usd")),amount_crypto:String(d.get("amount_crypto")).trim(),status:"pending"};}else{const walletId=String(d.get("wallet_id")||document.getElementById("deposit-asset")?.value||"");if(!walletId)return;const {data:w,error:walletError}=await sb.from("crypto_wallets").select("asset,network,address").eq("id",walletId).single();if(walletError||!w)return;payload={user_id:user.id,account_id:accountId,kind:"deposit",asset:w.asset,network:w.network,destination_address:w.address,amount_usd:Number(d.get("amount_usd")),amount_crypto:String(d.get("amount_crypto")).trim(),tx_hash:String(d.get("tx_hash")).trim(),status:"pending"};}const {error}=await sb.from("wallet_transactions").insert(payload);const msg=f.querySelector("[data-page-message]")||f.parentElement.querySelector("[data-page-message]");if(msg)msg.textContent=error?"Request failed: "+error.message:"Request submitted and is pending admin review.";if(!error){f.reset();if(accountId)showAccountTool(accountId,kind==="deposit"?"deposit":"withdraw");else loadPageData();}return;}
 if(f.id==="kyc-form"){
   e.preventDefault();e.stopPropagation();if(typeof e.stopImmediatePropagation==="function")e.stopImmediatePropagation();
   const d=new FormData(f),out=f.querySelector("[data-page-message]"),button=f.querySelector('button[type="submit"]'),front=d.get("document_front"),back=d.get("document_back"),allowed=["image/jpeg","image/png","image/webp","application/pdf"],minBytes=100*1024,maxBytes=20*1024*1024;
   const mimeForFile=file=>{const ext=String(file?.name||"").split(".").pop().toLowerCase();const byExt={jpg:"image/jpeg",jpeg:"image/jpeg",png:"image/png",webp:"image/webp",pdf:"application/pdf"};const typed=String(file?.type||"").toLowerCase();if(allowed.includes(typed))return typed;if(typed==="image/jpg"||typed==="image/pjpeg")return "image/jpeg";return byExt[ext]||"";};
   const showKycError=message=>{if(out){out.textContent=message;out.classList.add("error");}};
   if(!button){showKycError("KYC submit control is unavailable. Please refresh once and retry.");return;}
   if(!user?.id||!sb){showKycError("Your secure session has expired. Please sign in again and retry.");return;}
   if(!(front instanceof File)||!front.size){showKycError("Please select the front of your identity document.");return;}
   const documentType=String(d.get("document_type")||"");
   if(!["CNIC","Passport","Driving License"].includes(documentType)){showKycError("Select a valid identity document type.");return;}
   if(["CNIC","Driving License"].includes(documentType)&&(!(back instanceof File)||!back.size)){showKycError("Upload both front and back sides for CNIC / Driving License.");return;}
   for(const [label,doc] of [["Front",front],["Back",back]]){
    if(!(doc instanceof File)||!doc.size)continue;
    if(doc.size<minBytes){showKycError(label+" document must be at least 100 KB.");return;}
    if(doc.size>maxBytes){showKycError(label+" document exceeds the 20 MB limit.");return;}
    if(!mimeForFile(doc)){showKycError(label+" document must be JPG, PNG, WEBP or PDF.");return;}
   }
   if(!String(d.get("first_name")||"").trim()||!String(d.get("last_name")||"").trim()||!String(d.get("document_number")||"").trim()||!String(d.get("dob")||"")||!String(d.get("country")||"").trim()||!String(d.get("address")||"").trim()){showKycError("Complete your first name, last name, ID number, date of birth and address.");return;}
   const frontPath=f.elements.document_front.dataset.uploadedPath,backPath=f.elements.document_back.dataset.uploadedPath||null;
   if(!frontPath){showKycError("Front document is not uploaded yet. Wait for the secure upload to finish.");return;}
   if(["CNIC","Driving License"].includes(documentType)&&!backPath){showKycError("Back document is not uploaded yet. Wait for the secure upload to finish.");return;}
   if([...f.querySelectorAll('input[type="file"]')].some(el=>el.files?.[0]&&!el.dataset.uploadedPath)){showKycError("A document is still uploading or failed. Please wait or select it again.");return;}
   button.disabled=true;button.textContent="Submitting KYC…";if(out){out.textContent="Documents are safely stored. Saving your KYC request…";out.classList.remove("error");}
   try{
    const firstName=String(d.get("first_name")||"").trim(),lastName=String(d.get("last_name")||"").trim(),documentNumber=String(d.get("document_number")||"").trim();
    const payload={user_id:user.id,first_name:firstName,last_name:lastName,document_number:documentNumber,legal_name:(firstName+" "+lastName).trim(),date_of_birth:String(d.get("dob")),country:String(d.get("country")).trim(),residential_address:String(d.get("address")).trim(),document_type:documentType,document_front_path:frontPath,document_back_path:backPath,status:"pending",rejection_reasons:[]};
    const {data:submission,error}=await sb.from("kyc_submissions").insert(payload).select("id,status,created_at").single();
    if(error)throw new Error("Documents are uploaded, but KYC request could not be saved: "+error.message);
    if(!submission?.id)throw new Error("KYC request could not be confirmed. Please refresh your KYC status before trying again.");
    if(out){out.textContent="KYC submitted successfully. Your request is now visible to Admin for review.";out.classList.remove("error");}
    f.reset();for(const el of f.querySelectorAll('input[type="file"]'))delete el.dataset.uploadedPath;await loadPageData();
   }catch(err){showKycError(err?.message||"KYC submission failed. Please retry.");}
   finally{button.disabled=false;button.textContent="Submit KYC securely";}
   return;
  }
  if(f.id==="support-ticket-form"){
  e.preventDefault();
  if(!sb||!user){const out=f.querySelector("[data-page-message]");if(out)out.textContent="Please sign in again before submitting a ticket.";return;}
  const d=new FormData(f),out=f.querySelector("[data-page-message]"),button=f.querySelector('button[type="submit"]');
  const subject=String(d.get("subject")||"").trim(),category=String(d.get("category")||"other"),bodyText=String(d.get("message")||"").trim();
  if(subject.length<3||bodyText.length<10){if(out)out.textContent="Enter a clear subject and at least 10 characters describing the issue.";return;}
  button.disabled=true;button.textContent="Submitting…";
  try{const {error}=await sb.from("support_tickets").insert({user_id:user.id,subject,category,message:bodyText,status:"open"});if(error)throw error;f.reset();if(out)out.textContent="Ticket submitted successfully. You can follow its status below.";await loadPageData();}
  catch(err){if(out)out.textContent="Ticket submission failed: "+(err.message||"Please retry.");}
  finally{button.disabled=false;button.textContent="Submit support ticket";}
  return;
 }
 if(f.id==="partner-form"){
  e.preventDefault();const d=new FormData(f),out=f.querySelector("[data-page-message]"),payload={user_id:user.id,partner_type:String(d.get("partner_type")),business_name:String(d.get("business_name")||"").trim()||null,website_or_social:String(d.get("website_or_social")||"").trim()||null,audience_size:String(d.get("audience_size")||"").trim()?Number(d.get("audience_size")):null,experience:String(d.get("experience")||"").trim()||null,status:"pending"};
  const {error}=await sb.from("partner_applications").insert(payload);if(out)out.textContent=error?error.message:"Partner application submitted for review.";if(!error)loadPageData();return;
 }
 if(f.id==="admin-commission-form"){
  e.preventDefault();if(!isAdmin())return;const d=new FormData(f),out=f.querySelector("[data-page-message]"),button=f.querySelector("button[type=submit]"),lots=Number(d.get("verified_lots")),commission=Number(d.get("commission_usd")),partnerId=String(d.get("partner_user_id")||"").trim(),source=String(d.get("source_reference")||"").trim();
  if(!partnerId||!source||!Number.isFinite(lots)||lots<0||!Number.isFinite(commission)||commission<=0){if(out)out.textContent="Enter a valid partner ID, broker reference, lots and positive commission.";return;}
  button.disabled=true;const {error}=await sb.from("partner_commission_ledger").insert({partner_user_id:partnerId,referred_user_id:String(d.get("referred_user_id")||"").trim()||null,verified_lots:lots,commission_usd:commission,source_reference:source,admin_note:String(d.get("admin_note")||"").trim()||null,status:"pending",created_by:user.id});
  button.disabled=false;if(out)out.textContent=error?"Commission record failed: "+error.message:"Commission entry saved as pending review.";if(!error){f.reset();loadPageData();}return;
 }
 if(f.id==="account-form"){e.preventDefault();const d=new FormData(f),out=f.querySelector("[data-page-message]"),button=f.querySelector('button[type="submit"]');button.disabled=true;button.textContent="Creating…";const {data,error}=await sb.rpc("create_client_trading_account",{p_account_mode:String(d.get("account_mode")),p_account_type:String(d.get("account_type")),p_currency:String(d.get("currency")),p_display_name:String(d.get("display_name")).trim(),p_platform:String(d.get("platform")),p_leverage:String(d.get("leverage"))});button.disabled=false;button.textContent="Create account";if(out)out.textContent=error?"Account creation failed: "+error.message:"Portal account request submitted · #"+data+". Awaiting Admin approval; this is not an MT4/MT5 login.";if(!error){f.reset();await loadClientTradingAccounts();}return;}
 if(f.id==="account-transfer-form"){e.preventDefault();const d=new FormData(f),out=f.querySelector("[data-page-message]"),button=f.querySelector('button[type="submit"]');button.disabled=true;const {error}=await sb.from("account_transfers").insert({user_id:user.id,from_account:String(d.get("from_account")),to_account:String(d.get("to_account")),amount_usd:Number(d.get("amount")),currency:(window.bbClientAccounts||[]).find(x=>x.id===String(d.get("from_account")))?.currency||"USD",status:"pending"});button.disabled=false;if(out)out.textContent=error?"Transfer request failed: "+error.message:"Transfer request submitted. It is pending admin review.";if(!error)f.reset();return;}
 if(f.id==="transfer-form"){e.preventDefault();const d=new FormData(f),from=String(d.get("from_account")).trim(),to=String(d.get("to_account")).trim(),amount=Number(d.get("amount")),out=f.querySelector("[data-page-message]");if(!from||!to||from===to||!(amount>0)){if(out)out.textContent="Choose two different accounts and enter a valid amount.";return;}const {error}=await sb.from("account_transfers").insert({user_id:user.id,from_account:from,to_account:to,amount_usd:amount,currency:"USD",status:"pending"});if(out)out.textContent=error?error.message:"Transfer request submitted. Funds move only after Admin approval.";if(!error)f.reset();return;}
 if(f.id==="admin-wallet-form"){e.preventDefault();if(!isAdmin())return;const d=new FormData(f),asset=String(d.get("asset")),network=String(d.get("network"));const {error}=await sb.from("crypto_wallets").upsert({asset,network,label:String(d.get("label")||""),address:String(d.get("address")).trim(),active:true},{onConflict:"asset,network"});const out=f.parentElement.querySelector("[data-page-message]");if(out)out.textContent=error?error.message:"Wallet address saved.";if(!error){f.reset();loadPageData();}return;}
 if(f.id==="admin-package-form"){e.preventDefault();if(!isAdmin())return;const d=new FormData(f),file=d.get("package"),out=f.querySelector("[data-page-message]"),button=f.querySelector("button[type=submit]");if(!(file instanceof File)||!file.size||!file.name.toLowerCase().endsWith(".zip")){out.textContent="Select a valid ZIP package.";return;}if(file.size>104857600){out.textContent="Package must be 100 MB or smaller.";return;}button.disabled=true;button.textContent="Uploading privately…";const path="echo-system/latest-package.zip";const {error:uploadError}=await sb.storage.from("product-downloads").upload(path,file,{upsert:true,contentType:"application/zip"});if(uploadError){out.textContent="Upload failed: "+uploadError.message;button.disabled=false;button.textContent="Upload / replace private package";return;}const {error:updateError}=await sb.from("licenses").update({download_path:path}).eq("status","active");if(updateError){out.textContent="Package uploaded, but license link update failed: "+updateError.message;}else{out.textContent="Private Echo System package uploaded. Active licenses can now download it.";f.reset();}button.disabled=false;button.textContent="Upload / replace private package";return;}
 if(f.id==="profile-form"){
  e.preventDefault();const b=f.querySelector("button");b.disabled=true;
  const {data,error}=await sb.auth.updateUser({data:{full_name:String(new FormData(f).get("full_name")).trim()}});
  b.disabled=false;const out=f.parentElement.querySelector("[data-page-message]");if(error){out.textContent=error.message;return;}user=data.user;renderApp();return;
 }
}
async function clickHandler(e){
 const el=e.target instanceof Element?e.target:null;if(!el)return;
 const menuToggle=el.closest("[data-menu-toggle]");
 if(menuToggle){e.preventDefault();const id=menuToggle.dataset.menuToggle,drop=document.querySelector('[data-menu-dropdown="'+id+'"]'),wasOpen=drop&&!drop.hidden;document.querySelectorAll(".top-menu-dropdown,.sidebar-submenu").forEach(x=>x.hidden=true);document.querySelectorAll("[data-menu-toggle]").forEach(x=>x.setAttribute("aria-expanded","false"));if(drop&&!wasOpen){drop.hidden=false;menuToggle.setAttribute("aria-expanded","true");}return;}
 if(!el.closest(".top-menu-group")){document.querySelectorAll(".top-menu-dropdown,.sidebar-submenu").forEach(x=>x.hidden=true);document.querySelectorAll("[data-menu-toggle]").forEach(x=>x.setAttribute("aria-expanded","false"));}
 const enroll=el.closest("[data-mfa-enroll]");
 if(enroll){
  const host=document.getElementById("mfa-control");enroll.disabled=true;
  try{
   const {data,error}=await sb.auth.mfa.enroll({factorType:"totp",friendlyName:"BIGBULLS Client Authenticator"});
   if(error)throw error;
   const challenge=await sb.auth.mfa.challenge({factorId:data.id});if(challenge.error)throw challenge.error;
   host.innerHTML='<h3>Scan authenticator QR code</h3><p>Scan with Google Authenticator, Microsoft Authenticator or another TOTP app. Keep the secret private.</p><img alt="Authenticator QR code" style="width:190px;max-width:100%;background:#fff;padding:10px;border-radius:12px" src="'+esc(data.totp.qr_code)+'"><p>Manual setup key: <code>'+esc(data.totp.secret)+'</code></p><form id="mfa-verify-form" data-factor-id="'+esc(data.id)+'" data-challenge-id="'+esc(challenge.data.id)+'" class="client-form"><label>Authenticator code<input name="code" inputmode="numeric" autocomplete="one-time-code" minlength="6" maxlength="8" required></label><button class="portal-primary" type="submit">Verify and enable 2FA</button><div data-page-message></div></form>';
  }catch(err){host.innerHTML='<div class="notice error">'+esc(err.message||"Unable to start authenticator setup.")+'</div>';}
  return;
 }

 const courseOpen=el.closest("[data-course-open]");
 if(courseOpen){e.preventDefault();showApp("course-"+courseOpen.dataset.courseOpen);return;}
 const courseModule=el.closest("[data-course-module]");
 if(courseModule){const idx=Number(courseModule.dataset.courseModule);const course=BB_COURSES[activePage.replace("course-","")];if(course){document.querySelectorAll("[data-course-module]").forEach(x=>{x.classList.toggle("active",Number(x.dataset.courseModule)===idx);const icon=x.querySelector("i");if(icon)icon.textContent=Number(x.dataset.courseModule)===idx?"●":"○";});const view=document.getElementById("course-lesson-view");if(view)view.innerHTML=courseLessonView(course,idx);}return;}
 const courseNext=el.closest("[data-course-next]");
 if(courseNext){const course=BB_COURSES[activePage.replace("course-","")],idx=Number(courseNext.dataset.courseNext)+1;if(course&&idx<course.modules.length)document.querySelector('[data-course-module="'+idx+'"]')?.click();return;}
 const coursePrev=el.closest("[data-course-prev]");
 if(coursePrev){const course=BB_COURSES[activePage.replace("course-","")],idx=Number(coursePrev.dataset.coursePrev)-1;if(course&&idx>=0)document.querySelector('[data-course-module="'+idx+'"]')?.click();return;}

 const notificationToggle=el.closest("[data-notification-toggle]");if(notificationToggle){const panel=document.getElementById("client-notification-panel");if(panel){panel.hidden=!panel.hidden;notificationToggle.setAttribute("aria-expanded",String(!panel.hidden));loadClientNotifications();}const menu=document.getElementById("client-profile-menu");if(menu)menu.hidden=true;return;}
 const profileToggle=el.closest("[data-profile-toggle]");if(profileToggle){const menu=document.getElementById("client-profile-menu");if(menu){menu.hidden=!menu.hidden;profileToggle.setAttribute("aria-expanded",String(!menu.hidden));}const panel=document.getElementById("client-notification-panel");if(panel)panel.hidden=true;return;}
 const notificationRead=el.closest("[data-notification-read]");if(notificationRead){const {error}=await sb.from("client_notifications").update({read_at:new Date().toISOString()}).eq("id",notificationRead.dataset.notificationRead).eq("user_id",user.id);if(error)alert(error.message);else loadClientNotifications();return;}
 const accountMode=el.closest("[data-account-mode]");
 if(accountMode){window.bbAccountMode=accountMode.dataset.accountMode;document.querySelectorAll("[data-account-mode]").forEach(x=>x.classList.toggle("active",x===accountMode));const tools=document.getElementById("bb-account-tools");if(tools){tools.hidden=true;tools.innerHTML="";}loadClientTradingAccounts();return;}
 const accountTool=el.closest("[data-account-tool]");
 if(accountTool){if(["deposit","withdraw"].includes(accountTool.dataset.accountTool))showAccountTool(accountTool.dataset.accountId,accountTool.dataset.accountTool);else showAccountTool(accountTool.dataset.accountId,accountTool.dataset.accountTool);return;}
 const accountAction=el.closest("[data-account-action]");
 if(accountAction){manageClientAccount(accountAction.dataset.accountId,accountAction.dataset.accountAction);return;}
 const termSymbol=el.closest("[data-term-symbol]");
 if(termSymbol){document.querySelectorAll("[data-term-symbol]").forEach(x=>x.classList.toggle("active",x===termSymbol));const sym=termSymbol.dataset.termSymbol,frame=document.getElementById("bb-tv-chart"),label=document.getElementById("bb-current-symbol"),paperSymbol=document.getElementById("bb-paper-symbol");if(paperSymbol){const mapped=sym.split(":").pop();if(Array.from(paperSymbol.options).some(o=>o.value===mapped))paperSymbol.value=mapped;}if(frame){const url=new URL("https://www.tradingview.com/widgetembed/");url.searchParams.set("symbol",sym);url.searchParams.set("interval",window.bbInterval||"1");url.searchParams.set("hidesidetoolbar","0");url.searchParams.set("symboledit","1");url.searchParams.set("saveimage","1");url.searchParams.set("toolbarbg","f1f3f6");url.searchParams.set("theme","light");url.searchParams.set("style","1");url.searchParams.set("timezone","Etc/UTC");url.searchParams.set("withdateranges","1");url.searchParams.set("hideideas","1");url.searchParams.set("allow_symbol_change","1");url.searchParams.set("details","1");url.searchParams.set("hotlist","1");url.searchParams.set("calendar","0");frame.src=url.toString();}if(label)label.textContent=sym.split(":").pop();return;}
 const termInterval=el.closest("[data-term-interval]");
 if(termInterval){window.bbInterval=termInterval.dataset.termInterval;document.querySelectorAll("[data-term-interval]").forEach(x=>x.classList.toggle("active",x===termInterval));const symButton=document.querySelector("[data-term-symbol].active");if(symButton)symButton.click();return;}
 const termBottom=el.closest("[data-term-bottom]");if(termBottom){document.querySelectorAll("[data-term-bottom]").forEach(x=>x.classList.toggle("active",x===termBottom));const box=document.getElementById("bb-bottom-content");if(box)box.textContent=termBottom.dataset.termBottom==="positions"?"No live positions. BIGBULLS execution engine is not connected yet.":termBottom.dataset.termBottom==="orders"?"No active orders. Order routing is disabled until the BIGBULLS trading engine is deployed.":termBottom.dataset.termBottom==="history"?"Trading history will appear after account execution services are connected.":"Trade journal and analysis notes will be available in a future terminal release.";return;}
 const termTool=el.closest("[data-term-tool]");if(termTool){if(termTool.dataset.termTool==="fullscreen"){const frame=document.querySelector(".bb-tv-frame");if(frame?.requestFullscreen)frame.requestFullscreen();}else if(termTool.dataset.termTool==="indicators")alert("Use the Indicators button in the embedded chart toolbar to add technical indicators.");else if(termTool.dataset.termTool==="compare")alert("Use the Compare symbol control in the embedded chart toolbar.");return;}
 const termMarket=el.closest("[data-term-market]");if(termMarket){document.querySelectorAll("[data-term-market]").forEach(x=>x.classList.toggle("active",x===termMarket));const groups={forex:["FX:EURUSD","FX:GBPUSD","FX:USDJPY"],metals:["OANDA:XAUUSD"],crypto:["BINANCE:BTCUSDT","BINANCE:ETHUSDT"],indices:["NASDAQ:NDX","TVC:DJI"]};document.querySelectorAll("[data-term-symbol]").forEach(x=>x.hidden=!groups[termMarket.dataset.termMarket].includes(x.dataset.termSymbol));return;}
 const page=el.closest("[data-page]");if(page){e.preventDefault();document.querySelectorAll(".top-menu-dropdown,.sidebar-submenu").forEach(x=>x.hidden=true);document.querySelectorAll("[data-menu-toggle]").forEach(x=>x.setAttribute("aria-expanded","false"));showApp(page.getAttribute("data-page"));return;}
 const view=el.closest("[data-auth-view]");if(view){if(view.dataset.authView==="signup")signupForm();else loginForm();return;}
 const lang=el.closest("[data-language]");if(lang){alert("Language selector is a visual prototype. EN / UR / AR translations will be enabled in the localization phase.");return;}
 const trigger=el.closest("[data-open]");if(trigger){e.preventDefault();openModal(trigger.getAttribute("data-open"));return;}
 const appOpen=el.closest("[data-app-open]");if(appOpen){e.preventDefault();showApp("dashboard");return;}const appPage=el.closest("[data-app-page]");if(appPage){e.preventDefault();showApp(appPage.getAttribute("data-app-page"));return;}
 const wt=el.closest("[data-wallet-tab]");if(wt){document.querySelectorAll("[data-wallet-tab]").forEach(x=>x.classList.toggle("active",x===wt));const box=document.getElementById("wallet-content");if(box){if(wt.dataset.walletTab==="history"){box.innerHTML='<h3>Wallet history</h3><div id="wallet-history-list">Loading…</div>';loadWalletHistory();}else if(wt.dataset.walletTab==="transfer"){renderWalletTransfer();}else{box.innerHTML='<span class="free-tag">ACCOUNT FUNDING</span><h3>Choose a trading account</h3><p>Deposits and withdrawals are now linked to a specific Real account. Open Trading Accounts and use its Deposit or Withdraw popup to continue.</p><button class="portal-primary" type="button" data-page="accounts">Open Trading Accounts</button>';}}return;}
 const st=el.closest("[data-settings-tab]");if(st){document.querySelectorAll("[data-settings-tab]").forEach(x=>x.classList.toggle("active",x===st));const box=document.getElementById("settings-content");if(box){if(st.dataset.settingsTab==="security"){box.innerHTML='<h3>Security management</h3><p>Signed in as '+esc(user.email)+'</p><button class="copy-wallet" data-action="forgot">Send password reset email</button><div class="notice">Two-factor authentication is mandatory after KYC approval. Complete your identity verification, then enable your authenticator from KYC Verification.</div>';}else if(st.dataset.settingsTab==="preferences"){box.innerHTML='<h3>Platform preferences</h3><p>Display preferences and notification controls will be available here.</p><div class="empty-state">Preference controls coming soon.</div>';}else{box.innerHTML='<h3>Manage profile</h3><form id="profile-form" class="client-form"><label>Full name<input name="full_name" value="'+esc(user.user_metadata?.full_name||"")+'" required></label><label>Email address<input value="'+esc(user.email||"")+'" disabled></label><button class="portal-primary">Save profile</button></form><div data-page-message></div>';}}return;}
 const financialBack=el.closest("[data-financial-back]");if(financialBack){const ctx=window.bbFinancialContext;const account=(window.bbClientAccounts||[]).find(x=>x.id===ctx?.accountId);if(account)openAccountFinancialModal(account.id,"withdraw",ctx.methods);return;}
 const copy=el.closest("[data-copy-address]");if(copy){if(navigator.clipboard?.writeText)navigator.clipboard.writeText(copy.dataset.copyAddress);else alert(copy.dataset.copyAddress);return;}
 const toggle=el.closest("[data-wallet-toggle]");if(toggle&&isAdmin()){const {error}=await sb.from("crypto_wallets").update({active:toggle.dataset.active!=="true"}).eq("id",toggle.dataset.walletToggle);if(error)alert(error.message);else loadPageData();return;}
 const adjust=el.closest("[data-admin-adjust]");if(adjust&&isAdmin()){const raw=prompt("Balance adjustment amount (positive to credit, negative to debit):");if(raw===null)return;const amount=Number(raw);if(!Number.isFinite(amount)||amount===0){alert("Enter a valid non-zero amount.");return;}const note=prompt("Reason for this balance adjustment (required):");if(!note||note.trim().length<4){alert("A reason of at least 4 characters is required.");return;}const {error}=await sb.rpc("admin_adjust_account_balance",{p_account_id:adjust.dataset.adminAdjust,p_amount:amount,p_note:note.trim()});if(error)alert(error.message);else{alert("Balance updated and audit record saved.");loadPageData();}return;}
 const complete=el.closest("[data-complete-withdrawal]");if(complete&&isAdmin()){const ref=prompt("Enter payout blockchain TXID / reference after sending funds:");if(!ref||ref.trim().length<5)return;const {error}=await sb.rpc("admin_complete_withdrawal",{p_transaction_id:complete.dataset.completeWithdrawal,p_payout_reference:ref.trim()});if(error)alert(error.message);else{alert("Payout recorded and account balance debited.");loadPageData();}return;}
 const review=el.closest("[data-review]");if(review&&isAdmin()){const status=review.dataset.status;let note=null;if(status==="rejected"){note=prompt("Enter rejection reason (required):");if(!note||note.trim().length<4){alert("A clear rejection reason is required.");return;}note=note.trim();}const {error}=await sb.rpc("admin_review_wallet_transaction",{p_transaction_id:review.dataset.review,p_status:status,p_admin_note:note});if(error)alert(error.message);else loadPageData();return;}
 const ar=el.closest("[data-account-review]");if(ar&&isAdmin()){let note=null;if(ar.dataset.status==="rejected"){note=prompt("Enter account request rejection reason (at least 4 characters):");if(!note||note.trim().length<4){alert("A clear rejection reason is required.");return;}note=note.trim();}const {error}=await sb.rpc("admin_review_trading_account",{p_account_id:ar.dataset.accountReview,p_status:ar.dataset.status,p_admin_note:note});if(error)alert(error.message);else{alert(ar.dataset.status==="approved"?"Portal account approved. No broker login has been provisioned.":"Account request rejected.");loadPageData();}return;}
 const tr=el.closest("[data-transfer-review]");if(tr&&isAdmin()){let note=null;if(tr.dataset.status==="rejected"){note=prompt("Enter transfer rejection reason (at least 4 characters):");if(!note||note.trim().length<4){alert("A clear rejection reason is required.");return;}note=note.trim();}const {error}=await sb.rpc("admin_review_account_transfer",{p_transfer_id:tr.dataset.transferReview,p_status:tr.dataset.status,p_admin_note:note});if(error)alert(error.message);else{alert(tr.dataset.status==="approved"?"Transfer approved. Both account balances and ledgers were updated.":"Transfer rejected.");loadPageData();}return;}
 if(el.closest("[data-wallet-queue-refresh]")&&isAdmin()){loadPageData();return;}
 if(el.closest("[data-kyc-refresh]")&&isAdmin()){loadPageData();return;}
  const kycReview=el.closest("[data-kyc-review]");if(kycReview&&isAdmin()){const row=kycReview.closest(".admin-transaction"),reasons=Array.from(row?.querySelector("[data-kyc-reasons]")?.selectedOptions||[]).map(x=>x.value),note=String(row?.querySelector("[data-kyc-admin-note]")?.value||"").trim();if(kycReview.dataset.status==="rejected"&&!reasons.length){alert("Select at least one KYC rejection reason.");return;}const {error}=await sb.rpc("admin_review_kyc_submission",{p_submission_id:kycReview.dataset.kycReview,p_status:kycReview.dataset.status,p_admin_note:note||null,p_rejection_reasons:kycReview.dataset.status==="rejected"?reasons:[]});if(error)alert(error.message);else loadPageData();return;}
 const partnerReview=el.closest("[data-partner-review]");if(partnerReview&&isAdmin()){let note=null;if(partnerReview.dataset.status==="rejected"){note=prompt("Enter partner rejection reason (required):");if(!note||note.trim().length<4){alert("A clear rejection reason is required.");return;}note=note.trim();}const {error}=await sb.rpc("admin_review_partner_application",{p_application_id:partnerReview.dataset.partnerReview,p_status:partnerReview.dataset.status,p_admin_note:note});if(error)alert(error.message);else loadPageData();return;}
 if(el.closest("[data-support-queue-refresh]")&&isAdmin()){loadPageData();return;}
 const supportReview=el.closest("[data-support-review]");
 if(supportReview&&isAdmin()){
  const reply=prompt("Enter the reply that the client will receive (required):");
  if(reply===null)return;
  if(reply.trim().length<2||reply.trim().length>5000){alert("Reply must be between 2 and 5000 characters.");return;}
  const {error}=await sb.rpc("admin_update_support_ticket",{p_ticket_id:supportReview.dataset.supportReview,p_status:supportReview.dataset.status,p_admin_reply:reply.trim()});
  if(error)alert(error.message);else{alert("Support ticket updated and client notified.");loadPageData();}
  return;
 }
 const commissionStatus=el.closest("[data-commission-status]");if(commissionStatus&&isAdmin()){let note=null;if(commissionStatus.dataset.status==="rejected"){note=prompt("Enter commission rejection reason (required):");if(!note||note.trim().length<4){alert("A clear rejection reason is required.");return;}note=note.trim();}const update={status:commissionStatus.dataset.status,reviewed_by:user.id,reviewed_at:new Date().toISOString()};if(note)update.admin_note=note;if(commissionStatus.dataset.status==="paid")update.paid_at=new Date().toISOString();const {error}=await sb.from("partner_commission_ledger").update(update).eq("id",commissionStatus.dataset.commissionStatus);if(error)alert(error.message);else loadPageData();return;}
 const productOrderReview=el.closest("[data-product-order-review]");if(productOrderReview&&isAdmin()){let note=null;if(productOrderReview.dataset.status==="rejected"){note=prompt("Enter product order rejection reason (at least 4 characters):");if(!note||note.trim().length<4){alert("A clear rejection reason is required.");return;}note=note.trim();}const {data,error}=await sb.rpc("admin_review_product_order",{p_order_id:productOrderReview.dataset.productOrderReview,p_status:productOrderReview.dataset.status,p_admin_note:note});if(error)alert(error.message);else{if(productOrderReview.dataset.status==="paid")alert("Payment marked as verified. License issued: "+String(data||""));else alert("Product order rejected.");loadPageData();}return;}
 const action=el.closest("[data-action]");if(action){
  if(action.dataset.action==="package-info"){openModal("buy");return;}
  if(action.dataset.action==="logout"){const {error}=await sb.auth.signOut();if(error)alert(error.message);else{user=null;hideApp();window.scrollTo({top:0,behavior:"smooth"});}return;}
  if(action.dataset.action==="forgot"){const email=prompt("Registered email address:");if(!email)return;const {error}=await sb.auth.resetPasswordForEmail(email.trim(),{redirectTo:location.origin+location.pathname});if(error)alert(error.message);else alert("Password reset email requested. Check your inbox.");return;}
 }
 if(el.closest("[data-close]")||el.classList.contains("portal-close")||el===modal)closeModal();
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();

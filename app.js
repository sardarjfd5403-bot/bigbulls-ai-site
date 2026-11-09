(function(){
"use strict";
const URL="https://ztiiyulusburxjkpcfxu.supabase.co";
const KEY="sb_publishable_5hDwqvbcUHeSJdXFHf9ugw_VPYGN4J_";
let sb=null,modal,body,shell,user=null,activePage="dashboard",licenseActive=false;
const pages=["dashboard","profile","services","market-analysis","signals","copy-trading","portfolio","wallet","orders","license","echo-system","downloads","settings","support"];
function init(){
 modal=document.getElementById("portal-modal");body=document.getElementById("portal-body");shell=document.getElementById("app-shell");
 if(!modal||!body||!shell){console.error("Portal shell missing");return;}
 if(window.supabase&&window.supabase.createClient){sb=window.supabase.createClient(URL,KEY);}
 else console.error("Supabase SDK failed to load");
 document.addEventListener("click",clickHandler);document.addEventListener("submit",submitHandler);
 document.addEventListener("keydown",e=>{if(e.key==="Escape")closeModal();});
 window.openPortal=openModal;window.closePortal=closeModal;
 updateHeader();
 if(sb){
  sb.auth.onAuthStateChange((_event,session)=>{user=session?session.user:null;updateHeader();if(user){showApp(activePage);}else{hideApp();}});
  sb.auth.getSession().then(({data})=>{user=data.session?data.session.user:null;updateHeader();if(user)showApp("dashboard");}).catch(console.error);
 }
}
function updateHeader(){
 const old=document.querySelector('header [data-open="login"],header [data-app-open="dashboard"]');if(!old)return;
 if(user){old.textContent="Client Area";old.setAttribute("data-app-open","dashboard");old.removeAttribute("data-open");}
 else if(old.hasAttribute("data-app-open")){old.textContent="Login";old.setAttribute("data-open","login");old.removeAttribute("data-app-open");}
 let buy=document.querySelector('header [data-open="buy"],header [data-app-page="services"]');if(buy){if(user){buy.textContent="Services";buy.setAttribute("data-app-page","services");buy.removeAttribute("data-open");}else{buy.textContent="Buy Now";buy.setAttribute("data-open","buy");buy.removeAttribute("data-app-page");}}
}
function openModal(kind){
 if(kind==="buy"){body.innerHTML='<p class="eyebrow">BIGBULLS AI PACKAGE</p><h2>Echo System · $199</h2><div class="notice">Checkout is not live yet. Payment verification, license activation and private download delivery are not enabled. Do not send payment.</div><button class="portal-primary" data-close>Close</button>';showModal();return;}
 if(!sb){body.innerHTML="<h2>Account service unavailable</h2><p>Please refresh and try again.</p>";showModal();return;}
 if(user){closeModal();showApp("dashboard");return;}
 if(kind==="signup")signupForm();else loginForm();showModal();
}
function showModal(){modal.classList.add("show");modal.setAttribute("aria-hidden","false");document.body.classList.add("portal-open");}
function closeModal(){modal.classList.remove("show");modal.setAttribute("aria-hidden","true");document.body.classList.remove("portal-open");}
function signupForm(){body.innerHTML='<p class="eyebrow">CUSTOMER ACCOUNT</p><h2>Create account</h2><form id="signup-form"><label>Full name<input name="full_name" autocomplete="name" required></label><label>Email<input name="email" type="email" autocomplete="email" required></label><label>Password<input name="password" type="password" minlength="8" autocomplete="new-password" required></label><button class="portal-primary" type="submit">Create account</button></form><div data-msg></div><button class="copy-wallet" data-auth-view="login">Already registered? Login</button>';}
function loginForm(){body.innerHTML='<p class="eyebrow">CUSTOMER ACCOUNT</p><h2>Login</h2><form id="login-form"><label>Email<input name="email" type="email" autocomplete="email" required></label><label>Password<input name="password" type="password" autocomplete="current-password" required></label><button class="portal-primary" type="submit">Login</button></form><div data-msg></div><button class="copy-wallet" data-auth-view="signup">Create account</button><button class="copy-wallet" data-action="forgot">Forgot password?</button>';}
function message(t,bad){let el=body.querySelector("[data-msg]");if(!el){el=document.createElement("div");el.dataset.msg="";body.append(el);}el.className="notice auth-message"+(bad?" error":"");el.textContent=t;}
function esc(v){return String(v||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function hideApp(){shell.hidden=true;document.body.classList.remove("app-mode");document.querySelector("main")?.removeAttribute("hidden");document.querySelector("footer")?.removeAttribute("hidden");activePage="dashboard";updateHeader();}
function showApp(page){
 if(!user||!shell)return;activePage=pages.includes(page)?page:"dashboard";
 shell.hidden=false;document.body.classList.add("app-mode");
 const main=document.querySelector("main"),footer=document.querySelector("footer");if(main)main.setAttribute("hidden","");if(footer)footer.setAttribute("hidden","");
 closeModal();renderApp();
}
function renderApp(){
 const meta=user.user_metadata||{},name=meta.full_name||user.email?.split("@")[0]||"Client";
 const nav=[["dashboard","▦","Overview"],["profile","◉","My Profile"],["services","✧","Trading Services"],["market-analysis","⌁","Market Analysis"],["signals","↗","Signals & Ideas"],["copy-trading","⟳","Copy Trading"],["portfolio","▤","Portfolio"],["wallet","◇","Wallet"],["orders","▣","Orders"],["license","♢","License"],["echo-system","⬡","Echo System"],["downloads","⇩","Downloads"],["settings","⚙","Settings"],["support","?","Support"]];
 shell.innerHTML='<div class="client-layout"><aside class="client-sidebar"><a class="client-brand" href="#" data-page="dashboard"><span class="mark">B</span><span>BIGBULLS <b>AI</b><small>CLIENT TERMINAL</small></span></a><div class="client-user"><div class="avatar">'+esc(name.charAt(0).toUpperCase())+'</div><div><b>'+esc(name)+'</b><small>Customer account</small></div></div><nav class="client-nav">'+nav.map(([id,ico,label])=>'<button type="button" data-page="'+id+'" class="'+(activePage===id?"active":"")+'"><span>'+ico+'</span>'+label+(id==="echo-system"&&!licenseActive?'<i>LOCKED</i>':"")+'</button>').join("")+'</nav><button class="client-logout" data-action="logout">↪ Log out</button></aside><section class="client-content"><header class="client-top"><div><small>BIGBULLS FX MARKET / CLIENT AREA</small><h2>'+title(activePage)+'</h2></div><div class="client-top-actions"><span class="client-status">● ACCOUNT ACTIVE</span><button type="button" data-action="logout">Logout</button></div></header><div id="client-page">'+pageContent(activePage,name)+'</div></section></div>';
}
function title(p){return ({dashboard:"Dashboard",profile:"My Profile",services:"Trading Services","market-analysis":"Market Analysis",signals:"Signals & Ideas","copy-trading":"Copy Trading",portfolio:"Portfolio",wallet:"Wallet",orders:"Orders",license:"License","echo-system":"Echo System",downloads:"Downloads",settings:"Settings",support:"Support"})[p]||"Dashboard";}
function stat(label,value,sub){return '<div class="client-stat"><small>'+label+'</small><b>'+value+'</b><span>'+sub+'</span></div>';}
function tile(id,icon,heading,desc,tag){return '<button class="service-tile" data-page="'+id+'"><span>'+icon+'</span><b>'+heading+'</b><small>'+desc+'</small><i>'+tag+' →</i></button>';}
function pageContent(p,name){
 if(p==="dashboard")return '<div class="welcome-row"><div><h3>Welcome back, '+esc(name)+'</h3><p>Your trading services and account access in one place.</p></div><span class="client-status">● Signed in</span></div><div class="client-stats">'+stat("ACCOUNT STATUS","ACTIVE","Email account connected")+stat("LICENSE STATUS","NOT ACTIVE","No verified purchase")+stat("TRADING ENGINE","OFFLINE","Not connected to broker")+stat("AVAILABLE SERVICES","6","Research and account tools")+'</div><h3 class="client-section-title">Your services</h3><div class="service-grid">'+tile("market-analysis","⌁","Market Analysis","Multi-asset research workspace","Open")+tile("signals","↗","Signals & Ideas","Research watchlist and trade journal","Open")+tile("copy-trading","⟳","Copy Trading","Copy-trading service information","Explore")+tile("portfolio","▤","Portfolio","Track your account allocations","Open")+tile("wallet","◇","Wallet & Payments","Payment and transaction records","Open")+tile("echo-system","⬡","BIGBULLS Echo System","Premium AI trading application","Paid license")+'</div><div class="client-banner"><div><small>PREMIUM SOFTWARE</small><h3>BIGBULLS AI Echo System</h3><p>Purchase access to the premium application when secure checkout launches.</p></div><button data-page="echo-system">View access</button></div>';
 if(p==="profile")return '<div class="client-panel"><h3>Personal information</h3><form id="profile-form" class="client-form"><label>Full name<input name="full_name" value="'+esc(user.user_metadata?.full_name||"")+'" required></label><label>Email address<input value="'+esc(user.email||"")+'" disabled></label><label>User ID<input value="'+esc(user.id||"")+'" disabled></label><button class="portal-primary">Save profile</button></form><div data-page-message></div></div>';
 if(p==="services")return '<h3 class="client-section-title">Explore available services</h3><div class="service-grid">'+tile("market-analysis","⌁","Market Analysis","Forex, Gold, Crypto and Indices","Open")+tile("signals","↗","Signals & Ideas","Watchlists and analysis notes","Open")+tile("copy-trading","⟳","Copy Trading","Managed strategy service information","Explore")+tile("portfolio","▤","Portfolio","Portfolio overview and tracking","Open")+tile("echo-system","⬡","Echo System","Premium paid software","Locked")+'</div>';
 if(p==="market-analysis")return '<div class="client-panel"><span class="client-status">RESEARCH WORKSPACE</span><h3>Multi-asset Market Analysis</h3><p>Choose a market to prepare analysis. Live quotes, chart feeds and AI-generated signals require market-data provider integration in the next backend phase.</p><div class="asset-grid"><button>EURUSD <small>Forex</small></button><button>GBPUSD <small>Forex</small></button><button>XAUUSD <small>Gold</small></button><button>BTCUSD <small>Crypto</small></button><button>US30 <small>Index</small></button><button>NAS100 <small>Index</small></button></div><div class="notice">No live price or trade signal is being displayed in this development build.</div></div>';
 if(p==="signals")return '<div class="client-panel"><h3>Signals & Ideas</h3><p>Your watchlist and trading journal workspace.</p><div class="empty-state">No live signals connected yet.<br><small>Signal provider and validation backend are pending.</small></div></div>';
 if(p==="copy-trading")return '<div class="client-panel"><h3>Copy Trading</h3><p>Connect and monitor approved copy-trading providers after broker integration.</p><div class="empty-state">No broker or master account connected.</div></div>';
 if(p==="portfolio")return '<div class="client-panel"><h3>Portfolio overview</h3><div class="client-stats">'+stat("CONNECTED ACCOUNTS","0","No broker connected")+stat("EQUITY","—","Awaiting broker API")+stat("OPEN TRADES","0","No live trading data")+stat("P&L","—","Not available")+'</div><div class="notice">Portfolio figures will appear after secure broker integration.</div></div>';
 if(p==="wallet")return '<div class="client-panel"><h3>Wallet & Payments</h3><div class="client-stats">'+stat("AVAILABLE BALANCE","—","Wallet backend pending")+stat("PAYMENT RECORDS","0","No verified orders")+'</div><div class="notice">Secure checkout is not active. Do not transfer funds directly. Payment confirmation must be implemented before accepting orders.</div></div>';
 if(p==="orders")return '<div class="client-panel"><h3>My Orders</h3><div class="empty-state">No orders yet.<br><small>Verified purchases will appear here once checkout is activated.</small></div></div>';
 if(p==="license")return '<div class="client-panel"><h3>Product license</h3><span class="lock-label">NOT ACTIVATED</span><p>No active Echo System license is associated with this account.</p><p>License activation will happen only after verified payment and server-side license issuance.</p><button class="portal-primary" data-page="echo-system">View Echo System</button></div>';
 if(p==="echo-system")return '<div class="client-panel echo-lock"><div class="lock-symbol">⬡</div><span class="lock-label">PREMIUM · PAYMENT REQUIRED</span><h3>BIGBULLS AI Echo System</h3><p>The Echo System application is reserved for customers with a verified active license.</p><ul><li>AI multi-timeframe market analysis</li><li>Strategy research and validation</li><li>Risk controls and emergency stop</li><li>Broker connection and trade monitoring</li></ul><div class="notice">Your license is not active. Secure checkout and automatic license delivery are still being built. No trading engine is connected in this website yet.</div></div>';
 if(p==="downloads")return '<div class="client-panel"><h3>My Downloads</h3><div class="empty-state">No private downloads available.<br><small>Download links appear after license verification.</small></div></div>';
 if(p==="settings")return '<div class="client-panel"><h3>Account security</h3><p>Email: '+esc(user.email)+'</p><button class="copy-wallet" data-action="forgot">Send password reset email</button><div class="notice">Two-factor authentication (authenticator app) is planned and is not enabled yet.</div></div>';
 if(p==="support")return '<div class="client-panel"><h3>Customer Support</h3><p>For account, payment or technical issues, contact the BIGBULLS FX Market support team.</p><a class="support-link" href="mailto:support@bigbullsfxmarket.com">Email support (address needs confirmation)</a><div class="notice">Support ticket submission will be connected to the backend in a later phase.</div></div>';
 return '<div class="client-panel">Page not found.</div>';
}
async function submitHandler(e){
 const f=e.target;if(!(f instanceof HTMLFormElement))return;
 if(f.id==="signup-form"||f.id==="login-form"){
  e.preventDefault();const d=new FormData(f),b=f.querySelector("button[type=submit]");b.disabled=true;b.textContent="Please wait…";
  try{if(f.id==="signup-form"){const {data,error}=await sb.auth.signUp({email:String(d.get("email")).trim(),password:String(d.get("password")),options:{emailRedirectTo:location.origin+location.pathname,data:{full_name:String(d.get("full_name")).trim()}}});if(error)throw error;if(data.session){user=data.user;showApp("dashboard");}else{message("Registration submitted. Check your email and verify your address, then log in.",false);b.disabled=false;b.textContent="Create account";}}
  else{const {data,error}=await sb.auth.signInWithPassword({email:String(d.get("email")).trim(),password:String(d.get("password"))});if(error)throw error;user=data.user;showApp("dashboard");}}
  catch(err){message(err.message||"Authentication failed.",true);b.disabled=false;b.textContent=f.id==="signup-form"?"Create account":"Login";}return;
 }
 if(f.id==="profile-form"){
  e.preventDefault();const b=f.querySelector("button");b.disabled=true;
  const {data,error}=await sb.auth.updateUser({data:{full_name:String(new FormData(f).get("full_name")).trim()}});
  b.disabled=false;const out=f.parentElement.querySelector("[data-page-message]");if(error){out.textContent=error.message;return;}user=data.user;renderApp();return;
 }
}
async function clickHandler(e){
 const el=e.target instanceof Element?e.target:null;if(!el)return;
 const page=el.closest("[data-page]");if(page){e.preventDefault();showApp(page.getAttribute("data-page"));return;}
 const view=el.closest("[data-auth-view]");if(view){if(view.dataset.authView==="signup")signupForm();else loginForm();return;}
 const trigger=el.closest("[data-open]");if(trigger){e.preventDefault();openModal(trigger.getAttribute("data-open"));return;}
 const appOpen=el.closest("[data-app-open]");if(appOpen){e.preventDefault();showApp("dashboard");return;}
 const action=el.closest("[data-action]");if(action){
  if(action.dataset.action==="logout"){const {error}=await sb.auth.signOut();if(error)alert(error.message);else{user=null;hideApp();window.scrollTo({top:0,behavior:"smooth"});}return;}
  if(action.dataset.action==="forgot"){const email=prompt("Registered email address:");if(!email)return;const {error}=await sb.auth.resetPasswordForEmail(email.trim(),{redirectTo:location.origin+location.pathname});if(error)alert(error.message);else alert("Password reset email requested. Check your inbox.");return;}
 }
 if(el.closest("[data-close]")||el.classList.contains("portal-close")||el===modal)closeModal();
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();
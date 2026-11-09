(function(){
"use strict";
const notice=(message)=>{
 let n=document.getElementById("bb-expansion-notice");
 if(!n){n=document.createElement("div");n.id="bb-expansion-notice";n.className="bbx-toast";document.body.append(n);}
 n.textContent=message;n.classList.add("show");window.setTimeout(()=>n.classList.remove("show"),4200);
};
const card=(kicker,title,body,foot)=>'<article class="bbx-card"><small>'+kicker+'</small><h4>'+title+'</h4><p>'+body+'</p>'+(foot?'<span>'+foot+'</span>':'')+'</article>';
function inject(page,html){if(!page||page.dataset.bbxReady==="1")return;page.dataset.bbxReady="1";page.insertAdjacentHTML("beforeend",html);}
function enhance(){
 const page=document.getElementById("client-page");if(!page)return;
 const shell=document.querySelector(".terminal");if(!shell)return;
 const navActive=shell.querySelector(".terminal-sidebar button.active");
 const pageName=navActive?.getAttribute("data-page")||"";
 if(!pageName||pageName==="admin")return;
 if(pageName==="accounts"){
  inject(page,'<section class="bbx-section"><div class="bbx-heading"><div><small>ACCOUNT MANAGEMENT · EXPANDED WORKSPACE</small><h3>Platform & account controls</h3><p>Account balance, equity and margin fields will populate when a verified MT4/MT5 broker connection is available.</p></div><span class="bbx-state">BROKER FEED PENDING</span></div><div class="bbx-grid">'+
  card("PLATFORM","MT4 / MT5","Choose your preferred platform when requesting a new account. Existing website account records are not live broker logins.","Platform provisioning pending")+
  card("ACCOUNT METRICS","Equity · Free Margin · Margin Level","Balance is shown from the website account record. Equity and free margin require broker-side trading data.","Live metrics unavailable")+
  card("LEVERAGE","Maximum leverage request","Leverage changes must be confirmed by the broker and applied server-side. This preview does not change leverage.","Request workflow pending")+
  card("SECURITY","Trading & read-only passwords","Password changes must use a secure broker API. Do not enter or share trading passwords in this preview.","Secure broker integration pending")+
  '</div><div class="bbx-action-row"><label>Preferred platform<select id="bbx-platform"><option>MT5</option><option>MT4</option></select></label><label>Leverage preference<select id="bbx-leverage"><option>1:100</option><option>1:200</option><option>1:500</option><option>1:1000</option><option>1:2000</option></select></label><button type="button" data-bbx-action="account-request">Preview account preferences</button></div><p class="bbx-footnote">Account requests continue through the existing website workflow. These preference controls are frontend-only and are not saved or sent to the broker.</p></section>');
 }
 if(pageName==="wallet"){
  inject(page,'<section class="bbx-section"><div class="bbx-heading"><div><small>FINANCE HUB · PAYMENT ROUTES</small><h3>Available payment experiences</h3><p>Only administrator-enabled crypto wallets appear in the existing deposit selector. Other routes remain planned until provider onboarding is complete.</p></div><span class="bbx-state">MANUAL REVIEW</span></div><div class="bbx-grid">'+
  card("CRYPTO","USDT · BTC · ETH","Network-specific wallet address, QR display, TXID and proof submission through the existing account deposit flow.","Depends on active admin wallet")+
  card("LOCAL BANK","Bank transfer","Bank beneficiary details, payment reference and reconciliation screen.","Integration pending")+
  card("CARDS","Debit / credit cards","Hosted payment gateway and verified payment callback.","Provider approval pending")+
  card("E-WALLETS","Skrill · Neteller","Redirect checkout and settlement reconciliation.","Provider integration pending")+
  '</div><p class="bbx-footnote">Withdrawal requests remain subject to balance checks and administrator payout review. Internal transfers are request-based until a secure settlement workflow is enabled.</p></section>');
 }
 if(pageName==="partner"){
  inject(page,'<section class="bbx-section"><div class="bbx-heading"><div><small>PARTNERSHIP · IB WORKSPACE</small><h3>Partner performance & campaign tools</h3><p>Commission and volume figures must come from verified broker-side activity; no estimated earnings are shown.</p></div><span class="bbx-state">BROKER ATTRIBUTION PENDING</span></div><div class="bbx-metrics"><div><small>TOTAL REWARD</small><b>Awaiting verified data</b></div><div><small>DAILY COMMISSION</small><b>Awaiting verified data</b></div><div><small>ACTIVE CLIENTS</small><b>—</b></div><div><small>TRADED VOLUME</small><b>— lots</b></div></div><div class="bbx-grid">'+
  card("REFERRAL LINKS","Campaign tracking","Use the approved referral link shown above. Campaign tags and custom partner codes require attribution support.","Link tools preview")+
  card("QR CENTER","Partner QR code","A downloadable QR will be generated once an approved referral URL is available.","Awaiting approved referral link")+
  card("PROMO ASSETS","Banners & landing pages","Partner creative assets can be published after campaign approval.","Asset library pending")+
  card("IB WALLET","Rewards & payouts","Transfer and payout controls require a verified commission ledger and separate payout approval.","Payout integration pending")+
  '</div></section>');
 }
 if(pageName==="economic-calendar"){
  inject(page,'<section class="bbx-section"><div class="bbx-heading"><div><small>EVENT MONITOR</small><h3>Calendar filters</h3><p>Filter controls are ready for a calendar provider; event rows are not live until the data source is connected.</p></div><span class="bbx-state">DATA FEED PENDING</span></div><div class="bbx-action-row"><label>Impact<select disabled><option>All impacts</option><option>High</option><option>Medium</option><option>Low</option></select></label><label>Region<select disabled><option>All countries</option><option>United States</option><option>United Kingdom</option><option>Eurozone</option></select></label><label>Time range<select disabled><option>Today</option><option>This week</option><option>Next week</option></select></label></div><div class="bbx-empty">Economic events · Previous · Forecast · Actual · Countdown<br><small>Connect a licensed/approved calendar source to populate this table.</small></div></section>');
 }
 if(pageName==="trading-central"){
  inject(page,'<section class="bbx-section"><div class="bbx-heading"><div><small>RESEARCH WORKSPACE</small><h3>Technical analysis modules</h3><p>These are display areas only; no third-party analyst signals are currently connected.</p></div><span class="bbx-state">RESEARCH FEED PENDING</span></div><div class="bbx-grid">'+
  card("MARKET BIAS","Bullish / bearish view","Instrument-level directional bias with supporting technical evidence.","No active recommendation")+
  card("PRICE LEVELS","Targets & invalidation","Provider-sourced target zones, stop/invalidation levels and timestamps.","No levels available")+
  card("PIVOT POINTS","Support & resistance","Daily and weekly pivot calculations with source and session context.","Calculation integration pending")+
  '</div></section>');
 }
 if(pageName==="settings"||pageName==="profile"){
  inject(page,'<section class="bbx-section"><div class="bbx-heading"><div><small>SECURITY CENTRE</small><h3>Account protection</h3><p>Security features that require server-side verification are shown as unavailable until the secure backend is deployed.</p></div><span class="bbx-state">AUTHENTICATION ACTIVE</span></div><div class="bbx-grid">'+
  card("TWO-FACTOR AUTH","Authenticator app / SMS","Enable 2FA only after challenge verification, recovery codes and rate limits are implemented.","2FA setup pending")+
  card("ACTIVE SESSIONS","Device & IP manager","Session revocation and device history require secure session-management endpoints.","Session manager pending")+
  card("CONTACT DETAILS","Email & phone","Email authentication is handled by the account provider; phone OTP is not enabled here.","Phone verification pending")+
  '</div></section>');
 }
 if(pageName==="verification"){
  inject(page,'<section class="bbx-section"><div class="bbx-heading"><div><small>IDENTITY VERIFICATION · KYC JOURNEY</small><h3>Verification progress</h3><p>Your existing secure KYC form remains the submission route. The expanded journey below is a workflow guide, not a claim that every step is connected.</p></div><span class="bbx-state">REVIEW REQUIRED</span></div><ol class="bbx-steps"><li><b>01</b><span><strong>Email & phone verification</strong><small>Email status is managed by sign-in; phone OTP integration pending.</small></span><em>PARTIAL</em></li><li><b>02</b><span><strong>Personal information</strong><small>Name, date of birth and residential address are collected in the existing KYC form.</small></span><em>FORM AVAILABLE</em></li><li><b>03</b><span><strong>Economic profile</strong><small>Occupation, source of funds, income range and trading experience questionnaire.</small></span><em>BACKEND FIELD MAPPING PENDING</em></li><li><b>04</b><span><strong>Proof of identity (POI)</strong><small>CNIC, passport or driving licence upload; existing front/back document fields are available.</small></span><em>FORM AVAILABLE</em></li><li><b>05</b><span><strong>Proof of residence (POR)</strong><small>Utility bill or bank statement upload with document-age checks.</small></span><em>UPLOAD WORKFLOW PENDING</em></li></ol><div class="bbx-footnote">Do not upload POR or economic-profile details into unrelated fields. Those steps need their own secure schema, private storage policies and admin review states before collection.</div></section>');
 }
 if(pageName==="terminal"){
  inject(page,'<section class="bbx-section"><div class="bbx-heading"><div><small>EXECUTION STATUS</small><h3>Order workflow readiness</h3><p>Charting is provided by the embedded chart widget. Order execution stays disabled until a broker gateway, risk checks and audit trail are connected.</p></div><span class="bbx-state">EXECUTION OFFLINE</span></div><div class="bbx-grid">'+
  card("ORDER TYPES","Market · Limit · Stop","Order ticket layout can support market and pending order types after broker integration.","UI preview only")+
  card("RISK CONTROLS","Stop loss · Take profit · Volume","Pre-trade margin, exposure and loss-limit checks must run server-side.","Not connected")+
  card("POSITIONS","Open · Pending · Closed","Position history and margin-call indicators require a live broker data stream.","No broker positions")+
  '</div></section>');
 }
}
document.addEventListener("click",function(e){
 const button=e.target.closest("[data-bbx-action]");if(!button)return;
 if(button.dataset.bbxAction==="account-request"){
  const platform=document.getElementById("bbx-platform")?.value||"MT5";
  const leverage=document.getElementById("bbx-leverage")?.value||"1:100";
  notice("Preference preview: "+platform+" · "+leverage+". Nothing was saved or sent to a broker.");
 }
});
const observer=new MutationObserver(()=>{enhance();});
function start(){enhance();observer.observe(document.body,{childList:true,subtree:true});}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start);else start();
})();
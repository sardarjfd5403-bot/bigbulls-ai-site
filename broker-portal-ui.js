/* BIGBULLS Global Market — reference dashboard interaction layer */
(function(){
 "use strict";
 const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
 let enhanced=null;
 const svg=(name)=>{const p={
 menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',close:'<path d="m6 6 12 12M18 6 6 18"/>',bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
 user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',wallet:'<rect x="3" y="6" width="18" height="15" rx="2"/><path d="M3 10h18M16 15h2M6 6V4h12"/>',
 trade:'<path d="M4 17 10 11l4 4 6-8"/><path d="M15 7h5v5"/>',chart:'<path d="M4 19V5M4 19h17M7 15l4-5 3 3 6-8"/>',
 news:'<path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5"/>',ribbon:'<path d="M12 3a6 6 0 1 0 0 12 6 6 0 0 0 0-12zM8 14l-2 7 6-3 6 3-2-7"/>',
 heart:'<path d="M20.8 8.8c0 5.4-8.8 11-8.8 11s-8.8-5.6-8.8-11A4.8 4.8 0 0 1 12 6.4a4.8 4.8 0 0 1 8.8 2.4z"/>',
 gear:'<circle cx="12" cy="12" r="3"/><path d="M19 13.5a7 7 0 0 0 0-3l2-1.5-2-3.5-2.4 1a7 7 0 0 0-2.6-1L13.5 3h-3L10 5.5a7 7 0 0 0-2.6 1L5 5.5 3 9l2 1.5a7 7 0 0 0 0 3L3 15l2 3.5 2.4-1a7 7 0 0 0 2.6 1l.5 2.5h3l.5-2.5a7 7 0 0 0 2.6-1l2.4 1 2-3.5z"/>',
 chat:'<path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 9 9 0 0 1-4-.9L3 21l1.9-5.5a9 9 0 0 1-.9-4A8.5 8.5 0 0 1 12.5 3H13a8.5 8.5 0 0 1 8 8.5z"/>',
 grid:'<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/>',
 help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4.2 1.8c-1.1.9-1.7 1.3-1.7 2.7M12 17h.01"/>',
 globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/>',
 sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4m11.4-11.4 1.4-1.4"/>',
 down:'<path d="m6 9 6 6 6-6"/>',plus:'<path d="M12 5v14M5 12h14"/>',tradeCircle:'<path d="M4 16 9 11l4 3 7-8M15 6h5v5"/>',
 deposit:'<circle cx="12" cy="12" r="9"/><path d="M12 7v10m-4-4 4 4 4-4"/>',withdraw:'<circle cx="12" cy="12" r="9"/><path d="M12 17V7m-4 4 4-4 4 4"/>',more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>'
 };return '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+(p[name]||p.grid)+'</svg>';};
 const item=(page,label)=>'<button type="button" class="bb-sub-link" data-page="'+page+'">'+label+'</button>';
 const accordion=(id,label,ico,links)=>'<section class="bb-nav-group"><button type="button" class="bb-nav-main" data-bb-accordion="'+id+'" aria-expanded="false"><span class="bb-nav-ico">'+svg(ico)+'</span><span>'+label+'</span>'+svg('down')+'</button><div class="bb-nav-sub" data-bb-submenu="'+id+'" hidden>'+links+'</div></section>';
 function maskName(n){return String(n||"Client").split(/\s+/).map(w=>w.length<2?w:w[0]+"*".repeat(Math.max(2,w.length-1))).join(" ");}
 function maskEmail(e){if(!e||!e.includes("@"))return "Registered email";const [u,d]=e.split("@");return (u.length>2?u[0]+"****"+u.slice(-1):u[0]+"***")+"@"+d;}
 function closeDrawer(){const s=$(".client-sidebar"),b=$(".bb-drawer-backdrop");s?.classList.remove("bb-drawer-open");b?.classList.remove("is-open");document.body.classList.remove("bb-drawer-visible");}
 function openDrawer(){const s=$(".client-sidebar"),b=$(".bb-drawer-backdrop");s?.classList.add("bb-drawer-open");b?.classList.add("is-open");document.body.classList.add("bb-drawer-visible");}
 function syncBalance(){const v=$("#header-wallet-balance")?.textContent||"0.00 USD";const n=$("#bb-drawer-balance");if(n)n.textContent=v.replace("$","")+" USD";}
 function enhance(){
  const shell=$("#app-shell"),terminal=shell&&$(".terminal",shell);if(!terminal)return;
  if(enhanced===terminal&&terminal.dataset.bbReference==="yes")return;
  enhanced=terminal;terminal.dataset.bbReference="yes";
  const head=$(".terminal-head",terminal),sidebar=$(".client-sidebar",terminal),main=$(".terminal-main",terminal);if(!head||!sidebar||!main)return;
  const panel=$("#client-notification-panel",head);
  const name=window.__bbUserName||$(".profile-trigger b",head)?.textContent||"Client";
  const email=window.__bbUserEmail||"";
  const balance=$("#header-wallet-balance",head)?.textContent||"0.00 USD";
  head.innerHTML='<div class="bb-top-left"><button type="button" class="bb-hamburger" data-bb-drawer-toggle aria-label="Open menu">'+svg('menu')+'</button><a class="bb-top-brand" href="#" data-page="accounts"><strong>BIGBULLSGLOBAL</strong> <span>MARKET</span></a></div><div class="bb-top-actions"><button type="button" class="bb-bell" data-notification-toggle aria-label="Notifications">'+svg('bell')+'<i></i></button></div><span class="bb-hidden-balance" id="header-wallet-balance">'+balance+'</span>';
  const n=maskName(name),em=maskEmail(email);
  sidebar.innerHTML='<div class="bb-drawer-head"><button type="button" class="bb-close" data-bb-drawer-close aria-label="Close menu">'+svg('close')+'</button><span><b>BIGBULLSGLOBAL</b> MARKET</span><button type="button" class="bb-drawer-bell" data-notification-toggle aria-label="Notifications">'+svg('bell')+'</button></div><div class="bb-drawer-scroll"><section class="bb-bronze-card"><div class="bb-bronze-top"><h3>Bronze</h3><b>0.03 BGM</b></div><p>10 days left to upgrade</p><div class="bb-progress-text"><span>Earn 10 BGM</span><span>0/10</span></div><div class="bb-progress-track"><i></i></div></section><button class="bb-identity" type="button" data-page="profile"><span class="bb-user-icon">'+svg('user')+'</span><span><b>'+n+'</b><small>'+em+'</small></span>'+svg('down')+'</button><button class="bb-wallet-quick" type="button" data-page="wallet"><span>'+svg('wallet')+'<b id="bb-drawer-balance">'+balance.replace("$","")+' USD</b></span><span class="bb-new-pill">NEW</span>'+svg('down')+'</button><nav class="bb-reference-nav" aria-label="Main navigation">'+
   accordion('trading','Trading','trade',item('accounts','Accounts')+item('portfolio','Performance')+item('orders','History of orders')+item('terminal','Bigbulls Terminal'))+
   accordion('payments','Payments & wallet','wallet',item('wallet','Deposit')+item('wallet','Withdrawal')+item('wallet','Transfer')+item('wallet','Transaction history')+item('wallet','Funding wallet')+item('wallet','Crypto wallet'))+
   accordion('analytics','Analytics','news',item('signals','Trading signals')+item('market-analysis','News')+item('economic-calendar','Economic Calendar'))+
   accordion('benefits','Bigbulls benefits','ribbon',item('services','Trading Conditions')+item('services','Savings')+item('partner','IB Partner')+item('echo-system','Bigbulls AI products'))+
   '<button type="button" class="bb-nav-direct" data-page="support"><span class="bb-nav-ico">'+svg('heart')+'</span><span>Support hub</span></button>'+
   accordion('settings','Settings','gear',item('profile','Profile')+item('settings','Security Settings')+item('verification','KYC verification'))+
   '<div class="bb-nav-separator"></div><button type="button" class="bb-nav-direct" data-page="support"><span class="bb-nav-ico">'+svg('chat')+'</span><span>Live Chat</span></button>'+
   accordion('products','Bigbulls Products','grid',item('echo-system','Echo System')+item('learning','Education')+item('services','Trading products')+item('partner','IB Partner'))+
   accordion('help','Help','help',item('support','Help centre')+item('support','FAQs')+item('support','Contact support'))+
   '<section class="bb-nav-group"><button type="button" class="bb-nav-main" data-bb-utility="language"><span class="bb-nav-ico">'+svg('globe')+'</span><span>English</span>'+svg('down')+'</button><div class="bb-utility-pop" data-bb-utility-pop="language" hidden><button type="button" data-bb-language="English">English · selected</button><button type="button" data-bb-language="Urdu">اردو</button></div></section>'+
   '<section class="bb-nav-group"><button type="button" class="bb-nav-main" data-bb-utility="theme"><span class="bb-nav-ico">'+svg('sun')+'</span><span>Display theme</span>'+svg('down')+'</button><div class="bb-utility-pop" data-bb-utility-pop="theme" hidden><button type="button" data-bb-theme="light">Light</button><button type="button" data-bb-theme="dark">Dark</button></div></section></nav></div><div class="bb-drawer-bottom"><button type="button" class="bb-referral" data-page="partner"><span class="bb-referral-icon">'+svg('user')+'</span><span><b>Refer traders, earn commission</b><small>Invite your network to BIGBULLS</small></span></button></div>';
  if(panel){panel.classList.add('bb-notification-panel');head.append(panel);}
  let backdrop=$('.bb-drawer-backdrop');if(!backdrop){backdrop=document.createElement('div');backdrop.className='bb-drawer-backdrop';document.body.append(backdrop);}
  const title=$('.terminal-page-head h2',main);if(title&&(title.textContent.trim()==='Trading Accounts'||title.textContent.trim()==='Dashboard'))title.textContent='My accounts';
  if(title&&title.textContent.trim()==='My accounts')decorateAccounts();
  syncBalance();
 }
 function decorateAccounts(){
  const intro=$('.accounts-page-intro');if(!intro)return;
  const host=$('#my-trading-accounts');const request=$('.account-request-panel');const list=$('.account-list-panel');
  if(intro.dataset.bbRefDone!=="yes"){
   intro.dataset.bbRefDone="yes";
   intro.insertAdjacentHTML('afterend','<div class="bb-account-toolbar"><div class="bb-account-tabs-wrap"></div><div class="bb-toolbar-right"><button type="button" class="bb-open-account" data-bb-open-account>'+svg('plus')+' Open account</button><label class="bb-sort-wrap"><select class="bb-sort-select" aria-label="Sort accounts"><option value="newest">Newest</option><option value="oldest">Oldest</option><option value="name">Name</option></select></label></div></div>');
   const tabs=$('.bb-account-tabs',intro.parentElement);if(tabs){$('.bb-account-tabs-wrap',intro.parentElement).append(tabs);const archived=tabs.querySelector('[data-account-mode="archived"]');if(archived)archived.remove();const real=tabs.querySelector('[data-account-mode="real"]'),demo=tabs.querySelector('[data-account-mode="demo"]');if(real)real.textContent='Real';if(demo)demo.textContent='Demo';}
   intro.hidden=true;
   const workspace=$('.accounts-workspace',intro.parentElement);if(workspace)workspace.classList.add('bb-ref-workspace');
   if(request)request.hidden=true;
   if(list){const h=$('.account-list-heading',list);if(h)h.hidden=true;}
   const notice=$('.accounts-workspace + #bb-account-tools + .notice');if(notice)notice.classList.add('bb-reference-note');
   const archive=document.createElement('section');archive.className='bb-archived-section';archive.innerHTML='<h2>Archived accounts</h2><button type="button" data-account-mode="archived"><span>Show archived accounts</span>'+svg('down')+'</button>';host?.closest('.account-list-panel')?.insertAdjacentElement('afterend',archive);
  }
  decorateAccountCards();
 }
 function decorateAccountCards(){
  const host=$('#my-trading-accounts');if(!host)return;
  $$('.bb-account-card',host).forEach(card=>{
   if(card.dataset.bbRefCard==="yes")return;card.dataset.bbRefCard="yes";
   const meta=$('.bb-account-meta',card),top=$('.bb-account-card-top',card);
   const val=(key)=>{const s=meta&&$$('span',meta).find(x=>x.textContent.trim().toUpperCase().startsWith(key));return s?s.textContent.replace(new RegExp('^'+key+'\\s*','i'),'').trim():"";};
   const platform=val('PLATFORM')||'MT5',type=val('TYPE')||'Standard',balanceText=val('BALANCE')||'USD 0.00';
   const bm=balanceText.match(/([A-Z]{3})\s*([\d,]+(?:\.\d+)?)/i);const currency=bm?bm[1]:'USD',amount=bm?bm[2]:'0.00';
   const number=$('.bb-account-number',top)?.textContent||'# —';
   const financial=$$('.account-financial-actions button',card),manage=$$('.bb-account-actions:not(.account-financial-actions) button',card);
   const direct=financial.filter(b=>['deposit','withdraw'].includes(b.dataset.accountTool));
   const more=[...financial.filter(b=>!['deposit','withdraw'].includes(b.dataset.accountTool)),...manage];
   const row=document.createElement('div');row.className='bb-reference-card-content';
   row.innerHTML='<div class="bb-ref-card-top"><div class="bb-ref-badges"><span>'+platform+'</span><span>'+type+'</span></div><button type="button" class="bb-card-chevron" data-bb-card-details aria-label="Account details">'+svg('down')+'</button></div><div class="bb-ref-number">'+number+'</div><div class="bb-ref-balance"><strong>'+amount+'</strong><span> '+currency+'</span></div><div class="bb-ref-actions"><button type="button" class="bb-circle-action bb-trade-action" data-page="terminal"><i>'+svg('tradeCircle')+'</i><b>Trade</b></button><button type="button" class="bb-circle-action" data-account-tool="deposit" data-account-id="'+(direct.find(b=>b.dataset.accountTool==='deposit')?.dataset.accountId||'')+'"><i>'+svg('deposit')+'</i><b>Deposit</b></button><button type="button" class="bb-circle-action" data-account-tool="withdraw" data-account-id="'+(direct.find(b=>b.dataset.accountTool==='withdraw')?.dataset.accountId||'')+'"><i>'+svg('withdraw')+'</i><b>Withdraw</b></button><button type="button" class="bb-circle-action" data-bb-more-toggle><i>'+svg('more')+'</i><b>More</b></button></div><div class="bb-more-menu" hidden></div>';
   card.insertBefore(row,card.firstChild);
   const menu=$('.bb-more-menu',row);more.forEach(b=>menu.append(b));
   direct.forEach(b=>b.remove());
   if(meta)meta.hidden=true;if(top)top.hidden=true;
   $$('.bb-account-actions',card).forEach(w=>{if(!w.children.length)w.remove();else w.hidden=true;});
   const notice=$('.notice',card);if(notice)notice.classList.add('bb-account-status-note');
  });
 }
 function onClick(e){
  const t=e.target.closest('[data-bb-drawer-toggle],[data-bb-drawer-close],[data-bb-accordion],[data-bb-open-account],[data-bb-more-toggle],[data-bb-card-details],[data-bb-utility],[data-bb-language],[data-bb-theme]');
  if(t){
   if(t.hasAttribute('data-bb-drawer-toggle')){const isOpen=$('.client-sidebar')?.classList.contains('bb-drawer-open');if(isOpen)closeDrawer();else openDrawer();t.setAttribute('aria-expanded',String(!isOpen));}
   if(t.hasAttribute('data-bb-drawer-close'))closeDrawer();
   if(t.hasAttribute('data-bb-accordion')){const id=t.dataset.bbAccordion,sub=$('[data-bb-submenu="'+id+'"]');const open=t.getAttribute('aria-expanded')==='true';t.setAttribute('aria-expanded',String(!open));if(sub)sub.hidden=open;}
   if(t.hasAttribute('data-bb-open-account')){const p=$('.account-request-panel');if(p){p.hidden=false;p.classList.add('bb-open');p.scrollIntoView({behavior:'smooth',block:'start'});}}
   if(t.hasAttribute('data-bb-more-toggle')){const menu=$('.bb-more-menu',t.closest('.bb-account-card'));if(menu)menu.hidden=!menu.hidden;}
   if(t.hasAttribute('data-bb-card-details')){const meta=$('.bb-account-meta',t.closest('.bb-account-card'));if(meta)meta.hidden=!meta.hidden;}
   if(t.hasAttribute('data-bb-utility')){const id=t.dataset.bbUtility,p=$('[data-bb-utility-pop="'+id+'"]');if(p)p.hidden=!p.hidden;}
   if(t.hasAttribute('data-bb-language')){const label=$('[data-bb-utility="language"] span:nth-child(2)');if(label)label.textContent=t.dataset.bbLanguage;const p=t.closest('.bb-utility-pop');if(p)p.hidden=true;}
   if(t.hasAttribute('data-bb-theme')){const mode=t.dataset.bbTheme==='dark'?'dark':'light';document.documentElement.dataset.theme=mode;$('[data-bb-theme]').forEach(x=>{x.textContent=(x.dataset.bbTheme===mode?'✓ ':'')+(x.dataset.bbTheme==='dark'?'Dark':'Light');});const p=t.closest('.bb-utility-pop');if(p)p.hidden=true;}
  }
  if(e.target.closest('.bb-drawer-backdrop'))closeDrawer();
  if(!e.target.closest('.bb-account-card'))$$('.bb-more-menu').forEach(x=>x.hidden=true);
 }
 function onPageClick(e){const l=e.target.closest('.bb-sub-link[data-page],.bb-nav-direct[data-page],.bb-referral[data-page],.bb-identity[data-page],.bb-wallet-quick[data-page],.bb-top-brand[data-page]');if(l)closeDrawer();}
 function observe(){
  const shell=$('#app-shell');if(!shell)return;
  const obs=new MutationObserver(()=>{const t=$('.terminal',shell);if(t&&t.dataset.bbReference!=='yes'){enhanced=null;enhance();}else if(t&&$('.terminal-page-head h2')?.textContent.trim()==='My accounts'){decorateAccounts();}syncBalance();});
  obs.observe(shell,{childList:true,subtree:true});
  document.addEventListener('click',onClick);
  document.addEventListener('click',onPageClick,true);
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeDrawer();});
  document.addEventListener('change',e=>{if(e.target.matches('.bb-sort-select')){const h=$('#my-trading-accounts');if(!h)return;const cards=$$(':scope > .bb-account-card',h);const sorted=e.target.value==='name'?cards.sort((a,b)=>a.textContent.localeCompare(b.textContent)):e.target.value==='oldest'?cards.reverse():cards;sorted.forEach(c=>h.append(c));}});
  const shell=$('#app-shell');const t=shell&&$('.terminal',shell);if(t)enhance();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',observe);else observe();
})();

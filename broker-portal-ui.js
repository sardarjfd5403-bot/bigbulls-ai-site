/* BIGBULLS broker-style navigation and accounts UI */
(function(){
 "use strict";
 const $=(s,r=document)=>r.querySelector(s);
 const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
 let enhancedTerminal=null;
 const icon=(name)=>({trade:'<path d="M3 17l6-6 4 4 8-9"/><path d="M15 6h6v6"/>',wallet:'<path d="M3 6h18v14H3z"/><path d="M3 9h18M16 14h2"/>',chart:'<path d="M4 19V5M4 19h17M7 15l4-5 3 3 6-8"/>',settings:'<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.5-2.3 1a7 7 0 0 0-1.7-1L14.5 3h-5L9 5.9a7 7 0 0 0-1.7 1L5 6l-2 3.5L5 11a7 7 0 0 0 0 2l-2 1.5L5 18l2.3-1a7 7 0 0 0 1.7 1l.5 3h5l.5-3a7 7 0 0 0 1.7-1l2.3 1 2-3.5-2-1.5a7 7 0 0 0 .1-1z"/>',help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4.2 1.8c-1.1.9-1.7 1.3-1.7 2.7M12 17h.01"/>',people:'<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0M16 5a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 5"/>',news:'<path d="M4 4h16v16H4zM8 8h8M8 12h8M8 16h5"/>',products:'<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>',support:'<path d="M4 13v-2a8 8 0 0 1 16 0v2M4 13H2v4h4v-4zM20 13h2v4h-4v-4zM9 20h6"/>',globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/>',sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'})[name]||'<circle cx="12" cy="12" r="8"/>';
 const nav=[
  {id:'trading',label:'Trading',icon:'trade',items:[['accounts','My accounts'],['terminal','BIGBULLS Terminal'],['portfolio','Performance'],['orders','Order history']]},
  {id:'payments',label:'Payments & wallet',icon:'wallet',items:[['wallet','Deposit'],['wallet','Withdrawal'],['wallet','Transfer'],['wallet','Transaction history'],['wallet','Funding wallet'],['wallet','Crypto wallet']]},
  {id:'analytics',label:'Analytics / Insights',icon:'chart',items:[['signals','Trading signals'],['market-analysis','Market analysis & news'],['economic-calendar','Economic Calendar'],['trading-central','Trading insights']]},
  {id:'benefits',label:'BigBulls benefits & products',icon:'people',items:[['services','Trading Conditions'],['services','Savings & benefits'],['echo-system','Echo System'],['services','Trading products'],['learning','Education']]},
  {id:'support',label:'Support hub',icon:'support',items:[['support','Support centre'],['support','Submit a ticket'],['support','Live Chat'],['support','Help centre'],['support','FAQs']]},
  {id:'settings',label:'Settings',icon:'settings',items:[['profile','Profile information'],['settings','Security settings'],['verification','KYC verification'],['profile','Language preferences'],['settings','Appearance settings']]},
  {id:'partner',label:'IB Partner',icon:'people',items:[['partner','IB Partner dashboard'],['partner','Referral links'],['partner','Commission history']]}
 ];
 function navMarkup(){return nav.map(g=>'<section class="bb-menu-section"><button type="button" class="bb-menu-main" data-bb-accordion="'+g.id+'" aria-expanded="'+(g.id==='trading'?'true':'false')+'"><span class="bb-nav-icon"><svg viewBox="0 0 24 24">'+icon(g.icon)+'</svg></span><span>'+g.label+'</span><span class="bb-chevron">⌄</span></button><div class="bb-submenu" data-bb-submenu="'+g.id+'" '+(g.id==='trading'?'':'hidden')+'>'+g.items.map(x=>'<button type="button" data-page="'+x[0]+'">'+x[1]+'</button>').join('')+'</div></section>').join('');}
 function enhance(){
  const shell=$('#app-shell'),terminal=shell&&$('.terminal',shell);
  if(!terminal)return;
  if(enhancedTerminal===terminal&&terminal.dataset.bbEnhanced==='yes')return;
  enhancedTerminal=terminal;terminal.dataset.bbEnhanced='yes';
  const head=$('.terminal-head',terminal),sidebar=$('.client-sidebar',terminal),main=$('.terminal-main',terminal);
  if(!head||!sidebar||!main)return;
  const oldBrand=$('.terminal-brand',head);
  const oldName=$('.profile-trigger b',head)?.textContent||'Client Account';
  const notificationPanel=$('#client-notification-panel',head);
  const brand=oldBrand?oldBrand.innerHTML:'<span class="mark">B</span><span>BIGBULLS <b>FX</b><small>PERSONAL AREA</small></span>';
  const balance=$('#header-wallet-balance',head)?.textContent||'Loading…';
  head.innerHTML='<div class="bb-layout-left"><button class="bb-menu-toggle" type="button" data-bb-drawer-toggle aria-label="Open navigation menu"><svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/></svg></button><a class="bb-brand" href="#" data-page="accounts">'+brand+'</a></div><div class="bb-header-right"><div class="header-balance"><small>WALLET</small><b id="header-wallet-balance">'+balance+'</b></div><button type="button" class="profile-trigger" data-page="profile"><span class="profile-avatar">B</span><span><b>My Profile</b><small>Personal Area ▾</small></span></button></div>';
  sidebar.innerHTML='<button type="button" class="bb-mobile-close" data-bb-drawer-close aria-label="Close menu">×</button><div class="bb-drawer-profile"><div class="bb-tier-row"><span>BRONZE MEMBER</span><span>10 days to upgrade</span></div><div class="bb-points"><span>BIGBULLS REWARD POINTS</span><b>0.03 BBP</b></div><div class="bb-progress"><i></i></div><div class="bb-progress-label"><span>Earn 10 BBP</span><span>0.03 / 10</span></div></div><div class="bb-user-row"><span><b class="bb-user-name">Client Account</b><small class="bb-user-email">Signed-in account</small></span><span>⌄</span></div><div class="bb-wallet-row"><span><small>WALLET BALANCE</small><b id="bb-drawer-balance">'+balance+'</b></span><span class="bb-new-badge">NEW　⌄</span></div><nav class="client-nav sidebar-nav" aria-label="BigBulls main navigation"><button type="button" class="bb-menu-main" data-page="accounts"><span class="bb-nav-icon"><svg viewBox="0 0 24 24">'+icon('trade')+'</svg></span><span>My accounts</span></button>'+navMarkup()+'</nav><div class="bb-referral">♧ &nbsp; Refer traders, earn commission<small>Invite your network to BIGBULLS FX Market</small></div>';
  const name=oldName;
  const email=window.__bbUserEmail||'Registered email';
  $('.bb-user-name',sidebar).textContent=name;
  $('.bb-user-email',sidebar).textContent=email;
  const notificationWrap=document.createElement('div');notificationWrap.className='header-pop-wrap';notificationWrap.innerHTML='<button type="button" data-notification-toggle aria-label="Notifications">♧</button>';if(notificationPanel)notificationWrap.append(notificationPanel);$('.bb-header-right',head)?.insertBefore(notificationWrap,$('.profile-trigger',head));
  let backdrop=$('.bb-drawer-backdrop');
  if(!backdrop){backdrop=document.createElement('div');backdrop.className='bb-drawer-backdrop';document.body.append(backdrop);}
  sidebar.classList.remove('bb-drawer-open');
  const title=$('.terminal-page-head h2',main);
  const redirectDashboard=!!(title&&title.textContent.trim()==='Dashboard');
  if(redirectDashboard){title.textContent='My accounts';}
  if(title&&title.textContent.trim()==='Trading Accounts'){title.textContent='My accounts';}
  if(activePageName()==='accounts')decorateAccounts();
  if(redirectDashboard){window.setTimeout(()=>$('.bb-menu-main[data-page="accounts"]')?.click(),0);}
 }
 function activePageName(){const h=$('.terminal-page-head h2');return h?.textContent.trim()==='My accounts'?'accounts':h?.textContent.trim().toLowerCase()||'';}
 function decorateAccounts(){
  const intro=$('.accounts-page-intro');if(!intro)return;
  if($('.bb-account-toolbar',intro.parentElement))return;
  const tabs=$('.bb-account-tabs',intro.parentElement);
  const request=$('.account-request-panel',intro.parentElement);
  const list=$('.account-list-panel',intro.parentElement);
  if(!tabs||!list)return;
  const toolbar=document.createElement('div');toolbar.className='bb-account-toolbar';
  toolbar.innerHTML='<button type="button" class="bb-open-account" data-bb-open-account>＋ Open account</button><label class="bb-sort-label"><select class="bb-sort-select" aria-label="Sort accounts"><option value="newest">↕ Newest</option><option value="oldest">Oldest</option><option value="name">Name</option></select></label>';
  intro.insertAdjacentElement('afterend',toolbar);
  const demo=tabs.querySelector('[data-account-mode="demo"]');if(demo)demo.textContent='Demo';
  const real=tabs.querySelector('[data-account-mode="real"]');if(real)real.textContent='Real';
  const archived=tabs.querySelector('[data-account-mode="archived"]');if(archived)archived.hidden=true;
  if(request){request.querySelector('.free-tag')?.remove();const h=request.querySelector('h3');if(h)h.textContent='Open a trading account';}
  decorateAccountCards();
 }
 function decorateAccountCards(){
  const host=$('#my-trading-accounts');if(!host)return;
  $('#my-trading-accounts > *').forEach((card,index)=>{
   if(card.classList.contains('empty-state')||card.querySelector('.bb-account-actions')||!/(account|#\\s*\\d)/i.test(card.textContent))return;
   card.classList.add('bb-account-card');
   const actions=document.createElement('div');actions.className='bb-account-actions';
   actions.innerHTML='<button type="button" data-page="terminal"><i>⌁</i><span>Trade</span></button><button type="button" data-page="wallet"><i>↓</i><span>Deposit</span></button><button type="button" data-page="wallet"><i>↗</i><span>Withdraw</span></button><button type="button" data-bb-more="'+index+'"><i>⋮</i><span>More</span></button>';
   card.append(actions);
  });
 }
 function syncUser(){
  const email=window.__bbUserEmail||'';
  const node=$('.bb-user-email');if(node&&email)node.textContent=email.replace(/^(.{1}).*(@.*)$/, '$1••••$2');
 }
 function handleClick(e){
  const t=e.target.closest('[data-bb-drawer-toggle],[data-bb-drawer-close],[data-bb-accordion],[data-bb-open-account],[data-account-mode],[data-notification-toggle],[data-bb-more]')||(e.target.classList?.contains('bb-drawer-backdrop')?e.target:null);
  if(!t)return;
  const sidebar=$('.client-sidebar'),backdrop=$('.bb-drawer-backdrop');
  if(t.hasAttribute('data-bb-drawer-toggle')){sidebar?.classList.add('bb-drawer-open');backdrop?.classList.add('is-open');}
  if(t.hasAttribute('data-bb-drawer-close')||e.target===backdrop){sidebar?.classList.remove('bb-drawer-open');backdrop?.classList.remove('is-open');}
  if(t.hasAttribute('data-bb-accordion')){const id=t.dataset.bbAccordion,sub=$('[data-bb-submenu="'+id+'"]');const open=t.getAttribute('aria-expanded')==='true';t.setAttribute('aria-expanded',String(!open));if(sub)sub.hidden=open;}
  if(t.hasAttribute('data-bb-open-account')){$('.account-request-panel')?.classList.toggle('bb-open');$('.account-request-panel')?.scrollIntoView({behavior:'smooth',block:'start'});}
  if(t.hasAttribute('data-account-mode')){setTimeout(()=>{const mode=t.dataset.accountMode;const real=$('[data-account-mode="real"]');const demo=$('[data-account-mode="demo"]');real?.classList.toggle('active',mode==='real');demo?.classList.toggle('active',mode==='demo');},0);}
  if(t.hasAttribute('data-notification-toggle')){const panel=$('#client-notification-panel');if(panel)panel.hidden=!panel.hidden;}
  if(t.hasAttribute('data-bb-more')){const card=t.closest('.bb-account-card');let menu=card?.querySelector('.bb-more-menu');if(!menu&&card){menu=document.createElement('div');menu.className='bb-more-menu';menu.innerHTML='<button type="button" data-page="portfolio">Performance</button><button type="button" data-page="orders">History of orders</button><button type="button" data-page="wallet">Transfer</button>';card.append(menu);}else if(menu)menu.remove();}
 }
 function handlePageClick(e){
  const link=e.target.closest('.bb-submenu [data-page],.bb-menu-main[data-page],.bb-brand[data-page]');
  if(link){$('.client-sidebar')?.classList.remove('bb-drawer-open');$('.bb-drawer-backdrop')?.classList.remove('is-open');}
 }
 function observe(){
  const shell=$('#app-shell');if(!shell)return;
  new MutationObserver(()=>{const t=$('.terminal',shell);if(t&&t.dataset.bbEnhanced!=='yes'){enhancedTerminal=null;enhance();syncUser();if($('.terminal-page-head h2')?.textContent.trim()==='Dashboard'){const b=$('.bb-menu-main[data-page="accounts"]');if(b)b.click();}}else if(t&&activePageName()==='accounts'){decorateAccounts();decorateAccountCards();}}).observe(shell,{childList:true,subtree:true});
  document.addEventListener('click',handleClick);
  document.addEventListener('click',handlePageClick,true);
  document.addEventListener('click',e=>{if(e.target.closest('.bb-drawer-backdrop'))handleClick(e);});
  document.addEventListener('change',e=>{if(e.target.matches('.bb-sort-select')){const host=$('#my-trading-accounts');if(!host)return;const cards=$$(':scope > *',host);const ordered=e.target.value==='name'?cards.sort((a,b)=>a.textContent.localeCompare(b.textContent)):e.target.value==='oldest'?cards.reverse():cards;ordered.forEach(x=>host.append(x));}});
  const obs=new MutationObserver(()=>{syncUser();if(activePageName()==='accounts')decorateAccountCards();});obs.observe(document.body,{childList:true,subtree:true});
  const t=$('.terminal','#app-shell');if(t){enhance();if($('.terminal-page-head h2')?.textContent.trim()==='Dashboard'){$('.bb-menu-main[data-page="accounts"]')?.click();}}
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',observe);else observe();
 window.addEventListener('resize',()=>{const s=$('.client-sidebar');if(s&&window.matchMedia('(min-width:901px)').matches){s.classList.remove('bb-drawer-open');$('.bb-drawer-backdrop')?.classList.remove('is-open');}});
})();
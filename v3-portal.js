(function () {
  "use strict";
  const $ = (s, root=document) => root.querySelector(s);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const icon = (name) => {
    const paths = {
      menu:"M4 6h16M4 12h16M4 18h16", close:"M6 6l12 12M18 6 6 18", bell:"M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4",
      user:"M20 21a8 8 0 0 0-16 0M12 12a4 4 0 1 0 0-8", wallet:"M3 6h18v14H3zM3 9h18M16 14h2",
      chart:"M4 19V5M4 19h17M7 15l4-5 3 3 6-8", history:"M3 12a9 9 0 1 0 3-6.7M3 4v5h5M12 7v5l4 2",
      terminal:"M4 5h16v14H4zM7 9l3 3-3 3M12 15h4", card:"M3 5h18v14H3zM3 10h18",
      gift:"M3 9h18v12H3zM2 5h20v4H2zM12 5v16M12 5H7a2 2 0 1 1 2-2c0 2 3 2 3 2zm0 0h5a2 2 0 1 0-2-2c0 2-3 2-3 2z",
      help:"M12 18h.01M9.1 9a3 3 0 1 1 5.8 1c-.9 1.4-2.9 1.7-2.9 3.5M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20",
      settings:"M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M19 12h2M3 12h2M12 3v2M12 19v2",
      partner:"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8M20 8v6M17 11h6",
      news:"M4 4h16v16H4zM8 8h8M8 12h8M8 16h5", calendar:"M4 5h16v16H4zM8 3v4M16 3v4M4 9h16"
    };
    return '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="'+(paths[name]||paths.chart)+'"/></svg>';
  };
  const nav = [
    {title:"Trading",items:[["accounts","My Accounts","Accounts"],["portfolio","Performance","Performance"],["orders","History of orders","History"],["terminal","BIGBULLS Terminal","Terminal"]]},
    {title:"Payments & Wallet",items:[["wallet","Deposit","Deposit"],["wallet","Withdrawal","Withdrawal"],["wallet","Transfer","Transfer"],["wallet","Transaction history","History"],["wallet","Funding wallet","Wallet"],["wallet","Crypto wallet","Crypto"]]},
    {title:"Analytics",items:[["signals","Trading signals","Signals"],["economic-calendar","News","News"],["economic-calendar","Economic Calendar","Calendar"],["market-analysis","Market analysis","Analysis"]]},
    {title:"BIGBULLS Benefits",items:[["services","Trading Conditions","Conditions"],["services","Savings","Savings"]]},
    {title:"Partner",items:[["partner","IB Program","Partner"]]}
  ];
  function pageLabel() {
    const title = $(".terminal-page-head h2")?.textContent?.trim();
    return title === "Trading Accounts" ? "My Accounts" : (title || "My Accounts");
  }
  async function membershipMarkup() {
    const sb = window.__bbSupabaseClient, userId = window.__bbUserId;
    let row = null;
    if (sb && userId) {
      const result = await sb.from("bb_client_memberships")
        .select("level_name,points_balance,points_unit,next_level_name,next_level_threshold")
        .eq("user_id", userId).maybeSingle();
      if (result.error) console.warn("Membership details unavailable:", result.error.message);
      row = result.data || null;
    }
    if (!row) return '<section class="bb-bronze-card"><div class="bb-bronze-top"><h3>Membership</h3><b>Pending</b></div><p>Your client tier will appear here when available</p></section>';
    const points = Number(row.points_balance || 0), threshold = Number(row.next_level_threshold || 0);
    const pct = threshold > 0 ? Math.max(0, Math.min(100, points / threshold * 100)) : 0;
    return '<section class="bb-bronze-card"><div class="bb-bronze-top"><h3>'+esc(row.level_name||"Member")+'</h3><b>CLIENT TIER</b></div><p>BIGBULLS membership benefits</p><div class="bb-progress-text"><span>'+esc(points.toLocaleString())+' '+esc(row.points_unit||"points")+'</span><span>Next: '+esc(row.next_level_name||"—")+'</span></div><div class="bb-progress-track"><i style="width:'+pct.toFixed(1)+'%"></i></div><small class="bb-tier-threshold">'+(threshold>0?esc(Math.max(0,threshold-points).toLocaleString())+" points to next level":"Membership level active")+'</small></section>';
  }
  function menuMarkup() {
    return nav.map((group,i)=>'<section class="bb-nav-group"><button class="bb-nav-main" type="button" data-v3-toggle="'+i+'" aria-expanded="false"><span class="bb-nav-ico">'+icon(i===0?"chart":i===1?"wallet":i===2?"news":i===3?"gift":"partner")+'</span>'+group.title+icon("calendar")+'</button><div class="bb-nav-sub" data-v3-sub="'+i+'" hidden>'+group.items.map(([route,label])=>'<button class="bb-sub-link" type="button" data-page="'+route+'">'+label+'</button>').join("")+'</div></section>').join("");
  }
  async function enhance() {
    const shell=$("#app-shell"), terminal=$(".terminal",shell);
    if (!shell || !terminal || terminal.dataset.bbReference==="yes") return;
    terminal.dataset.bbReference="yes";
    const oldHead=$(".terminal-head",terminal), layout=$(".terminal-layout",terminal), oldSidebar=$(".client-sidebar",layout), main=$(".terminal-main",layout);
    if (!layout || !main) return;
    const name=window.__bbUserName || "Client";
    const email=window.__bbUserEmail || "";
    const admin=typeof window.__bbIsAdmin==="function" && window.__bbIsAdmin();
    const initials=(name.trim().charAt(0)||"C").toUpperCase();
    if(oldHead) oldHead.outerHTML='<header class="terminal-head bb-v3-head"><div class="bb-top-left"><button type="button" class="bb-hamburger" data-v3-drawer-open aria-label="Open menu">'+icon("menu")+'</button></div><a class="bb-top-brand" href="#" data-page="accounts">BIGBULLS <span>GLOBAL MARKET</span></a><div class="bb-top-actions"><span class="bb-header-balance"><small>WALLET</small><b id="header-wallet-balance">—</b></span><button class="bb-bell" type="button" data-notification-toggle aria-label="Notifications">'+icon("bell")+'</button><button class="bb-profile-chip" type="button" data-profile-toggle aria-label="Profile"><span>'+esc(initials)+'</span></button><div class="header-popover" id="client-notification-panel" hidden><b>Notification Centre</b><p>Loading notifications…</p></div><div class="header-popover profile-menu" id="client-profile-menu" hidden><button type="button" data-page="profile">Profile details</button><button type="button" data-page="settings">Settings & security</button><button type="button" data-page="verification">KYC verification</button><button type="button" data-action="logout">Log out</button></div></div></header>';
    if(oldSidebar) oldSidebar.outerHTML='<aside class="client-sidebar bb-v3-drawer" aria-label="Client navigation"><div class="bb-drawer-head"><span>BIGBULLS <b>GLOBAL MARKET</b></span><button class="bb-close" type="button" data-v3-drawer-close aria-label="Close menu">'+icon("close")+'</button></div><div class="bb-drawer-scroll"><div id="bb-membership-slot">'+await membershipMarkup()+'</div><button class="bb-identity" type="button" data-page="profile"><span class="bb-user-icon">'+icon("user")+'</span><span><b>'+esc(name)+'</b><small>'+esc(email)+'</small></span>'+icon("calendar")+'</button><button class="bb-wallet-quick" type="button" data-page="wallet"><span>'+icon("wallet")+' <b>Wallet balance</b></span><b id="bb-wallet-drawer-balance">View</b></button><nav class="bb-reference-nav" aria-label="Client portal navigation">'+menuMarkup()+'<div class="bb-nav-separator"></div><button class="bb-nav-direct" type="button" data-page="support">'+icon("help")+' Support hub</button><button class="bb-nav-direct" type="button" data-page="settings">'+icon("settings")+' Settings</button><button class="bb-nav-direct" type="button" data-page="support">'+icon("help")+' Live Chat / Help</button><button class="bb-nav-direct" type="button" data-page="services">'+icon("gift")+' BIGBULLS Products</button>'+(admin?'<div class="bb-nav-separator"></div><section class="bb-nav-group bb-admin-group"><button class="bb-nav-main" type="button" data-v3-toggle="admin-tools" aria-expanded="true"><span class="bb-nav-ico">'+icon("settings")+'</span>Admin Workspace'+icon("calendar")+'</button><div class="bb-nav-sub" data-v3-sub="admin-tools"><button class="bb-sub-link bb-admin-link" type="button" data-page="admin">Admin Panel · Client & Operations</button><button class="bb-sub-link" type="button" data-page="seo">SEO & Growth AI · Website Control</button></div></section>':'')+'</nav><div class="bb-referral-card"><b>Invite & earn with BIGBULLS</b><p>Open your IB partner area to manage referrals and commissions.</p><button type="button" data-page="partner">Explore IB Program</button></div></div><button class="sidebar-logout bb-drawer-logout" type="button" data-action="logout">Sign out</button></aside>';
    let backdrop=$(".bb-drawer-backdrop",terminal);
    if(!backdrop){backdrop=document.createElement("button");backdrop.type="button";backdrop.className="bb-drawer-backdrop";backdrop.setAttribute("aria-label","Close navigation");backdrop.dataset.v3DrawerClose="";layout.prepend(backdrop);}
    const pageHead=$(".terminal-page-head",main);
    if(pageHead){
      pageHead.classList.add("bb-v3-page-head");
      pageHead.innerHTML='<div><small>BIGBULLS FX MARKET / CLIENT PORTAL</small><h2>'+esc(pageLabel())+'</h2></div><button type="button" class="bb-open-account" data-account-wizard>Open Account</button>';
      const syncAccountButton=()=>{
        const label=(pageHead.querySelector("h2")?.textContent||"").trim().toLowerCase();
        const visible=["my accounts","trading accounts","accounts"].includes(label);
        const button=pageHead.querySelector("[data-account-wizard]");
        if(button) button.style.display=visible?"":"none";
      };
      syncAccountButton();
      if(!pageHead.dataset.bbAccountButtonObserver){
        pageHead.dataset.bbAccountButtonObserver="1";
        new MutationObserver(syncAccountButton).observe(pageHead,{subtree:true,childList:true,characterData:true});
      }
    }
    if(!$("#bb-v3-meta",main)){const meta=document.createElement("div");meta.id="bb-v3-meta";meta.className="bb-v3-meta";meta.textContent="Your account activity and available services are shown from your secure client profile.";main.insertBefore(meta,$("#client-page",main));}
    const drawer=$(".client-sidebar",layout);
    const open=()=>{drawer?.classList.add("bb-drawer-open");backdrop?.classList.add("is-open");document.body.classList.add("bb-drawer-active");};
    const close=()=>{drawer?.classList.remove("bb-drawer-open");backdrop?.classList.remove("is-open");document.body.classList.remove("bb-drawer-active");};
    if(!terminal.dataset.bbV3Events){
      terminal.dataset.bbV3Events="1";
      terminal.addEventListener("click",e=>{
        const target=e.target instanceof Element?e.target:null;if(!target)return;
        if(target.closest("[data-v3-drawer-open]")){open();return;}
        if(target.closest("[data-v3-drawer-close]")){close();return;}
        const toggle=target.closest("[data-v3-toggle]");
        if(toggle){const id=toggle.dataset.v3Toggle,sub=$('[data-v3-sub="'+id+'"]',terminal),wasOpen=sub&&!sub.hidden;terminal.querySelectorAll("[data-v3-sub]").forEach(x=>x.hidden=true);terminal.querySelectorAll("[data-v3-toggle]").forEach(x=>x.setAttribute("aria-expanded","false"));if(sub&&!wasOpen){sub.hidden=false;toggle.setAttribute("aria-expanded","true");}return;}
        if(target.closest("[data-page]"))close();
      });
      document.addEventListener("keydown",e=>{if(e.key==="Escape")close();});
    }
    const sb=window.__bbSupabaseClient;
    if(sb&&window.__bbUserId){
      const {data,error}=await sb.from("trading_accounts").select("balance,status").eq("user_id",window.__bbUserId).is("archived_at",null).is("deleted_at",null);
      if(!error){const total=(data||[]).filter(x=>x.status==="approved").reduce((s,x)=>s+Number(x.balance||0),0);const value="$"+total.toFixed(2);const node=$("#bb-wallet-drawer-balance");if(node)node.textContent=value;}
    }
    document.body.classList.add("bb-v3-active");
  }
  window.__bbEnhanceClientPortal=enhance;
})();
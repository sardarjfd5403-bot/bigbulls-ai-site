(function(){
  "use strict";
  const SUPABASE_URL="https://ztiiyulusburxjkpcfxu.supabase.co";
  const SUPABASE_KEY="sb_publishable_5hDwqvbcUHeSJdXFHf9ugw_VPYGN4J_";
  const frame=document.getElementById("surface");
  const welcome=document.getElementById("welcome");
  let current="";
  let client=null;
  function show(path){
    if(path===current)return;
    current=path;
    frame.src=path;
    frame.style.display="block";
    welcome.style.display="none";
  }
  function showWelcome(){
    current="";
    frame.style.display="none";
    frame.removeAttribute("src");
    welcome.style.display="flex";
  }
  function route(session){
    if(session&&session.user)show("./terminal.html");
    else showWelcome();
  }
  window.bbOpenAuth=function(mode){
    const target=mode==="signup"?"signup":"login";
    show("../index.html?from=bigbullsglobal-android&auth="+target);
  };
  function start(){
    if(!window.supabase||!window.supabase.createClient){
      console.error("Supabase JS did not load; welcome screen remains available.");
      return;
    }
    client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{
      auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
    });
    client.auth.onAuthStateChange((_event,session)=>route(session));
    client.auth.getSession().then(({data,error})=>{
      if(error)throw error;
      route(data&&data.session);
    }).catch(error=>console.error("BigBull session check:",error));
    window.setInterval(async()=>{
      if(!client)return;
      try{const {data}=await client.auth.getSession();if(data&&data.session&&current!=="./terminal.html")route(data.session);}
      catch(_){}
    },1800);
  }
  showWelcome();
  if(window.supabase&&window.supabase.createClient)start();
  else window.addEventListener("load",start,{once:true});
})();
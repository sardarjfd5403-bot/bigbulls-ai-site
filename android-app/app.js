(function(){
  "use strict";
  const SUPABASE_URL="https://ztiiyulusburxjkpcfxu.supabase.co";
  const SUPABASE_KEY="sb_publishable_5hDwqvbcUHeSJdXFHf9ugw_VPYGN4J_";
  const frame=document.getElementById("surface");
  const boot=document.getElementById("boot");
  let current="";
  let client=null;
  function show(path){
    if(path===current)return;
    current=path;
    frame.src=path;
    boot.style.display="none";
  }
  function route(session){
    if(session&&session.user)show("./terminal.html");
    else show("../index.html?from=bigbullsglobal-android");
  }
  function start(){
    if(!window.supabase||!window.supabase.createClient){
      boot.innerHTML="<div class='mark'>B</div><div class='brand'>BigbullsGlobal</div><p>Secure connection could not load. Please check your internet and reopen the app.</p>";
      return;
    }
    client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{
      auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
    });
    client.auth.onAuthStateChange((_event,session)=>route(session));
    client.auth.getSession().then(({data,error})=>{
      if(error)throw error;
      route(data&&data.session);
    }).catch(error=>{
      console.error("BigbullsGlobal session check:",error);
      show("../index.html?from=bigbullsglobal-android");
    });
    window.setInterval(async()=>{
      if(!client)return;
      try{const {data}=await client.auth.getSession();const next=data&&data.session?"./terminal.html":"../index.html?from=bigbullsglobal-android";if(next!==current)show(next);}catch(_){}
    },1800);
  }
  if(window.supabase&&window.supabase.createClient)start();
  else window.addEventListener("load",start,{once:true});
})();
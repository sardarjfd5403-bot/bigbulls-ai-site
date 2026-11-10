(function(){
"use strict";
const URL="https://ztiiyulusburxjkpcfxu.supabase.co";
const KEY="sb_publishable_5hDwqvbcUHeSJdXFHf9ugw_VPYGN4J_";
let client=null,session=null;
function getSessionId(){
 try{let id=sessionStorage.getItem("bb_seo_session");if(!id){id=crypto.randomUUID();sessionStorage.setItem("bb_seo_session",id);}return id;}catch(_){return null;}
}
function host(value){try{return value?new URL(value).hostname:null;}catch(_){return null;}}
function send(eventName,element){
 if(!client)return;
 const p=new URLSearchParams(location.search);
 const row={event_name:eventName,path:location.pathname.slice(0,500)||"/",referrer_host:host(document.referrer),utm_source:p.get("utm_source"),utm_medium:p.get("utm_medium"),utm_campaign:p.get("utm_campaign"),element_id:element?(element.id||element.getAttribute("data-track")||element.getAttribute("aria-label")||String(element.textContent||"").trim().slice(0,100)||element.tagName.toLowerCase()):null,session_id:session};
 client.from("bb_site_events").insert(row).then(()=>{}).catch(()=>{});
}
function init(){
 if(!window.supabase||!window.supabase.createClient)return;
 client=window.supabase.createClient(URL,KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 session=getSessionId();send("page_view",null);
 document.addEventListener("click",function(e){
  const el=e.target&&e.target.closest?e.target.closest("a,button,[data-track]"):null;if(!el)return;
  const label=(el.getAttribute("data-open")||"")+" "+(el.getAttribute("data-track")||"")+" "+(el.id||"")+" "+(el.textContent||"");
  if(/signup|register|open account/i.test(label))send("signup",el);
  else if(/buy|purchase|checkout|deposit/i.test(label))send("conversion",el);
  else send("click",el);
 },{passive:true});
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
window.BBTrack={track:function(name,element){if(["page_view","click","signup","conversion"].includes(name))send(name,element||null);}};
})();
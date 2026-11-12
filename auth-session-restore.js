(()=>{"use strict";
const key=id=>"bb:client:last-page:"+String(id||"");
function restore(){
 const client=window.__bbSupabaseClient;if(!client?.auth)return;
 client.auth.getSession().then(({data,error})=>{
  if(error||!data?.session?.user)return;
  const id=data.session.user.id;let tries=0;
  const wait=()=>{
   if(window.__bbUserId===id){
    const shell=document.getElementById("app-shell");
    if(shell?.hidden){const open=document.querySelector('[data-app-open="dashboard"]');if(open)open.click()}
    return;
   }
   if(++tries<40)setTimeout(wait,100);
  };
  wait();
 }).catch(error=>console.warn("BIGBULLS session resume check failed:",error));
}
window.addEventListener("pageshow",restore);
document.addEventListener("DOMContentLoaded",restore);
setTimeout(restore,500);
})();
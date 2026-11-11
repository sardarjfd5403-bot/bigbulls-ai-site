// Supabase browser client. Publishable key is intended for browser use; never place service_role keys here.
const BB_SUPABASE_URL='https://ztiiyulusburxjkpcfxu.supabase.co';
const BB_SUPABASE_PUBLISHABLE_KEY='sb_publishable_5hDwqvbcUHeSJdXFHf9ugw_VPYGN4J_';
if(window.supabase?.createClient){window.bbSupabase=window.supabase.createClient(BB_SUPABASE_URL,BB_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});}

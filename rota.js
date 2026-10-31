(async function(){
 'use strict';
 const el=document.getElementById('rota-katalog'),C=window.SITE_CONFIG||{};
 try{
   const db=window.supabase.createClient(C.SUPABASE_URL,C.SUPABASE_ANON_KEY,{auth:{persistSession:false,detectSessionInUrl:false}});
   const {data,error}=await db.rpc('rota_katalogu');
   if(error)throw error;
   window.RotaKartlari.mount(el,{rows:data||[]});
 }catch(_){el.innerHTML='<div class="rk-empty"><h3>Rota şu an yüklenemedi.</h3><p>Biraz sonra tekrar deneyebilir veya <a href="./#harita">haritaya bakabilirsin.</a></p></div>';}
})();

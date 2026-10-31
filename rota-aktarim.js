/* Convert the user's portable master list to idempotent, private route records. */
(function(root){
  'use strict';
  const K=typeof module!=='undefined'&&module.exports?require('./rota-kartlari.js'):root.RotaKartlari;
  function plan(master, existing){
    if(!master||!Array.isArray(master.places)||master.places.length>5000)throw Error('Geçerli bir ana liste dosyası seç.');
    const labels=Object.fromEntries((master.category_catalog||[]).map(c=>[c.id,c.label]));
    const seen=new Set(),seenMaps=new Set();
    return master.places.map(p=>{
      if(!/^DNR-\d{4,}$/.test(p.id)||seen.has(p.id))throw Error('Eksik veya yinelenen mekân kayıt numarası var.');seen.add(p.id);
      if(typeof p.name!=='string'||p.name.trim().length<2||p.name.length>120)throw Error('Bir mekân adı eksik veya 120 karakterden uzun.');
      if(typeof p.city!=='string'||!p.city||p.city.length>40)throw Error('Bir mekânın şehri eksik veya çok uzun.');
      if(!K.url(p.google_maps_url))throw Error(p.name+': Google Maps bağlantısı eksik.');
      if(seenMaps.has(p.google_maps_url))throw Error(p.name+': aynı fiziksel şube listede iki kez bulunuyor.');seenMaps.add(p.google_maps_url);
      for(const [field,max] of [['list_reason',2000],['user_notes',4000]])if(p[field]!=null&&(typeof p[field]!=='string'||p[field].length>max))throw Error(p.name+': not alanı geçersiz veya çok uzun.');
      if(p.district!=null&&(typeof p.district!=='string'||p.district.length>60))throw Error(p.name+': ilçe alanı geçersiz.');
      if(p.country!=null&&(typeof p.country!=='string'||p.country.length>60))throw Error(p.name+': ülke alanı geçersiz.');
      if(p.google_rating!==null&&(typeof p.google_rating!=='number'||p.google_rating<1||p.google_rating>5))throw Error(p.name+': Google puanı geçersiz.');
      if(p.google_review_count!==null&&(!Number.isInteger(p.google_review_count)||p.google_review_count<0))throw Error(p.name+': yorum sayısı geçersiz.');
      const urls=new Set([p.google_maps_url,...(master.submissions||[]).filter(s=>s.place_id===p.id).map(s=>s.url)]);
      const matches=existing.filter(r=>r.plan_kayit_id===p.id||String(r.neden||'').includes('Liste kaydı: '+p.id+'.')||urls.has(r.adres)||urls.has(r.google_url));
      if(matches.length>1)throw Error(p.name+': birden fazla mevcut kayıt eşleşti; önce panelde birleştir.');
      const old=matches[0], checked=new Date(p.checked_at+'T00:00:00Z'), oldDate=old?new Date(old.google_puan_tarih||old.google_tarih||0):new Date(0);
      if(!Number.isFinite(+checked))throw Error(p.name+': kontrol tarihi geçersiz.');
      const fresh=checked>=oldDate, cats=K.cleanCategories((p.categories||[]).map(c=>labels[c]||c));
      const row={mekan_adi:p.name.trim(),il:p.country==='Türkiye'?p.city:'Yurt dışı',ilce:p.district||null,ulke:p.country==='Türkiye'?null:p.country||null,
        google_url:p.google_maps_url,google_ad:p.name,google_adres:p.address||null,
        plan_kayit_id:p.id,plan_kategorileri:old&&Array.isArray(old.plan_kategorileri)?old.plan_kategorileri:cats,
        plan_gerekcesi:old?.plan_gerekcesi??p.list_reason??'',yonetici_notu:old?.yonetici_notu??p.user_notes??'',
        plan_instagram:old?.plan_instagram??(K.url(p.instagram,true)||null),
        durum:old&&['gidildi','uygun_degil'].includes(old.durum)?old.durum:'listede',
        haritada_goster:old?old.haritada_goster:false};
      if(fresh){row.google_puan=p.google_rating;row.google_yorum=p.google_review_count;row.google_puan_tarih=checked.toISOString();}
      if(!old){Object.assign(row,{adres:urls.values().next().value,neden:'Çekim planlama listesinden. Liste kaydı: '+p.id+'.',kaynak:'liste',kvkk_onay:true,yayin_izni:false,onayli:false});}
      return {id:old?.id||null,name:p.name,city:p.city,district:p.district,row};
    });
  }
  const api={plan};if(typeof module!=='undefined'&&module.exports)module.exports=api;if(root)root.RotaAktarim=api;
})(typeof window==='undefined'?null:window);

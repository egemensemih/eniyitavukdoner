/* Shared route catalogue. Private fields are rendered only in editor mode. */
(function (root) {
  'use strict';
  const presets = ['Alman usulü', 'Eski usul / klasik', 'Hatay / Antakya usulü', 'Shawarma / şavurma', 'Adana usulü', 'Kilis usulü', 'Döner & bowl', 'Soslu döner', 'Zincir / çok şubeli', 'Diğer / menü teyidi'];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm = s => String(s ?? '').toLocaleLowerCase('tr-TR').normalize('NFC');
  const numeric = v => typeof v === 'number' && Number.isFinite(v);
  function score(r) {
    const p = r.google_puan, n = r.google_yorum;
    return numeric(p) && p >= 1 && p <= 5 && Number.isInteger(n) && n >= 0 ? Math.round((p*n+4.2*200)/(n+200)*1e6)/1e6 : null;
  }
  function cleanCategories(value) {
    const out = [], seen = new Set();
    for (const part of Array.isArray(value) ? value : String(value || '').split(',')) {
      if (typeof part !== 'string') continue;
      const s = part.trim().slice(0,60), key = norm(s);
      if (s && !seen.has(key)) { out.push(s); seen.add(key); }
      if (out.length === 12) break;
    }
    return out;
  }
  function categories(r) {
    if (Array.isArray(r.plan_kategorileri)) return cleanCategories(r.plan_kategorileri);
    const m = String(r.neden || '').match(/Kategori önerisi:\s*(.*?)\.\s*Konsept:/u);
    return m ? cleanCategories(m[1]) : [];
  }
  function url(value, instagramOnly = false) {
    try {
      const u = new URL(value);
      if (u.protocol !== 'https:' || u.username || u.password) return '';
      if (instagramOnly && (!['instagram.com','www.instagram.com'].includes(u.hostname) || !/^\/[A-Za-z0-9._]+\/?$/.test(u.pathname) || /^\/(p|reel|reels|stories|tv|explore|accounts)\/?$/i.test(u.pathname))) return '';
      return u.href;
    } catch (_) { return ''; }
  }
  function instagram(r) {
    return url(r.plan_instagram ?? (String(r.neden || '').match(/Instagram:\s*(https:\/\/(?:www\.)?instagram\.com\/[^\s]+)/i)?.[1] || ''), true);
  }
  function compare(a,b,sort='balanced') {
    const key = r => sort === 'priority' ? (numeric(r.rota_puani) ? r.rota_puani : -Infinity) : sort === 'rating' ? (numeric(r.google_puan) ? r.google_puan : -Infinity) : sort === 'reviews' ? (numeric(r.google_yorum) ? r.google_yorum : -Infinity) : (score(r) ?? -Infinity);
    const x = key(a), y = key(b);
    return (x === y ? 0 : x < y ? 1 : -1) || (b.google_yorum ?? -1)-(a.google_yorum ?? -1) || String(a.plan_kayit_id || a.id).localeCompare(String(b.plan_kayit_id || b.id),'en',{numeric:true});
  }
  function mount(el, options) {
    let rows = options.rows || [], active = '', busy = false, editing = null;
    const edit = typeof options.onSave === 'function';
    const current = new URL(location.href).searchParams;
    el.classList.add('rk-app');
    el.innerHTML = `<div class="rk-tools"><label><span>Mekân ara</span><input type="search" data-q placeholder="Mekân veya ilçe…" maxlength="120"></label><label><span>Şehir</span><select data-city><option value="">Tüm şehirler</option></select></label><label><span>Sıralama</span><select data-sort><option value="balanced">Puan + yorum dengesi</option><option value="rating">Google puanı</option><option value="reviews">Yorum sayısı</option>${edit?'<option value="priority">Kendi rota puanım</option>':''}</select></label></div><div class="rk-filters" aria-label="Kategoriler"></div><div class="rk-caption"><span data-count role="status" aria-live="polite"></span><div><button type="button" class="rk-text" data-share>Görünümü paylaş ↗</button>${edit?'<button type="button" class="rk-text" data-csv>CSV indir ↓</button>':''}</div></div><div class="rk-grid"></div><dialog class="rk-dialog"><form><div class="rk-dialog-head"><div><small>MEKÂN DOSYASI</small><h2 data-title></h2></div><button type="button" data-close aria-label="Kapat">×</button></div><label>Kategoriler <small>Birden fazla seçebilirsin.</small></label><div class="rk-choices"></div><label>Diğer kategoriler<input name="custom" placeholder="Virgülle ayır: Odun ateşi, Gece döneri…" maxlength="720"></label><label>Neden listemde?<textarea name="reason" rows="3" maxlength="2000" placeholder="Bu mekâna neden gitmek istiyorum?"></textarea></label><label>Notum<textarea name="note" rows="4" maxlength="4000" placeholder="Ustanın adı, denenecek ürün, çekim fikri…"></textarea></label><label>Instagram<input name="instagram" type="url" maxlength="200" placeholder="https://www.instagram.com/hesap/"></label><p class="rk-private">Gerekçen ve notun yalnız panelde görünür.</p><p class="rk-error" role="alert" data-error></p><div class="rk-dialog-foot"><button type="button" data-close>Vazgeç</button><button type="submit" data-save>Değişiklikleri kaydet</button></div></form></dialog>`;
    const find = s => el.querySelector(s), q = find('[data-q]'), city = find('[data-city]'), sort = find('[data-sort]'), grid = find('.rk-grid'), dialog = find('dialog'), form = find('form');
    q.value = (current.get('q') || '').slice(0,120); city.dataset.initial = current.get('sehir') || ''; active = current.get('kategori') || '';
    if ([...sort.options].some(o=>o.value===current.get('sira'))) sort.value = current.get('sira');
    function filterOptions() {
      const selected = city.value || city.dataset.initial; delete city.dataset.initial;
      const cities = [...new Set(rows.map(r=>r.il === 'Yurt dışı' ? r.ulke : r.il).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'tr'));
      city.innerHTML = '<option value="">Tüm şehirler</option>'+cities.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
      city.value = cities.includes(selected) ? selected : '';
    }
    function filtered() {
      return rows.filter(r=>(!city.value || (r.il==='Yurt dışı'?r.ulke:r.il)===city.value) && (!active || categories(r).includes(active)) && (!q.value.trim() || norm([r.google_ad||r.mekan_adi,r.il,r.ilce,r.ulke].join(' ')).includes(norm(q.value.trim())))).sort((a,b)=>compare(a,b,sort.value));
    }
    function draw() {
      const labels = [...new Set([...presets,...rows.flatMap(categories)])].filter(c=>rows.some(r=>categories(r).includes(c)));
      if (active && !labels.includes(active)) active = '';
      find('.rk-filters').innerHTML = ['',...labels].map(c=>`<button type="button" data-cat="${esc(c)}" aria-pressed="${active===c}">${esc(c||'Tümü')}<span>${c?rows.filter(r=>categories(r).includes(c)).length:rows.length}</span></button>`).join('');
      const visible = filtered();
      find('[data-count]').textContent = `${visible.length} / ${rows.length} mekân`;
      grid.innerHTML = visible.length ? visible.map((r,i)=>{
        const name=r.google_ad||r.mekan_adi, cats=categories(r), sc=score(r), ig=instagram(r), maps=url(r.google_url||r.adres), inferred=!Array.isArray(r.plan_kategorileri)&&cats.length;
        const privateNote=edit&&(r.plan_gerekcesi||r.yonetici_notu);
        return `<article class="rk-card"><div class="rk-card-top"><span class="rk-number">${String(i+1).padStart(2,'0')}</span><span class="rk-loc">${esc([r.ilce,r.il==='Yurt dışı'?r.ulke:r.il].filter(Boolean).join(' · '))}</span>${edit?`<button type="button" data-edit="${esc(r.id)}" aria-label="${esc(name)} kaydını düzenle">Düzenle ↗</button>`:''}</div><h3>${esc(name)}</h3><div class="rk-tags">${cats.map(c=>`<span>${esc(c)}</span>`).join('')||'<span class="rk-untagged">Kategori seçilmedi</span>'}${inferred&&edit?'<small>öneri</small>':''}</div><div class="rk-rating"><div><span class="rk-star" aria-hidden="true">★</span><strong>${numeric(r.google_puan)?r.google_puan.toLocaleString('tr-TR',{minimumFractionDigits:1,maximumFractionDigits:1}):'—'}</strong><span>/ 5</span></div><div><b>${Number.isInteger(r.google_yorum)?r.google_yorum.toLocaleString('tr-TR'):'—'}</b><span>Google yorumu</span></div><div><b>${sc===null?'—':sc.toLocaleString('tr-TR',{minimumFractionDigits:3,maximumFractionDigits:3})}</b><span>Dengeli puan</span></div></div>${privateNote?`<div class="rk-note">${r.plan_gerekcesi?`<small>NEDEN LİSTEMDE?</small><p>${esc(r.plan_gerekcesi)}</p>`:''}${r.yonetici_notu?`<small>NOTUM</small><p>${esc(r.yonetici_notu)}</p>`:''}</div>`:edit?'<div class="rk-note rk-note-empty">Bir not ekle; bu mekânın neden listende olduğunu hatırla.</div>':''}<div class="rk-card-foot">${maps?`<a href="${esc(maps)}" target="_blank" rel="noopener noreferrer">Google Maps ↗</a>`:'<span>Harita bağlantısı bekleniyor</span>'}${ig?`<a href="${esc(ig)}" target="_blank" rel="noopener noreferrer">Instagram ↗</a>`:'<span>Instagram teyit bekliyor</span>'}</div>${edit&&options.routeActions?`<div class="rk-route-actions"><button type="button" class="rk-text" data-rota="${esc(r.id)}">Rota ayarları</button><button type="button" class="rk-text" data-tomap2="${esc(r.id)}">Gidildi</button><button type="button" class="rk-text" data-cikar="${esc(r.id)}">Rotadan çıkar</button></div>`:''}${r.google_puan_tarih?`<small class="rk-date">Google kontrolü: ${esc(new Date(r.google_puan_tarih).toLocaleDateString('tr-TR'))}</small>`:''}</article>`;
      }).join('') : '<div class="rk-empty"><h3>Eşleşen mekân yok.</h3><p>Aramayı veya kategori seçimini değiştirebilirsin.</p></div>';
    }
    function openEditor(r) {
      editing=r;const cats=categories(r);find('[data-title]').textContent=r.google_ad||r.mekan_adi;
      find('.rk-choices').innerHTML=presets.map(c=>`<label><input type="checkbox" name="category" value="${esc(c)}"${cats.includes(c)?' checked':''}>${esc(c)}</label>`).join('');
      form.elements.custom.value=cats.filter(c=>!presets.includes(c)).join(', ');form.elements.reason.value=r.plan_gerekcesi||'';form.elements.note.value=r.yonetici_notu||'';form.elements.instagram.value=instagram(r);find('[data-error]').textContent='';dialog.showModal();
    }
    el.addEventListener('input',e=>{if(e.target===q||e.target===city||e.target===sort)draw();});
    el.addEventListener('click',async e=>{
      const cat=e.target.closest('[data-cat]'), b=e.target.closest('[data-edit]');
      if(cat){active=cat.dataset.cat;draw();}
      if(b&&edit)openEditor(rows.find(r=>String(r.id)===b.dataset.edit));
      if(e.target.closest('[data-close]')&&!busy)dialog.close();
      if(e.target.closest('[data-share]')){
        if(options.onShare){options.onShare(filtered());return;}
        const u=new URL(options.shareUrl||location.href);u.search='';u.hash='';if(q.value)u.searchParams.set('q',q.value);if(city.value)u.searchParams.set('sehir',city.value);if(active)u.searchParams.set('kategori',active);if(sort.value!=='balanced')u.searchParams.set('sira',sort.value);
        try{await navigator.clipboard.writeText(u.href);find('[data-count]').textContent='Görünüm bağlantısı kopyalandı.';}catch(_){find('[data-count]').textContent='Bağlantıyı adres çubuğundan kopyalayabilirsin.';}
      }
      if(e.target.closest('[data-csv]')&&edit){
        const matrix=[['Mekân','İlçe','Google puanı','Yorum sayısı','Google Maps','Instagram','Şehir','Ülke','Kategoriler','Neden listemde','Notum'],...filtered().map(r=>[r.google_ad||r.mekan_adi,r.ilce,r.google_puan,r.google_yorum,r.google_url||r.adres,instagram(r),r.il,r.ulke,categories(r).join('; '),r.plan_gerekcesi,r.yonetici_notu])];
        const csv='\uFEFF'+matrix.map(row=>row.map(v=>{let s=String(v??'');if(typeof v==='string'&&/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}).join(',')).join('\r\n');
        const a=document.createElement('a'),href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.href=href;a.download='doner-rotasi.csv';a.click();setTimeout(()=>URL.revokeObjectURL(href),1000);
      }
    });
    form.addEventListener('submit',async e=>{
      e.preventDefault();if(busy)return;
      const ig=form.elements.instagram.value.trim();if(ig&&!url(ig,true)){find('[data-error]').textContent='Geçerli bir Instagram profil bağlantısı yaz.';return;}
      const selected=[...form.querySelectorAll('[name=category]:checked')].map(x=>x.value),rawCustom=form.elements.custom.value.split(',').map(s=>s.trim()).filter(Boolean),custom=cleanCategories(rawCustom);
      if(rawCustom.some(s=>s.length>60)||new Set([...selected,...rawCustom].map(norm)).size>12){find('[data-error]').textContent='En fazla 12 kategori seç; her kategori 60 karakteri geçmesin.';return;}
      const change={plan_kategorileri:cleanCategories([...selected,...custom]),plan_gerekcesi:form.elements.reason.value.trim(),yonetici_notu:form.elements.note.value.trim(),plan_instagram:ig};
      busy=true;find('[data-save]').disabled=true;find('[data-save]').textContent='Kaydediliyor…';
      try{await options.onSave(editing.id,change);Object.assign(editing,change);draw();dialog.close();}catch(err){find('[data-error]').textContent=err.message||'Kaydedilemedi. Notların bu pencerede duruyor.';}
      finally{busy=false;find('[data-save]').disabled=false;find('[data-save]').textContent='Değişiklikleri kaydet';}
    });
    dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
    filterOptions();draw();
    return {visible(){return filtered();},all(){return rows;},update(next){rows=next;filterOptions();draw();}};
  }
  const api={presets,score,compare,categories,cleanCategories,instagram,url,mount};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.RotaKartlari=api;
})(typeof window==='undefined'?null:window);

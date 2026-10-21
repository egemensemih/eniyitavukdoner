/* eniyitavukdoner.com — Tahsin / Egemen değerlendirme paneli */
(function () {
  "use strict";
  if (window.top !== window.self) { document.documentElement.innerHTML = ""; return; }
  const C = window.SITE_CONFIG || {}, P = window.ETDP;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = P.esc, guvenli = P.guvenli, TR = "tr-TR";
  const SAYFA = document.body.dataset.kisi;
  const KISILER = C.KISILER || [{ k: "tahsin", ad: "Tahsin" }, { k: "egemen", ad: "Egemen" }];
  const KI = Math.max(0, KISILER.findIndex(k => k.k === SAYFA));
  const KISI = KISILER[KI] || { k: SAYFA, ad: SAYFA };
  const EGEMEN = SAYFA === "egemen";
  const KRITER = C.KRITERLER || [];
  const ILLER = Object.keys(window.ILCELER || {});
  const DURUM = { yeni: "Yeni", incelendi: "İncelendi", listede: "Rotada", gidildi: "Gidildi", uygun_degil: "Uygun değil" };
  const fP = p => { if (p == null || p === "") return "–"; const n = Math.round(Number(p) * 10) / 10; return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ","); };
  const fmtD = s => { try { return new Date(String(s).length === 10 ? s + "T12:00:00" : s).toLocaleDateString(TR, { day: "numeric", month: "long", year: "numeric" }); } catch (e) { return ""; } };
  const anahtar = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase(TR).replace(/[^a-z0-9]/g, "");
  const eslesen = (list, ad) => { const k = anahtar(ad); return k ? list.find(x => anahtar(x) === k) || null : null; };
  const temizAd = s => String(s || "").replace(/̇/g, "").normalize("NFC");
  const yerYazi = m => [m.ilce, m.il === "Yurt dışı" ? m.ulke : m.il].filter(Boolean).join(", ");
  const mapsLink = m => guvenli(m.maps_url) || "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent([m.ad, m.ilce, m.il].filter(Boolean).join(" "));
  const ls = { get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* gizli mod */ } }, del(k) { try { localStorage.removeItem(k); } catch (e) { /* */ } } };

  // Davet / şifre sıfırlama bağlantısı: istemci oluşmadan önce okunur
  const H = new URLSearchParams(location.hash.replace(/^#/, ""));
  let HASH_TIP = H.get("type"), HASH_HATA = H.get("error_description");
  const db = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, storageKey: "etd-ekip", detectSessionInUrl: true, flowType: "implicit" } });

  /* ---------- küçük yardımcılar ---------- */
  function toast(msg) {
    let t = $(".toast"); if (!t) { t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
    t.textContent = msg; t.classList.add("show"); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 3200);
  }
  const modal = $("#modal");
  function onay(msg, ok = "Sil") {
    return new Promise(res => {
      $("#modal-title").textContent = "Emin misin?";
      $("#modal-body").innerHTML = `<p style="margin-bottom:22px;line-height:1.55">${esc(msg)}</p><div class="m-foot"><button class="btn btn-line btn-sm" data-no>Vazgeç</button><button class="btn btn-danger btn-sm" data-yes>${esc(ok)}</button></div>`;
      modal.hidden = false; $("[data-yes]", modal).focus();
      const kapat = v => { modal.hidden = true; $("#modal-body").innerHTML = ""; modal.onclick = null; res(v); };
      modal.onclick = e => { if (e.target.closest("[data-yes]")) kapat(true); else if (e.target.closest("[data-no],[data-close]")) kapat(false); };
    });
  }
  addEventListener("keydown", e => { if (e.key === "Escape" && !modal.hidden) { const n = $("[data-no]", modal); if (n) n.click(); } });
  function mesaj(f, t, ok) { const m = $(".form-msg", f); m.textContent = t || ""; m.className = "form-msg" + (t && !ok ? " err" : ""); m.style.color = ok ? "var(--ok)" : ""; }
  async function fn(islem, body) {
    try {
      const { data, error } = await db.functions.invoke("google-mekan", { body: { islem, ...body } });
      if (error) { let m = "Google bağlantısı kurulamadı."; try { const j = await error.context.json(); if (j && j.error) m = j.error; } catch (e) { /* */ } return { error: m }; }
      return data || {};
    } catch (e) { return { error: "Bağlantı hatası." }; }
  }

  /* ---------- giriş ---------- */
  const lf = $("#login-form"), npf = $("#newpass-form");
  const ekran = ad => { $("#login").hidden = ad !== "login"; $("#app").hidden = ad !== "app"; };
  lf.addEventListener("submit", async e => {
    e.preventDefault(); const b = $("button[type=submit]", lf);
    if (!lf.email.value.trim() || !lf.password.value) return mesaj(lf, "E-posta ve şifreni yaz.");
    b.disabled = true; mesaj(lf, "");
    const { error } = await db.auth.signInWithPassword({ email: lf.email.value.trim(), password: lf.password.value });
    b.disabled = false;
    if (error) return mesaj(lf, /rate|many/i.test(error.message) ? "Çok fazla deneme yapıldı, birkaç dakika sonra tekrar dene." : "E-posta ya da şifre hatalı.");
    lf.password.value = ""; basla();
  });
  $("#forgot").addEventListener("click", async () => {
    const email = lf.email.value.trim(); if (!email) { lf.email.focus(); return mesaj(lf, "Önce e-posta adresini yaz."); }
    const { error } = await db.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    mesaj(lf, error ? "Şu an gönderilemedi, biraz sonra dene." : "Hesap varsa şifre sıfırlama bağlantısı e-postana gönderildi.", !error);
  });
  function sifreEkrani(baslik) {
    ekran("login"); lf.hidden = true; npf.hidden = false;
    $("#np-title").textContent = baslik; npf.password.focus();
  }
  npf.addEventListener("submit", async e => {
    e.preventDefault();
    const p = npf.password.value, p2 = npf.password2.value;
    if (p.length < 10) return mesaj(npf, "Şifre en az 10 karakter olmalı.");
    if (p !== p2) return mesaj(npf, "İki şifre aynı değil.");
    const b = $("button[type=submit]", npf); b.disabled = true;
    const { error } = await db.auth.updateUser({ password: p });
    b.disabled = false;
    if (error) return mesaj(npf, /same|different/i.test(error.message) ? "Yeni şifre eskisinden farklı olmalı." : /weak|short|pwned|leak/i.test(error.message) ? "Bu şifre zayıf, daha güçlü bir şifre seç." : "Kaydedilemedi: " + error.message);
    npf.reset(); npf.hidden = true; lf.hidden = false; toast("Şifren kaydedildi"); basla();
  });
  db.auth.onAuthStateChange(ev => { if (ev === "PASSWORD_RECOVERY") sifreEkrani("Yeni şifreni belirle"); });
  $("#logout").addEventListener("click", async () => { if (kirli && !(await onay("Kaydedilmemiş değişikliklerin var. Yine de çıkılsın mı?", "Çık"))) return; kirli = false; await db.auth.signOut(); location.replace(location.pathname); });

  /* ---------- veri ---------- */
  const D = { mekan: [], deg: new Map(), oneri: [] };
  let kirli = false;
  addEventListener("beforeunload", e => { if (kirli) { e.preventDefault(); e.returnValue = ""; } });

  async function basla() {
    const { data: { session } } = await db.auth.getSession();
    if (HASH_HATA) { HASH_HATA = null; history.replaceState(null, "", location.pathname); ekran("login"); return mesaj(lf, /expired|invalid/i.test(HASH_HATA) ? "Bağlantının süresi dolmuş. “Şifremi unuttum” ile yenisini iste." : "Bağlantı geçersiz."); }
    if (!session) { ekran("login"); return; }
    const { data: rol, error } = await db.rpc("kisi_rol");
    if (error) { ekran("login"); return mesaj(lf, "Bağlantı sorunu, sayfayı yenile."); }
    if (!rol) {
      const { data: adm } = await db.rpc("is_admin");
      await db.auth.signOut(); ekran("login");
      return mesaj(lf, adm ? "Bu bir yönetici hesabı. Yönetim paneline /panel.html adresinden gir." : "Bu hesabın değerlendirme paneli yetkisi yok.");
    }
    if (rol !== SAYFA) { location.replace(`/panel/${encodeURIComponent(rol)}/${location.hash}`); return; }
    if (HASH_TIP === "invite" || HASH_TIP === "recovery") {
      const tip = HASH_TIP; HASH_TIP = null;
      history.replaceState(null, "", location.pathname);
      return sifreEkrani(tip === "invite" ? `Hoş geldin ${KISI.ad}! Şifreni belirle` : "Yeni şifreni belirle");
    }
    if (/access_token|refresh_token/.test(location.hash)) history.replaceState(null, "", location.pathname);
    ekran("app"); $("#me-mail").textContent = session.user.email;
    await yukle(); yonlendir();
  }

  async function yukle() {
    $("#ek-liste").innerHTML = `<div class="ek-yuk"><span class="lc-spin" aria-hidden="true"></span>Yükleniyor…</div>`;
    const [m, d, o] = await Promise.all([
      db.from("mekanlar").select("id,ad,il,ilce,ulke,adres,lat,lng,maps_url,google_place_id,ziyaret_tarihi,degerlendirme_acik,yayinda,puan_notu,aciklama,instagram,etiketler,bolum_url,created_at").order("created_at", { ascending: false }),
      db.from("degerlendirmeler").select("mekan_id,puanlar,yorum,toplam,updated_at").eq("kisi", SAYFA),
      db.from("mekan_onerileri").select("id,mekan_adi,il,ilce,ulke,durum,created_at,google_place_id").eq("kaynak", SAYFA).order("created_at", { ascending: false }),
    ]);
    if (m.error) { $("#ek-liste").innerHTML = `<div class="empty">Mekânlar alınamadı. Sayfayı yenile.</div>`; return; }
    D.mekan = m.data || []; D.deg = new Map((d.data || []).map(x => [x.mekan_id, x])); D.oneri = o.data || [];
    listeCiz(); onerilerCiz();
  }

  /* ---------- yönlendirme: #m/12 düzenleyici, #ekle ---------- */
  function yonlendir() {
    const h = location.hash.slice(1);
    const mm = h.match(/^m\/(\d+)$/);
    sekme(h === "ekle" ? "ekle" : "deg");
    if (mm) { const mk = D.mekan.find(x => x.id === +mm[1]); if (mk) return duzenle(mk); toast("Bu mekân sana atanmamış."); }
    $("#ek-duz").hidden = true; $("#ek-liste").hidden = false; $("#ek-ust").hidden = false;
  }
  addEventListener("hashchange", async () => {
    if (kirli && !location.hash.startsWith("#m/")) {
      if (!(await onay("Kaydedilmemiş değişikliklerin var. Kaydetmeden çıkılsın mı?", "Kaydetmeden çık"))) { history.pushState(null, "", "#m/" + AKTIF); return; }
      kirli = false;
    }
    if (!$("#app").hidden) yonlendir();
  });
  function sekme(t) {
    $$("#ek-sekme [data-s]").forEach(b => b.setAttribute("aria-selected", String(b.dataset.s === t)));
    $$("[data-pane]").forEach(p => p.hidden = p.dataset.pane !== t);
  }
  $("#ek-sekme").addEventListener("click", e => { const b = e.target.closest("[data-s]"); if (!b) return; location.hash = b.dataset.s === "ekle" ? "ekle" : ""; if (b.dataset.s !== "ekle" && !location.hash) yonlendir(); });

  /* ---------- liste ---------- */
  function durumOf(m) {
    const d = D.deg.get(m.id), n = d && d.puanlar ? Object.keys(d.puanlar).length : 0;
    if (!m.degerlendirme_acik) return { k: "kapali", t: d && d.toplam != null ? "Kapandı" : "Kapandı · puan yok", bitti: true };
    if (d && n >= KRITER.length && d.yorum) return { k: "tamam", t: "Tamamlandı", bitti: true };
    if (d && n > 0) return { k: "yarim", t: `Yarım · ${n}/${KRITER.length}${d.yorum ? "" : " · yorum yok"}`, bitti: false };
    if (d && d.yorum) return { k: "yarim", t: "Sadece yorum", bitti: false };
    return { k: "bekliyor", t: "Puanlanmadı", bitti: false };
  }
  function kart(m) {
    const d = D.deg.get(m.id), s = durumOf(m);
    return `<a class="ek-kart" href="#m/${m.id}">
      <span class="ek-k-sol"><span class="ek-rozet r-${s.k}">${esc(s.t)}</span><b>${esc(m.ad)}</b><small>${esc(yerYazi(m))}${m.ziyaret_tarihi ? " · " + esc(fmtD(m.ziyaret_tarihi)) : ""}</small></span>
      <span class="ek-k-puan${d && d.toplam != null ? "" : " bos"}"><b>${fP(d && d.toplam)}</b><small>/100</small></span>
      <span class="ek-ok" aria-hidden="true">›</span></a>`;
  }
  function listeCiz() {
    const bek = D.mekan.filter(m => !durumOf(m).bitti), bit = D.mekan.filter(m => durumOf(m).bitti);
    $("#cnt-deg").textContent = bek.length || "";
    $("#ek-liste").innerHTML = !D.mekan.length
      ? `<div class="ek-bos"><div class="ek-bos-i" aria-hidden="true">🍗</div><h3>Henüz atanmış mekân yok</h3><p>Yönetici bir mekânı “Gidildi” olarak işaretleyip sana atadığında burada görünür ve puanlamaya açılır.</p><a class="btn btn-o btn-sm" href="#ekle">Rotaya mekân ekle</a></div>`
      : (bek.length ? `<h3 class="ek-bas">Seni bekleyenler <em>${bek.length}</em></h3><div class="ek-kartlar">${bek.map(kart).join("")}</div>` : `<div class="ek-tamam">Bekleyen değerlendirmen yok. Eline sağlık!</div>`) +
        (bit.length ? `<h3 class="ek-bas">Tamamlananlar <em>${bit.length}</em></h3><div class="ek-kartlar">${bit.map(kart).join("")}</div>` : "");
  }

  /* ---------- düzenleyici ---------- */
  let AKTIF = null;
  function puanSatirlari(p, kilit) {
    return KRITER.map(([k, ad]) => { const v = p[k], has = v != null;
      return `<div class="dg-r${has ? "" : " bos"}" data-k="${k}"><span class="dg-l">${esc(ad)}</span>
        <input type="range" min="0" max="10" step="0.5" value="${has ? v : 5}" aria-label="${esc(ad)} puanı"${kilit ? " disabled" : ""}><output>${has ? fP(v) : "–"}</output>
        <button type="button" class="dg-x" aria-label="${esc(ad)} puanını temizle"${kilit ? " hidden" : ""}>×</button></div>`; }).join("");
  }
  function topla(root) {
    const vals = {}; $$(".dg-r:not(.bos)", root).forEach(r => vals[r.dataset.k] = Number($("input", r).value));
    const n = Object.keys(vals).length, t = n ? Math.round(Object.values(vals).reduce((a, b) => a + b, 0) / n * 100) / 10 : null;
    $$("[data-top]", root).forEach(x => x.textContent = fP(t));
    const ilerle = $("[data-ilerleme]", root); if (ilerle) ilerle.textContent = `${n}/${KRITER.length} kriter`;
    return { puanlar: vals, toplam: t, n };
  }

  function duzenle(m) {
    AKTIF = m.id; kirli = false;
    const d = D.deg.get(m.id) || {}, kilit = !m.degerlendirme_acik;
    const tk = `etd-taslak-${SAYFA}-${m.id}`, taslak = ls.get(tk);
    const geriYukle = !kilit && taslak && (!d.updated_at || taslak.t > Date.parse(d.updated_at));
    const p = geriYukle ? taslak.puanlar || {} : d.puanlar || {}, yorum = geriYukle ? taslak.yorum || "" : d.yorum || "";
    const etk = (m.etiketler || []).join(", ");
    $("#ek-liste").hidden = true; $("#ek-ust").hidden = true;
    const el = $("#ek-duz"); el.hidden = false;
    el.innerHTML = `
      <a class="ek-geri" href="#">← Mekânlar</a>
      <header class="ek-h"><h2>${esc(m.ad)}</h2><p>${esc([m.adres, yerYazi(m)].filter(Boolean).join(" · "))}</p>
        <div class="ek-linkler"><a href="${esc(mapsLink(m))}" target="_blank" rel="noopener noreferrer">Google Maps ↗</a>${m.lat != null ? `<a href="https://www.google.com/maps/dir/?api=1&destination=${m.lat},${m.lng}" target="_blank" rel="noopener noreferrer">Yol tarifi ↗</a>` : ""}${m.yayinda ? `<a href="/mekan.html?id=${m.id}" target="_blank" rel="noopener">Sitedeki sayfa ↗</a>` : `<span class="ek-taslak">Sitede henüz yayında değil</span>`}</div></header>
      ${kilit ? `<div class="ek-uyari">Bu mekânın değerlendirmesi kapandı. Puanını değiştirmen gerekiyorsa yöneticiye yaz.</div>` : ""}
      ${geriYukle ? `<div class="ek-bilgi">Kaydedilmemiş taslağın geri yüklendi. <button type="button" class="linkish" data-taslak-at>Taslağı at</button></div>` : ""}
      <form id="ek-form" novalidate>
        <section class="ek-kutu dg p${KI}" data-kisi="${SAYFA}">
          <div class="ek-kh"><div><h3>Puanların</h3><small data-ilerleme></small></div><span class="dg-top"><b data-top>–</b><small>/100</small></span></div>
          <p class="sm ek-ip">Her kriteri 0–10 arası kaydır. Dokunmadığın kriter boş kalır; toplam, girdiğin kriterlerin ortalamasıyla 100'e ölçeklenir. Diğer kişinin puanlarını göremezsin, sitede ikiniz yan yana görünürsünüz.</p>
          <div class="ek-puanlar">${puanSatirlari(p, kilit)}</div>
          <label class="field" style="margin:16px 0 0"><span>Yorumun <small>(mekân sayfasında adınla görünür)</small></span>
            <textarea name="yorum" rows="6" maxlength="4000" placeholder="Tavuk, ekmek, sos, usta… Neyi sevdin, neyi sevmedin?"${kilit ? " disabled" : ""}>${esc(yorum)}</textarea><small class="ek-sayac" data-sayac></small></label>
        </section>
        ${EGEMEN ? `<section class="ek-kutu">
          <div class="ek-kh"><div><h3>Sayfa bilgileri</h3><small>Mekân sayfasında herkesin gördüğü genel bilgiler</small></div></div>
          <label class="field"><span>Kısa özet <small>(sayfanın başında, tırnak içinde · 400 karakter)</small></span><textarea name="puan_notu" rows="2" maxlength="400">${esc(m.puan_notu || "")}</textarea></label>
          <label class="field"><span>Genel yorum <small>(paragrafları boş satırla ayır)</small></span><textarea name="aciklama" rows="7" maxlength="6000" placeholder="Ustanın hikâyesi, döneri nasıl hazırladığı, mekânın havası…">${esc(m.aciklama || "")}</textarea></label>
          <div class="row2"><label class="field"><span>Instagram</span><input name="instagram" maxlength="200" value="${esc(m.instagram || "")}" placeholder="@hesap" autocomplete="off" autocapitalize="off"></label>
            <label class="field"><span>Ziyaret tarihi</span><input name="ziyaret_tarihi" type="date" value="${esc(m.ziyaret_tarihi || "")}"></label></div>
          <label class="field"><span>Bölüm linki <small>(YouTube)</small></span><input name="bolum_url" type="url" inputmode="url" value="${esc(m.bolum_url || "")}" placeholder="https://youtu.be/…" autocomplete="off"></label>
          <label class="field"><span>Etiketler <small>(virgülle · en fazla 12)</small></span><input name="etiketler" value="${esc(etk)}" placeholder="Lavaş, Sulu tavuk, Uygun fiyat" autocomplete="off"></label>
        </section>` : ""}
        <div class="ek-alt"><span class="ek-alt-p"><small>${esc(KISI.ad)}</small><b data-top>–</b><small>/100</small></span>
          <button class="btn btn-o" type="submit"${kilit && !EGEMEN ? " disabled" : ""}>Kaydet</button></div>
      </form>
      ${EGEMEN ? `<section class="ek-kutu"><div class="ek-kh"><div><h3>Fotoğraflar</h3><small>Mekân sayfasında galeri olarak görünür · ilk fotoğraf kapak olur</small></div></div><div id="ek-foto"></div></section>` : ""}
      <section class="ek-kutu ek-g"><div class="ek-kh"><div><h3>Google'da</h3><small>Sadece fikir vermesi için; senin puanını etkilemez</small></div></div><div id="ek-gd">${m.google_place_id ? `<div class="gd sm">Google bilgileri getiriliyor…</div>` : `<p class="sm">Bu mekân Google ile eşleşmemiş.</p>`}</div></section>`;
    scrollTo(0, 0);
    const f = $("#ek-form"), kok = $(".dg", f), ta = f.yorum, say = $("[data-sayac]", f);
    const sayac = () => { say.textContent = ta.value.length > 3500 ? `${ta.value.length}/4000` : ""; };
    const taslakYaz = () => { if (kilit) return; const s = topla(kok); ls.set(tk, { t: Date.now(), puanlar: s.puanlar, yorum: ta.value }); };
    let tt; const degisti = () => { kirli = true; clearTimeout(tt); tt = setTimeout(taslakYaz, 400); };
    kok.addEventListener("input", e => {
      const r = e.target.closest(".dg-r"); if (r) { r.classList.remove("bos"); $("output", r).textContent = fP(e.target.value); topla(f); }
      if (e.target === ta) sayac();
      degisti();
    });
    kok.addEventListener("click", e => { const x = e.target.closest(".dg-x"); if (!x) return; const r = x.closest(".dg-r"); r.classList.add("bos"); $("output", r).textContent = "–"; topla(f); degisti(); });
    if (EGEMEN) $$("input,textarea", f).forEach(i => { if (!i.closest(".dg")) i.addEventListener("input", () => { kirli = true; }); });
    const at = $("[data-taslak-at]", el); if (at) at.addEventListener("click", () => { ls.del(tk); kirli = false; duzenle(m); });
    topla(f); sayac();
    if (geriYukle) kirli = true;

    f.addEventListener("submit", async e => {
      e.preventDefault();
      const b = $("button[type=submit]", f); b.disabled = true; b.textContent = "Kaydediliyor…";
      let hata = null;
      try {
        if (!kilit) {
          const s = topla(f), y = ta.value.trim() || null;
          if (s.n || y || D.deg.has(m.id)) {
            const { error } = await db.from("degerlendirmeler").upsert({ mekan_id: m.id, kisi: SAYFA, puanlar: s.puanlar, yorum: y }, { onConflict: "mekan_id,kisi" });
            if (error) throw new Error(/row-level|policy/i.test(error.message) ? "Değerlendirme kapanmış ya da bu mekân sana atanmamış." : error.message);
          }
        }
        if (EGEMEN) {
          const v = n => (f[n].value || "").trim();
          const ig = P.instaTemiz(v("instagram"));
          if (ig === null) throw new Error("Instagram: @kullanici ya da instagram.com/kullanici yaz.");
          const bu = v("bolum_url");
          if (bu && !/^https:\/\/(www\.|m\.)?(youtube\.com|youtu\.be)\//i.test(bu)) throw new Error("Bölüm linki bir YouTube linki olmalı (https://youtu.be/…).");
          const { error } = await db.rpc("mekan_genel_guncelle", { p_id: m.id, p_puan_notu: v("puan_notu"), p_aciklama: v("aciklama"), p_instagram: ig, p_etiketler: v("etiketler") ? v("etiketler").split(",").map(s => s.trim()).filter(Boolean).slice(0, 12) : [], p_ziyaret_tarihi: v("ziyaret_tarihi") || null, p_bolum_url: bu || null });
          if (error) throw new Error(error.message);
          if (ig) f.instagram.value = ig;
        }
      } catch (er) { hata = er.message || "Kaydedilemedi."; }
      b.disabled = kilit && !EGEMEN; b.textContent = "Kaydet";
      if (hata) return toast(hata);
      ls.del(tk); kirli = false;
      const [r1, r2] = await Promise.all([
        db.from("degerlendirmeler").select("mekan_id,puanlar,yorum,toplam,updated_at").eq("mekan_id", m.id).eq("kisi", SAYFA).maybeSingle(),
        db.from("mekanlar").select("puan_notu,aciklama,instagram,etiketler,bolum_url,ziyaret_tarihi").eq("id", m.id).maybeSingle(),
      ]);
      if (r1.data) D.deg.set(m.id, r1.data);
      if (r2.data) Object.assign(m, r2.data);
      listeCiz();
      const t = r1.data && r1.data.toplam;
      toast(t != null ? `Kaydedildi · ${fP(t)}/100` : "Kaydedildi");
    });

    if (EGEMEN) P.fotoYoneticisi($("#ek-foto"), db, m.id, { toast, onay: msg => onay(msg), url: C.SUPABASE_URL });
    if (m.google_place_id) fn("detay", { place_id: m.google_place_id }).then(g => {
      if (AKTIF !== m.id) return; const box = $("#ek-gd"); if (!box) return;
      box.innerHTML = g.error ? `<p class="sm">${esc(g.error)}</p>` : P.gDetayHtml(g.detay);
      if (EGEMEN && g.detay && g.detay.instagram && f.instagram && !f.instagram.value) { const ig = P.instaTemiz(g.detay.instagram); if (ig) { f.instagram.value = ig; kirli = true; } }
    });
  }

  /* ---------- mekân ekle (rotaya) ---------- */
  const ef = $("#ekle-form"), sonuc = $("#ekle-sonuc"), ekleBtn = $("[data-ekle]", ef);
  let SEC = null, LISTE = [], lt;
  const adayCiz = () => {
    sonuc.innerHTML = LISTE.map((g, i) => `<button type="button" class="kp-item${g === SEC ? " on" : ""}" data-i="${i}" aria-pressed="${g === SEC}"><b>${esc(g.ad)}${g.tur ? ` <em>${esc(g.tur)}</em>` : ""}${g.kapali ? ` <em class="kapali">Kalıcı kapalı</em>` : ""}</b><small>${esc(temizAd(g.adres))}</small></button>`).join("") +
      (LISTE.length > 1 ? `<p class="sm" style="margin-top:6px">Doğru mekân değilse listeden seç.</p>` : "");
    const ayni = SEC && D.oneri.find(r => r.google_place_id === SEC.place_id);
    if (ayni) sonuc.insertAdjacentHTML("afterbegin", `<p class="ek-uyari" style="margin-bottom:8px">Bunu ${esc(fmtD(ayni.created_at))} tarihinde zaten eklemişsin (${esc(DURUM[ayni.durum] || ayni.durum)}).</p>`);
    ekleBtn.disabled = !SEC || !!ayni;
  };
  sonuc.addEventListener("click", e => { const b = e.target.closest("[data-i]"); if (!b) return; SEC = LISTE[+b.dataset.i]; adayCiz(); });
  ef.url.addEventListener("input", () => {
    clearTimeout(lt); const u = ef.url.value.trim(); SEC = null; ekleBtn.disabled = true;
    if (!u) { sonuc.innerHTML = ""; return; }
    if (!/^https?:\/\//i.test(u)) { sonuc.innerHTML = `<p class="sm">Linki tam yapıştır (https:// ile başlar).</p>`; return; }
    lt = setTimeout(async () => {
      sonuc.innerHTML = `<p class="sm"><span class="lc-spin sm-spin" aria-hidden="true"></span> Google'da tanınıyor…</p>`;
      const d = await fn("link", { url: u });
      if (ef.url.value.trim() !== u) return;
      if (d.error) { sonuc.innerHTML = `<p class="sm" style="color:var(--err)">${esc(d.error)}</p>`; return; }
      LISTE = (d.sonuc || []).map(g => ({ ...g, place_id: g.place_id || g.id })); SEC = LISTE[0] || null;
      if (!SEC) { sonuc.innerHTML = `<p class="sm" style="color:var(--err)">Bu linkten mekân bulunamadı. Google Maps'te mekânın kendi sayfasını açıp Paylaş ile linki al.</p>`; return; }
      adayCiz();
    }, 450);
  });
  ef.addEventListener("submit", async e => {
    e.preventDefault(); if (!SEC || ekleBtn.disabled) return;
    const g = SEC, yurtd = g.il === "Yurt dışı";
    const il = yurtd ? "Yurt dışı" : (eslesen(ILLER, g.il) || temizAd(g.il) || null);
    const ilce = yurtd ? null : (eslesen((window.ILCELER || {})[il] || [], g.ilce) || temizAd(g.ilce) || null);
    const row = { mekan_adi: String(g.ad || "").slice(0, 120), il: il ? String(il).slice(0, 40) : "Belirsiz", ilce: ilce ? String(ilce).slice(0, 60) : null, ulke: yurtd ? (g.ulke || "").slice(0, 60) || null : null,
      adres: ef.url.value.trim().slice(0, 400), neden: ef.neden.value.trim().slice(0, 1000) || null, takma_ad: KISI.ad, kvkk_onay: true, yayin_izni: false,
      durum: "listede", onayli: false, haritada_goster: false, kaynak: SAYFA,
      google_place_id: g.place_id, google_ad: g.ad, google_adres: g.adres, google_url: g.url || null, google_tur: g.tur || null,
      google_eslesme: g.kapali ? "kapali" : "elle", lat: g.lat, lng: g.lng };
    if (row.mekan_adi.length < 2) return toast("Mekân adı okunamadı.");
    ekleBtn.disabled = true;
    const { error } = await db.from("mekan_onerileri").insert(row);
    if (error) { ekleBtn.disabled = false; return toast("Eklenemedi: " + error.message); }
    toast(`${g.ad} rotaya eklendi`); ef.reset(); sonuc.innerHTML = ""; SEC = null; LISTE = [];
    const o = await db.from("mekan_onerileri").select("id,mekan_adi,il,ilce,ulke,durum,created_at,google_place_id").eq("kaynak", SAYFA).order("created_at", { ascending: false });
    if (!o.error) { D.oneri = o.data || []; onerilerCiz(); }
  });
  function onerilerCiz() {
    $("#ekle-liste").innerHTML = D.oneri.length ? D.oneri.map(r => `<li><span><b>${esc(r.mekan_adi)}</b><small>${esc(yerYazi(r))} · ${esc(fmtD(r.created_at))}</small></span><span class="badge b-${esc(r.durum)}">${esc(DURUM[r.durum] || r.durum)}</span></li>`).join("")
      : `<li class="sm ek-bos-s">Henüz eklediğin mekân yok.</li>`;
  }

  $("#ek-yenile").addEventListener("click", async e => { const b = e.currentTarget; b.disabled = true; await yukle(); b.disabled = false; toast("Güncellendi"); });
  $("#ek-ad").textContent = KISI.ad;
  document.title = `${KISI.ad} paneli | eniyitavukdoner.com`;
  basla();
})();

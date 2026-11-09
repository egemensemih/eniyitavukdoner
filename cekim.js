/* eniyitavukdoner.com — çekim paneli (çekim ekibi, puan verenler, yöneticiler) */
(function () {
  "use strict";
  if (window.top !== window.self) { document.documentElement.innerHTML = ""; return; }
  const C = window.SITE_CONFIG || {}, ETDP = window.ETDP || {};
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const TR = "tr-TR", ALAN = "ekip.eniyitavukdoner.com", BUCKET = "cekim-foto";
  const KRITER = C.KRITERLER || [];
  const ILLER = Object.keys(window.ILCELER || {});
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const guvenli = u => /^https?:\/\/[^\s"'<>]+$/i.test(String(u || "").trim()) ? String(u).trim() : "";
  const fP = p => { if (p == null || p === "") return "–"; const n = Math.round(Number(p) * 10) / 10; return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ","); };
  const fTL = n => n == null || n === "" ? "" : Number(n).toLocaleString(TR, { maximumFractionDigits: 2 }) + " ₺";
  const fmtD = s => { try { return new Date(String(s).length === 10 ? s + "T12:00:00" : s).toLocaleDateString(TR, { day: "numeric", month: "long", weekday: "long" }); } catch (e) { return ""; } };
  const fmtK = s => { try { return new Date(String(s).length === 10 ? s + "T12:00:00" : s).toLocaleDateString(TR, { day: "numeric", month: "long", year: "numeric" }); } catch (e) { return ""; } };
  const ls = { get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* */ } }, del(k) { try { localStorage.removeItem(k); } catch (e) { /* */ } } };
  const kadiTemiz = s => String(s || "").trim().toLocaleLowerCase(TR).replace(/ı/g, "i").replace(/ş/g, "s").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ö/g, "o").replace(/ç/g, "c");
  const anahtar = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase(TR).replace(/[^a-z0-9]/g, "");
  const eslesen = (list, ad) => { const k = anahtar(ad); return k ? list.find(x => anahtar(x) === k) || null : null; };
  const temizAd = s => String(s || "").replace(/̇/g, "").normalize("NFC");
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)));
  const fotoUrl = yol => `${C.SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${String(yol).split("/").map(encodeURIComponent).join("/")}`;

  const db = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, storageKey: "etd-cekim", detectSessionInUrl: false } });

  function toast(msg) {
    let t = $(".toast"); if (!t) { t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
    t.textContent = msg; t.classList.add("show"); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 3200);
  }
  const modal = $("#modal");
  let modalKapat = null;
  function modalAc(baslik, html, kapanirken, tam) {
    $("#modal-title").textContent = baslik; $("#modal-body").innerHTML = html; modal.hidden = false; document.body.classList.add("ck-kilit");
    $(".modal-card", modal).classList.toggle("ck-tam", !!tam);
    modalKapat = kapanirken || null; $(".modal-card", modal).scrollTop = 0;
  }
  async function kapat(zorla) {
    if (!zorla && modalKapat && !(await modalKapat())) return;
    modal.hidden = true; $("#modal-body").innerHTML = ""; modalKapat = null; document.body.classList.remove("ck-kilit");
  }
  modal.addEventListener("click", e => { if (e.target.closest("[data-close]")) kapat(); });
  addEventListener("keydown", e => { if (e.key === "Escape" && !modal.hidden) kapat(); });
  const mesaj = (f, t, ok) => { const m = $(".form-msg", f); if (!m) return; m.textContent = t || ""; m.className = "form-msg" + (t && !ok ? " err" : ""); m.style.color = ok ? "var(--ok)" : ""; };
  async function gfn(islem, body) {
    try {
      const { data, error } = await db.functions.invoke("google-mekan", { body: { islem, ...body } });
      if (error) { let m = "Google bağlantısı kurulamadı."; try { const j = await error.context.json(); if (j && j.error) m = j.error; } catch (e) { /* */ } return { error: m }; }
      return data || {};
    } catch (e) { return { error: "Bağlantı hatası." }; }
  }

  /* ---------- giriş ---------- */
  const lf = $("#login-form");
  const ekran = ad => { $("#login").hidden = ad !== "login"; $("#app").hidden = ad !== "app"; };
  lf.addEventListener("submit", async e => {
    e.preventDefault(); const b = $("button[type=submit]", lf);
    const k = lf.kadi.value.trim(), p = lf.password.value;
    if (!k || !p) return mesaj(lf, "Kullanıcı adını ve şifreni yaz.");
    b.disabled = true; mesaj(lf, "");
    const email = k.includes("@") ? k.toLowerCase() : `${kadiTemiz(k)}@${ALAN}`;
    const { error } = await db.auth.signInWithPassword({ email, password: p });
    b.disabled = false;
    if (error) return mesaj(lf, /rate|many/i.test(error.message) ? "Çok fazla deneme yapıldı, birkaç dakika sonra tekrar dene." : /banned/i.test(error.message) ? "Bu hesabın erişimi kapatılmış." : "Kullanıcı adı ya da şifre hatalı.");
    lf.password.value = ""; basla();
  });
  async function cikis() {
    if (TASLAK_VAR() && !confirm("Kaydedilmemiş değişikliğin var. Yine de çıkılsın mı?")) return;
    await db.auth.signOut(); location.replace(location.pathname);
  }

  /* ---------- veri ---------- */
  const ROL_AD = { ekip: "çekim ekibi", puanci: "puan verici", yonetici: "süper yönetici" };
  const ort = L => { const t = (L || []).filter(p => p.toplam != null); return t.length ? t.reduce((a, p) => a + Number(p.toplam), 0) / t.length : null; };
  let D = null, BEN = null, SEC = null, SON_JSON = "";
  const SUNUCU = () => !!(BEN && BEN.kullanici_adi && (BEN.rol === "puanci" || BEN.rol === "yonetici"));
  const EKLEYEBILIR = () => !!(BEN && (SUNUCU() || BEN.eposta));
  const YONETICI = () => !!(BEN && BEN.rol === "yonetici");
  const TASLAK_VAR = () => !modal.hidden && !!modalKapat;
  const tumMekanlar = () => (D.bolumler || []).flatMap(b => (b.mekanlar || []).map(m => ({ m, b })));
  const mekanBul = id => { const b = (D.bolumler || []).find(x => x.id === SEC), m = b && b.mekanlar.find(x => x.oneri_id === id); return m || (tumMekanlar().find(x => x.m.oneri_id === id) || {}).m; };

  async function basla() {
    const { data: { session } } = await db.auth.getSession();
    if (!session) { ekran("login"); return; }
    const ok = await yukle(true);
    if (!ok) return;
    ekran("app");
    ciz();
  }

  async function yukle(ilk) {
    const { data, error } = await db.rpc("cekim_verisi");
    if (error) {
      if (ilk) {
        if (/yetki|42501/i.test(error.message + error.code)) { await db.auth.signOut(); ekran("login"); mesaj(lf, "Bu hesabın çekim paneline erişimi yok."); }
        else { ekran("login"); mesaj(lf, "Bağlantı sorunu. Sayfayı yenile."); }
      }
      return false;
    }
    const j = JSON.stringify(data);
    const degisti = j !== SON_JSON; SON_JSON = j;
    D = data; BEN = data.ben || {};
    $("#ck-ben").textContent = BEN.kullanici_adi ? `${BEN.ad} · ${ROL_AD[BEN.rol] || BEN.rol}` : "Yönetici önizlemesi";
    return ilk ? true : degisti;
  }

  function varsayilanBolum() {
    const L = D.bolumler || []; if (!L.length) return null;
    const bugun = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });
    const plan = L.filter(b => b.durum === "planlaniyor");
    const yakin = plan.filter(b => b.cekim_tarihi && b.cekim_tarihi >= bugun).sort((a, b) => a.cekim_tarihi.localeCompare(b.cekim_tarihi))[0];
    return (yakin || plan[0] || L.filter(b => b.durum === "cekildi").pop() || L[L.length - 1]).id;
  }

  /* ---------- yardımcılar ---------- */
  const DURUM = { planlaniyor: "Planlanıyor", cekildi: "Çekildi", yayinda: "Yayında" };
  const ODURUM = { yeni: "Yeni", incelendi: "İncelendi", listede: "Rotada", gidildi: "Gidildi", uygun_degil: "Uygun değil" };
  const yer = m => [m.ilce, m.il === "Yurt dışı" ? m.ulke : m.il].filter(Boolean).join(" · ");
  const tel = t => { const d = String(t || "").replace(/[^\d+]/g, ""); return d.startsWith("+") ? d : d.startsWith("0") ? "+90" + d.slice(1) : d ? "+90" + d : ""; };
  const yolTarifi = m => m.lat != null ? `https://www.google.com/maps/dir/?api=1&destination=${m.lat},${m.lng}` : guvenli(m.maps) || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([m.ad, m.ilce, m.il].filter(Boolean).join(" "))}`;
  const igAd = u => (String(u || "").match(/instagram\.com\/([a-z0-9._]{1,30})/i) || [])[1];
  function bugunSaat(s) {
    if (!Array.isArray(s) || !s.length) return null;
    const g = new Date().toLocaleDateString(TR, { weekday: "long", timeZone: "Europe/Istanbul" }).toLocaleLowerCase(TR);
    const r = s.find(x => String(x).toLocaleLowerCase(TR).startsWith(g));
    return r ? String(r).replace(/^[^:]+:\s*/, "") : null;
  }
  function rotaLink(L) {
    const n = L.filter(m => m.lat != null); if (!n.length) return "";
    const son = n[n.length - 1], ara = n.slice(0, -1).slice(0, 9);
    return `https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=${son.lat},${son.lng}` + (ara.length ? `&waypoints=${encodeURIComponent(ara.map(m => `${m.lat},${m.lng}`).join("|"))}` : "");
  }
  const benimPuan = m => (m.puanlar || []).find(p => BEN && BEN.kullanici_adi && p.kisi === BEN.kullanici_adi);
  const siparisToplam = s => (s || []).reduce((a, x) => a + (x.fiyat != null ? Number(x.fiyat) * (x.adet || 1) : 0), 0);

  /* ---------- çizim ---------- */
  function puanHtml(p) {
    const k = KRITER.filter(([x]) => p.puanlar && p.puanlar[x] != null);
    return `<div class="ck-puan">
      <div class="ck-puan-h"><span>${esc(p.ad)}</span><b>${fP(p.toplam)}<small>/100</small></b></div>
      ${k.length ? `<div class="ck-krit">${k.map(([x, ad]) => `<span><em>${esc(ad)}</em><b>${fP(p.puanlar[x])}</b></span>`).join("")}</div>` : ""}
      ${p.yorum ? `<p class="ck-yorum">“${esc(p.yorum)}”</p>` : ""}</div>`;
  }

  function kayitHtml(m) {
    const F = m.fotolar || [], foto = F.filter(f => f.tur === "foto"), menu = F.filter(f => f.tur === "menu");
    const z = m.ziyaret || {}, S = z.siparis || [], top = siparisToplam(S);
    const kucuk = f => `<button type="button" class="ck-th" data-foto-ac="${f.id}" aria-label="Fotoğrafı aç"><img src="${esc(fotoUrl(f.yol))}" alt="" loading="lazy" width="${f.genislik || 120}" height="${f.yukseklik || 120}"></button>`;
    const yukle = (tur, metin) => `<label class="ck-yukle"><input type="file" accept="image/*" ${tur === "foto" ? "multiple" : ""} hidden data-yukle="${tur}" data-id="${m.oneri_id}"><span>+ ${metin}</span></label>`;
    return `<section class="ck-kayit">
      <h4>Çekim kaydı</h4>
      <div class="ck-ks"><div class="ck-ks-h"><b>Fotoğraflar</b>${foto.length ? `<small>${foto.length}</small>` : ""}</div>
        <div class="ck-thumbs">${foto.map(kucuk).join("")}${yukle("foto", "Fotoğraf")}</div></div>
      <div class="ck-ks"><div class="ck-ks-h"><b>Menü</b>${z.menu_tarih ? `<small>${esc(fmtK(z.menu_tarih))}</small>` : ""}</div>
        <div class="ck-thumbs">${menu.map(kucuk).join("")}${guvenli(z.menu_url) ? `<a class="ck-chip ck-menu-l" href="${esc(z.menu_url)}" target="_blank" rel="noopener noreferrer">Menü linki ↗</a>` : ""}${yukle("menu", "Menü fotoğrafı")}<button type="button" class="ck-yukle" data-hesap="${m.oneri_id}" data-odak="menu_url"><span>${z.menu_url ? "Linki değiştir" : "+ Menü linki"}</span></button></div></div>
      <div class="ck-ks"><div class="ck-ks-h"><b>Ne yedik, ne ödedik</b></div>
        ${S.length || z.odenen != null || z.not ? `<ul class="ck-sip">${S.map(x => `<li><span>${x.adet > 1 ? `${x.adet}× ` : ""}${esc(x.ad)}</span><b>${fTL(x.fiyat != null ? x.fiyat * (x.adet || 1) : null)}</b></li>`).join("")}</ul>
          ${z.odenen != null ? `<p class="ck-odenen"><span>Ödenen</span><b>${fTL(z.odenen)}</b></p>` : top ? `<p class="ck-odenen"><span>Toplam</span><b>${fTL(top)}</b></p>` : ""}
          ${z.not ? `<p class="ck-knot">${esc(z.not)}</p>` : ""}
          ${z.guncelleyen ? `<p class="sm">${esc(z.guncelleyen)} · ${esc(fmtK(z.updated_at))}</p>` : ""}` : ""}
        <button type="button" class="btn btn-line btn-sm" data-hesap="${m.oneri_id}">${S.length || z.odenen != null ? "Düzenle" : "+ Ekle"}</button></div>
    </section>`;
  }

  function kart(m, i) {
    const bugun = bugunSaat(m.saatler), ig = igAd(m.instagram), t = tel(m.telefon);
    const puanlar = m.puanlar || [], benim = benimPuan(m);
    const taslak = SUNUCU() && ls.get(`etd-cekim-taslak-${m.oneri_id}`);
    const nedenler = (m.nedenler || []).filter(n => n && n.neden);
    const yorumlar = Array.isArray(m.yorumlar) ? m.yorumlar : [];
    return `<article class="ck-kart" id="m-${m.oneri_id}" data-id="${m.oneri_id}">
      <header class="ck-kh"><span class="ck-no">${i + 1}</span><div class="ck-kt"><h3>${esc(m.ad)}</h3><small>${esc([yer(m), m.tur].filter(Boolean).join(" · "))}</small></div>
        ${ort(puanlar) != null ? `<span class="ck-rozet"${puanlar.length > 1 ? ` title="${puanlar.length} kişinin ortalaması"` : ""}>${fP(ort(puanlar))}</span>` : ""}</header>
      ${m.kapali ? `<p class="ck-uyari">Google'da “kalıcı olarak kapandı” görünüyor.</p>` : ""}
      ${m.not ? `<p class="ck-not">${esc(m.not)}</p>` : ""}
      ${m.adres ? `<p class="ck-adres">${esc(m.adres)}</p>` : ""}
      <div class="ck-chips">
        <a class="ck-chip ck-yol" href="${esc(yolTarifi(m))}" target="_blank" rel="noopener noreferrer">Yol tarifi ↗</a>
        ${t ? `<a class="ck-chip" href="tel:${esc(t)}">☎ ${esc(m.telefon)}</a>` : ""}
        ${ig ? `<a class="ck-chip ck-ig" href="https://www.instagram.com/${esc(ig)}/" target="_blank" rel="noopener noreferrer">@${esc(ig)}</a>` : ""}
        ${m.gpuan != null ? `<a class="ck-chip ck-g" href="${esc(guvenli(m.maps) || yolTarifi(m))}" target="_blank" rel="noopener noreferrer">★ ${fP(m.gpuan)} <small>${Number(m.gyorum || 0).toLocaleString(TR)}</small></a>` : ""}
        ${guvenli(m.web) && !/instagram\.com/i.test(m.web) ? `<a class="ck-chip" href="${esc(m.web)}" target="_blank" rel="noopener noreferrer">${esc(m.web.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "").slice(0, 28))} ↗</a>` : ""}
      </div>
      ${bugun ? `<p class="ck-saat"><b>Bugün:</b> ${esc(bugun)}</p>` : ""}
      ${cekildi(m) ? `<div class="ck-cekildi"><span>✓ Çekildi · ${esc(saatYaz(m.ziyaret.cekildi_at))}${m.ziyaret.cekildi_kim ? " · " + esc(m.ziyaret.cekildi_kim) : ""}</span><button type="button" class="linkish" data-cek="${m.oneri_id}" data-durum="0">Geri al</button></div>`
        : `<button type="button" class="btn btn-line full ck-cek-btn" data-cek="${m.oneri_id}" data-durum="1">Burada çektik ✓</button>`}
      <div class="ck-alt">
        ${Array.isArray(m.saatler) && m.saatler.length ? `<details data-k="s${m.oneri_id}"><summary>Çalışma saatleri</summary>${m.saatler.map(x => `<div>${esc(x)}</div>`).join("")}</details>` : ""}
        ${nedenler.length ? `<details data-k="n${m.oneri_id}" ${SUNUCU() ? "open" : ""}><summary>Neden gidiyoruz? (${nedenler.length})</summary>${nedenler.map(n => `<blockquote>${esc(n.neden)}${n.kim ? `<cite>— ${esc(n.kim)}</cite>` : ""}</blockquote>`).join("")}</details>` : ""}
        ${yorumlar.length ? `<details data-k="y${m.oneri_id}"><summary>Son Google yorumları (${yorumlar.length})</summary>${yorumlar.map(r => `<blockquote><span class="ck-yp">${"★".repeat(Math.max(0, Math.min(5, Math.round(r.puan || 0))))}</span> ${esc(r.metin || "")}<cite>${esc(r.yazar || "")}${r.zaman ? " · " + esc(r.zaman) : ""}</cite></blockquote>`).join("")}</details>` : ""}
      </div>
      <section class="ck-puanlar">
        ${puanlar.length ? puanlar.map(puanHtml).join("") : `<p class="ck-bos-p">${SUNUCU() ? "Henüz puan vermedin." : "Henüz puan verilmedi."}</p>`}
        ${SUNUCU() ? `<button type="button" class="btn ${benim ? "btn-line" : "btn-o"} full ck-puanla" data-puanla="${m.oneri_id}">${taslak ? "Taslağa devam et" : benim ? "Puanı düzenle" : "Puan ver"}</button>` : ""}
      </section>
      ${kayitHtml(m)}
    </article>`;
  }

  function ozet(b) {
    const L = (b.mekanlar || []).map((m, i) => ({ m, i, p: ort(m.puanlar), n: (m.puanlar || []).length })).filter(x => x.p != null);
    if (!L.length) return "";
    const s = [...L].sort((a, b) => b.p - a.p);
    return `<section class="ck-ozet"><div class="ck-ozet-h"><h3>Puan tablosu</h3><button type="button" class="btn btn-line btn-sm" data-kopyala>Kopyala</button></div>
      <ol>${s.map(x => `<li><a href="#m-${x.m.oneri_id}"><span>${esc(x.m.ad)}</span><b>${fP(x.p)}${x.n > 1 ? `<small class="ck-ort"> · ${x.n} kişi</small>` : ""}</b></a></li>`).join("")}</ol>
      <p class="sm">${L.length}/${b.mekanlar.length} mekân puanlandı.</p></section>`;
  }
  function ozetMetni(b) {
    const satir = [];
    satir.push(`${b.no ? "Bölüm " + b.no + " — " : ""}${b.baslik}`);
    (b.mekanlar || []).forEach((m, i) => {
      const L = m.puanlar || [], o = ort(L), girinti = L.length > 1 ? "      " : "   ";
      satir.push("", `${i + 1}. ${m.ad}${o != null ? ` — ${fP(o)}/100${L.length > 1 ? " (ortalama)" : ""}` : " — puan yok"}`);
      L.forEach(p => {
        if (L.length > 1) satir.push(`   ${p.ad}: ${fP(p.toplam)}/100`);
        KRITER.forEach(([k, ad]) => { if (p.puanlar && p.puanlar[k] != null) satir.push(`${girinti}${ad}: ${fP(p.puanlar[k])}`); });
        if (p.yorum) satir.push(`${girinti}Yorum: ${p.yorum}`);
      });
      const z = m.ziyaret || {};
      if ((z.siparis || []).length) satir.push(`   Yediklerimiz: ${z.siparis.map(x => `${x.adet > 1 ? x.adet + "× " : ""}${x.ad}${x.fiyat != null ? " (" + fTL(x.fiyat * (x.adet || 1)) + ")" : ""}`).join(", ")}`);
      if (z.odenen != null) satir.push(`   Ödenen: ${fTL(z.odenen)}`);
    });
    return satir.join("\n");
  }

  // Bölüm "Çekildi" olduktan sonra puanı ya da yorumu eksik olanlar
  function bekleyenler() {
    if (!SUNUCU()) return [];
    return tumMekanlar().filter(({ b }) => b.durum === "cekildi" || b.durum === "yayinda")
      .map(({ m, b }) => ({ m, b, p: benimPuan(m) })).filter(x => !x.p || !x.p.yorum);
  }
  function bekleyenHtml() {
    const L = bekleyenler(); if (!L.length) return "";
    return `<section class="ck-bekle"><h3>Çekim puanlaman ve yorumun bekleniyor <em>${L.length}</em></h3>
      <ul>${L.map(x => `<li><span><b>${esc(x.m.ad)}</b><small>${esc(x.b.no ? "Bölüm " + x.b.no : x.b.baslik)} · ${x.p ? "yorum eksik" : "puan verilmedi"}</small></span>
        <button type="button" class="btn btn-o btn-sm" data-puanla="${x.m.oneri_id}" data-bolum="${x.b.id}">${x.p ? "Yorum yaz" : "Puan ver"}</button></li>`).join("")}</ul></section>`;
  }

  function sekmeler(aktif) {
    const n = bekleyenler().length;
    $("#ck-sekme").innerHTML = `<a href="#b/${SEC || ""}" class="${aktif === "bolum" ? "on" : ""}">Bölümler${n ? ` <em>${n}</em>` : ""}</a><a href="#galeri" class="${aktif === "galeri" ? "on" : ""}">Galeri</a><a href="#ozet" class="${aktif === "ozet" ? "on" : ""}">Özet</a>${EKLEYEBILIR() ? `<a href="#ekle" class="${aktif === "ekle" ? "on" : ""}">+ Mekân</a>` : ""}`;
  }

  function ciz() {
    if (location.hash === "#ekle" && EKLEYEBILIR()) return ekleCiz();
    if (location.hash === "#galeri") return galeriCiz();
    if (location.hash === "#ozet") return ozetCiz();
    sekmeler("bolum");
    const L = D.bolumler || [];
    const h = (location.hash.match(/^#b\/(\d+)/) || [])[1];
    if (h && L.some(b => b.id === +h)) SEC = +h;
    if (!SEC || !L.some(b => b.id === SEC)) SEC = varsayilanBolum();
    $("#ck-bolumler").hidden = false;
    $("#ck-bolumler").innerHTML = L.length > 1 ? L.map(b => `<a href="#b/${b.id}" class="ck-bt${b.id === SEC ? " on" : ""}" aria-current="${b.id === SEC}"><b>${b.no ? "Bölüm " + b.no : "Bölüm"}</b><small>${b.cekim_tarihi ? esc(new Date(b.cekim_tarihi + "T12:00:00").toLocaleDateString(TR, { day: "numeric", month: "short" })) + " · " : esc(DURUM[b.durum] || b.durum) + " · "}${(b.mekanlar || []).length} mekân</small></a>`).join("") : "";
    const nav = $("#ck-bolumler"), on = $(".ck-bt.on", nav); if (on) nav.scrollLeft = on.offsetLeft - (nav.clientWidth - on.offsetWidth) / 2;
    const b = L.find(x => x.id === SEC);
    if (!b) {
      $("#ck-icerik").innerHTML = bekleyenHtml() + `<div class="ck-bos"><div aria-hidden="true">🎬</div><h3>Şu an planlanan bölüm yok</h3><p>Yeni bir bölüm açılıp mekânlar eklendiğinde burada görünür.</p></div>`;
      return;
    }
    const M = b.mekanlar || [], rl = rotaLink(M);
    $("#ck-icerik").innerHTML = bekleyenHtml() + `
      <section class="ck-bh">
        <span class="ck-durum d-${esc(b.durum)}">${esc(DURUM[b.durum] || b.durum)}</span>
        <h2>${b.no && !String(b.baslik).toLocaleLowerCase(TR).includes("bölüm " + b.no) ? `<small>Bölüm ${b.no}</small>` : ""}${esc(b.baslik)}</h2>
        <p class="ck-meta">${[b.cekim_tarihi ? "Çekim: " + esc(fmtD(b.cekim_tarihi)) : "", b.sehir ? esc(b.sehir) : "", `${M.length} mekân`].filter(Boolean).join(" · ")}</p>
        ${b.aciklama ? `<p class="ck-acik">${esc(b.aciklama)}</p>` : ""}
        ${M.length ? ilerlemeHtml(M) : ""}
        <div class="ck-bh-a">${rl ? `<a class="btn btn-o btn-sm" href="${esc(rl)}" target="_blank" rel="noopener noreferrer">Bütün rotayı Google Maps'te aç ↗</a>` : ""}
          ${BEN.admin ? `<label class="ck-durum-sec"><span>Bölüm durumu</span><select data-bdurum="${b.id}">${Object.entries(DURUM).map(([k, v]) => `<option value="${k}"${k === b.durum ? " selected" : ""}>${v}</option>`).join("")}</select></label>` : ""}</div>
      </section>
      ${M.length > 1 ? `<nav class="ck-dizin" aria-label="Bu bölümün mekânları">${M.map((m, i) => `<a href="#m-${m.oneri_id}"${cekildi(m) ? ` class="ok"` : ""}><b>${cekildi(m) ? "✓" : i + 1}</b>${esc(m.ad)}${ort(m.puanlar) != null ? `<em>${fP(ort(m.puanlar))}</em>` : ""}</a>`).join("")}</nav>` : ""}
      ${ozet(b)}
      <div class="ck-liste">${M.length ? M.map(kart).join("") : `<div class="ck-bos"><p>Bu bölüme henüz mekân eklenmemiş.</p></div>`}</div>`;
  }
  async function yenidenCiz() {
    const acik = new Set($$("#ck-icerik details[open]").map(d => d.dataset.k)), y = scrollY;
    await yukle(false); ciz();
    $$("#ck-icerik details").forEach(d => { if (acik.has(d.dataset.k)) d.open = true; }); scrollTo(0, y);
  }

  addEventListener("hashchange", () => { if (!D) return; if (!location.hash || /^#(b\/\d*|ekle|galeri|ozet)$/.test(location.hash)) { ciz(); scrollTo(0, 0); } });
  $("#ck-icerik").addEventListener("click", async e => {
    const p = e.target.closest("[data-puanla]"); if (p) return puanla(+p.dataset.puanla);
    const fa = e.target.closest("[data-foto-ac]"); if (fa) return fotoAc(+fa.dataset.fotoAc);
    const hs = e.target.closest("[data-hesap]"); if (hs) return hesapDuzenle(+hs.dataset.hesap, hs.dataset.odak);
    const ck = e.target.closest("[data-cek]"); if (ck) return cekIsaretle(+ck.dataset.cek, ck.dataset.durum === "1", ck);
    const cs = e.target.closest("[data-csv]"); if (cs) return csvIndir(cs.dataset.csv);
    if (e.target.closest("[data-ozet-kopya]")) { try { await navigator.clipboard.writeText(ozetYazi()); toast("Özet kopyalandı"); } catch (er) { modalAc("Özet", `<textarea class="ck-kopya" rows="16" readonly>${esc(ozetYazi())}</textarea>`); } return; }
    if (e.target.closest("[data-kopyala]")) {
      const b = (D.bolumler || []).find(x => x.id === SEC); if (!b) return;
      try { await navigator.clipboard.writeText(ozetMetni(b)); toast("Puanlar kopyalandı"); }
      catch (er) { modalAc("Puanlar", `<textarea class="ck-kopya" rows="14" readonly>${esc(ozetMetni(b))}</textarea>`); }
      return;
    }
    const a = e.target.closest('a[href^="#m-"]');
    if (a) { e.preventDefault(); const k = $(a.getAttribute("href")); if (k) { k.scrollIntoView({ behavior: "smooth", block: "start" }); k.classList.add("vurgu"); setTimeout(() => k.classList.remove("vurgu"), 1600); } }
  });
  $("#ck-icerik").addEventListener("change", async e => {
    const bd = e.target.closest("[data-bdurum]");
    if (bd) {
      const { error } = await db.rpc("cekim_bolum_durum", { p_bolum: +bd.dataset.bdurum, p_durum: bd.value });
      if (error) return toast("Değiştirilemedi: " + error.message);
      toast(`Bölüm durumu: ${DURUM[bd.value]}`); return yenidenCiz();
    }
    const kp = e.target.closest("[data-kapsam]"); if (kp) { KAPSAM = kp.value; ls.set("etd-cekim-kapsam", KAPSAM); return ciz(); }
  });
  $("#ck-icerik").addEventListener("change", e => { const i = e.target.closest("[data-yukle]"); if (i) fotoYukle(+i.dataset.id, i.dataset.yukle, [...i.files]).finally(() => { i.value = ""; }); });

  /* ---------- puan verme (puan verici ve süper yönetici) ---------- */
  function puanla(id) {
    if (!SUNUCU()) return;
    const m = mekanBul(id); if (!m) return;
    const kayit = benimPuan(m) || {};
    const tk = `etd-cekim-taslak-${id}`, taslak = ls.get(tk);
    const geri = taslak && (!kayit.updated_at || taslak.t > Date.parse(kayit.updated_at));
    const P0 = geri ? taslak.puanlar || {} : kayit.puanlar || {}, Y0 = geri ? taslak.yorum || "" : kayit.yorum || "";
    let kirli = !!geri;
    modalAc(m.ad, `
      ${geri ? `<p class="ck-bilgi">Kaydedilmemiş taslağın geri yüklendi. <button type="button" class="linkish" data-at>Taslağı at</button></p>` : ""}
      <form id="cp-form" novalidate>
        <div class="cp-top"><span>Toplam</span><b data-top>–</b><small>/100</small><em data-n></em></div>
        <p class="sm cp-ip">Her kriteri 0–10 arası kaydır. Dokunmadığın kriter boş kalır; toplam, girdiğin kriterlerin ortalamasıdır.</p>
        <div class="cp-list">${KRITER.map(([k, ad]) => { const v = P0[k], has = v != null;
          return `<div class="cp-r${has ? "" : " bos"}" data-k="${k}"><label for="cp-${k}">${esc(ad)}</label><output>${has ? fP(v) : "–"}</output>
            <input id="cp-${k}" type="range" min="0" max="10" step="0.5" value="${has ? v : 5}"><button type="button" class="cp-x" aria-label="${esc(ad)} puanını temizle">×</button></div>`; }).join("")}</div>
        <label class="field" style="margin-top:14px"><span>Yorumun</span><textarea name="yorum" rows="4" maxlength="4000" placeholder="Tavuk, ekmek, sos, usta… Neyi sevdin, neyi sevmedin?">${esc(Y0)}</textarea></label>
        <div class="cp-alt"><button type="button" class="btn btn-line" data-close>Vazgeç</button><button class="btn btn-o" type="submit">Kaydet</button></div>
      </form>`, async () => !kirli || confirm("Kaydetmeden kapatılsın mı? (Taslağın bu telefonda saklanıyor.)"), true);
    const f = $("#cp-form");
    const topla = () => {
      const v = {}; $$(".cp-r:not(.bos)", f).forEach(r => v[r.dataset.k] = Number($("input", r).value));
      const n = Object.keys(v).length, t = n ? Math.round(Object.values(v).reduce((a, c) => a + c, 0) / n * 100) / 10 : null;
      $("[data-top]", f).textContent = fP(t); $("[data-n]", f).textContent = `${n}/${KRITER.length} kriter`;
      return { v, n };
    };
    const taslakYaz = () => { const s = topla(); ls.set(tk, { t: Date.now(), puanlar: s.v, yorum: f.yorum.value }); };
    let tt; const degisti = () => { kirli = true; clearTimeout(tt); tt = setTimeout(taslakYaz, 300); };
    f.addEventListener("input", e => {
      const r = e.target.closest(".cp-r"); if (r) { r.classList.remove("bos"); $("output", r).textContent = fP(e.target.value); topla(); }
      degisti();
    });
    f.addEventListener("click", e => {
      const x = e.target.closest(".cp-x"); if (!x) return; const r = x.closest(".cp-r");
      r.classList.add("bos"); $("output", r).textContent = "–"; topla(); degisti();
    });
    const at = $("[data-at]"); if (at) at.addEventListener("click", () => { ls.del(tk); kirli = false; kapat(true).then(() => puanla(id)); });
    topla();
    f.addEventListener("submit", async e => {
      e.preventDefault(); const s = topla(), y = f.yorum.value.trim();
      if (!s.n && !y) return toast("En az bir kriter puanla ya da yorum yaz.");
      const btn = $("button[type=submit]", f); btn.disabled = true; btn.textContent = "Kaydediliyor…";
      const { data, error } = await db.rpc("cekim_puan_kaydet", { p_oneri: id, p_puanlar: s.v, p_yorum: y || null });
      btn.disabled = false; btn.textContent = "Kaydet";
      if (error) return toast(/fetch|network/i.test(error.message) ? "İnternet yok gibi. Taslağın saklandı, bağlanınca tekrar Kaydet'e bas." : "Kaydedilemedi: " + error.message);
      ls.del(tk); kirli = false; await kapat(true);
      await yenidenCiz();
      toast(data && data.toplam != null ? `Kaydedildi · ${fP(data.toplam)}/100` : "Kaydedildi");
    });
  }

  /* ---------- fotoğraf ve menü ---------- */
  let YUKLENIYOR = false;
  async function fotoYukle(id, tur, files) {
    if (!files.length) return;
    if (YUKLENIYOR) return toast("Önceki yükleme bitsin, sonra tekrar dene.");
    if (!ETDP.kucult) return toast("Fotoğraf aracı yüklenemedi, sayfayı yenile.");
    YUKLENIYOR = true; let ok = 0;
    for (let i = 0; i < files.length; i++) {
      toast(files.length > 1 ? `Yükleniyor ${i + 1}/${files.length}…` : "Yükleniyor…");
      try {
        const { blob, w, h } = await ETDP.kucult(files[i]);
        const yol = `${id}/${uuid()}.jpg`;
        const up = await db.storage.from(BUCKET).upload(yol, blob, { contentType: "image/jpeg", cacheControl: "31536000", upsert: false });
        if (up.error) throw new Error(up.error.message);
        const { error } = await db.rpc("cekim_foto_ekle", { p_oneri: id, p_yol: yol, p_tur: tur, p_genislik: w, p_yukseklik: h, p_aciklama: null });
        if (error) throw new Error(error.message);
        ok++;
      } catch (e) { toast(`${files[i].name || "Fotoğraf"}: ${e.message || "yüklenemedi"}`); await new Promise(r => setTimeout(r, 1500)); }
    }
    YUKLENIYOR = false;
    if (ok) { await yenidenCiz(); toast(tur === "menu" ? `Menü kaydedildi · ${fmtK(new Date())}` : `${ok} fotoğraf eklendi`); }
  }
  function fotoAc(fid) {
    let f = null, m = null;
    for (const x of tumMekanlar()) { const y = (x.m.fotolar || []).find(z => z.id === fid); if (y) { f = y; m = x.m; break; } }
    if (!f) return;
    const ayni = (m.fotolar || []).filter(z => z.tur === f.tur), i = ayni.indexOf(f);
    const silebilir = f.benim || YONETICI() || (BEN && BEN.eposta);
    modalAc(`${m.ad} · ${f.tur === "menu" ? "Menü" : "Fotoğraf"}`, `<figure class="ck-buyuk"><img src="${esc(fotoUrl(f.yol))}" alt="">
      <figcaption>${esc(f.ekleyen_ad || "")} · ${esc(fmtK(f.created_at))}${ayni.length > 1 ? ` · ${i + 1}/${ayni.length}` : ""}</figcaption></figure>
      <div class="cp-alt ck-foto-alt">${ayni.length > 1 ? `<button type="button" class="btn btn-line" data-git="${ayni[(i - 1 + ayni.length) % ayni.length].id}" aria-label="Önceki">←</button><button type="button" class="btn btn-line" data-git="${ayni[(i + 1) % ayni.length].id}" aria-label="Sonraki">→</button>` : ""}
        <a class="btn btn-line" href="${esc(fotoUrl(f.yol))}" target="_blank" rel="noopener">Tam boy ↗</a>
        ${silebilir ? `<button type="button" class="btn btn-danger" data-kaldir>Kaldır</button>` : ""}</div>`, null, true);
    $("#modal-body").onclick = async e => {
      const g = e.target.closest("[data-git]"); if (g) return fotoAc(+g.dataset.git);
      if (e.target.closest("[data-kaldir]")) {
        if (!confirm("Bu fotoğraf kaldırılsın mı?")) return;
        const { error } = await db.rpc("cekim_foto_gizle", { p_id: f.id });
        if (error) return toast("Kaldırılamadı: " + error.message);
        $("#modal-body").onclick = null; await kapat(true); await yenidenCiz(); toast("Fotoğraf kaldırıldı");
      }
    };
  }

  /* ---------- ne yedik, ne ödedik ---------- */
  function hesapDuzenle(id, odak) {
    const m = mekanBul(id); if (!m) return;
    const z = m.ziyaret || {}, S = (z.siparis || []).length ? z.siparis : [{ ad: "", adet: 1, fiyat: null }];
    let kirli = false;
    const satir = x => `<div class="hs-r"><input name="ad" maxlength="80" placeholder="Ör. Tavuk dürüm" value="${esc(x.ad || "")}" aria-label="Ne yedik">
      <input name="adet" type="number" inputmode="numeric" min="1" max="99" value="${esc(x.adet || 1)}" aria-label="Adet">
      <input name="fiyat" type="number" inputmode="decimal" min="0" step="0.5" placeholder="₺" value="${x.fiyat != null ? esc(x.fiyat) : ""}" aria-label="Birim fiyat (₺)">
      <button type="button" class="cp-x" data-sil aria-label="Satırı sil">×</button></div>`;
    modalAc(`${m.ad} · Çekim kaydı`, `<form id="hs-form" novalidate>
      <div class="hs-bas"><span>Ne yedik</span><span>Adet</span><span>Fiyat ₺</span><span></span></div>
      <div id="hs-list">${S.map(satir).join("")}</div>
      <button type="button" class="btn btn-line btn-sm" data-ekle>+ Satır ekle</button>
      <p class="hs-top">Satırların toplamı: <b data-top></b></p>
      <label class="field"><span>Ödenen toplam ₺ <small>(fiş/hesap)</small></span><input name="odenen" type="number" inputmode="decimal" min="0" step="0.5" value="${z.odenen != null ? esc(z.odenen) : ""}" placeholder="Boş bırakırsan satırların toplamı yazılır"></label>
      <label class="field"><span>Menü linki <small>(QR menü vb. · kaydedildiği günün tarihiyle saklanır)</small></span><input name="menu_url" type="url" inputmode="url" value="${esc(z.menu_url || "")}" placeholder="https://…" autocomplete="off" autocapitalize="off"></label>
      <label class="field"><span>Not <small>(isteğe bağlı)</small></span><textarea name="not" rows="2" maxlength="2000" placeholder="Ör. kartla ödendi, porsiyon büyüktü…">${esc(z.not || "")}</textarea></label>
      <div class="cp-alt"><button type="button" class="btn btn-line" data-close>Vazgeç</button><button class="btn btn-o" type="submit">Kaydet</button></div>
    </form>`, async () => !kirli || confirm("Kaydetmeden kapatılsın mı?"), true);
    const f = $("#hs-form"), list = $("#hs-list", f);
    const oku = () => $$(".hs-r", list).map(r => ({ ad: $("[name=ad]", r).value.trim(), adet: +$("[name=adet]", r).value || 1, fiyat: $("[name=fiyat]", r).value === "" ? null : +$("[name=fiyat]", r).value })).filter(x => x.ad);
    const top = () => { const t = siparisToplam(oku()); $("[data-top]", f).textContent = t ? fTL(t) : "–"; return t; };
    f.addEventListener("input", () => { kirli = true; top(); });
    f.addEventListener("click", e => {
      if (e.target.closest("[data-ekle]")) { list.insertAdjacentHTML("beforeend", satir({ ad: "", adet: 1, fiyat: null })); $(".hs-r:last-child [name=ad]", list).focus(); }
      const s = e.target.closest("[data-sil]"); if (s) { s.closest(".hs-r").remove(); if (!$(".hs-r", list)) list.insertAdjacentHTML("beforeend", satir({ ad: "", adet: 1, fiyat: null })); kirli = true; top(); }
    });
    top();
    if (odak && f[odak]) setTimeout(() => f[odak].focus(), 60);
    f.addEventListener("submit", async e => {
      e.preventDefault();
      const u = f.menu_url.value.trim();
      if (u && !/^https?:\/\//i.test(u)) return toast("Menü linki https:// ile başlamalı.");
      const S2 = oku(), od = f.odenen.value === "" ? (siparisToplam(S2) || null) : +f.odenen.value;
      const b = $("button[type=submit]", f); b.disabled = true;
      const { error } = await db.rpc("cekim_ziyaret_kaydet", { p_oneri: id, p_siparis: S2, p_odenen: od, p_menu_url: u || null, p_not: f.not.value.trim() || null });
      b.disabled = false;
      if (error) return toast("Kaydedilemedi: " + error.message);
      kirli = false; await kapat(true); await yenidenCiz(); toast("Çekim kaydı kaydedildi");
    });
  }

  /* ---------- mekân ekle (puan verici, süper yönetici) ---------- */
  let SECG = null, LISTEG = [], ltG, ONERI = [];
  async function onerilerYukle() {
    if (!BEN.kaynak) { ONERI = []; return; }
    const { data } = await db.from("mekan_onerileri").select("id,mekan_adi,google_ad,il,ilce,ulke,durum,created_at,google_place_id").eq("kaynak", BEN.kaynak).order("created_at", { ascending: false }).limit(100);
    ONERI = data || [];
  }
  async function ekleCiz() {
    sekmeler("ekle"); $("#ck-bolumler").hidden = true;
    $("#ck-icerik").innerHTML = `<form id="ekle-form" class="ck-bh" novalidate>
        <h2 style="margin-top:0">Rotaya mekân ekle</h2>
        <p class="ck-meta">Google Maps'te mekânı aç → Paylaş → Bağlantıyı kopyala → buraya yapıştır.</p>
        <label class="field"><span>Google Maps linki</span><input name="url" type="url" inputmode="url" placeholder="https://maps.app.goo.gl/…" autocomplete="off" autocapitalize="off" required></label>
        <div id="ekle-sonuc" class="ck-aday" aria-live="polite"></div>
        <label class="field"><span>Neden gidelim? <small>(isteğe bağlı)</small></span><textarea name="neden" rows="3" maxlength="1000" placeholder="Neyi meşhur, kim önerdi…"></textarea></label>
        <button class="btn btn-o full" type="submit" data-ekle disabled>Rotaya ekle</button>
        <p class="sm" style="margin-top:10px">Eklediğin mekân rota listesine düşer; bölüme alınıp alınmayacağına yönetici karar verir.</p>
      </form>
      <section class="ck-bh"><h3 style="margin:0 0 8px">Eklediklerin</h3><ul class="ck-eklenen" id="ekle-liste"><li class="sm">Yükleniyor…</li></ul></section>`;
    SECG = null; LISTEG = [];
    const ef = $("#ekle-form"), sonuc = $("#ekle-sonuc"), btn = $("[data-ekle]", ef);
    const listeCiz = () => { $("#ekle-liste").innerHTML = ONERI.length ? ONERI.map(r => `<li><span><b>${esc(r.google_ad || r.mekan_adi)}</b><small>${esc(yer(r))} · ${esc(fmtK(r.created_at))}</small></span><span class="badge b-${esc(r.durum)}">${esc(ODURUM[r.durum] || r.durum)}</span></li>`).join("") : `<li class="sm">Henüz eklediğin mekân yok.</li>`; };
    const adayCiz = () => {
      sonuc.innerHTML = LISTEG.map((g, i) => `<button type="button" class="ck-aday-i${g === SECG ? " on" : ""}" data-i="${i}" aria-pressed="${g === SECG}"><b>${esc(g.ad)}${g.tur ? ` <em>${esc(g.tur)}</em>` : ""}${g.kapali ? ` <em class="kapali">Kalıcı kapalı</em>` : ""}</b><small>${esc(temizAd(g.adres))}</small></button>`).join("") + (LISTEG.length > 1 ? `<p class="sm">Doğru mekân değilse listeden seç.</p>` : "");
      const ayni = SECG && ONERI.find(r => r.google_place_id === SECG.place_id);
      if (ayni) sonuc.insertAdjacentHTML("afterbegin", `<p class="ck-uyari" style="margin-bottom:8px">Bunu ${esc(fmtK(ayni.created_at))} tarihinde zaten eklemişsin (${esc(ODURUM[ayni.durum] || ayni.durum)}).</p>`);
      btn.disabled = !SECG || !!ayni;
    };
    sonuc.addEventListener("click", e => { const b = e.target.closest("[data-i]"); if (!b) return; SECG = LISTEG[+b.dataset.i]; adayCiz(); });
    ef.url.addEventListener("input", () => {
      clearTimeout(ltG); const u = ef.url.value.trim(); SECG = null; btn.disabled = true;
      if (!u) { sonuc.innerHTML = ""; return; }
      if (!/^https?:\/\//i.test(u)) { sonuc.innerHTML = `<p class="sm">Linki tam yapıştır (https:// ile başlar).</p>`; return; }
      ltG = setTimeout(async () => {
        sonuc.innerHTML = `<p class="sm"><span class="lc-spin sm-spin" aria-hidden="true"></span> Google'da tanınıyor…</p>`;
        const d = await gfn("link", { url: u });
        if (ef.url.value.trim() !== u) return;
        if (d.error) { sonuc.innerHTML = `<p class="sm" style="color:var(--err)">${esc(d.error)}</p>`; return; }
        LISTEG = (d.sonuc || []).map(g => ({ ...g, place_id: g.place_id || g.id })); SECG = d.emin === false ? null : (LISTEG[0] || null);
        if (!SECG && LISTEG.length) { adayCiz(); sonuc.insertAdjacentHTML("afterbegin", `<p class="sm" style="color:#B86400;font-weight:600;margin-bottom:8px">Bu linkte mekânın tam yeri yok. Adresine bakarak doğru mekânı seç.</p>`); return; }
        if (!SECG) { sonuc.innerHTML = `<p class="sm" style="color:var(--err)">Bu linkten mekân bulunamadı. Google Maps'te mekânın kendi sayfasını açıp Paylaş ile linki al.</p>`; return; }
        adayCiz();
      }, 450);
    });
    ef.addEventListener("submit", async e => {
      e.preventDefault(); if (!SECG || btn.disabled) return;
      const g = SECG, yurtd = g.il === "Yurt dışı";
      const il = yurtd ? "Yurt dışı" : (eslesen(ILLER, g.il) || temizAd(g.il) || null);
      const ilce = yurtd ? null : (eslesen((window.ILCELER || {})[il] || [], g.ilce) || temizAd(g.ilce) || null);
      const row = { mekan_adi: String(g.ad || "").slice(0, 120), il: il ? String(il).slice(0, 40) : "Belirsiz", ilce: ilce ? String(ilce).slice(0, 60) : null, ulke: yurtd ? (g.ulke || "").slice(0, 60) || null : null,
        adres: ef.url.value.trim().slice(0, 400), neden: ef.neden.value.trim().slice(0, 1000) || null, takma_ad: String(BEN.ad || "").slice(0, 60), kvkk_onay: true, yayin_izni: false,
        durum: "listede", onayli: false, haritada_goster: false, kaynak: BEN.kaynak || "panel",
        google_place_id: g.place_id, google_ad: g.ad, google_adres: g.adres, google_url: g.url || null, google_tur: g.tur || null,
        google_eslesme: g.kapali ? "kapali" : "elle", lat: g.lat, lng: g.lng };
      if (row.mekan_adi.length < 2) return toast("Mekân adı okunamadı.");
      btn.disabled = true;
      const { error } = await db.from("mekan_onerileri").insert(row);
      if (error) { btn.disabled = false; return toast("Eklenemedi: " + error.message); }
      toast(`${g.ad} rotaya eklendi`); ef.reset(); sonuc.innerHTML = ""; SECG = null; LISTEG = [];
      await onerilerYukle(); listeCiz();
    });
    await onerilerYukle(); listeCiz();
  }

  /* ---------- çekildi işareti ve ilerleme ---------- */
  const cekildi = m => !!(m.ziyaret && m.ziyaret.cekildi_at);
  const saatYaz = s => { try { const d = new Date(s), bugun = new Date().toDateString() === d.toDateString(); return d.toLocaleString(TR, bugun ? { hour: "2-digit", minute: "2-digit" } : { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); } catch (e) { return ""; } };
  function ilerlemeHtml(M) {
    const n = M.filter(cekildi).length, sira = M.find(m => !cekildi(m));
    return `<div class="ck-ilerle"><div class="ck-ilerle-u"><b>${n}/${M.length}</b> mekân çekildi${sira && n ? ` · Sıradaki: <a href="#m-${sira.oneri_id}">${esc(sira.ad)}</a>` : ""}</div>
      <div class="ck-ilerle-c" role="progressbar" aria-valuemin="0" aria-valuemax="${M.length}" aria-valuenow="${n}"><i style="width:${Math.round(n / M.length * 100)}%"></i></div></div>`;
  }
  async function cekIsaretle(id, durum, btn) {
    if (!durum && !confirm("“Çekildi” işareti kaldırılsın mı?")) return;
    if (btn) btn.disabled = true;
    const { error } = await db.rpc("cekim_cekildi", { p_oneri: id, p_durum: durum });
    if (error) { if (btn) btn.disabled = false; return toast("Kaydedilemedi: " + error.message); }
    await yenidenCiz(); toast(durum ? "Çekildi olarak işaretlendi" : "İşaret kaldırıldı");
  }

  /* ---------- kapsam seçici (galeri, özet) ---------- */
  let KAPSAM = ls.get("etd-cekim-kapsam") || "tum";
  function kapsamHtml(etiket) {
    const L = D.bolumler || [];
    if (KAPSAM !== "tum" && !L.some(b => String(b.id) === String(KAPSAM))) KAPSAM = "tum";
    return `<label class="ck-kapsam"><span>${etiket}</span><select data-kapsam>${[`<option value="tum">Bütün bölümler</option>`].concat(L.filter(b => (b.mekanlar || []).length).map(b => `<option value="${b.id}"${String(b.id) === String(KAPSAM) ? " selected" : ""}>${esc(b.no ? `Bölüm ${b.no}` : b.baslik)}${b.no && !String(b.baslik).toLocaleLowerCase(TR).includes("bölüm " + b.no) ? " · " + esc(b.baslik.slice(0, 40)) : ""}</option>`)).join("")}</select></label>`;
  }
  const kapsamMekanlar = () => {
    const goruldu = new Set();
    return tumMekanlar().filter(({ b }) => KAPSAM === "tum" || String(b.id) === String(KAPSAM)).filter(({ m }) => goruldu.has(m.oneri_id) ? false : goruldu.add(m.oneri_id));
  };

  /* ---------- galeri ---------- */
  function galeriCiz() {
    sekmeler("galeri"); $("#ck-bolumler").hidden = true;
    const L = kapsamMekanlar().filter(({ m }) => (m.fotolar || []).length);
    const top = L.reduce((a, { m }) => a + m.fotolar.length, 0);
    $("#ck-icerik").innerHTML = `<section class="ck-bh"><h2 style="margin-top:0">Galeri</h2>
        <p class="ck-meta">Ekibin çektiği fotoğraflar ve menüler. Herkes görür; dokununca büyür, “Tam boy” ile indirilir.</p>${kapsamHtml("Bölüm")}</section>
      ${L.length ? L.map(({ m, b }) => `<section class="ck-gal"><h3><a href="#b/${b.id}">${esc(m.ad)}</a><small>${esc(b.no ? "Bölüm " + b.no : "")} · ${m.fotolar.length} görsel</small></h3>
        <div class="ck-gal-g">${m.fotolar.map(f => `<button type="button" class="ck-gal-i" data-foto-ac="${f.id}"><img src="${esc(fotoUrl(f.yol))}" alt="" loading="lazy" width="${f.genislik || 300}" height="${f.yukseklik || 300}">${f.tur === "menu" ? `<span>Menü</span>` : ""}</button>`).join("")}</div></section>`).join("")
        : `<div class="ck-bos"><div aria-hidden="true">📷</div><h3>Henüz fotoğraf yok</h3><p>Mekân kartlarındaki “+ Fotoğraf” ve “+ Menü fotoğrafı” ile eklenen görseller burada toplanır.</p></div>`}
      ${top ? `<p class="sm" style="text-align:center;margin-top:12px">${top} görsel</p>` : ""}`;
  }

  /* ---------- özet ve infografik verisi ---------- */
  const urunAnahtar = s => String(s || "").toLocaleLowerCase(TR).replace(/\s+/g, " ").trim();
  function ozetVeri() {
    const L = kapsamMekanlar();
    const R = L.map(({ m, b }) => {
      const z = m.ziyaret || {}, S = z.siparis || [], P = m.puanlar || [];
      return { m, b, z, S, P, puan: ort(P), harcama: z.odenen != null ? Number(z.odenen) : (siparisToplam(S) || null),
        gitti: cekildi(m) || P.length > 0 || S.length > 0 || z.odenen != null, foto: (m.fotolar || []).filter(f => f.tur === "foto").length, menu: (m.fotolar || []).filter(f => f.tur === "menu").length };
    });
    const gidilen = R.filter(r => r.gitti), puanli = R.filter(r => r.puan != null), harcanan = R.filter(r => r.harcama != null);
    const toplamHarcama = harcanan.reduce((a, r) => a + r.harcama, 0);
    const urun = new Map();
    R.forEach(r => r.S.forEach(x => {
      const k = urunAnahtar(x.ad); if (!k) return;
      const u = urun.get(k) || { ad: x.ad, adet: 0, fiyatlar: [], mekan: new Set() };
      u.adet += x.adet || 1; if (x.fiyat != null) u.fiyatlar.push(Number(x.fiyat)); u.mekan.add(r.m.ad); urun.set(k, u);
    }));
    const urunler = [...urun.values()].map(u => ({ ...u, ortFiyat: u.fiyatlar.length ? u.fiyatlar.reduce((a, b) => a + b, 0) / u.fiyatlar.length : null,
      minF: u.fiyatlar.length ? Math.min(...u.fiyatlar) : null, maxF: u.fiyatlar.length ? Math.max(...u.fiyatlar) : null, mekanSay: u.mekan.size })).sort((a, b) => b.adet - a.adet);
    const kriter = KRITER.map(([k, ad]) => { const v = R.flatMap(r => r.P.map(p => p.puanlar && p.puanlar[k])).filter(x => x != null).map(Number); return { k, ad, ort: v.length ? v.reduce((a, b) => a + b, 0) / v.length : null, n: v.length }; }).filter(x => x.ort != null);
    return { R, gidilen, puanli, harcanan, toplamHarcama, urunler, kriter,
      foto: R.reduce((a, r) => a + r.foto, 0), menu: R.reduce((a, r) => a + r.menu, 0), adet: urunler.reduce((a, u) => a + u.adet, 0),
      ortPuan: puanli.length ? puanli.reduce((a, r) => a + r.puan, 0) / puanli.length : null };
  }
  const cubuk = (L, deger, yazi, maks) => `<ul class="ck-cubuk">${L.map(x => { const v = deger(x); return `<li><span class="ck-cubuk-a">${x.etiket}</span><span class="ck-cubuk-c"><i style="width:${maks ? Math.max(2, Math.round(v / maks * 100)) : 0}%"></i></span><b>${yazi(x)}</b></li>`; }).join("")}</ul>`;
  function ozetCiz() {
    sekmeler("ozet"); $("#ck-bolumler").hidden = true;
    const V = ozetVeri();
    const kutu = (b, s) => `<div class="ck-kpi"><b>${b}</b><small>${s}</small></div>`;
    const sira = [...V.puanli].sort((a, b) => b.puan - a.puan).slice(0, 15).map(r => ({ ...r, etiket: esc(r.m.ad) }));
    const harc = [...V.harcanan].sort((a, b) => b.harcama - a.harcama).slice(0, 15).map(r => ({ ...r, etiket: esc(r.m.ad) }));
    $("#ck-icerik").innerHTML = `<section class="ck-bh"><h2 style="margin-top:0">Özet</h2>
        <p class="ck-meta">Ziyaretlerden, puanlardan ve hesaplardan otomatik toplanır. İnfografik ve video için hazır.</p>${kapsamHtml("Kapsam")}
        <div class="ck-ozet-a"><button type="button" class="btn btn-o btn-sm" data-csv="mekan">Mekân tablosu (CSV)</button><button type="button" class="btn btn-line btn-sm" data-csv="urun">Ürün tablosu (CSV)</button><button type="button" class="btn btn-line btn-sm" data-ozet-kopya>Metin olarak kopyala</button></div></section>
      <section class="ck-kpis">
        ${kutu(V.gidilen.length, "mekân ziyaret edildi")}
        ${kutu(V.ortPuan != null ? fP(V.ortPuan) : "–", "ortalama puan /100")}
        ${kutu(V.toplamHarcama ? fTL(V.toplamHarcama) : "–", "toplam harcama")}
        ${kutu(V.harcanan.length ? fTL(Math.round(V.toplamHarcama / V.harcanan.length)) : "–", "mekân başına hesap")}
        ${kutu(V.adet || "–", "ürün yendi / içildi")}
        ${kutu(V.foto + V.menu || "–", `görsel${V.menu ? ` · ${V.menu} menü` : ""}`)}
      </section>
      ${sira.length ? `<section class="ck-bh"><h3 class="ck-bas">Puan sıralaması</h3>${cubuk(sira, r => r.puan, r => fP(r.puan), 100)}</section>` : ""}
      ${V.kriter.length ? `<section class="ck-bh"><h3 class="ck-bas">Kriter ortalamaları <small>/10</small></h3>${cubuk(V.kriter.map(k => ({ ...k, etiket: esc(k.ad) })), k => k.ort, k => fP(k.ort), 10)}</section>` : ""}
      ${harc.length ? `<section class="ck-bh"><h3 class="ck-bas">Mekân başına hesap</h3>${cubuk(harc, r => r.harcama, r => fTL(r.harcama), harc[0].harcama)}</section>` : ""}
      ${V.urunler.length ? `<section class="ck-bh"><h3 class="ck-bas">Ne yedik, ne içtik</h3><div class="ck-tablo"><table><thead><tr><th>Ürün</th><th>Adet</th><th>Ort. fiyat</th><th>En ucuz – en pahalı</th><th>Mekân</th></tr></thead><tbody>
          ${V.urunler.map(u => `<tr><td>${esc(u.ad)}</td><td>${u.adet}</td><td>${u.ortFiyat != null ? fTL(Math.round(u.ortFiyat * 100) / 100) : "–"}</td><td>${u.minF != null ? (u.minF === u.maxF ? fTL(u.minF) : `${fTL(u.minF)} – ${fTL(u.maxF)}`) : "–"}</td><td>${u.mekanSay}</td></tr>`).join("")}</tbody></table></div></section>` : ""}
      ${!V.gidilen.length ? `<div class="ck-bos"><div aria-hidden="true">📊</div><h3>Henüz veri yok</h3><p>Mekânlarda “Burada çektik”, puan ve “Ne yedik, ne ödedik” kayıtları girildikçe bu sayfa kendiliğinden dolar.</p></div>` : ""}`;
  }
  function ozetYazi() {
    const V = ozetVeri(), s = [];
    s.push(KAPSAM === "tum" ? "Bütün bölümler" : (((D.bolumler || []).find(b => String(b.id) === String(KAPSAM)) || {}).baslik || ""));
    s.push(`Ziyaret edilen mekân: ${V.gidilen.length}`, `Ortalama puan: ${V.ortPuan != null ? fP(V.ortPuan) + "/100" : "–"}`,
      `Toplam harcama: ${V.toplamHarcama ? fTL(V.toplamHarcama) : "–"}`, `Mekân başına hesap: ${V.harcanan.length ? fTL(Math.round(V.toplamHarcama / V.harcanan.length)) : "–"}`, `Yenen/içilen ürün: ${V.adet}`);
    const sira = [...V.puanli].sort((a, b) => b.puan - a.puan);
    if (sira.length) { s.push("", "Puan sıralaması:"); sira.forEach((r, i) => s.push(`${i + 1}. ${r.m.ad} — ${fP(r.puan)}/100`)); }
    if (V.urunler.length) { s.push("", "Ne yedik:"); V.urunler.forEach(u => s.push(`${u.ad} × ${u.adet}${u.ortFiyat != null ? ` (ort. ${fTL(Math.round(u.ortFiyat * 100) / 100)})` : ""}`)); }
    return s.join("\n");
  }
  function csvIndir(tur) {
    const V = ozetVeri(), h = v => { const s = v == null ? "" : String(v); return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const sayi = v => v == null ? "" : String(Math.round(v * 100) / 100).replace(".", ",");
    let rows;
    if (tur === "urun") rows = [["Ürün", "Adet", "Ortalama fiyat (TL)", "En ucuz (TL)", "En pahalı (TL)", "Mekân sayısı", "Mekânlar"]]
      .concat(V.urunler.map(u => [u.ad, u.adet, sayi(u.ortFiyat), sayi(u.minF), sayi(u.maxF), u.mekanSay, [...u.mekan].join(", ")]));
    else rows = [["Bölüm", "Mekân", "İlçe", "İl", "Çekildi", "Ortalama puan", ...KRITER.map(k => k[1]), "Puan veren", "Yorumlar", "Ödenen (TL)", "Yenenler", "Fotoğraf", "Menü linki", "Google puanı"]]
      .concat(V.R.map(r => [r.b.no ? `Bölüm ${r.b.no}` : r.b.baslik, r.m.ad, r.m.ilce || "", r.m.il || "", r.z.cekildi_at ? new Date(r.z.cekildi_at).toLocaleString(TR) : "", sayi(r.puan),
        ...KRITER.map(([k]) => { const v = r.P.map(p => p.puanlar && p.puanlar[k]).filter(x => x != null); return v.length ? sayi(v.reduce((a, b) => a + Number(b), 0) / v.length) : ""; }),
        r.P.map(p => p.ad).join(", "), r.P.filter(p => p.yorum).map(p => `${p.ad}: ${p.yorum}`).join(" | "), sayi(r.harcama),
        r.S.map(x => `${x.adet > 1 ? x.adet + "x " : ""}${x.ad}${x.fiyat != null ? " " + x.fiyat + " TL" : ""}`).join(", "), r.foto + r.menu, r.z.menu_url || "", r.m.gpuan != null ? sayi(r.m.gpuan) : ""]));
    const csv = "﻿" + rows.map(r => r.map(h).join(";")).join("\r\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `cekim-${tur === "urun" ? "urunler" : "mekanlar"}-${new Date().toLocaleDateString("en-CA")}.csv`;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    toast("CSV indirildi · Excel ya da Google E-Tablolar ile açılır");
  }

  /* ---------- hesap: şifre değiştir, çıkış ---------- */
  function hesap() {
    modalAc("Hesabım", `<p class="ck-hesap-b"><b>${esc(BEN.ad || "")}</b><small>${BEN.kullanici_adi ? `Kullanıcı adı: ${esc(BEN.kullanici_adi)} · ${esc(ROL_AD[BEN.rol] || BEN.rol)}` : "Yönetici"}</small></p>
      ${YONETICI() || BEN.eposta ? `<a class="btn btn-line full" href="/panel.html" style="margin-bottom:10px">Yönetim paneline git</a>` : ""}
      <form id="sf-form" novalidate class="ck-sf">
        <h4>Şifremi değiştir</h4>
        <label class="field"><span>Şu anki şifren</span><input name="eski" type="password" autocomplete="current-password" required></label>
        <label class="field"><span>Yeni şifre <small>(en az 8 karakter)</small></span><input name="yeni" type="password" autocomplete="new-password" minlength="8" required></label>
        <label class="field"><span>Yeni şifre (tekrar)</span><input name="yeni2" type="password" autocomplete="new-password" minlength="8" required></label>
        <p class="form-msg" role="status" aria-live="polite"></p>
        <button class="btn btn-o full" type="submit">Şifreyi değiştir</button>
      </form>
      <button type="button" class="btn btn-line full" data-cikis style="margin-top:12px">Çıkış yap</button>`);
    const f = $("#sf-form");
    $("[data-cikis]").addEventListener("click", cikis);
    f.addEventListener("submit", async e => {
      e.preventDefault();
      const eski = f.eski.value, yeni = f.yeni.value;
      if (!eski) return mesaj(f, "Şu anki şifreni yaz.");
      if (yeni.length < 8) return mesaj(f, "Yeni şifre en az 8 karakter olmalı.");
      if (yeni !== f.yeni2.value) return mesaj(f, "Yeni şifreler aynı değil.");
      if (yeni === eski) return mesaj(f, "Yeni şifre eskisinden farklı olmalı.");
      const b = $("button[type=submit]", f); b.disabled = true; mesaj(f, "");
      const { data: { session } } = await db.auth.getSession();
      const g = await db.auth.signInWithPassword({ email: session.user.email, password: eski });
      if (g.error) { b.disabled = false; return mesaj(f, /rate|many/i.test(g.error.message) ? "Çok fazla deneme, biraz sonra tekrar dene." : "Şu anki şifren hatalı."); }
      const { error } = await db.auth.updateUser({ password: yeni });
      b.disabled = false;
      if (error) return mesaj(f, /weak|pwned|leak/i.test(error.message) ? "Bu şifre çok bilinen/zayıf, başka bir şifre seç." : /same|different/i.test(error.message) ? "Yeni şifre eskisinden farklı olmalı." : "Değiştirilemedi: " + error.message);
      f.reset(); mesaj(f, "Şifren değiştirildi.", true); toast("Şifren değiştirildi");
    });
  }
  $("#ck-hesap").addEventListener("click", hesap);

  /* ---------- yenileme ---------- */
  async function tazele(elle) {
    if (!D || !modal.hidden || location.hash === "#ekle") return;
    const acik = new Set($$("#ck-icerik details[open]").map(d => d.dataset.k)), y = scrollY;
    const degisti = await yukle(false);
    if (degisti || elle) {
      ciz(); $$("#ck-icerik details").forEach(d => { if (acik.has(d.dataset.k)) d.open = true; }); scrollTo(0, y);
    }
  }
  $("#ck-yenile").addEventListener("click", async e => { const b = e.currentTarget; b.disabled = true; if (location.hash === "#ekle") { await yukle(false); await ekleCiz(); } else await tazele(true); b.disabled = false; toast("Güncellendi"); });
  setInterval(() => { if (document.visibilityState === "visible" && !YUKLENIYOR) tazele(false); }, 45000);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && !YUKLENIYOR) tazele(false); });
  db.auth.onAuthStateChange(ev => { if (ev === "SIGNED_OUT") ekran("login"); });

  basla();
})();

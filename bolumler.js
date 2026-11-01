/* eniyitavukdoner.com — panel: YouTube bölümleri ve mekân detayları (sadece yönetici) */
(function () {
  "use strict";
  const P = window.PANEL; if (!P) return;
  const { db, D, esc, toast, openModal, closeModal, confirmBox, gfn, mapsAra, guvenli, fmtD, nf, DURUM, adGoster } = P;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const TR = "tr-TR";
  const B = { list: [], bag: [], gy: new Map(), yuklendi: false, acik: null, harita: null };
  const BDURUM = { planlaniyor: "Planlanıyor", cekildi: "Çekildi", yayinda: "Yayında" };
  const root = $("#bolum-root");
  if (!root) return;

  /* ---------- yardımcılar ---------- */
  const adOf = r => adGoster(r.google_ad || r.mekan_adi || "");
  const yerOf = r => [r.ilce, r.il === "Yurt dışı" ? r.ulke : r.il].filter(Boolean).join(" · ");
  const oneri = id => D.oneri.find(x => x.id === id);
  const gyOf = r => (r && r.google_place_id && B.gy.get(r.google_place_id)) || null;
  const igHandle = v => {
    const s = String(v || "").trim(); if (!s) return null;
    const m = s.match(/instagram\.com\/([A-Za-z0-9._]{1,30})/i) || s.match(/^@?([A-Za-z0-9._]{1,30})$/);
    return m && !/^(p|reel|reels|explore|stories|accounts)$/i.test(m[1]) ? m[1] : null;
  };
  const igOf = r => igHandle(r.instagram) || igHandle((gyOf(r) || {}).instagram);
  // Elle girilmediyse (Google/site ya da otomatik arama) kontrol edilmesi gerekir
  const igKontrol = r => !!igOf(r) && (!igHandle(r.instagram) || r.instagram_otomatik === true);
  const igAra = r => "https://www.google.com/search?q=" + encodeURIComponent(`site:instagram.com "${adOf(r)}" ${[r.ilce, r.il].filter(Boolean).join(" ")}`);
  const gunAdi = () => new Date().toLocaleDateString(TR, { weekday: "long" }).toLocaleLowerCase(TR);
  const ytId = u => { const m = String(u || "").match(/(?:youtu\.be\/|v=|shorts\/|embed\/)([A-Za-z0-9_-]{11})/); return m ? m[1] : null; };
  // Aynı mekânı öneren tüm kayıtlar (öneri sayısı ve "neden" yazıları)
  const kardesler = r => D.oneri.filter(x => x.id === r.id || (r.google_place_id && x.google_place_id === r.google_place_id));
  const ayniMekan = (a, b) => a.id === b.id || (a.google_place_id && a.google_place_id === b.google_place_id);

  async function gyYukle(rows) {
    const ids = [...new Set(rows.map(r => r.google_place_id).filter(Boolean))].filter(id => !B.gy.has(id));
    for (let i = 0; i < ids.length; i += 100) {
      const { data, error } = await db.from("google_yerler").select("*").in("place_id", ids.slice(i, i + 100));
      if (error) { toast("Google bilgileri alınamadı: " + error.message); return; }
      (data || []).forEach(y => B.gy.set(y.place_id, y));
    }
  }
  async function yukle() {
    const [b, m] = await Promise.all([
      db.from("bolumler").select("*").order("no", { ascending: true, nullsFirst: false }).order("created_at", { ascending: true }),
      db.from("bolum_mekanlari").select("*").order("sira", { ascending: true }),
    ]);
    if (b.error || m.error) { root.innerHTML = `<div class="box empty">Bölümler alınamadı: ${esc((b.error || m.error).message)}</div>`; return false; }
    B.list = b.data || []; B.bag = m.data || []; B.yuklendi = true;
    await gyYukle(B.bag.map(x => oneri(x.oneri_id)).filter(Boolean));
    return true;
  }
  const bolumMekanlari = id => B.bag.filter(x => x.bolum_id === id).sort((a, b) => a.sira - b.sira || a.created_at.localeCompare(b.created_at))
    .map(x => ({ bag: x, r: oneri(x.oneri_id) })).filter(x => x.r);

  /* ---------- mekân kartı ---------- */
  function kartHtml(r, opt = {}) {
    const y = gyOf(r) || {};
    const ks = kardesler(r);
    const puan = y.puan ?? r.google_puan, yorum = y.yorum_sayisi ?? r.google_yorum;
    const ig = igOf(r);
    const tel = y.telefon ? String(y.telefon) : "";
    const web = guvenli(y.web) && !/instagram\.com/i.test(y.web) ? y.web : "";
    const maps = guvenli(y.url) || guvenli(r.google_url) || mapsAra(r);
    const yol = r.lat != null ? `https://www.google.com/maps/dir/?api=1&destination=${r.lat},${r.lng}${r.google_place_id ? "&destination_place_id=" + encodeURIComponent(r.google_place_id) : ""}` : maps;
    const bugun = gunAdi();
    const saatler = Array.isArray(y.saatler) ? y.saatler : [];
    const bugunSaat = saatler.find(s => String(s).toLocaleLowerCase(TR).startsWith(bugun));
    const nedenler = ks.filter(x => x.neden || x.takma_ad);
    const yorumlar = Array.isArray(y.yorumlar) ? y.yorumlar : [];
    const eski = !y.detay_tarih || Date.now() - new Date(y.detay_tarih).getTime() > 30 * 864e5;
    return `<article class="bk" data-oid="${r.id}">
      <div class="bk-h">
        ${opt.sira != null ? `<span class="bk-no">${opt.sira + 1}</span>` : ""}
        <div class="bk-t"><h4>${esc(adOf(r))}</h4>
          <div class="sm">${esc(yerOf(r))}${y.tur || r.google_tur ? ` · ${esc(y.tur || r.google_tur)}` : ""}</div></div>
        <div class="bk-rozet">
          <span class="badge">${esc(DURUM[r.durum] || r.durum || "")}</span>
          ${r.rota_puani != null ? `<span class="badge b-rota" title="Rota puanın">Rota ${Number(r.rota_puani).toFixed(1)}</span>` : ""}
          ${ks.length > 1 ? `<span class="badge b-dup">×${ks.length} öneri</span>` : ""}
          ${y.kapali || r.google_eslesme === "kapali" ? `<span class="badge b-kapali">Kalıcı kapalı</span>` : ""}
        </div>
      </div>
      ${y.adres || r.google_adres ? `<p class="bk-adres">${esc(y.adres || r.google_adres)}</p>` : ""}
      <div class="bk-bilgi">
        ${puan != null ? `<a class="bk-chip bk-g" href="${esc(maps)}" target="_blank" rel="noopener">★ ${Number(puan).toFixed(1)} <small>${nf(yorum || 0)} yorum</small></a>` : ""}
        ${ig ? `<a class="bk-chip bk-ig" href="https://www.instagram.com/${esc(ig)}/" target="_blank" rel="noopener">@${esc(ig)}${igKontrol(r) ? ` <small class="bk-kontrol">kontrol et</small>` : ""}</a>` : `<a class="bk-chip" href="${esc(igAra(r))}" target="_blank" rel="noopener">Instagram'ı ara ↗</a>`}<button type="button" class="bk-mini" data-igac="${r.id}">${ig ? "değiştir" : "ekle"}</button>
        ${tel ? `<a class="bk-chip" href="tel:${esc(tel.replace(/[^\d+]/g, ""))}">☎ ${esc(tel)}</a>` : ""}
        ${web ? `<a class="bk-chip" href="${esc(web)}" target="_blank" rel="noopener">${esc(web.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "").slice(0, 32))} ↗</a>` : ""}
        ${puan == null ? `<a class="bk-chip" href="${esc(maps)}" target="_blank" rel="noopener">Google Maps ↗</a>` : ""}
        <a class="bk-chip" href="${esc(yol)}" target="_blank" rel="noopener">Yol tarifi ↗</a>
      </div>
      ${bugunSaat ? `<p class="bk-saat"><b>Bugün:</b> ${esc(String(bugunSaat).replace(/^[^:]+:\s*/, ""))}</p>` : ""}
      <div class="bk-alt">
        ${saatler.length ? `<details><summary>Çalışma saatleri</summary>${saatler.map(s => `<div${s === bugunSaat ? ' class="bugun"' : ""}>${esc(s)}</div>`).join("")}</details>` : ""}
        ${nedenler.length ? `<details${opt.ac ? " open" : ""}><summary>Önerenler ne demiş? (${nedenler.length})</summary>${nedenler.map(x => `<blockquote>${esc(x.neden || "—")}<cite>${esc(x.takma_ad || "isimsiz")} · ${fmtD(x.created_at)}</cite></blockquote>`).join("")}</details>` : ""}
        ${yorumlar.length ? `<details><summary>Son Google yorumları (${yorumlar.length})</summary>${yorumlar.map(c => `<blockquote><span class="bk-yp">${"★".repeat(Math.round(c.puan || 0))}</span> ${esc(c.metin || "")}<cite>${esc(c.yazar || "Google kullanıcısı")} · ${esc(c.zaman || "")}</cite></blockquote>`).join("")}</details>` : ""}
      </div>
      ${r.yonetici_notu ? `<p class="bk-not"><b>Rota notun:</b> ${esc(r.yonetici_notu)}</p>` : ""}
      <form class="bk-ig-form" data-ig="${r.id}" hidden>
        <input name="ig" placeholder="Instagram: @kullaniciadi ya da profil linki" value="${esc(ig ? "@" + ig : "")}" maxlength="200" autocomplete="off">
        <button class="btn btn-line btn-sm">Kaydet</button>
      </form>
      ${opt.bag ? `<label class="field bk-bnot"${opt.bag.not_ ? "" : " hidden"}><span>Bu bölüm için not</span><textarea rows="2" maxlength="1000" data-bnot="${opt.bag.bolum_id}:${r.id}" placeholder="Çekim notu, sipariş edilecekler, saat…">${esc(opt.bag.not_ || "")}</textarea></label>` : ""}
      <div class="bk-act">
        ${!r.google_place_id ? `<span class="sm warn">Google ile eşleşmemiş: Öneriler sekmesinden eşleştir.</span>` : eski ? `<button type="button" class="icon-btn" data-gdet="${r.id}">Google bilgilerini getir</button>` : opt.bag ? "" : `<button type="button" class="icon-btn" data-gdet="${r.id}">Google bilgilerini yenile</button>`}
        ${opt.bag ? `${opt.bag.not_ ? "" : `<button type="button" class="icon-btn" data-notac="${r.id}">+ Not</button>`}<span class="bk-sag"><button type="button" class="icon-btn" data-yukari="${r.id}" aria-label="Yukarı taşı">↑</button><button type="button" class="icon-btn" data-asagi="${r.id}" aria-label="Aşağı taşı">↓</button><button type="button" class="icon-btn danger" data-bcikar="${r.id}" aria-label="Bölümden çıkar">✕</button></span>` : ""}
      </div>
    </article>`;
  }

  /* ---------- liste görünümü ---------- */
  function listeHtml() {
    if (!B.list.length) return `<div class="box empty">Henüz bölüm yok. <b>+ Yeni bölüm</b> ile ilk bölümü aç, sonra rotadaki mekânları içine ekle.</div>`;
    return `<div class="bl-grid">${B.list.map(b => {
      const ms = bolumMekanlari(b.id);
      return `<button type="button" class="bl-kart" data-bac="${b.id}">
        <span class="bl-no">${b.no != null ? "Bölüm " + esc(b.no) : "Bölüm"}</span>
        <b>${esc(b.baslik)}</b>
        <span class="sm">${esc([b.sehir, b.cekim_tarihi ? fmtD(b.cekim_tarihi) : ""].filter(Boolean).join(" · ") || "Şehir/tarih yok")}</span>
        <span class="bl-alt"><span class="badge bd-${esc(b.durum)}">${esc(BDURUM[b.durum] || b.durum)}</span><span class="sm">${ms.length} mekân</span></span>
        ${ms.length ? `<span class="bl-adlar">${ms.slice(0, 4).map(x => esc(adOf(x.r))).join(" · ")}${ms.length > 4 ? " …" : ""}</span>` : ""}
      </button>`;
    }).join("")}</div>`;
  }

  /* ---------- bölüm detayı ---------- */
  function rotaLinki(ms) {
    const n = ms.filter(x => x.r.lat != null);
    if (!n.length) return "";
    const son = n[n.length - 1].r, ara = n.slice(0, -1).slice(0, 9).map(x => x.r);
    const q = new URLSearchParams({ api: "1", travelmode: "driving", destination: adOf(son) + " " + (son.ilce || ""), });
    if (son.google_place_id) q.set("destination_place_id", son.google_place_id);
    if (ara.length) {
      q.set("waypoints", ara.map(r => adOf(r) + " " + (r.ilce || "")).join("|"));
      if (ara.every(r => r.google_place_id)) q.set("waypoint_place_ids", ara.map(r => r.google_place_id).join("|"));
    }
    return "https://www.google.com/maps/dir/?" + q.toString();
  }
  function detayHtml(b) {
    const ms = bolumMekanlari(b.id);
    const yt = ytId(b.youtube_url);
    const rl = rotaLinki(ms);
    return `<div class="bd">
      <button type="button" class="linkish" data-geri>← Tüm bölümler</button>
      <div class="bd-h">
        <div><span class="bl-no">${b.no != null ? "Bölüm " + esc(b.no) : "Bölüm"}</span><h3>${esc(b.baslik)}</h3>
          <div class="sm">${esc([b.sehir, b.cekim_tarihi ? "Çekim: " + fmtD(b.cekim_tarihi) : ""].filter(Boolean).join(" · "))} <span class="badge bd-${esc(b.durum)}">${esc(BDURUM[b.durum] || b.durum)}</span></div></div>
        <div class="acts">
          <button class="btn btn-line btn-sm" data-bduz="${b.id}">Düzenle</button>
          <button class="btn btn-y btn-sm" data-bekle="${b.id}">+ Mekân ekle</button>
        </div>
      </div>
      ${b.aciklama ? `<p class="bd-acik">${esc(b.aciklama)}</p>` : ""}
      ${guvenli(b.youtube_url) ? `<p><a class="bk-chip bk-yt" href="${esc(b.youtube_url)}" target="_blank" rel="noopener">${yt ? "YouTube videosu ↗" : "Bölüm linki ↗"}</a></p>` : ""}
      ${ms.length ? `<div class="bd-arac">
          <span class="sm"><b>${ms.length}</b> mekân${ms.filter(x => !gyOf(x.r) || !gyOf(x.r).detay_tarih).length ? ` · ${ms.filter(x => !gyOf(x.r) || !gyOf(x.r).detay_tarih).length} mekânın Google bilgisi eksik` : ""}</span>
          <span class="acts">
            <button class="btn btn-line btn-sm" data-hepsi="${b.id}">Eksik Google bilgilerini getir</button>
            ${rl ? `<a class="btn btn-sm" href="${esc(rl)}" target="_blank" rel="noopener">Hepsini Google Maps'te rota yap ↗</a>` : ""}
          </span></div>
        <div class="bd-map" id="bolum-map"></div>
        <div class="bk-list">${ms.map((x, i) => kartHtml(x.r, { sira: i, bag: x.bag })).join("")}</div>`
      : `<div class="box empty">Bu bölümde henüz mekân yok. <b>+ Mekân ekle</b> ile rotadan seç.</div>`}
      <div class="bd-sil"><button class="icon-btn danger" data-bsil="${b.id}">Bölümü sil</button></div>
    </div>`;
  }
  function haritaKur(ms) {
    if (B.harita) { try { B.harita.remove(); } catch (e) { /* */ } B.harita = null; }
    const el = $("#bolum-map"); if (!el) return;
    const n = ms.map((x, i) => ({ ...x, i })).filter(x => x.r.lat != null && x.r.lng != null);
    if (!window.maplibregl || !n.length) { el.hidden = true; return; }
    const mp = new maplibregl.Map({ container: el, style: "https://tiles.openfreemap.org/styles/liberty", center: [n[0].r.lng, n[0].r.lat], zoom: 12, attributionControl: { compact: true } });
    mp.addControl(new maplibregl.NavigationControl({ showCompass: false }));
    const bb = new maplibregl.LngLatBounds();
    n.forEach(x => {
      const m = document.createElement("button"); m.type = "button"; m.className = "bd-pin"; m.textContent = x.i + 1;
      m.setAttribute("aria-label", adOf(x.r));
      m.addEventListener("click", () => { const k = $(`.bk[data-oid="${x.r.id}"]`, root); if (k) { k.scrollIntoView({ behavior: "smooth", block: "start" }); k.classList.add("vurgu"); setTimeout(() => k.classList.remove("vurgu"), 1400); } });
      new maplibregl.Marker({ element: m }).setLngLat([x.r.lng, x.r.lat]).addTo(mp);
      bb.extend([x.r.lng, x.r.lat]);
    });
    if (n.length > 1) mp.fitBounds(bb, { padding: 50, maxZoom: 15, duration: 0 }); else mp.setZoom(15);
    B.harita = mp;
  }
  function ciz() {
    if (B.acik != null) {
      const b = B.list.find(x => x.id === B.acik);
      if (!b) { B.acik = null; return ciz(); }
      root.innerHTML = detayHtml(b); haritaKur(bolumMekanlari(b.id));
    } else { if (B.harita) { try { B.harita.remove(); } catch (e) { /* */ } B.harita = null; } root.innerHTML = listeHtml(); }
  }
  async function ac() {
    if (!B.yuklendi) { root.innerHTML = `<div class="box empty">Yükleniyor…</div>`; if (!(await yukle())) return; }
    ciz();
  }

  /* ---------- formlar ---------- */
  function bolumForm(b = {}) {
    const sonNo = Math.max(0, ...B.list.map(x => x.no || 0));
    openModal(b.id ? "Bölümü düzenle" : "Yeni bölüm", `<form id="bf" novalidate>
      <div class="row2"><label class="field"><span>Bölüm no</span><input name="no" type="number" min="0" max="999" value="${esc(b.no ?? sonNo + 1)}"></label>
        <label class="field"><span>Durum</span><select name="durum">${Object.entries(BDURUM).map(([k, v]) => `<option value="${k}"${(b.durum || "planlaniyor") === k ? " selected" : ""}>${v}</option>`).join("")}</select></label></div>
      <label class="field"><span>Başlık</span><input name="baslik" required maxlength="160" value="${esc(b.baslik || "")}" placeholder="Örn: İstanbul'un Alman dönercileri"></label>
      <div class="row2"><label class="field"><span>Şehir</span><input name="sehir" maxlength="80" value="${esc(b.sehir || "")}" placeholder="İstanbul"></label>
        <label class="field"><span>Çekim tarihi</span><input name="cekim_tarihi" type="date" value="${esc(b.cekim_tarihi || "")}"></label></div>
      <label class="field"><span>YouTube linki <small>(yayınlanınca)</small></span><input name="youtube_url" type="url" maxlength="300" value="${esc(b.youtube_url || "")}" placeholder="https://youtube.com/…"></label>
      <label class="field"><span>Açıklama / plan</span><textarea name="aciklama" rows="3" maxlength="2000">${esc(b.aciklama || "")}</textarea></label>
      <div class="m-foot"><button type="button" class="btn btn-line btn-sm" data-close>Vazgeç</button><button class="btn btn-sm">${b.id ? "Kaydet" : "Bölümü oluştur"}</button></div></form>`);
    const f = $("#bf");
    f.addEventListener("submit", async e => {
      e.preventDefault();
      const v = n => (f[n].value || "").trim();
      if (!v("baslik")) return toast("Başlık gerekli.");
      const yt = v("youtube_url");
      if (yt && !guvenli(yt)) return toast("YouTube linki http(s) ile başlamalı.");
      const row = { no: v("no") === "" ? null : Math.round(Number(v("no"))), durum: v("durum"), baslik: v("baslik"), sehir: v("sehir") || null,
        cekim_tarihi: v("cekim_tarihi") || null, youtube_url: yt || null, aciklama: v("aciklama") || null };
      const q = b.id ? db.from("bolumler").update(row).eq("id", b.id).select().single() : db.from("bolumler").insert(row).select().single();
      const { data, error } = await q;
      if (error) return toast("Kaydedilemedi: " + error.message);
      if (b.id) Object.assign(b, data); else { B.list.push(data); B.acik = data.id; }
      B.list.sort((x, y) => (x.no ?? 1e9) - (y.no ?? 1e9));
      closeModal(); ciz(); toast(b.id ? "Bölüm güncellendi" : "Bölüm oluşturuldu. Şimdi mekân ekle.");
    });
  }

  async function mekanSec(bolumId) {
    const b = B.list.find(x => x.id === bolumId);
    const icerde = new Set(bolumMekanlari(bolumId).map(x => x.r.id));
    // Aynı Google mekânından tek satır göster (önce rotadaki kayıt)
    const sira = { listede: 0, gidildi: 1, incelendi: 2, yeni: 3 };
    const tekil = new Map();
    D.oneri.filter(r => r.durum !== "uygun_degil").sort((x, y) => (sira[x.durum] ?? 9) - (sira[y.durum] ?? 9) || (y.rota_puani ?? -1) - (x.rota_puani ?? -1))
      .forEach(r => { const k = r.google_place_id ? "g:" + r.google_place_id : "o:" + r.id; if (!tekil.has(k)) tekil.set(k, r); });
    const hepsi = [...tekil.values()];
    openModal(`Mekân ekle · ${b.baslik}`, `<div class="ms">
      <div class="toolbar"><input type="search" id="ms-q" placeholder="Mekân, ilçe, il ara…" value="${esc(b.sehir || "")}">
        <label class="check"><input type="checkbox" id="ms-rota" checked><span>Sadece rotadakiler</span></label></div>
      <div class="ms-list" id="ms-list"></div>
      <label class="check" id="ms-rotaya-l" hidden><input type="checkbox" id="ms-rotaya" checked><span>Rotada olmayanları rotaya da ekle</span></label>
      <div class="m-foot"><button type="button" class="btn btn-line btn-sm" data-close>Vazgeç</button><button type="button" class="btn btn-y btn-sm" id="ms-ekle" disabled>Seçilenleri ekle</button></div></div>`);
    const secili = new Set();
    const q = $("#ms-q"), sadeceRota = $("#ms-rota"), list = $("#ms-list"), btn = $("#ms-ekle");
    const norm = s => String(s || "").toLocaleLowerCase(TR);
    function liste() {
      const t = norm(q.value).split(/\s+/).filter(Boolean);
      const rows = hepsi.filter(r => (!sadeceRota.checked || r.durum === "listede" || r.durum === "gidildi"))
        .filter(r => { const s = norm([adOf(r), r.mekan_adi, r.ilce, r.il, r.ulke].join(" ")); return t.every(w => s.includes(w)); });
      list.innerHTML = rows.length ? rows.slice(0, 200).map(r => {
        const var_ = [...icerde].some(id => ayniMekan(oneri(id) || {}, r));
        return `<label class="ms-row${var_ ? " var" : ""}"><input type="checkbox" value="${r.id}"${var_ ? " disabled checked" : secili.has(r.id) ? " checked" : ""}>
          <span><b>${esc(adOf(r))}</b><small>${esc(yerOf(r))}${r.rota_puani != null ? " · rota " + Number(r.rota_puani).toFixed(1) : ""}${r.google_puan != null ? " · ★ " + Number(r.google_puan).toFixed(1) : ""}</small></span>
          <span class="badge">${var_ ? "Bölümde" : esc(DURUM[r.durum] || r.durum)}</span></label>`;
      }).join("") : `<p class="sm" style="padding:14px 4px">Eşleşen mekân yok.${sadeceRota.checked ? " “Sadece rotadakiler” kutusunu kaldırıp tüm önerilerde arayabilirsin." : ""}</p>`;
      tazele();
    }
    function tazele() {
      btn.disabled = !secili.size; btn.textContent = secili.size ? `${secili.size} mekânı ekle` : "Seçilenleri ekle";
      $("#ms-rotaya-l").hidden = ![...secili].some(id => { const r = oneri(id); return r && r.durum !== "listede" && r.durum !== "gidildi"; });
    }
    q.addEventListener("input", liste); sadeceRota.addEventListener("change", liste);
    list.addEventListener("change", e => { const c = e.target.closest("input[type=checkbox]"); if (!c || c.disabled) return; c.checked ? secili.add(+c.value) : secili.delete(+c.value); tazele(); });
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      let sira0 = Math.max(-1, ...B.bag.filter(x => x.bolum_id === bolumId).map(x => x.sira));
      const rows = [...secili].map(id => ({ bolum_id: bolumId, oneri_id: id, sira: ++sira0 }));
      const { data, error } = await db.from("bolum_mekanlari").insert(rows).select();
      if (error) { btn.disabled = false; return toast("Eklenemedi: " + error.message); }
      B.bag.push(...(data || []));
      if ($("#ms-rotaya").checked) {
        const ids = [...secili].filter(id => { const r = oneri(id); return r && r.durum !== "listede" && r.durum !== "gidildi"; });
        if (ids.length) {
          const { error: e2 } = await db.from("mekan_onerileri").update({ durum: "listede" }).in("id", ids);
          if (e2) toast("Bölüme eklendi ama rotaya alınamadı: " + e2.message); else { ids.forEach(id => { oneri(id).durum = "listede"; }); P.renderAll(); }
        }
      }
      await gyYukle([...secili].map(oneri).filter(Boolean));
      closeModal(); ciz(); toast(`${rows.length} mekân bölüme eklendi`);
    });
    liste();
  }

  // Rota sekmesinden: bir mekânı bir bölüme ekle
  function bolumeEkle(r) {
    if (!r) return;
    const yap = () => {
      openModal("Bölüme ekle", `<form id="be" novalidate><p style="margin-bottom:14px"><b>${esc(adOf(r))}</b> <span class="sm">${esc(yerOf(r))}</span></p>
        ${B.list.length ? `<label class="field"><span>Bölüm</span><select name="b">${B.list.map(b => `<option value="${b.id}"${bolumMekanlari(b.id).some(x => ayniMekan(x.r, r)) ? " disabled" : ""}>${b.no != null ? "Bölüm " + esc(b.no) + " · " : ""}${esc(b.baslik)}${bolumMekanlari(b.id).some(x => ayniMekan(x.r, r)) ? " (zaten içinde)" : ""}</option>`).join("")}</select></label>` : `<p class="sm" style="margin-bottom:14px">Henüz bölüm yok.</p>`}
        <div class="m-foot"><button type="button" class="btn btn-line btn-sm" id="be-yeni">+ Yeni bölüm</button>${B.list.length ? `<button class="btn btn-y btn-sm">Ekle</button>` : ""}</div></form>`, true);
      const f = $("#be");
      $("#be-yeni").addEventListener("click", () => bolumForm());
      f.addEventListener("submit", async e => {
        e.preventDefault(); const id = +f.b.value; if (!id) return;
        const sira = Math.max(-1, ...B.bag.filter(x => x.bolum_id === id).map(x => x.sira)) + 1;
        const { data, error } = await db.from("bolum_mekanlari").insert({ bolum_id: id, oneri_id: r.id, sira }).select().single();
        if (error) return toast(/duplicate|23505/.test(error.message + error.code) ? "Bu mekân zaten o bölümde." : "Eklenemedi: " + error.message);
        B.bag.push(data); await gyYukle([r]); closeModal(); toast("Bölüme eklendi"); if (B.acik === id) ciz();
      });
    };
    if (B.yuklendi) yap(); else yukle().then(ok => ok && yap());
  }

  // Rota sekmesinden: tek mekânın detayını aç
  async function detay(r) {
    if (!r) return;
    if (!B.yuklendi) await yukle();
    await gyYukle([r]);
    const icinde = B.list.filter(b => bolumMekanlari(b.id).some(x => ayniMekan(x.r, r)));
    openModal(adOf(r), `<div class="bk-modal">${kartHtml(r, { ac: true })}
      ${icinde.length ? `<p class="sm" style="margin-top:10px">Bölümler: ${icinde.map(b => esc((b.no != null ? "Bölüm " + b.no + " · " : "") + b.baslik)).join(", ")}</p>` : ""}
      <div class="m-foot bk-foot">
        ${r.durum === "listede" ? `<button type="button" class="btn btn-line btn-sm danger-t" id="bk-cikar">Rotadan çıkar</button><button type="button" class="btn btn-line btn-sm" id="bk-duz">Rota puanı / konum</button><button type="button" class="btn btn-line btn-sm" id="bk-gidildi">Gidildi</button>` : ""}
        <button type="button" class="btn btn-y btn-sm" id="bk-bolume">Bölüme ekle</button></div></div>`);
    $("#bk-bolume").addEventListener("click", () => bolumeEkle(r));
    const on = (id, f) => { const el = $(id); if (el) el.addEventListener("click", f); };
    on("#bk-duz", () => P.rotaForm(r));
    on("#bk-gidildi", () => P.toMap(r));
    on("#bk-cikar", async () => {
      if (!(await confirmBox("Bu mekân rotadan çıkarılacak (öneri silinmez, durumu 'İncelendi' olur).", "Rotadan çıkar"))) return;
      const { error } = await db.from("mekan_onerileri").update({ durum: "incelendi" }).eq("id", r.id);
      if (error) return toast("Güncellenemedi: " + error.message);
      r.durum = "incelendi"; P.renderAll(); toast("Rotadan çıkarıldı");
    });
  }

  /* ---------- Google bilgisi ---------- */
  async function googleGetir(r, btn) {
    if (!r || !r.google_place_id) return false;
    if (btn) { btn.disabled = true; btn.textContent = "Getiriliyor…"; }
    const d = await gfn("detay", { place_id: r.google_place_id, zorla: true });
    if (d.error) { if (btn) { btn.disabled = false; btn.textContent = "Tekrar dene"; } toast(d.error); return false; }
    if (d.detay) B.gy.set(r.google_place_id, { ...(B.gy.get(r.google_place_id) || {}), ...d.detay });
    if (d.puan) D.oneri.filter(x => x.google_place_id === r.google_place_id).forEach(x => Object.assign(x, d.puan));
    return true;
  }
  function kartYenile(r) {
    const k = $$(`.bk[data-oid="${r.id}"]`, document);
    k.forEach(el => {
      const inModal = !!el.closest("#modal");
      const b = B.acik != null ? B.bag.find(x => x.bolum_id === B.acik && x.oneri_id === r.id) : null;
      const i = B.acik != null ? bolumMekanlari(B.acik).findIndex(x => x.r.id === r.id) : -1;
      el.outerHTML = inModal ? kartHtml(r, { ac: true }) : kartHtml(r, { sira: i >= 0 ? i : null, bag: b });
    });
  }

  /* ---------- olaylar ---------- */
  async function tikla(e) {
    const t = e.target;
    const by = t.closest("[data-bac]"); if (by) { B.acik = +by.dataset.bac; ciz(); window.scrollTo({ top: 0 }); return; }
    if (t.closest("[data-geri]")) { B.acik = null; ciz(); return; }
    const b = t.closest("button"); if (!b) return;
    if (b.dataset.igac) { const f = b.closest(".bk").querySelector(".bk-ig-form"); f.hidden = !f.hidden; if (!f.hidden) f.ig.focus(); return; }
    if (b.dataset.notac) { const l = b.closest(".bk").querySelector(".bk-bnot"); l.hidden = false; b.remove(); l.querySelector("textarea").focus(); return; }
    if (b.dataset.bduz) return bolumForm(B.list.find(x => x.id === +b.dataset.bduz));
    if (b.dataset.bekle) return mekanSec(+b.dataset.bekle);
    if (b.dataset.bsil) {
      const bo = B.list.find(x => x.id === +b.dataset.bsil);
      if (!(await confirmBox(`<b>${esc(bo.baslik)}</b> bölümü silinecek. İçindeki mekânlar rotadan ve önerilerden silinmez.`, "Bölümü sil"))) return;
      const { error } = await db.from("bolumler").delete().eq("id", bo.id);
      if (error) return toast("Silinemedi: " + error.message);
      B.list = B.list.filter(x => x.id !== bo.id); B.bag = B.bag.filter(x => x.bolum_id !== bo.id); B.acik = null; ciz(); toast("Bölüm silindi"); return;
    }
    if (b.dataset.gdet) { const r = oneri(+b.dataset.gdet); if (await googleGetir(r, b)) { kartYenile(r); P.renderAll(); toast("Google bilgileri güncellendi"); } return; }
    if (b.dataset.hepsi) {
      const ms = bolumMekanlari(+b.dataset.hepsi).filter(x => x.r.google_place_id && !(gyOf(x.r) || {}).detay_tarih);
      if (!ms.length) return toast("Tüm mekânların Google bilgisi zaten var.");
      b.disabled = true; let n = 0;
      for (const x of ms) { b.textContent = `Getiriliyor ${++n}/${ms.length}…`; if (!(await googleGetir(x.r))) break; }
      P.renderAll(); ciz(); toast("Google bilgileri getirildi"); return;
    }
    const kaydir = async (id, yon) => {
      const ms = bolumMekanlari(B.acik); const i = ms.findIndex(x => x.r.id === id), j = i + yon;
      if (i < 0 || j < 0 || j >= ms.length) return;
      [ms[i], ms[j]] = [ms[j], ms[i]];
      const guncel = ms.map((x, k) => ({ ...x.bag, sira: k }));
      const { error } = await db.from("bolum_mekanlari").upsert(guncel.map(({ bolum_id, oneri_id, sira, not_ }) => ({ bolum_id, oneri_id, sira, not_ })));
      if (error) return toast("Sıralanamadı: " + error.message);
      guncel.forEach(g => { const o = B.bag.find(x => x.bolum_id === g.bolum_id && x.oneri_id === g.oneri_id); if (o) o.sira = g.sira; });
      ciz();
    };
    if (b.dataset.yukari) return kaydir(+b.dataset.yukari, -1);
    if (b.dataset.asagi) return kaydir(+b.dataset.asagi, 1);
    if (b.dataset.bcikar) {
      const id = +b.dataset.bcikar;
      if (!(await confirmBox("Mekân bu bölümden çıkarılacak (rotada kalır).", "Çıkar"))) return;
      const { error } = await db.from("bolum_mekanlari").delete().eq("bolum_id", B.acik).eq("oneri_id", id);
      if (error) return toast("Çıkarılamadı: " + error.message);
      B.bag = B.bag.filter(x => !(x.bolum_id === B.acik && x.oneri_id === id)); ciz(); toast("Bölümden çıkarıldı");
    }
  }
  root.addEventListener("click", tikla);
  $("#modal").addEventListener("click", e => { if (e.target.closest("[data-gdet],[data-igac]") && e.target.closest(".bk-modal")) tikla(e); });

  async function igKaydet(e) {
    const f = e.target.closest("form[data-ig]"); if (!f) return;
    e.preventDefault();
    const r = oneri(+f.dataset.ig); const v = f.ig.value.trim();
    const h = v ? igHandle(v) : null;
    if (v && !h) return toast("Instagram kullanıcı adı ya da profil linki yaz (örn. @mekan).");
    const deger = h ? `https://www.instagram.com/${h}/` : null;
    const ids = kardesler(r).map(x => x.id);
    const { error } = await db.from("mekan_onerileri").update({ instagram: deger, instagram_otomatik: false }).in("id", ids);
    if (error) return toast("Kaydedilemedi: " + error.message);
    D.oneri.filter(x => ids.includes(x.id)).forEach(x => { x.instagram = deger; x.instagram_otomatik = false; });
    kartYenile(r); toast(h ? "Instagram kaydedildi" : "Instagram silindi");
  }
  root.addEventListener("submit", igKaydet);
  $("#modal").addEventListener("submit", igKaydet);

  root.addEventListener("change", async e => {
    const ta = e.target.closest("[data-bnot]"); if (!ta) return;
    const [bid, oid] = ta.dataset.bnot.split(":").map(Number);
    const not_ = ta.value.trim() || null;
    const { error } = await db.from("bolum_mekanlari").update({ not_ }).eq("bolum_id", bid).eq("oneri_id", oid);
    if (error) return toast("Not kaydedilemedi: " + error.message);
    const o = B.bag.find(x => x.bolum_id === bid && x.oneri_id === oid); if (o) o.not_ = not_;
    toast("Not kaydedildi");
  });

  $("#add-bolum").addEventListener("click", () => { if (B.yuklendi) bolumForm(); else yukle().then(ok => ok && bolumForm()); });
  $("#tabs").addEventListener("click", e => { const b = e.target.closest("[data-tab]"); if (b && b.dataset.tab === "bolum") ac(); });

  // Panel verisi her yüklendiğinde bölümleri de tazele (rota satırlarındaki "Bölüm 1" rozetleri için)
  async function yenile() {
    if (!(await yukle())) return;
    P.renderRota();
    if (!$('[data-pane="bolum"]').hidden) ciz();
  }
  function rozet(r) {
    if (!B.yuklendi) return "";
    return B.list.filter(b => bolumMekanlari(b.id).some(x => ayniMekan(x.r, r)))
      .map(b => `<span class="badge bd-${esc(b.durum)}" title="${esc(b.baslik)}">${b.no != null ? "Bölüm " + esc(b.no) : "Bölüm"}</span>`).join("");
  }
  window.BOLUM = { detay, bolumeEkle, yenile, rozet };
})();

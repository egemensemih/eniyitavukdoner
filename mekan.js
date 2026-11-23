/* eniyitavukdoner.com — mekân sayfası v11 (karakterler) */
(function () {
  "use strict";
  const C = window.SITE_CONFIG || {};
  const K = window.KARAKTER;
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const TR = "tr-TR";
  $("#yil").textContent = new Date().getFullYear();
  const main = $("#mk");

  const fmt = p => { if (p == null || p === "") return "–"; const n = Math.round(Number(p) * 10) / 10; return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ","); };
  const guvenli = u => /^https?:\/\/[^\s"'<>]+$/i.test(String(u || "").trim()) ? String(u).trim() : null;
  const insta = v => { const s = String(v || "").trim(); if (!s) return null; if (/^@?[\w.]{1,30}$/.test(s)) return "https://www.instagram.com/" + s.replace(/^@/, "") + "/"; return guvenli(s); };
  const instaAd = u => { const m = String(u || "").match(/instagram\.com\/([\w.]+)/i); return m ? "@" + m[1] : "Instagram"; };
  const bos = (t, p) => { main.innerHTML = `<div class="mk-empty wrap"><h1>${t}</h1><p class="muted">${p}</p><a class="btn btn-o" href="./#harita">Haritaya dön</a></div>`; };
  const ytId = u => { const m = String(u || "").match(/(?:youtu\.be\/|v=|shorts\/|embed\/|live\/)([\w-]{11})/); return m ? m[1] : null; };
  const yer = m => [m.adres, m.ilce, m.il === "Yurt dışı" ? m.ulke : m.il].filter(Boolean).join(", ");
  const maps = m => guvenli(m.maps_url) || "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent([m.ad, m.ilce, m.il === "Yurt dışı" ? m.ulke : m.il].filter(Boolean).join(" "));
  const yol = m => m.lat != null && m.lng != null ? `https://www.google.com/maps/dir/?api=1&destination=${m.lat},${m.lng}` : maps(m);
  const tarih = d => { try { return new Date(d + "T12:00:00").toLocaleDateString(TR, { month: "long", year: "numeric" }); } catch (e) { return ""; } };
  const paragraflar = t => String(t || "").split(/\n\s*\n/).map(s => s.trim()).filter(Boolean).map(p => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join("");

  const IKON = {
    yol: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l18-8-8 18-2-8z"/></svg>',
    maps: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-5.6-7-11a7 7 0 0114 0c0 5.4-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>',
    insta: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.5 6.5h.01"/></svg>',
    izle: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
    g: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 01-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3z"/><path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0012 22z"/><path fill="#FBBC05" d="M6.4 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.4H3.1a10 10 0 000 9.2z"/><path fill="#EA4335" d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 003.1 7.4L6.4 10c.8-2.3 3-4.1 5.6-4.1z"/></svg>',
  };

  const fotoUrl = yol => `${C.SUPABASE_URL}/storage/v1/object/public/mekan-foto/${String(yol).split("/").map(encodeURIComponent).join("/")}`;
  const yildiz = p => { const n = Math.max(0, Math.min(5, Number(p) || 0)); return `<span class="gy-st" aria-label="5 üzerinden ${fmt(n)}"><i style="width:${n * 20}%"></i></span>`; };

  function galeriHtml(F, ad) {
    if (!F.length) return "";
    const ilk = F.slice(0, 5), kalan = F.length - ilk.length;
    return `<section class="mk-galeri g${Math.min(F.length, 5)}" aria-label="${esc(ad)} fotoğrafları">${ilk.map((f, i) => `<button type="button" class="mg-i" data-foto="${i}" aria-label="Fotoğraf ${i + 1}${f.aciklama ? ": " + esc(f.aciklama) : ""}">
      <img src="${esc(fotoUrl(f.yol))}" alt="${esc(f.aciklama || ad)}" ${i ? 'loading="lazy"' : ""} decoding="async" width="${f.genislik || 1200}" height="${f.yukseklik || 900}">
      ${i === ilk.length - 1 && kalan > 0 ? `<span class="mg-daha">+${kalan} fotoğraf</span>` : ""}</button>`).join("")}
      ${F.length > 1 ? `<button type="button" class="mg-tum" data-foto="0">Tüm fotoğraflar (${F.length})</button>` : ""}</section>`;
  }
  function lightbox(F, ad) {
    let i = 0, x0 = null;
    const lb = document.createElement("div"); lb.className = "lb"; lb.hidden = true; lb.setAttribute("role", "dialog"); lb.setAttribute("aria-modal", "true"); lb.setAttribute("aria-label", ad + " fotoğrafları");
    lb.innerHTML = `<button type="button" class="lb-x" aria-label="Kapat">×</button><button type="button" class="lb-n lb-p" aria-label="Önceki">‹</button><figure><img alt=""><figcaption></figcaption></figure><button type="button" class="lb-n lb-s" aria-label="Sonraki">›</button><span class="lb-c"></span>`;
    document.body.appendChild(lb);
    const img = lb.querySelector("img"), cap = lb.querySelector("figcaption"), cnt = lb.querySelector(".lb-c");
    let once = null;
    const goster = n => { i = (n + F.length) % F.length; const f = F[i]; img.src = fotoUrl(f.yol); img.alt = f.aciklama || ad; cap.textContent = f.aciklama || ""; cnt.textContent = `${i + 1} / ${F.length}`;
      lb.classList.toggle("tek", F.length < 2); [F[i + 1], F[i - 1]].forEach(g => { if (g) { const p = new Image(); p.src = fotoUrl(g.yol); } }); };
    const ac = n => { once = document.activeElement; goster(n); lb.hidden = false; document.documentElement.style.overflow = "hidden"; lb.querySelector(".lb-x").focus(); };
    const kapat = () => { lb.hidden = true; document.documentElement.style.overflow = ""; if (once) once.focus(); };
    lb.addEventListener("click", e => { if (e.target.closest(".lb-x") || e.target === lb) kapat(); else if (e.target.closest(".lb-p")) goster(i - 1); else if (e.target.closest(".lb-s")) goster(i + 1); });
    addEventListener("keydown", e => { if (lb.hidden) return; if (e.key === "Escape") kapat(); else if (e.key === "ArrowLeft") goster(i - 1); else if (e.key === "ArrowRight") goster(i + 1); else if (e.key === "Tab") { e.preventDefault(); lb.querySelector(".lb-x").focus(); } });
    lb.addEventListener("touchstart", e => { x0 = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener("touchend", e => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 45) goster(i + (dx < 0 ? 1 : -1)); });
    return ac;
  }

  // Google: yalnızca puan, yorum sayısı ve Google'a bağlantı
  function googleHtml(g, m) {
    const url = guvenli(g.url) || maps(m);
    const say = Number(g.yorum_sayisi || 0);
    return `<div class="gk">
      <div class="gk-l"><span class="gk-logo">${IKON.g}</span><div><small>Google Haritalar'da</small>
        <div class="gk-p"><b>${fmt(g.puan)}</b>${yildiz(g.puan)}</div>
        <span class="gk-s">${say ? say.toLocaleString(TR) + " Google yorumu" : "Henüz yorum yok"}</span></div></div>
      <a class="btn btn-line gk-a" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Google'da tüm yorumları oku ↗</a>
      <p class="gk-n">Puan ve yorumlar Google kullanıcılarına aittir. Biz dükkânlara puan vermiyoruz; karakter yakıştırıyoruz.</p>
    </div>`;
  }

  function karakterlerHtml(kl, m) {
    if (!kl.length) return `<div class="kk-bos"><p><b>Karakterleri yolda.</b> Bu dükkâna hangi karakterleri yakıştırdığımızı bölüm yayına girince burada göreceksin.</p></div>`;
    const kp = K.kapi(m);
    return `<div class="kk-grid">${kl.map(k => { const c = K.bul(k), kapida = kp.includes(k);
      return `<article class="kk${kapida ? " kapida" : ""}" style="--kr:${c.renk};--ky:${c.yazi}">
        ${K.sticker(k, { w: 132, cls: "kk-stk", alt: "" })}
        <div class="kk-t">${kapida ? `<span class="kk-etk">Kapıdaki sticker</span>` : ""}
          <h3>${esc(c.ad)} <span>Dönerci</span></h3>
          <p>${esc(c.uzun)}</p>
          <a class="kk-l" href="./?karakter=${encodeURIComponent(k)}#karakterler">Diğer ${esc(c.ad)} dükkânlar →</a></div>
      </article>`; }).join("")}</div>`;
  }

  async function run() {
    const id = parseInt(new URLSearchParams(location.search).get("id"), 10);
    if (!id) return bos("Mekân bulunamadı", "Bağlantı eksik görünüyor. Haritadan bir mekân seçebilirsin.");
    if (!window.supabase || !C.SUPABASE_URL || !K) return bos("Şu an yüklenemedi", "Birazdan tekrar dener misin?");
    const db = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const [mr, fr] = await Promise.all([
      db.from("mekanlar").select("id,ad,il,ilce,ulke,adres,lat,lng,puan_notu,etiketler,bolum_url,maps_url,instagram,aciklama,ziyaret_tarihi,karakterler,kapi").eq("id", id).eq("yayinda", true).maybeSingle(),
      db.from("mekan_fotolar").select("yol,aciklama,genislik,yukseklik").eq("mekan_id", id).order("sira").order("id").limit(40),
    ]);
    const F = fr.error ? [] : (fr.data || []);
    const m = mr.data;
    if (mr.error || !m) return bos("Mekân bulunamadı", "Bu mekân henüz yayında değil ya da kaldırılmış.");
    const kl = K.sirali(m), kp = K.kapi(m), ana = K.ana(m) ? K.bul(K.ana(m)) : null;
    const sehir = [m.ilce, m.il === "Yurt dışı" ? m.ulke : m.il].filter(Boolean).join(", ");

    document.title = `${m.ad}${kl.length ? " · " + kl.slice(0, 3).map(k => K.bul(k).ad).join(", ") : ""} | eniyitavukdoner.com`;
    const md = document.querySelector('meta[name=description]');
    md.content = `${m.ad} (${sehir})${kl.length ? ": " + kl.map(k => K.bul(k).ad).join(", ") + " dönerci." : "."} Denedik'in gidip denediği tavuk dönerci; karakterleri, bölümü ve Google puanı.`;
    if (ana) { const r = document.querySelector('meta[name=theme-color]'); if (r) r.content = ana.renk; }

    const vid = ytId(m.bolum_url), ig = insta(m.instagram), bolum = guvenli(m.bolum_url);
    const metin = paragraflar(m.aciklama);

    main.innerHTML = `
    <section class="mk-hero mkk-hero"${ana ? ` style="--kr:${ana.renk}"` : ""}><div class="wrap">
      <a class="mk-back" href="./#harita">← Türkiye Tavuk Dönerci Haritası</a>
      <div class="mk-top">
        <div class="mk-id">
          <div class="mk-tags"><span class="tag blue">Denedik'te denendi</span>${m.ziyaret_tarihi ? `<span class="mk-date">${esc(tarih(m.ziyaret_tarihi))}</span>` : ""}</div>
          <h1>${esc(m.ad)}</h1>
          <p class="addr">${esc(yer(m))}</p>
          ${kl.length ? `<div class="krz-l">${kl.map(k => K.rozet(k)).join("")}</div>` : ""}
          <div class="mk-links">
            <a class="mkl" href="${esc(yol(m))}" target="_blank" rel="noopener">${IKON.yol}Yol tarifi</a>
            <a class="mkl" href="${esc(maps(m))}" target="_blank" rel="noopener">${IKON.maps}Google Maps</a>
            ${ig ? `<a class="mkl" href="${esc(ig)}" target="_blank" rel="noopener">${IKON.insta}${esc(instaAd(ig))}</a>` : ""}
            ${bolum ? `<a class="mkl mkl-y" href="${esc(bolum)}" target="_blank" rel="noopener">${IKON.izle}Bölümü izle</a>` : ""}
          </div>
        </div>
        ${kp.length ? `<figure class="mk-kapi k${kp.length}">${kp.map((k, i) => K.sticker(k, { w: 260, cls: "kapi-stk", eager: !i, alt: K.bul(k).ad + " Dönerci sticker'ı" })).join("")}<figcaption>${kp.length > 1 ? "Kapısındaki sticker'lar" : "Kapısındaki sticker"}</figcaption></figure>`
          : ana ? `<figure class="mk-kapi k1">${K.sticker(ana.k, { w: 260, cls: "kapi-stk", eager: true, alt: ana.ad + " Dönerci" })}<figcaption>Karakteri</figcaption></figure>` : ""}
      </div>
    </div></section>
    ${F.length ? `<div class="wrap">${galeriHtml(F, m.ad)}</div>` : ""}

    <section class="sec mk-body"><div class="wrap">
      <div class="mk-h bant-h"><h2><span class="bant">Biz ne dedik?</span></h2><p>Puan vermiyoruz. Her dükkâna, yediğimiz dönere göre karakter yakıştırıyoruz.</p></div>
      ${karakterlerHtml(kl, m)}

      ${vid || m.puan_notu || metin ? `<div class="mk-story${vid ? "" : " tek"}">
        ${vid ? `<div class="mk-video"><iframe src="https://www.youtube-nocookie.com/embed/${vid}" title="${esc(m.ad)} bölümü" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>` : ""}
        <div class="mk-text">
          ${m.puan_notu ? `<p class="mk-quote">“${esc(m.puan_notu)}”</p>` : ""}
          ${metin}
        </div>
      </div>` : ""}

      <section class="mk-google" id="mk-google" hidden></section>

      <div class="mk-where">
        <div class="mk-map">${m.lat != null && m.lng != null ? `<iframe src="https://www.google.com/maps?q=${Number(m.lat)},${Number(m.lng)}&z=16&hl=tr&output=embed" title="${esc(m.ad)} Google Haritalar'da" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>` : ""}</div>
        <div class="mk-where-txt"><h2>Nerede?</h2><p class="addr">${esc(yer(m))}</p>
          <div class="mk-acts"><a class="btn btn-sm" href="${esc(yol(m))}" target="_blank" rel="noopener">Yol tarifi al</a><a class="btn btn-line btn-sm" href="${esc(maps(m))}" target="_blank" rel="noopener">Google Maps'te aç ↗</a></div></div>
      </div>

      <section class="mk-benzer" id="mk-benzer" hidden></section>
    </div></section>`;

    if (F.length) {
      const ac = lightbox(F, m.ad);
      main.querySelector(".mk-galeri").addEventListener("click", e => { const b = e.target.closest("[data-foto]"); if (b) ac(+b.dataset.foto); });
      const og = document.createElement("meta"); og.setAttribute("property", "og:image"); og.content = fotoUrl(F[0].yol); const eski = document.querySelector('meta[property="og:image"]'); if (eski) eski.replaceWith(og);
    }
    // Google puanı ve yorum sayısı
    db.functions.invoke("google-mekan", { body: { islem: "google_genel", mekan_id: id } }).then(({ data }) => {
      if (!data || !data.google || data.google.puan == null) return;
      const s = document.getElementById("mk-google"); s.innerHTML = googleHtml(data.google, m); s.hidden = false;
    }).catch(() => { /* Google kutusu isteğe bağlı */ });
    // Aynı ana karakterdeki diğer dükkânlar
    if (ana) db.from("mekanlar").select("id,ad,il,ilce,ulke,karakterler,kapi").eq("yayinda", true).contains("karakterler", [ana.k]).neq("id", id).limit(8).then(({ data }) => {
      if (!data || !data.length) return;
      const s = document.getElementById("mk-benzer");
      s.innerHTML = `<div class="mk-h"><h2>Başka ${esc(ana.ad)} dükkânlar</h2></div><div class="mb-l">${data.map(d => { const a = K.ana(d) || ana.k;
        return `<a class="mb" href="mekan.html?id=${d.id}" style="--kr:${K.bul(a).renk}">${K.sticker(a, { w: 56, alt: "" })}<span><b>${esc(d.ad)}</b><small>${esc([d.ilce, d.il === "Yurt dışı" ? d.ulke : d.il].filter(Boolean).join(", "))}</small></span></a>`; }).join("")}</div>`;
      s.hidden = false;
    });
  }
  run().catch(e => { console.warn(e); bos("Şu an yüklenemedi", "Birazdan tekrar dener misin?"); });
})();

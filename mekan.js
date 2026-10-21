/* eniyitavukdoner.com — mekân sayfası v7 */
(function () {
  "use strict";
  const C = window.SITE_CONFIG || {};
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const KRITER = C.KRITERLER || [];
  const KISI = C.KISILER || [{ k: "tahsin", ad: "Tahsin" }, { k: "egemen", ad: "Egemen" }];
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
  const yol = m => `https://www.google.com/maps/dir/?api=1&destination=${m.lat},${m.lng}`;
  const tarih = d => { try { return new Date(d + "T12:00:00").toLocaleDateString(TR, { month: "long", year: "numeric" }); } catch (e) { return ""; } };
  const paragraflar = t => String(t || "").split(/\n\s*\n/).map(s => s.trim()).filter(Boolean).map(p => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join("");

  const IKON = {
    yol: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l18-8-8 18-2-8z"/></svg>',
    maps: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-5.6-7-11a7 7 0 0114 0c0 5.4-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>',
    insta: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.5 6.5h.01"/></svg>',
    izle: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
  };

  function kisiKolon(kisi, d, i) {
    const p = (d && d.puanlar) || {};
    const var_ = d && (d.toplam != null || d.yorum);
    return `<article class="pcol p${i}">
      <header><span class="pav">${esc(kisi.ad[0])}</span><div><b>${esc(kisi.ad)}</b><small>${var_ ? "puanı ve yorumu" : "henüz puanlamadı"}</small></div>
        <span class="ptop"><b>${fmt(d && d.toplam)}</b><small>/ 100</small></span></header>
      ${var_ ? `<div class="pbars">${KRITER.map(([k, ad]) => {
        const v = p[k]; const has = v != null && v !== "";
        return `<div class="pbar${has ? "" : " yok"}"><span>${esc(ad)}</span><span class="t"><i style="width:${has ? Math.max(0, Math.min(100, Number(v) * 10)) : 0}%"></i></span><b>${has ? fmt(v) : "–"}</b></div>`;
      }).join("")}</div>
      ${d.yorum ? `<div class="pyorum"><h3>Yorumu</h3>${paragraflar(d.yorum)}</div>` : ""}` : `<p class="muted pbos">${esc(kisi.ad)} bu mekânı henüz puanlamadı.</p>`}
    </article>`;
  }

  async function run() {
    const id = parseInt(new URLSearchParams(location.search).get("id"), 10);
    if (!id) return bos("Mekân bulunamadı", "Bağlantı eksik görünüyor. Haritadan bir mekân seçebilirsin.");
    if (!window.supabase || !C.SUPABASE_URL) return bos("Şu an yüklenemedi", "Birazdan tekrar dener misin?");
    const db = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const [mr, dr] = await Promise.all([
      db.from("mekanlar").select("id,ad,il,ilce,ulke,adres,lat,lng,puan,puan_tahsin,puan_egemen,puan_notu,etiketler,bolum_url,maps_url,instagram,aciklama,kriterler,ziyaret_tarihi").eq("id", id).eq("yayinda", true).maybeSingle(),
      db.from("degerlendirmeler").select("kisi,puanlar,yorum,toplam").eq("mekan_id", id),
    ]);
    const m = mr.data;
    if (mr.error || !m) return bos("Mekân bulunamadı", "Bu mekân henüz yayında değil ya da kaldırılmış.");
    const deg = {}; (dr.data || []).forEach(d => deg[d.kisi] = d);

    const puanYazi = m.puan != null ? `${fmt(m.puan)}/100` : "";
    document.title = `${m.ad}${puanYazi ? " · Denedik puanı " + puanYazi : ""} | eniyitavukdoner.com`;
    const md = document.querySelector('meta[name=description]');
    md.content = `${m.ad} (${[m.ilce, m.il === "Yurt dışı" ? m.ulke : m.il].filter(Boolean).join(", ")})${puanYazi ? ": Denedik puanı " + puanYazi + "." : "."} ${m.puan_notu || ""}`.trim();

    const vid = ytId(m.bolum_url), ig = insta(m.instagram), bolum = guvenli(m.bolum_url);
    const metin = paragraflar(m.aciklama);

    main.innerHTML = `
    <section class="mk-hero"><div class="wrap">
      <a class="mk-back" href="./#harita">← Türkiye Tavuk Dönerci Haritası</a>
      <div class="mk-top">
        <div class="mk-id">
          <div class="mk-tags"><span class="tag blue">Denedik'te denendi</span>${m.ziyaret_tarihi ? `<span class="mk-date">${esc(tarih(m.ziyaret_tarihi))}</span>` : ""}</div>
          <h1>${esc(m.ad)}</h1>
          <p class="addr">${esc(yer(m))}</p>
          ${m.etiketler && m.etiketler.length ? `<div class="tags">${m.etiketler.map(t => `<span>${esc(t)}</span>`).join("")}</div>` : ""}
          <div class="mk-links">
            <a class="mkl" href="${esc(yol(m))}" target="_blank" rel="noopener">${IKON.yol}Yol tarifi</a>
            <a class="mkl" href="${esc(maps(m))}" target="_blank" rel="noopener">${IKON.maps}Google Maps</a>
            ${ig ? `<a class="mkl" href="${esc(ig)}" target="_blank" rel="noopener">${IKON.insta}${esc(instaAd(ig))}</a>` : ""}
            ${bolum ? `<a class="mkl mkl-y" href="${esc(bolum)}" target="_blank" rel="noopener">${IKON.izle}Bölümü izle</a>` : ""}
          </div>
        </div>
        <div class="mk-score" aria-label="Denedik puanı ${fmt(m.puan)} / 100">
          <small>Denedik puanı</small><b>${fmt(m.puan)}</b><small>/ 100</small>
          <div class="ms-kisi">${KISI.map(k => `<span>${esc(k.ad)} <b>${fmt(m["puan_" + k.k] ?? (deg[k.k] && deg[k.k].toplam))}</b></span>`).join("")}</div>
        </div>
      </div>
    </div></section>

    <section class="sec mk-body"><div class="wrap">
      ${vid || m.puan_notu || metin ? `<div class="mk-story${vid ? "" : " tek"}">
        ${vid ? `<div class="mk-video"><iframe src="https://www.youtube-nocookie.com/embed/${vid}" title="${esc(m.ad)} bölümü" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>` : ""}
        <div class="mk-text">
          ${m.puan_notu ? `<p class="mk-quote">“${esc(m.puan_notu)}”</p>` : ""}
          ${metin}
        </div>
      </div>` : ""}

      <div class="mk-h"><h2>İki kişi, iki görüş</h2><p>Her birimiz on kriteri 10 üzerinden ayrı ayrı puanladık. Mekânın puanı ikimizin ortalaması.</p></div>
      <div class="mk-kiyas">
        <div class="kr kh"><span></span>${KISI.map((k, i) => `<b class="c${i}">${esc(k.ad)}</b>`).join("")}</div>
        ${KRITER.map(([k, ad]) => `<div class="kr"><span>${esc(ad)}</span>${KISI.map((kk, i) => { const v = deg[kk.k] && deg[kk.k].puanlar ? deg[kk.k].puanlar[k] : null;
          return `<span class="kv c${i}"><i style="width:${v != null ? Math.max(0, Math.min(100, Number(v) * 10)) : 0}%"></i><b>${v != null ? fmt(v) : "–"}</b></span>`; }).join("")}</div>`).join("")}
        <div class="kr kt"><span>Toplam</span>${KISI.map((k, i) => `<b class="c${i}">${fmt(deg[k.k] && deg[k.k].toplam)}</b>`).join("")}</div>
      </div>
      <div class="mk-duo">${KISI.map((k, i) => kisiKolon(k, deg[k.k], i)).join("")}</div>

      <div class="mk-where">
        <div class="mk-map" id="mk-map" role="img" aria-label="${esc(m.ad)} haritada"></div>
        <div class="mk-where-txt"><h2>Nerede?</h2><p class="addr">${esc(yer(m))}</p>
          <div class="mk-acts"><a class="btn btn-sm" href="${esc(yol(m))}" target="_blank" rel="noopener">Yol tarifi al</a><a class="btn btn-line btn-sm" href="${esc(maps(m))}" target="_blank" rel="noopener">Google Maps'te aç ↗</a></div></div>
      </div>
    </div></section>`;

    if (window.maplibregl && m.lat != null && m.lng != null) {
      const map = new maplibregl.Map({ container: "mk-map", style: "https://tiles.openfreemap.org/styles/positron", center: [m.lng, m.lat], zoom: 14.5,
        attributionControl: false, cooperativeGestures: true, dragRotate: false });
      map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: "© OpenFreeMap" }), "bottom-right");
      const el = document.createElement("div"); el.className = "pin"; el.textContent = fmt(m.puan);
      new maplibregl.Marker({ element: el }).setLngLat([m.lng, m.lat]).addTo(map);
    }
  }
  run().catch(e => { console.warn(e); bos("Şu an yüklenemedi", "Birazdan tekrar dener misin?"); });
})();

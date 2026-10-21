/* eniyitavukdoner.com — Türkiye Tavuk Dönerci Haritası (ana sayfa ve büyük harita sayfası) */
(function () {
  "use strict";
  const C = window.SITE_CONFIG || {};
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const TR = "tr-TR";
  if (!$("#dh-items")) return;
  const BUYUK = document.body.dataset.sayfa === "harita";
  let db = null;
  function getDb() {
    if (db) return db;
    if (C.SUPABASE_URL && C.SUPABASE_ANON_KEY && window.supabase) db = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    return db;
  }
  function toast(msg) {
    let t = $(".toast");
    if (!t) { t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
    t.textContent = msg; t.classList.add("show");
    clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 3400);
  }
  let DATA_READY = Promise.resolve();

  /* ---------- Türkiye Tavuk Dönerci Haritası (MapLibre + OpenFreeMap, anahtar gerekmez) ---------- */
  const IL_KOORD = {"Adana":[37.00,35.32],"Adıyaman":[37.76,38.28],"Afyonkarahisar":[38.76,30.54],"Ağrı":[39.72,43.05],"Aksaray":[38.37,34.03],"Amasya":[40.65,35.83],"Ankara":[39.93,32.86],"Antalya":[36.89,30.71],"Ardahan":[41.11,42.70],"Artvin":[41.18,41.82],"Aydın":[37.84,27.85],"Balıkesir":[39.65,27.88],"Bartın":[41.63,32.34],"Batman":[37.88,41.13],"Bayburt":[40.26,40.23],"Bilecik":[40.14,29.98],"Bingöl":[38.88,40.50],"Bitlis":[38.40,42.11],"Bolu":[40.73,31.61],"Burdur":[37.72,30.29],"Bursa":[40.19,29.06],"Çanakkale":[40.15,26.41],"Çankırı":[40.60,33.62],"Çorum":[40.55,34.95],"Denizli":[37.78,29.09],"Diyarbakır":[37.91,40.24],"Düzce":[40.84,31.16],"Edirne":[41.68,26.56],"Elazığ":[38.68,39.22],"Erzincan":[39.75,39.49],"Erzurum":[39.90,41.27],"Eskişehir":[39.78,30.52],"Gaziantep":[37.07,37.38],"Giresun":[40.91,38.39],"Gümüşhane":[40.46,39.48],"Hakkâri":[37.58,43.74],"Hatay":[36.20,36.16],"Iğdır":[39.92,44.04],"Isparta":[37.76,30.55],"İstanbul":[41.01,28.98],"İzmir":[38.42,27.14],"Kahramanmaraş":[37.58,36.94],"Karabük":[41.20,32.63],"Karaman":[37.18,33.22],"Kars":[40.60,43.10],"Kastamonu":[41.39,33.78],"Kayseri":[38.72,35.49],"Kırıkkale":[39.85,33.51],"Kırklareli":[41.73,27.22],"Kırşehir":[39.15,34.17],"Kilis":[36.72,37.12],"Kocaeli":[40.77,29.92],"Konya":[37.87,32.48],"Kütahya":[39.42,29.98],"Malatya":[38.35,38.31],"Manisa":[38.61,27.43],"Mardin":[37.31,40.74],"Mersin":[36.81,34.64],"Muğla":[37.22,28.36],"Muş":[38.74,41.49],"Nevşehir":[38.62,34.71],"Niğde":[37.97,34.68],"Ordu":[40.98,37.88],"Osmaniye":[37.07,36.25],"Rize":[41.02,40.52],"Sakarya":[40.78,30.40],"Samsun":[41.29,36.33],"Siirt":[37.93,41.94],"Sinop":[42.03,35.15],"Sivas":[39.75,37.02],"Şanlıurfa":[37.16,38.79],"Şırnak":[37.52,42.46],"Tekirdağ":[40.98,27.51],"Tokat":[40.31,36.55],"Trabzon":[41.00,39.72],"Tunceli":[39.11,39.55],"Uşak":[38.68,29.41],"Van":[38.49,43.38],"Yalova":[40.65,29.27],"Yozgat":[39.82,34.81],"Zonguldak":[41.45,31.79],
    "Almanya":[52.52,13.40],"Hollanda":[52.37,4.90],"Belçika":[50.85,4.35],"Avusturya":[48.21,16.37],"Fransa":[48.86,2.35],"İngiltere":[51.51,-0.13],"İsviçre":[47.38,8.54],"Danimarka":[55.68,12.57],"İsveç":[59.33,18.07],"Norveç":[59.91,10.75],"İtalya":[41.90,12.50],"İspanya":[40.42,-3.70],"Yunanistan":[37.98,23.73],"Bulgaristan":[42.70,23.32],"KKTC":[35.19,33.38],"Azerbaycan":[40.41,49.87],"Gürcistan":[41.72,44.79],"BAE":[25.20,55.27],"Katar":[25.29,51.53],"ABD":[40.71,-74.01],"Kanada":[43.65,-79.38],"Avustralya":[-33.87,151.21]};
  const TR_BOUNDS = [[25.6, 35.7], [44.9, 42.2]];
  const TUR_AD = { denedik: "Denedik", rota: "Rotamızda", oneri: "Önerilen" };
  let MAP = null, ITEMS = [], MARKERS = new Map(), ME = null, MEMK = null, POP = null;
  const F = { tur: "", il: "", q: "" };
  let LIMIT = 40;
  const trNorm = s => String(s || "").toLocaleLowerCase(TR).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i").replace(/[^a-z0-9]+/g, " ").trim();
  const fmtP = p => { const n = Math.round(Number(p) * 10) / 10; return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ","); };
  const yerAd = m => m.il === "Yurt dışı" ? (m.ulke || "Yurt dışı") : m.il;
  const mapsLink = m => (/^https:\/\/[^\s"'<>]+$/i.test(m.maps_url || "") ? m.maps_url : "") || "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent([m.ad, m.ilce, m.il === "Yurt dışı" ? m.ulke : m.il].filter(Boolean).join(" "));
  function km(a, b) {
    const R = 6371, r = x => x * Math.PI / 180, dLa = r(b.lat - a.lat), dLo = r(b.lng - a.lng);
    const h = Math.sin(dLa / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLo / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  const fmtKm = d => d < 1 ? Math.round(d * 1000) + " m" : (d < 10 ? d.toFixed(1).replace(".", ",") : Math.round(d)) + " km";

  function loadAsset(tag, attrs) {
    return new Promise((res, rej) => { const el = document.createElement(tag); Object.assign(el, attrs); el.onload = res; el.onerror = rej; document.head.appendChild(el); });
  }
  async function fetchMapData() {
    const d = getDb(); if (!d) return;
    try {
      const [hr, mek] = await Promise.all([
        d.rpc("harita_mekanlari"),
        d.from("mekanlar").select("id,ad,il,ilce,ulke,adres,lat,lng,puan,puan_notu,bolum_url,maps_url").eq("yayinda", true).order("puan", { ascending: false })
      ]);
      const den = (mek.data || []).map(m => ({ ...m, key: "d" + m.id, tur: "denedik", adet: 0 }));
      const diger = (hr.data || []).map(m => ({ ...m, key: m.tur[0] + m.anahtar, adet: m.adet || 1 }));
      ITEMS = [...den, ...diger].filter(m => m.lat != null && m.lng != null);
      ITEMS.forEach(m => m.ara = trNorm([m.ad, m.ilce, m.il, m.ulke].join(" ")));
    } catch (e) { console.warn(e); }
  }
  const SIRA = { denedik: 0, rota: 1, oneri: 2 };
  function visible() {
    const q = trNorm(F.q);
    return ITEMS.filter(m => (!F.tur || m.tur === F.tur) && (!F.il || yerAd(m) === F.il) && (!q || m.ara.includes(q)));
  }
  function sorted(list) {
    if (ME) return list.map(m => (m.km = km(ME, m), m)).sort((a, b) => a.km - b.km);
    return list.sort((a, b) => SIRA[a.tur] - SIRA[b.tur] || (b.puan || 0) - (a.puan || 0) || b.adet - a.adet || a.ad.localeCompare(b.ad, TR));
  }
  const FLAG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/></svg>';
  function badge(m) {
    if (m.tur === "denedik") return `<span class="dh-b b-den">${m.puan != null ? fmtP(m.puan) : "–"}</span>`;
    if (m.tur === "rota") return `<span class="dh-b b-rota">${FLAG}</span>`;
    return `<span class="dh-b b-oneri">${m.adet > 1 ? m.adet : ""}</span>`;
  }
  function metaLine(m) {
    if (m.tur === "denedik") return `<span class="t-den">Denedik puanı</span>${m.bolum_url ? " · bölümü yayında" : ""}`;
    if (m.tur === "rota") return `<span class="t-rota">Rotamızda</span> · yakında deniyoruz`;
    return `<span class="t-oneri">Önerilen</span> · ${m.adet > 1 ? m.adet + " kişi önerdi" : "1 kişi önerdi"}`;
  }
  function renderCounts() {
    const base = ITEMS.filter(m => (!F.il || yerAd(m) === F.il));
    $("#dc-all").textContent = base.length;
    ["denedik", "rota", "oneri"].forEach(t => $("#dc-" + t).textContent = base.filter(m => m.tur === t).length);
    const sel = $("#dh-il"), cur = sel.value;
    const yerler = [...new Set(ITEMS.map(yerAd))].sort((a, b) => a.localeCompare(b, TR));
    sel.innerHTML = `<option value="">Tüm iller</option>` + yerler.map(y => `<option${y === cur ? " selected" : ""}>${esc(y)}</option>`).join("");
  }
  function renderList() {
    const list = sorted(visible()), box = $("#dh-items");
    $("#dh-count").textContent = list.length ? `${list.length.toLocaleString(TR)} mekân` : "Mekânlar";
    $("#dh-sub").textContent = ME ? "Sana en yakından uzağa" : "Denedik puanına ve öneri sayısına göre";
    if (!ITEMS.length) {
      box.innerHTML = `<li class="dh-empty"><b>Harita yeni doluyor.</b><span>Sizden gelen öneriler incelendikçe, rotamız netleştikçe ve her bölümle birlikte mekânlar burada belirecek.</span><a class="btn btn-o btn-sm" href="#oner">İlk öneriyi sen yap</a></li>`;
      return;
    }
    if (!list.length) { box.innerHTML = `<li class="dh-empty"><b>Bu filtreyle mekân yok.</b><span>Farklı bir il ya da tür seç. Bildiğin bir yer varsa öner, listeye girsin.</span></li>`; return; }
    box.innerHTML = list.slice(0, LIMIT).map(m => `<li class="dh-item${m.tur === "denedik" ? " is-den" : ""}" data-key="${esc(m.key)}" tabindex="0">
        ${badge(m)}
        <div class="dh-txt"><b>${esc(m.ad)}</b><span class="dh-yer">${esc([m.ilce, yerAd(m)].filter(Boolean).join(", "))}${m.km != null && ME ? ` · <strong>${fmtKm(m.km)}</strong>` : ""}</span><span class="dh-meta">${metaLine(m)}</span></div>
        <div class="dh-acts">${m.tur === "denedik" ? `<a class="dh-go" href="mekan.html?id=${m.id}">İncele</a>` : ""}<a class="dh-maps" href="${esc(mapsLink(m))}" target="_blank" rel="noopener" aria-label="${esc(m.ad)} Google Maps'te aç">Maps ↗</a></div>
      </li>`).join("") + (list.length > LIMIT ? `<li class="dh-more"><button type="button" class="btn btn-line btn-sm" data-more>${(list.length - LIMIT).toLocaleString(TR)} mekân daha göster</button></li>` : "");
  }
  function popHtml(m) {
    return `<div class="dh-pop"><span class="tag ${m.tur === "denedik" ? "blue" : m.tur === "rota" ? "yel" : ""}">${TUR_AD[m.tur]}</span>
      ${m.tur === "denedik" && m.puan != null ? `<div class="place-score"><b>${fmtP(m.puan)}</b><small>/ 100</small></div>` : ""}
      <b class="nm">${esc(m.ad)}</b><span class="yer">${esc([m.ilce, yerAd(m)].filter(Boolean).join(", "))}</span>
      ${m.tur === "oneri" ? `<span class="yer">${m.adet > 1 ? m.adet + " kişi önerdi" : "1 kişi önerdi"}</span>` : ""}
      ${m.tur === "rota" ? `<span class="yer">Yakında gidip deniyoruz.</span>` : ""}
      <div class="pop-acts">${m.tur === "denedik" ? `<a class="btn btn-sm" href="mekan.html?id=${m.id}">Detayları gör</a>` : ""}<a class="btn btn-line btn-sm" href="${esc(mapsLink(m))}" target="_blank" rel="noopener">Maps'te aç ↗</a></div></div>`;
  }
  function focusItem(m, fly = true) {
    $$(".dh-item").forEach(li => li.classList.toggle("on", li.dataset.key === m.key));
    MARKERS.forEach((el, k) => el.classList.toggle("on", k === m.key));
    if (!MAP) return;
    if (fly) MAP.flyTo({ center: [m.lng, m.lat], zoom: Math.max(MAP.getZoom(), 13), duration: 800 });
    if (!POP) POP = new maplibregl.Popup({ offset: 18, maxWidth: "280px", className: "dh-popup" });
    POP.setLngLat([m.lng, m.lat]).setHTML(popHtml(m)).addTo(MAP);
  }
  $("#dh-items").addEventListener("click", e => {
    if (e.target.closest("[data-more]")) { LIMIT += 40; return renderList(); }
    if (e.target.closest("a")) return;
    const li = e.target.closest(".dh-item"); if (!li) return;
    const m = ITEMS.find(x => x.key === li.dataset.key); if (m) { focusItem(m); if (BUYUK) sheet(false); else if (matchMedia("(max-width:960px)").matches) $("#map").scrollIntoView({ behavior: "smooth", block: "center" }); }
  });
  $("#dh-items").addEventListener("keydown", e => { if ((e.key === "Enter" || e.key === " ") && e.target.matches(".dh-item")) { e.preventDefault(); e.target.click(); } });
  function geo() {
    const list = visible();
    return { type: "FeatureCollection", features: list.filter(m => m.tur !== "denedik").map(m => ({ type: "Feature", properties: { key: m.key, tur: m.tur, adet: m.adet }, geometry: { type: "Point", coordinates: [m.lng, m.lat] } })) };
  }
  function applyFilters(fit) {
    LIMIT = 40; renderCounts(); renderList(); window.dispatchEvent(new Event("dh:filtre"));
    if (!MAP || !MAP.getSource("dh")) return;
    MAP.getSource("dh").setData(geo());
    const vis = new Set(visible().map(m => m.key));
    MARKERS.forEach((el, k) => el.style.display = vis.has(k) ? "" : "none");
    if (POP) POP.remove();
    if (fit) fitTo(visible());
  }
  function fitTo(list) {
    if (!MAP) return;
    if (!list.length) { if (F.il && IL_KOORD[F.il]) MAP.flyTo({ center: [IL_KOORD[F.il][1], IL_KOORD[F.il][0]], zoom: 9 }); return; }
    if (list.length === 1) return MAP.flyTo({ center: [list[0].lng, list[0].lat], zoom: 13 });
    const b = new maplibregl.LngLatBounds(); list.forEach(m => b.extend([m.lng, m.lat]));
    MAP.fitBounds(b, { padding: 60, maxZoom: 13, duration: 800 });
  }
  $("#dh-chips").addEventListener("click", e => {
    const b = e.target.closest("[data-tur]"); if (!b) return;
    F.tur = b.dataset.tur; $$("#dh-chips [data-tur]").forEach(x => x.setAttribute("aria-selected", x === b));
    applyFilters(false);
  });
  $("#dh-il").addEventListener("change", e => { F.il = e.target.value; applyFilters(true); if (!F.il && MAP && !ME) MAP.fitBounds(TR_BOUNDS, { padding: 16 }); });
  let qT; $("#dh-q").addEventListener("input", e => { clearTimeout(qT); qT = setTimeout(() => { F.q = e.target.value; applyFilters(!!F.q); }, 180); });
  $("#dh-near").addEventListener("click", () => {
    const b = $("#dh-near");
    if (ME) { ME = null; b.classList.remove("on"); if (MEMK) { MEMK.remove(); MEMK = null; } renderList(); return; }
    if (!navigator.geolocation) return toast("Tarayıcın konum paylaşmayı desteklemiyor.");
    b.disabled = true; b.lastChild.textContent = "Konum alınıyor…";
    navigator.geolocation.getCurrentPosition(p => {
      b.disabled = false; b.lastChild.textContent = "Yakınımdakiler"; b.classList.add("on");
      ME = { lat: p.coords.latitude, lng: p.coords.longitude };
      F.il = ""; $("#dh-il").value = ""; applyFilters(false);
      if (MAP) {
        if (!MEMK) { const el = document.createElement("div"); el.className = "me-dot"; MEMK = new maplibregl.Marker({ element: el }).setLngLat([ME.lng, ME.lat]).addTo(MAP); }
        const near = sorted(visible()).slice(0, 5).filter(m => m.km < 60);
        const bb = new maplibregl.LngLatBounds([ME.lng, ME.lat], [ME.lng, ME.lat]); near.forEach(m => bb.extend([m.lng, m.lat]));
        MAP.fitBounds(bb, { padding: 70, maxZoom: 13, duration: 900 });
      }
      $("#dh-items").scrollTop = 0;
      toast(sorted(visible())[0] ? "En yakın mekânlar listenin başında." : "Yakınında henüz mekân yok.");
    }, () => { b.disabled = false; b.lastChild.textContent = "Yakınımdakiler"; toast("Konum izni verilmedi."); }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
  });

  function tintStyle(map) {
    const st = map.getStyle(); if (!st) return;
    st.layers.forEach(l => {
      const id = l.id;
      try {
        if (l.type === "background") map.setPaintProperty(id, "background-color", "#F3ECDF");
        else if (l.type === "fill" && /water/.test(id)) map.setPaintProperty(id, "fill-color", "#CBD6F2");
        else if (l.type === "line" && /waterway/.test(id)) map.setPaintProperty(id, "line-color", "#CBD6F2");
        else if (l.type === "fill" && /(park|landcover|landuse|wood|grass)/.test(id)) map.setPaintProperty(id, "fill-color", "#ECE3D2");
        else if (l.type === "line" && /boundary/.test(id)) map.setPaintProperty(id, "line-color", "#B9B2C9");
        if (l.type === "symbol") {
          if (/poi|housenumber/.test(id)) map.setLayoutProperty(id, "visibility", "none");
          else if (l.layout && l.layout["text-field"]) {
            map.setLayoutProperty(id, "text-field", ["coalesce", ["get", "name:tr"], ["get", "name"]]);
            map.setPaintProperty(id, "text-color", /place|country|state|city|town/.test(id) ? "#4A5478" : "#7C84A0");
          }
        }
      } catch (e) {}
    });
  }
  async function initMap() {
    const load = $("#map-loading");
    try {
      await Promise.all([
        loadAsset("link", { rel: "stylesheet", href: "https://cdn.jsdelivr.net/npm/maplibre-gl@5.24.0/dist/maplibre-gl.css", integrity: "sha384-uTttxo/aOKbdE5RlD/SPzSDoDmNvGlUYPjONi2MN/b7c9HPSvW07OIuyP7uL6jxK", crossOrigin: "anonymous" }),
        loadAsset("script", { src: "https://cdn.jsdelivr.net/npm/maplibre-gl@5.24.0/dist/maplibre-gl.js", integrity: "sha384-5+cfbwT0iiub6VsQAdn6yz16nr6sDiQoHx6tm4O8OVYXHYOxcffFmCJBL0dgdvGp", crossOrigin: "anonymous" }),
        DATA_READY
      ]);
    } catch (e) { load.textContent = "Harita şu an yüklenemedi."; return; }
    MAP = new maplibregl.Map({
      container: "map", style: "https://tiles.openfreemap.org/styles/positron",
      bounds: TR_BOUNDS, fitBoundsOptions: { padding: 16 }, minZoom: 2.5, maxZoom: 17,
      attributionControl: false, dragRotate: false, pitchWithRotate: false, touchPitch: false,
      cooperativeGestures: !BUYUK,
      locale: {
        "CooperativeGesturesHandler.WindowsHelpText": "Yakınlaştırmak için Ctrl + kaydır",
        "CooperativeGesturesHandler.MacHelpText": "Yakınlaştırmak için ⌘ + kaydır",
        "CooperativeGesturesHandler.MobileHelpText": "Haritayı kaydırmak için iki parmak kullan",
        "NavigationControl.ZoomIn": "Yakınlaştır", "NavigationControl.ZoomOut": "Uzaklaştır",
        "AttributionControl.ToggleAttribution": "Harita kaynakları"
      }
    });
    MAP.touchZoomRotate.disableRotation();
    MAP.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    MAP.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: "© OpenFreeMap" }), "bottom-right");
    MAP.on("load", () => {
      load.remove();
      tintStyle(MAP);
      MAP.addSource("dh", { type: "geojson", data: geo() });
      const R = (a, b) => ["interpolate", ["linear"], ["zoom"], 4, a, 12, b];
      MAP.addLayer({ id: "dh-oneri", type: "circle", source: "dh", filter: ["==", ["get", "tur"], "oneri"], paint: {
        "circle-radius": R(["min", 11, ["+", 5, ["get", "adet"]]], ["min", 16, ["+", 8, ["get", "adet"]]]),
        "circle-color": "#FF6A00", "circle-opacity": .9, "circle-stroke-color": "#fff", "circle-stroke-width": 2 } });
      MAP.addLayer({ id: "dh-rota", type: "circle", source: "dh", filter: ["==", ["get", "tur"], "rota"], paint: {
        "circle-radius": R(7, 12), "circle-color": "#FFD500", "circle-stroke-color": "#14275A", "circle-stroke-width": 2.5 } });
      const hover = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 12, className: "dh-hover" });
      ["dh-oneri", "dh-rota"].forEach(id => {
        MAP.on("mouseenter", id, e => {
          MAP.getCanvas().style.cursor = "pointer";
          const m = ITEMS.find(x => x.key === e.features[0].properties.key); if (!m) return;
          hover.setLngLat([m.lng, m.lat]).setHTML(`<b>${esc(m.ad)}</b><br><small>${esc(TUR_AD[m.tur])}${m.tur === "oneri" && m.adet > 1 ? " · " + m.adet + " öneri" : ""}</small>`).addTo(MAP);
        });
        MAP.on("mouseleave", id, () => { MAP.getCanvas().style.cursor = ""; hover.remove(); });
        MAP.on("click", id, e => { hover.remove(); const m = ITEMS.find(x => x.key === e.features[0].properties.key); if (m) { focusItem(m, false); const li = $(`.dh-item[data-key="${m.key}"]`); if (li) li.scrollIntoView({ block: "nearest", behavior: "smooth" }); } });
      });
      ITEMS.filter(m => m.tur === "denedik").forEach(m => {
        const el = document.createElement("button"); el.type = "button"; el.className = "pin"; el.textContent = m.puan != null ? fmtP(m.puan) : "–";
        el.setAttribute("aria-label", `${m.ad}, Denedik puanı ${m.puan != null ? fmtP(m.puan) : "yok"} / 100`);
        el.addEventListener("click", ev => { ev.stopPropagation(); focusItem(m, false); });
        new maplibregl.Marker({ element: el }).setLngLat([m.lng, m.lat]).addTo(MAP);
        MARKERS.set(m.key, el);
      });
      applyFilters(false);
    });
    MAP.on("error", e => console.warn("Harita:", e && e.error));
  }


  /* ---------- açılış ---------- */
  function filtreAdresi() {
    const p = new URLSearchParams(); if (F.tur) p.set("tur", F.tur); if (F.il) p.set("il", F.il); if (F.q) p.set("q", F.q);
    const s = p.toString(); return "harita.html" + (s ? "?" + s : "");
  }
  function sheet(ac) {
    const l = $("#hp-list"), t = $("#hp-tutamac"); if (!l || !t) return;
    l.classList.toggle("acik", ac); t.setAttribute("aria-expanded", ac); $("small", t).textContent = ac ? "Haritaya dön" : "Listeyi aç";
  }
  function boot() {
    if (BUYUK) {
      const t = $("#hp-tutamac"); if (t) t.addEventListener("click", () => sheet(!$("#hp-list").classList.contains("acik")));
      const p = new URLSearchParams(location.search);
      F.tur = ["denedik", "rota", "oneri"].includes(p.get("tur")) ? p.get("tur") : ""; F.il = (p.get("il") || "").slice(0, 40); F.q = (p.get("q") || "").slice(0, 60);
      $("#dh-q").value = F.q; $$("#dh-chips [data-tur]").forEach(x => x.setAttribute("aria-selected", x.dataset.tur === F.tur));
    }
    DATA_READY = fetchMapData().then(() => { renderCounts(); if (F.il) $("#dh-il").value = F.il; renderList(); });
    if (BUYUK || !("IntersectionObserver" in window)) initMap();
    else { const mo = new IntersectionObserver(ents => { if (ents.some(e => e.isIntersecting)) { mo.disconnect(); initMap(); } }, { rootMargin: "600px 0px" }); mo.observe($("#map")); }
    const buyut = $("#dh-buyut");
    if (buyut) buyut.addEventListener("click", e => { e.preventDefault(); location.href = filtreAdresi(); });
    window.addEventListener("dh:filtre", () => { if (BUYUK) history.replaceState(null, "", filtreAdresi()); });
  }
  if (window.supabase) boot(); else window.addEventListener("load", boot);
})();

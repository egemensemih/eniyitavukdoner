/* eniyitavukdoner.com */
(function () {
  const C = window.SITE_CONFIG || {};
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const ILLER = ["Adana","Adıyaman","Afyonkarahisar","Ağrı","Aksaray","Amasya","Ankara","Antalya","Ardahan","Artvin","Aydın","Balıkesir","Bartın","Batman","Bayburt","Bilecik","Bingöl","Bitlis","Bolu","Burdur","Bursa","Çanakkale","Çankırı","Çorum","Denizli","Diyarbakır","Düzce","Edirne","Elazığ","Erzincan","Erzurum","Eskişehir","Gaziantep","Giresun","Gümüşhane","Hakkâri","Hatay","Iğdır","Isparta","İstanbul","İzmir","Kahramanmaraş","Karabük","Karaman","Kars","Kastamonu","Kayseri","Kırıkkale","Kırklareli","Kırşehir","Kilis","Kocaeli","Konya","Kütahya","Malatya","Manisa","Mardin","Mersin","Muğla","Muş","Nevşehir","Niğde","Ordu","Osmaniye","Rize","Sakarya","Samsun","Siirt","Sinop","Sivas","Şanlıurfa","Şırnak","Tekirdağ","Tokat","Trabzon","Tunceli","Uşak","Van","Yalova","Yozgat","Zonguldak","Yurt dışı"];

  /* ---------- Supabase ---------- */
  let db = null;
  function getDb() {
    if (db) return db;
    if (C.SUPABASE_URL && C.SUPABASE_ANON_KEY && window.supabase) {
      db = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    }
    return db;
  }

  /* ---------- helpers ---------- */
  function toast(msg) {
    let t = $(".toast");
    if (!t) { t = document.createElement("div"); t.className = "toast"; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add("show");
    clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 3200);
  }
  function fillIller(sel, placeholder) {
    sel.innerHTML = `<option value="">${placeholder}</option>` + ILLER.map(i => `<option>${i}</option>`).join("");
  }
  function setMsg(form, text, ok) {
    const m = $(".form-msg", form); m.textContent = text; m.className = "form-msg " + (ok ? "ok" : "err");
  }
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* ---------- links ---------- */
  const yt = $("#yt-link"); if (yt) yt.href = C.YOUTUBE_URL || "#";
  const IKON = {
    youtube: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M23 7.2a3 3 0 00-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 001 7.2 31 31 0 00.5 12a31 31 0 00.5 4.8 3 3 0 002.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 002.1-2.1 31 31 0 00.5-4.8 31 31 0 00-.5-4.8zM9.7 15.1V8.9L15.5 12z"/></svg>',
    instagram: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>'
  };
  const sos = $("#sosyal");
  if (sos) sos.innerHTML = (C.SOSYAL || []).map(x => `<a href="${esc(x.url)}" target="_blank" rel="noopener">${IKON[x.tur] || ""}<span>${esc(x.ad)}</span></a>`).join("");
  $$("select[data-iller]").forEach(s => fillIller(s, "İl seç"));
  fillIller($("#r-il"), "İl seç");

  /* ---------- countdown ---------- */
  const start = C.SERI_BASLANGIC ? new Date(C.SERI_BASLANGIC) : null;
  function tick() {
    const box = $("#sayac");
    if (!start) return;
    const ms = start - new Date();
    if (ms <= 0) { box.hidden = true; return; }
    box.hidden = false;
    $("#cd-g").textContent = Math.floor(ms / 864e5);
    $("#cd-s").textContent = Math.floor(ms / 36e5) % 24;
    $("#cd-d").textContent = Math.floor(ms / 6e4) % 60;
  }
  tick(); setInterval(tick, 30000);

  /* ---------- stats ---------- */
  const TABAN = C.SAYAC_TABANI || { recete: 250, bekleyen: 250 };
  const shown = { recete: 0, bekleyen: 0, mekan: 0 };
  function animateTo(key, target) {
    const el = $("#st-" + key); const from = shown[key]; shown[key] = target;
    if (from === target) { el.textContent = target.toLocaleString("tr-TR"); return; }
    const t0 = performance.now(), dur = from === 0 ? 1600 : 900;
    (function step(t) {
      const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = Math.round(from + (target - from) * e).toLocaleString("tr-TR");
      if (k < 1) requestAnimationFrame(step);
    })(t0);
  }
  async function loadStats() {
    let real = { recete: 0, bekleyen: 0, mekan: 0 };
    const d = getDb();
    if (d) { const { data } = await d.rpc("site_istatistik"); if (data) real = data; }
    // Gerçek sayı tabanın altındaysa taban gösterilir; tabanı geçince gerçek sayı akar.
    animateTo("recete", Math.max(Number(real.recete) || 0, TABAN.recete || 0));
    animateTo("bekleyen", Math.max(Number(real.bekleyen) || 0, TABAN.bekleyen || 0));
    const m = Number(real.mekan) || 0;
    $("#st-mekan").closest(".stat").hidden = m === 0;
    if (m) animateTo("mekan", m);
    $("#istatistik").hidden = false;
  }
  setInterval(() => { if (!document.hidden) loadStats(); }, 60000);

  /* ---------- map ---------- */
  const IL_KOORD = {"Adana":[37.00,35.32],"Adıyaman":[37.76,38.28],"Afyonkarahisar":[38.76,30.54],"Ağrı":[39.72,43.05],"Aksaray":[38.37,34.03],"Amasya":[40.65,35.83],"Ankara":[39.93,32.86],"Antalya":[36.89,30.71],"Ardahan":[41.11,42.70],"Artvin":[41.18,41.82],"Aydın":[37.84,27.85],"Balıkesir":[39.65,27.88],"Bartın":[41.63,32.34],"Batman":[37.88,41.13],"Bayburt":[40.26,40.23],"Bilecik":[40.14,29.98],"Bingöl":[38.88,40.50],"Bitlis":[38.40,42.11],"Bolu":[40.73,31.61],"Burdur":[37.72,30.29],"Bursa":[40.19,29.06],"Çanakkale":[40.15,26.41],"Çankırı":[40.60,33.62],"Çorum":[40.55,34.95],"Denizli":[37.78,29.09],"Diyarbakır":[37.91,40.24],"Düzce":[40.84,31.16],"Edirne":[41.68,26.56],"Elazığ":[38.68,39.22],"Erzincan":[39.75,39.49],"Erzurum":[39.90,41.27],"Eskişehir":[39.78,30.52],"Gaziantep":[37.07,37.38],"Giresun":[40.91,38.39],"Gümüşhane":[40.46,39.48],"Hakkâri":[37.58,43.74],"Hatay":[36.20,36.16],"Iğdır":[39.92,44.04],"Isparta":[37.76,30.55],"İstanbul":[41.01,28.98],"İzmir":[38.42,27.14],"Kahramanmaraş":[37.58,36.94],"Karabük":[41.20,32.63],"Karaman":[37.18,33.22],"Kars":[40.60,43.10],"Kastamonu":[41.39,33.78],"Kayseri":[38.72,35.49],"Kırıkkale":[39.85,33.51],"Kırklareli":[41.73,27.22],"Kırşehir":[39.15,34.17],"Kilis":[36.72,37.12],"Kocaeli":[40.77,29.92],"Konya":[37.87,32.48],"Kütahya":[39.42,29.98],"Malatya":[38.35,38.31],"Manisa":[38.61,27.43],"Mardin":[37.31,40.74],"Mersin":[36.81,34.64],"Muğla":[37.22,28.36],"Muş":[38.74,41.49],"Nevşehir":[38.62,34.71],"Niğde":[37.97,34.68],"Ordu":[40.98,37.88],"Osmaniye":[37.07,36.25],"Rize":[41.02,40.52],"Sakarya":[40.78,30.40],"Samsun":[41.29,36.33],"Siirt":[37.93,41.94],"Sinop":[42.03,35.15],"Sivas":[39.75,37.02],"Şanlıurfa":[37.16,38.79],"Şırnak":[37.52,42.46],"Tekirdağ":[40.98,27.51],"Tokat":[40.31,36.55],"Trabzon":[41.00,39.72],"Tunceli":[39.11,39.55],"Uşak":[38.68,29.41],"Van":[38.49,43.38],"Yalova":[40.65,29.27],"Yozgat":[39.82,34.81],"Zonguldak":[41.45,31.79]};
  let MAP = null;
  async function initMap() {
    if (!window.L) return;
    const mob = L.Browser.mobile;
    MAP = L.map("map", { scrollWheelZoom: false, dragging: !mob, tap: !mob, zoomControl: true, minZoom: 5 }).setView([39.0, 35.2], 6);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; OpenStreetMap &copy; CARTO', subdomains: "abcd", maxZoom: 19
    }).addTo(MAP);
    if (mob) MAP.on("click", () => { MAP.dragging.enable(); });
    const d = getDb(); if (!d) return;
    // 1) sizden gelen öneriler (il bazında toplam)
    const onr = await d.rpc("il_oneri_sayilari");
    const rows = (onr.data || []).filter(r => IL_KOORD[r.il]);
    const max = Math.max(1, ...rows.map(r => r.adet));
    rows.forEach(r => {
      const rad = 9 + 26 * Math.sqrt(r.adet / max);
      const c = L.circleMarker(IL_KOORD[r.il], { radius: rad, color: "#fff", weight: 2, fillColor: "#FF6A00", fillOpacity: .78 }).addTo(MAP);
      c.bindTooltip(`<b>${esc(r.il)}</b><br>${r.adet} öneri`, { direction: "top" });
      c.on("click", () => showCity(r));
    });
    // 2) puanlı mekânlar
    const { data } = await d.from("mekanlar").select("*").eq("yayinda", true).order("puan", { ascending: false });
    if (!data || !data.length) return;
    const markers = [];
    data.forEach((m, i) => {
      const icon = L.divIcon({ className: "pin", html: Number(m.puan).toFixed(1), iconSize: [40, 40] });
      const mk = L.marker([m.lat, m.lng], { icon, zIndexOffset: 1000 }).addTo(MAP);
      mk.on("click", () => showPlace(m, mk, markers));
      markers.push(mk);
      if (i === 0) showPlace(m, mk, markers);
    });
    MAP.fitBounds(L.featureGroup(markers).getBounds().pad(0.3), { maxZoom: 11 });
  }
  function showCity(r) {
    $("#mekan-kart").innerHTML = `<span class="pill pill-orange">Sizden gelen öneriler</span>
      <h3>${esc(r.il)}</h3><div class="score">${r.adet}<small> öneri</small></div>
      <p class="muted">En çok önerilen şehirler sıradaki duraklarımız olacak. ${esc(r.il)} için sen de favorini öner.</p>
      <a class="btn btn-cobalt btn-sm" href="#bildir" data-il="${esc(r.il)}">${esc(r.il)} için mekân öner</a>`;
  }
  document.addEventListener("click", e => {
    const a = e.target.closest("a[data-il]"); if (!a) return;
    const sel = $("#bildir-form select[name=il]"); if (sel) sel.value = a.dataset.il;
  });
  function showPlace(m, mk, all) {
    all.forEach(x => x.getElement() && x.getElement().classList.remove("on"));
    mk.getElement() && mk.getElement().classList.add("on");
    const k = $("#mekan-kart");
    k.innerHTML = `
      <div class="top"><span class="badge">Denedik onaylı</span><div class="score">${Number(m.puan).toFixed(1)}<small>/10</small></div></div>
      <h3>${esc(m.ad)}</h3><p class="addr">${esc([m.adres, m.il].filter(Boolean).join(" • "))}</p>
      ${m.puan_notu ? `<div class="note">“${esc(m.puan_notu)}”</div>` : ""}
      ${m.etiketler && m.etiketler.length ? `<div class="tags">${m.etiketler.map(t => `<span>${esc(t)}</span>`).join("")}</div>` : ""}
      <div class="links2">${m.bolum_url ? `<a href="${esc(m.bolum_url)}" target="_blank" rel="noopener">▶ Bölümü izle</a>` : ""}${m.maps_url ? `<a href="${esc(m.maps_url)}" target="_blank" rel="noopener">Yol tarifi ↗</a>` : ""}</div>`;
    k.hidden = false;
  }

  /* ---------- builder ---------- */
  const STEPS = [
    { k: "ekmek", t: "1. Ekmek tercihi", fis: "Ekmek", o: ["Lavaş", "Pide (Tombik)", "Somun Ekmek"], d: "Lavaş" },
    { k: "sos", t: "2. Dönerin içindeki sos", fis: "İç sos", multi: true, o: ["Sossuz", "Hatay Domates Sosu", "Sarımsak Kreması", "Klasik Mayonez", "Ketçap", "Acı Sos", "Hardallı Sos", "Yoğurtlu Otlu Sos"], or: true },
    { k: "peynir", t: "3. Peynir", fis: "Peynir", o: ["Peynirsiz", "Beyaz Peynir", "Feta Peyniri", "Kaşar Peyniri", "Kolot Peyniri", "Cheddar"], d: "Peynirsiz" },
    { k: "aci", t: "4. Acı seviyesi", fis: "Acı", o: ["Acısız", "Az Acılı", "Acılı", "İnanılmaz Acılı"], or: true },
    { k: "garnitur", t: "5. Salata & garnitür", fis: "Garnitür", multi: true, o: ["Kornişon Turşu", "Patates Kızartması", "Jalapeno Turşusu", "Çıtır Beyaz Lahana", "Sumaklı Soğan", "Domates & Marul", "Sadece Et"], or: true },
    { k: "tavuk", t: "6. Tavuk parçası", fis: "Tavuk", o: ["But (Sulu)", "Göğüs (Yağsız)", "%50 But + %50 Göğüs"] },
    { k: "pisme", t: "7. Pişme seviyesi", fis: "Pişme", o: ["Normal Pişmiş", "Çok Pişmiş", "Yanığa Yakın (Kıtır)"] },
    { k: "icecek", t: "8. Dönerin yanına", sub: "İçecek", fis: "İçecek", o: ["Köpüklü Ayran", "Kapalı Ayran", "Şalgam (Acılı)", "Şalgam (Acısız)", "Kola", "Gazoz", "Maden Suyu"] },
    { k: "patates", sub: "Patates", fis: "Patates", o: ["Baharatlı Çıtır Patates", "Sade Patates", "Elma Dilim Patates", "Patatessiz"] },
    { k: "yansos", sub: "Yan soslar", fis: "Yan sos", multi: true, o: ["Sarımsaklı Mayonez", "Acı Sos", "Klasik Mayonez", "Ketçap", "Trüflü Mayonez", "Ballı Hardal", "Ranch Sos", "Barbekü Sos"], or: true },
  ];
  const state = {};
  STEPS.forEach(s => state[s.k] = s.multi ? [] : (s.d || ""));

  const form = $("#recete-form");
  let html = "";
  STEPS.forEach(s => {
    const head = s.t ? `<div class="step${s.sub ? " step-group" : ""}"><div class="step-h"><h4>${s.t.replace(/^\d+\.\s/, m => m)}</h4><small>${s.multi ? "Birden fazla seçebilirsin" : ""}</small></div>` : "";
    html += head;
    if (s.sub) html += `<div class="sub-h">${s.sub}${s.multi ? " <small>(birden fazla)</small>" : ""}</div>`;
    html += `<div class="opts" data-k="${s.k}">` + s.o.map(o => `<button type="button" class="opt${s.multi ? " multi" : ""}" data-v="${esc(o)}" aria-pressed="false">${esc(o)}</button>`).join("") +
      `<button type="button" class="opt add" data-add="${s.k}">+ Kendim yazacağım</button></div>
      <div class="custom" data-custom="${s.k}" hidden><input maxlength="40" placeholder="Kendi seçeneğini yaz"><button type="button" class="btn btn-cobalt btn-sm">Ekle</button></div>`;
    const next = STEPS[STEPS.indexOf(s) + 1];
    if (!next || next.t) html += `</div>`;
  });
  html += `<div class="step"><div class="step-h"><h4>9. Ek notlar</h4></div><textarea id="r-not" rows="2" maxlength="200" placeholder="Örn: Lavaş sacda çıtırlasın…"></textarea></div>`;
  form.innerHTML = html;

  function syncButtons() {
    STEPS.forEach(s => $$(`.opts[data-k="${s.k}"] .opt[data-v]`).forEach(b => {
      const v = b.dataset.v;
      b.setAttribute("aria-pressed", s.multi ? state[s.k].includes(v) : state[s.k] === v);
    }));
    renderFis();
  }
  function pick(k, v) {
    const s = STEPS.find(x => x.k === k);
    if (s.multi) {
      const a = state[k]; const i = a.indexOf(v);
      if (i > -1) a.splice(i, 1); else {
        if (k === "sos" && v === "Sossuz") a.length = 0;
        if (k === "sos" && v !== "Sossuz") { const j = a.indexOf("Sossuz"); if (j > -1) a.splice(j, 1); }
        if (k === "garnitur" && v === "Sadece Et") a.length = 0;
        if (k === "garnitur" && v !== "Sadece Et") { const j = a.indexOf("Sadece Et"); if (j > -1) a.splice(j, 1); }
        a.push(v);
      }
    } else state[k] = state[k] === v ? "" : v;
    syncButtons();
  }
  form.addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.v) return pick(b.closest(".opts").dataset.k, b.dataset.v);
    if (b.dataset.add) { const c = $(`.custom[data-custom="${b.dataset.add}"]`); c.hidden = !c.hidden; if (!c.hidden) $("input", c).focus(); return; }
    const c = b.closest(".custom");
    if (c) addCustom(c);
  });
  form.addEventListener("keydown", e => { if (e.key === "Enter" && e.target.closest(".custom")) { e.preventDefault(); addCustom(e.target.closest(".custom")); } });
  function addCustom(c) {
    const k = c.dataset.custom, inp = $("input", c), v = inp.value.trim().slice(0, 40);
    if (!v) return;
    const s = STEPS.find(x => x.k === k);
    if (!s.o.includes(v)) {
      s.o.push(v);
      const btn = document.createElement("button");
      btn.type = "button"; btn.className = "opt" + (s.multi ? " multi" : ""); btn.dataset.v = v; btn.textContent = v;
      $(`.opts[data-k="${k}"]`).insertBefore(btn, $(`.opts[data-k="${k}"] .add`));
    }
    inp.value = ""; c.hidden = true;
    if (s.multi ? !state[k].includes(v) : state[k] !== v) pick(k, v);
  }
  function fisRows() {
    return STEPS.map(s => ({ label: s.fis, val: s.multi ? state[s.k].join(", ") : state[s.k], or: s.or }));
  }
  function doneTipi() {
    const sos = state.sos, isim = { "Lavaş": "Dürümcü", "Pide (Tombik)": "Tombikçi", "Somun Ekmek": "Ekmek Arası Ustası" }[state.ekmek] || "Dönerci";
    let sifat = "Klasik";
    if (state.aci === "İnanılmaz Acılı") sifat = "Ateşten Korkmayan";
    else if (sos.includes("Sossuz")) sifat = "Sossuz";
    else if (sos.length >= 3) sifat = "Sos Canavarı";
    else if (state.pisme === "Yanığa Yakın (Kıtır)") sifat = "Kıtır Kıtır";
    else if (state.garnitur.includes("Sadece Et")) sifat = "Minimalist";
    else if (state.aci === "Acılı") sifat = "Acı Sever";
    else if (state.garnitur.length >= 3) sifat = "Bol Malzemeli";
    else if (state.tavuk === "Göğüs (Yağsız)") sifat = "Formda";
    return sifat + " " + isim;
  }
  function renderFis() {
    const tip = $("#fis-tip"); if (tip) tip.textContent = doneTipi().trim();
    $("#fis-liste").innerHTML = fisRows().map(r =>
      `<div><dt>${r.label}:</dt><dd class="${r.val ? (r.or ? "or" : "") : "empty"}">${r.val ? esc(r.val) : "Seçilmedi"}</dd></div>`).join("");
  }
  syncButtons();

  /* ---------- save recipe ---------- */
  let savedSig = null;
  async function saveRecipe() {
    const secimler = {}; STEPS.forEach(s => secimler[s.k] = state[s.k]);
    secimler.not = ($("#r-not").value || "").trim().slice(0, 200);
    const il = $("#r-il").value || null, ilce = ($("#r-ilce").value || "").trim().slice(0, 60) || null;
    const sig = JSON.stringify([secimler, il, ilce]);
    if (sig === savedSig) return true;
    const d = getDb(); if (!d) { console.warn("Supabase ayarlanmadı; reçete kaydedilmedi."); return false; }
    const { error } = await d.from("receteler").insert({ secimler, il, ilce });
    if (error) { console.warn(error); return false; }
    savedSig = sig; return true;
  }

  /* ---------- story card ---------- */
  function wrapLines(ctx, text, maxW) {
    const words = String(text).split(" "); const lines = []; let line = "";
    words.forEach(w => { const t = line ? line + " " + w : w; if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; });
    if (line) lines.push(line); return lines;
  }
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); }
  function cone(x, cx, cy, s) { // stilize döner
    x.save(); x.translate(cx, cy); x.rotate(0.2);
    x.fillStyle = "#FFD500"; rr(x, -s * .05, -s * .95, s * .1, s * 1.9, s * .05); x.fill();
    x.fillStyle = "#fff"; x.beginPath(); x.moveTo(-s * .5, -s * .7); x.lineTo(s * .5, -s * .7); x.lineTo(s * .34, s * .7); x.lineTo(-s * .34, s * .7); x.closePath(); x.fill();
    x.fillStyle = "#FF6A00";
    [-.45, -.05, .35].forEach(t => { const y = s * t, w1 = s * (.5 - (t + .7) * .115), w2 = s * (.5 - (t + .83) * .115);
      x.beginPath(); x.moveTo(-w1, y); x.lineTo(w1, y); x.lineTo(w2, y + s * .13); x.lineTo(-w2, y + s * .13); x.closePath(); x.fill(); });
    x.restore();
  }
  function sticker(x, text, cx, cy, rot, bg, fg, size) {
    x.save(); x.translate(cx, cy); x.rotate(rot); x.font = `800 ${size}px Poppins, sans-serif`;
    const w = x.measureText(text).width + size * 1.4, h = size * 2;
    x.fillStyle = "rgba(0,0,0,.18)"; rr(x, -w / 2 + 6, -h / 2 + 8, w, h, h / 2); x.fill();
    x.fillStyle = bg; rr(x, -w / 2, -h / 2, w, h, h / 2); x.fill();
    x.fillStyle = fg; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(text, 0, 2); x.restore();
  }
  async function makeStory() {
    try { await Promise.all(["800 90px Poppins", "700 40px Poppins", "600 30px Poppins", "500 30px Poppins"].map(f => document.fonts.load(f))); } catch (e) {}
    const W = 1080, H = 1920, cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const x = cv.getContext("2d"); const F = "Poppins, sans-serif";
    // zemin
    x.fillStyle = "#2340B8"; x.fillRect(0, 0, W, H);
    x.fillStyle = "#FF6A00"; x.beginPath(); x.arc(W + 60, 250, 360, 0, 7); x.fill();
    x.fillStyle = "#1B3296"; x.beginPath(); x.arc(-120, H - 420, 380, 0, 7); x.fill();
    x.fillStyle = "#FFD500"; x.beginPath(); x.arc(W - 70, H - 300, 90, 0, 7); x.fill();
    cone(x, 850, 330, 300);
    // üst etiket
    x.font = `700 26px ${F}`; x.textBaseline = "middle"; x.textAlign = "left";
    const pill = "DENEDİK • TAVUK DÖNER DOSYASI", pw = x.measureText(pill).width + 56;
    x.fillStyle = "#FFD500"; rr(x, 80, 110, pw, 60, 30); x.fill(); x.fillStyle = "#121212"; x.fillText(pill, 108, 142);
    // başlık
    x.textBaseline = "alphabetic"; x.fillStyle = "#fff"; x.font = `800 150px ${F}`; x.fillText("BENİM", 72, 340);
    x.fillStyle = "#FFD500"; x.fillText("DÖNERİM", 72, 490);
    // döner tipi
    const tip = doneTipi().trim();
    x.save(); x.translate(80, 560); x.rotate(-0.035);
    x.font = `800 58px ${F}`; const tl = wrapLines(x, tip, 780); const bh = 70 + tl.length * 66;
    const bw = Math.max(...tl.map(l => x.measureText(l).width), 300) + 80;
    x.fillStyle = "rgba(0,0,0,.2)"; rr(x, 8, 10, bw, bh, 30); x.fill();
    x.fillStyle = "#FF6A00"; rr(x, 0, 0, bw, bh, 30); x.fill();
    x.fillStyle = "rgba(255,255,255,.85)"; x.font = `700 24px ${F}`; x.fillText("DÖNER TİPİM", 40, 48);
    x.fillStyle = "#fff"; x.font = `800 58px ${F}`; tl.forEach((l, i) => x.fillText(l, 40, 112 + i * 66));
    x.restore();
    // fiş kartı
    const j = (...a) => a.filter(Boolean).join(" · ");
    const rows = [
      { label: "Ekmek", val: state.ekmek },
      { label: "İç sos", val: state.sos.join(", "), multi: true },
      { label: "Acı", val: state.aci },
      { label: "Garnitür", val: state.garnitur.join(", "), multi: true },
      { label: "Tavuk", val: j(state.tavuk, state.pisme) },
      { label: "Peynir", val: state.peynir && state.peynir !== "Peynirsiz" ? state.peynir : "" },
      { label: "Yanına", val: j(state.icecek, state.patates && state.patates !== "Patatessiz" ? state.patates : "") },
    ].filter(r => r.val);
    const cardX = 80, cardW = W - 160, top = 600 + bh + 60, pad = 50;
    x.font = `700 36px ${F}`;
    const lay = rows.map(r => {
      if (r.multi) { // chip satırları
        const chips = r.val.split(", "); let lines = 1, lw = 0;
        x.font = `700 30px ${F}`;
        chips.forEach(c => { const w = x.measureText(c).width + 44; if (lw + w > cardW - pad * 2) { lines++; lw = 0; } lw += w + 12; });
        return { r, chips, h: 56 + lines * 64 + 22 };
      }
      return { r, h: 108 };
    });
    let cardH = lay.reduce((a, l) => a + l.h, 0) + pad * 2 - 10;
    const maxCard = 1560 - top; let scale = cardH > maxCard ? maxCard / cardH : 1;
    x.save(); x.translate(cardX + cardW / 2, top); x.rotate(0.02); x.scale(scale, scale); x.translate(-cardW / 2, 0);
    x.fillStyle = "rgba(0,0,0,.22)"; rr(x, 12, 16, cardW, cardH, 40); x.fill();
    x.fillStyle = "#fff"; rr(x, 0, 0, cardW, cardH, 40); x.fill();
    let y = pad;
    if (!rows.length) { x.fillStyle = "#8A90A8"; x.font = `600 38px ${F}`; x.textAlign = "center"; x.fillText("Henüz seçim yapılmadı", cardW / 2, 90); x.textAlign = "left"; }
    lay.forEach((l, i) => {
      x.textBaseline = "alphabetic"; x.fillStyle = "#8A90A8"; x.font = `700 24px ${F}`;
      x.fillText(l.r.label.toLocaleUpperCase("tr-TR"), pad, y + 30);
      if (l.chips) {
        let cx = pad, cy = y + 52; x.font = `700 30px ${F}`;
        l.chips.forEach((c, j) => { const w = x.measureText(c).width + 44;
          if (cx + w > cardW - pad) { cx = pad; cy += 64; }
          x.fillStyle = ["#FF6A00", "#2340B8", "#FFD500"][j % 3]; rr(x, cx, cy, w, 52, 26); x.fill();
          x.fillStyle = j % 3 === 2 ? "#121212" : "#fff"; x.textBaseline = "middle"; x.fillText(c, cx + 22, cy + 28); x.textBaseline = "alphabetic";
          cx += w + 12; });
      } else {
        x.fillStyle = "#14275A"; x.font = `800 40px ${F}`; let v = l.r.val;
        while (x.measureText(v).width > cardW - pad * 2 && v.length > 4) v = v.slice(0, -2);
        x.fillText(v === l.r.val ? v : v.trim() + "…", pad, y + 80);
      }
      y += l.h;
      if (i < lay.length - 1) { x.fillStyle = "#ECEAF2"; x.fillRect(pad, y - 8, cardW - pad * 2, 2); }
    });
    x.restore();
    // çıkartmalar
    sticker(x, "#EnİyiTavukDöner", 800, top - 20, 0.09, "#FFD500", "#121212", 30);
    // alt çağrı
    x.textAlign = "center"; x.textBaseline = "alphabetic"; x.fillStyle = "#fff"; x.font = `800 84px ${F}`;
    x.fillText("Seninki ne?", W / 2, 1700);
    x.font = `800 46px ${F}`; const url = "eniyitavukdoner.com", uw = x.measureText(url).width + 90;
    x.fillStyle = "#fff"; rr(x, (W - uw) / 2, 1745, uw, 92, 46); x.fill();
    x.fillStyle = "#2340B8"; x.textBaseline = "middle"; x.fillText(url, W / 2, 1793);
    return new Promise(r => cv.toBlob(r, "image/png"));
  }
  $("#story-btn").addEventListener("click", async e => {
    const btn = e.currentTarget; btn.disabled = true; const st = $("#recete-durum"); st.textContent = "Kartın hazırlanıyor…";
    try {
      const [blob, saved] = await Promise.all([makeStory(), saveRecipe()]);
      const file = new File([blob], "en-iyi-tavuk-donerim.png", { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], title: "Yıllardır aradığım tavuk döner", text: "Sen de tasarla: eniyitavukdoner.com" }); }
        catch (err) { if (err.name !== "AbortError") download(blob); }
      } else download(blob);
      st.textContent = saved ? "Reçeten kaydedildi. Story'de paylaşmayı unutma!" : "Kartın hazır. Story'de paylaşmayı unutma!";
    } catch (err) { console.error(err); st.textContent = "Bir sorun oldu, tekrar dener misin?"; }
    btn.disabled = false;
  });
  function download(blob) {
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "en-iyi-tavuk-donerim.png";
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  /* ---------- forms ---------- */
  async function submitForm(f, table, build) {
    if (f.web && f.web.value) return; // bot
    const data = build(); if (!data) return;
    const btn = $("button[type=submit]", f); btn.disabled = true;
    const d = getDb();
    if (!d) { setMsg(f, "Şu an kayıt alınamıyor. Lütfen biraz sonra tekrar dene.", false); btn.disabled = false; console.warn("Supabase ayarlanmadı."); return; }
    const { error } = await d.from(table).insert(data);
    btn.disabled = false;
    return error;
  }
  $("#bildir-form").addEventListener("submit", async e => {
    e.preventDefault(); const f = e.target;
    const err = await submitForm(f, "mekan_onerileri", () => {
      const v = n => (f[n].value || "").trim();
      if (!v("mekan_adi")) { setMsg(f, "Mekân adını yazar mısın?", false); f.mekan_adi.focus(); return; }
      if (!v("il")) { setMsg(f, "Hangi ilde olduğunu seçer misin?", false); f.il.focus(); return; }
      if (!f.kvkk_onay.checked) { setMsg(f, "Devam etmek için aydınlatma metnini onaylaman gerekiyor.", false); return; }
      return { mekan_adi: v("mekan_adi"), il: v("il"), ilce: v("ilce") || null, adres: v("adres") || null, neden: v("neden") || null, takma_ad: v("takma_ad") || null, kvkk_onay: true };
    });
    if (err === undefined) return;
    if (err) { console.warn(err); setMsg(f, "Bir sorun oldu, tekrar dener misin?", false); return; }
    f.reset(); setMsg(f, "Teşekkürler! Önerin listemize eklendi. Belki bir sonraki bölüm orada.", true); toast("Önerin alındı, teşekkürler!");
  });
  $("#haber-form").addEventListener("submit", async e => {
    e.preventDefault(); const f = e.target;
    const err = await submitForm(f, "bekleme_listesi", () => {
      let v = f.iletisim.value.trim();
      const isMail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
      const digits = v.replace(/[^\d]/g, "");
      if (!isMail && !(digits.length >= 10 && digits.length <= 13)) { setMsg(f, "Geçerli bir e-posta ya da telefon numarası yazar mısın?", false); f.iletisim.focus(); return; }
      if (!isMail) v = digits.length === 10 ? "0" + digits : digits; else v = v.toLowerCase();
      if (!f.kvkk_onay.checked) { setMsg(f, "Devam etmek için aydınlatma metnini onaylaman gerekiyor.", false); return; }
      return { iletisim: v, il: f.il.value || null, kvkk_onay: true };
    });
    if (err === undefined) return;
    if (err && err.code === "23505") { setMsg(f, "Sen zaten listedesin. Bulduğumuz gün ilk sen duyacaksın!", true); return; }
    if (err) { console.warn(err); setMsg(f, "Bir sorun oldu, tekrar dener misin?", false); return; }
    f.reset(); setMsg(f, "Harika! Bulduğumuz gün sana tek bir mesaj göndereceğiz.", true); toast("Listedesin!");
  });

  /* ---------- boot ---------- */
  function boot() { initMap(); loadStats(); }
  if (document.readyState === "complete") boot(); else window.addEventListener("load", boot);
})();

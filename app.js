/* eniyitavukdoner.com — v10 */
(function () {
  "use strict";
  // Panel davet / şifre bağlantısı ana sayfaya düşerse doğru panele aktar
  if (/(^|[#&])(access_token=|error_code=)/.test(location.hash.slice(1)) && /type=(invite|recovery|magiclink|signup)|error_code=otp_expired/.test(location.hash)) { location.replace("/panel/tahsin/" + location.hash); return; }
  const C = window.SITE_CONFIG || {};
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const TR = "tr-TR";
  const ONAY_METNI = "v1 (2026-09) · Bu proje ve açılış haberleri için bana e-posta ve SMS gönderilmesine onay veriyorum. · kaynak: eniyitavukdoner.com haber formu";

  /* ---------- Supabase ---------- */
  let db = null;
  function getDb() {
    if (db) return db;
    if (C.SUPABASE_URL && C.SUPABASE_ANON_KEY && window.supabase) {
      db = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    }
    return db;
  }

  /* ---------- helpers ---------- */
  function toast(msg) {
    let t = $(".toast");
    if (!t) { t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
    t.textContent = msg; t.classList.add("show");
    clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 3400);
  }
  const ILLER = () => Object.keys(window.ILCELER || {}).sort((a, b) => a.localeCompare(b, TR));
  function fillIl(sel, ph = "İl seç") {
    sel.innerHTML = `<option value="">${ph}</option>` + ILLER().map(i => `<option>${esc(i)}</option>`).join("") + `<option>Yurt dışı</option>`;
  }
  const ULKELER = ["Almanya", "Hollanda", "Belçika", "Avusturya", "Fransa", "İngiltere", "İsviçre", "Danimarka", "İsveç", "Norveç", "İtalya", "İspanya", "Yunanistan", "Bulgaristan", "KKTC", "Azerbaycan", "Gürcistan", "BAE", "Katar", "ABD", "Kanada", "Avustralya", "Diğer"];
  function fillIlce(sel, il, ph = "İlçe seç") {
    const lab = sel.closest("label"), span = lab && lab.querySelector("span");
    if (span && !span.dataset.orig) span.dataset.orig = span.textContent;
    if (span) span.textContent = il === "Yurt dışı" ? "Ülke" : span.dataset.orig;
    if (il === "Yurt dışı") {
      sel.innerHTML = `<option value="">Ülke seç</option>` + ULKELER.map(u => `<option>${esc(u)}</option>`).join("");
      sel.disabled = false; return;
    }
    const list = (window.ILCELER || {})[il];
    if (!list) { sel.innerHTML = `<option value="">Önce il seç</option>`; sel.disabled = true; return; }
    sel.innerHTML = `<option value="">${ph}</option>` + [...list].sort((a, b) => a.localeCompare(b, TR)).map(i => `<option>${esc(i)}</option>`).join("");
    sel.disabled = false;
  }
  function bindIlIlce(ilSel, ilceSel) {
    fillIl(ilSel); fillIlce(ilceSel, "");
    ilSel.addEventListener("change", () => { fillIlce(ilceSel, ilSel.value); clearErr(ilSel); });
    ilceSel.addEventListener("change", () => clearErr(ilceSel));
  }
  function setIl(ilSel, ilceSel, il) {
    if (ULKELER.includes(il)) { ilSel.value = "Yurt dışı"; fillIlce(ilceSel, "Yurt dışı"); ilceSel.value = il; return; }
    ilSel.value = il; fillIlce(ilceSel, il);
  }
  // il / ilçe / ülke değerlerini kayıt biçimine çevirir
  const konum = (il, ilce) => il === "Yurt dışı" ? { il, ilce: null, ulke: ilce || null } : { il: il || null, ilce: ilce || null };

  function fieldErr(el, msg) {
    el.setAttribute("aria-invalid", "true");
    const host = el.closest(".field") || el.closest(".check") || el.parentElement;
    let e = host.querySelector(".err-t");
    if (!e) { e = document.createElement("span"); e.className = "err-t"; host.appendChild(e); }
    e.textContent = msg;
  }
  function clearErr(el) {
    el.removeAttribute("aria-invalid");
    const host = el.closest(".field") || el.closest(".check") || el.parentElement;
    const e = host && host.querySelector(".err-t"); if (e) e.remove();
  }
  document.addEventListener("input", e => { if (e.target.matches("[aria-invalid]")) clearErr(e.target); });
  document.addEventListener("change", e => { if (e.target.matches("input[type=checkbox][aria-invalid]")) clearErr(e.target); });

  /* ---------- nav ---------- */
  const nav = $("#nav"), menuBtn = $("#menu-btn");
  menuBtn.addEventListener("click", () => {
    const open = nav.classList.toggle("open"); menuBtn.setAttribute("aria-expanded", open);
  });
  $$("#links a").forEach(a => a.addEventListener("click", () => { nav.classList.remove("open"); menuBtn.setAttribute("aria-expanded", false); }));
  addEventListener("scroll", () => nav.classList.toggle("scrolled", scrollY > 8), { passive: true });
  if ("IntersectionObserver" in window) {
    const secs = $$("#links a").map(a => $(a.getAttribute("href"))).filter(Boolean);
    const io = new IntersectionObserver(ents => ents.forEach(en => {
      if (en.isIntersecting) $$("#links a").forEach(a => a.classList.toggle("on", a.getAttribute("href") === "#" + en.target.id));
    }), { rootMargin: "-45% 0px -50% 0px" });
    secs.forEach(s => io.observe(s));
    const rv = new IntersectionObserver(ents => ents.forEach(en => { if (en.isIntersecting) { en.target.classList.add("in"); rv.unobserve(en.target); } }), { rootMargin: "0px 0px -8% 0px" });
    $$(".rv").forEach(el => rv.observe(el));
  } else $$(".rv").forEach(el => el.classList.add("in"));

  /* ---------- static bits ---------- */
  const yt = $("#yt-link"); if (yt) yt.href = C.YOUTUBE_URL || "#";
  const IKON = {
    youtube: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M23 7.2a3 3 0 00-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 001 7.2 31 31 0 00.5 12a31 31 0 00.5 4.8 3 3 0 002.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 002.1-2.1 31 31 0 00.5-4.8 31 31 0 00-.5-4.8zM9.7 15.1V8.9L15.5 12z"/></svg>',
    instagram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>'
  };
  const sos = $("#sosyal");
  if (sos) sos.innerHTML = (C.SOSYAL || []).map(x => `<a href="${esc(x.url)}" target="_blank" rel="noopener">${IKON[x.tur] || ""}<span>${esc(x.ad)}</span></a>`).join("");
  const fm = $("#foot-mail"); if (fm && C.ILETISIM_EPOSTA) { fm.href = "mailto:" + C.ILETISIM_EPOSTA; fm.textContent = C.ILETISIM_EPOSTA; }
  const yil = $("#yil"); if (yil) yil.textContent = new Date().getFullYear();
  const words = ["Şehir şehir", "Usta usta", "Ülke ülke", "Lavaş mı, pide mi?", "Soslu mu, sossuz mu?", "Acılı mı, acısız mı?", "Hesabı biz ödüyoruz", "Rotayı siz çiziyorsunuz"];
  const tk = $("#ticker"); if (tk) tk.innerHTML = [...words, ...words].map(w => `<span>${esc(w)}</span>`).join("");

  /* ---------- countdown ---------- */
  const start = C.SERI_BASLANGIC ? new Date(C.SERI_BASLANGIC) : null;
  function tick() {
    const box = $("#sayac"); if (!start) return;
    const ms = start - new Date();
    if (ms <= 0) { box.hidden = true; return; }
    box.hidden = false;
    $("#cd-g").textContent = Math.floor(ms / 864e5);
    $("#cd-s").textContent = Math.floor(ms / 36e5) % 24;
    $("#cd-d").textContent = Math.floor(ms / 6e4) % 60;
  }
  tick(); setInterval(tick, 30000);

  /* ---------- stats ---------- */
  // Sayaç: gerçek sayı eşiğe (ör. 300) ulaşana kadar, zamanla yavaşça artan ve eşiğin
  // hep altında kalan bir sayı gösterilir. Eşik geçilince gerçek sayı görünür.
  const ESIK = C.SAYAC_ESIK || { recete: 300, bekleyen: 200 };
  function vitrin(key, real) {
    const cap = ESIK[key] || 0; if (!cap || real >= cap) return real;
    const dk = Math.max(0, (Date.now() - Date.parse("2026-09-01T00:00:00+03:00")) / 6e4);
    const sahte = Math.floor(cap * (0.4 + 0.55 * (1 - Math.exp(-dk / 90000))));
    return Math.min(cap - 1, Math.max(real, sahte));
  }
  const shown = { recete: 0, bekleyen: 0, mekan: 0 };
  function animateTo(key, target) {
    const el = $("#st-" + key); const from = shown[key]; shown[key] = target;
    if (from === target || document.hidden || matchMedia("(prefers-reduced-motion: reduce)").matches) { el.textContent = target.toLocaleString(TR); return; }
    const t0 = performance.now(), dur = from === 0 ? 1600 : 900;
    (function step(t) {
      const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = Math.round(from + (target - from) * e).toLocaleString(TR);
      if (k < 1) requestAnimationFrame(step);
    })(t0);
  }
  async function loadStats() {
    let real = { recete: 0, bekleyen: 0, mekan: 0 };
    const d = getDb();
    if (d) { try { const { data } = await d.rpc("site_istatistik"); if (data) real = data; } catch (e) {} }
    animateTo("recete", vitrin("recete", Number(real.recete) || 0));
    animateTo("bekleyen", vitrin("bekleyen", Number(real.bekleyen) || 0));
    const m = Number(real.mekan) || 0;
    $("#stat-mekan").hidden = m === 0;
    $("#istatistik").classList.toggle("two-up", m === 0);
    if (m) { animateTo("mekan", m); const n = $("#lg-pin-note"); if (n) n.hidden = true; }
    $("#istatistik").hidden = false;
  }
  setInterval(() => { if (!document.hidden) loadStats(); }, 60000);

  /* ---------- builder ---------- */
  const STEPS = [
    { k: "ekmek", t: "Ekmek tercihi", fis: "Ekmek", o: ["Lavaş", "Pide (Tombik)", "Somun Ekmek"], d: "Lavaş" },
    { k: "sos", t: "Dönerin içindeki sos", fis: "İç sos", multi: true, o: ["Sossuz", "Hatay Domates Sosu", "Sarımsak Kreması", "Klasik Mayonez", "Ketçap", "Acı Sos", "Hardallı Sos", "Yoğurtlu Otlu Sos"], or: true },
    { k: "peynir", t: "Peynir", fis: "Peynir", o: ["Peynirsiz", "Beyaz Peynir", "Feta Peyniri", "Kaşar Peyniri", "Kolot Peyniri", "Cheddar"], d: "Peynirsiz" },
    { k: "aci", t: "Acı seviyesi", fis: "Acı", o: ["Acısız", "Az Acılı", "Acılı", "İnanılmaz Acılı"], or: true },
    { k: "garnitur", t: "Salata & garnitür", fis: "Garnitür", multi: true, o: ["Kornişon Turşu", "Patates Kızartması", "Jalapeno Turşusu", "Çıtır Beyaz Lahana", "Sumaklı Soğan", "Domates & Marul", "Sadece Et"], or: true },
    { k: "tavuk", t: "Tavuk parçası", fis: "Tavuk", o: ["But (Sulu)", "Göğüs (Yağsız)", "%50 But + %50 Göğüs"] },
    { k: "pisme", t: "Pişme seviyesi", fis: "Pişme", o: ["Normal Pişmiş", "Çok Pişmiş", "Yanığa Yakın (Kıtır)"] },
    { k: "icecek", t: "Dönerin yanına", sub: "İçecek", fis: "İçecek", o: ["Köpüklü Ayran", "Kapalı Ayran", "Şalgam (Acılı)", "Şalgam (Acısız)", "Kola", "Gazoz", "Maden Suyu"] },
    { k: "patates", sub: "Patates", fis: "Patates", o: ["Baharatlı Çıtır Patates", "Sade Patates", "Elma Dilim Patates", "Patatessiz"] },
    { k: "yansos", sub: "Yan soslar", fis: "Yan sos", multi: true, o: ["Sarımsaklı Mayonez", "Acı Sos", "Klasik Mayonez", "Ketçap", "Trüflü Mayonez", "Ballı Hardal", "Ranch Sos", "Barbekü Sos"], or: true },
  ];
  const state = {};
  STEPS.forEach(s => state[s.k] = s.multi ? [] : (s.d || ""));

  const form = $("#recete-form");
  let html = "", n = 0;
  STEPS.forEach((s, i) => {
    if (s.t) { n++; html += `<div class="step"><div class="step-h"><h4><em>${n}</em>${esc(s.t)}</h4><small>${s.multi ? "Birden fazla seçebilirsin" : ""}</small></div>`; }
    if (s.sub) html += `<div class="sub-h">${esc(s.sub)}${s.multi ? " · birden fazla" : ""}</div>`;
    html += `<div class="opts" data-k="${s.k}" role="group" aria-label="${esc(s.t || s.sub)}">` + s.o.map(o => `<button type="button" class="opt${s.multi ? " multi" : ""}" data-v="${esc(o)}" aria-pressed="false">${esc(o)}</button>`).join("") +
      `<button type="button" class="opt add" data-add="${s.k}">+ Kendim yazacağım</button></div>
      <div class="custom" data-custom="${s.k}" hidden><input maxlength="40" placeholder="Kendi seçeneğini yaz" aria-label="Kendi seçeneğin"><button type="button" class="btn btn-sm">Ekle</button></div>`;
    const next = STEPS[i + 1];
    if (!next || next.t) html += `</div>`;
  });
  html += `<div class="step"><div class="step-h"><h4><em>${n + 1}</em>Ek notlar</h4><small>İsteğe bağlı</small></div><textarea id="r-not" rows="2" maxlength="200" placeholder="Örn: Lavaş sacda çıtırlasın…" aria-label="Ek notlar"></textarea></div>`;
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
    const c = b.closest(".custom"); if (c) addCustom(c);
  });
  form.addEventListener("keydown", e => { if (e.key === "Enter" && e.target.closest(".custom")) { e.preventDefault(); addCustom(e.target.closest(".custom")); } });
  function addCustom(c) {
    const k = c.dataset.custom, inp = $("input", c), v = inp.value.trim().slice(0, 40);
    if (!v) return;
    const s = STEPS.find(x => x.k === k);
    if (!s.o.includes(v)) {
      s.o.push(v);
      const btn = document.createElement("button");
      btn.type = "button"; btn.className = "opt" + (s.multi ? " multi" : ""); btn.dataset.v = v; btn.textContent = v; btn.setAttribute("aria-pressed", "false");
      $(`.opts[data-k="${k}"]`).insertBefore(btn, $(`.opts[data-k="${k}"] .add`));
    }
    inp.value = ""; c.hidden = true;
    if (s.multi ? !state[k].includes(v) : state[k] !== v) pick(k, v);
  }
  function doneTipi(s = state) {
    const sos = s.sos, isim = { "Lavaş": "Dürümcü", "Pide (Tombik)": "Tombikçi", "Somun Ekmek": "Ekmek Arası Ustası" }[s.ekmek] || "Dönerci";
    let sifat = "Klasik";
    if (s.aci === "İnanılmaz Acılı") sifat = "Ateşten Korkmayan";
    else if (sos.includes("Sossuz")) sifat = "Sossuz";
    else if (sos.length >= 3) sifat = "Sos Canavarı";
    else if (s.pisme === "Yanığa Yakın (Kıtır)") sifat = "Kıtır Kıtır";
    else if (s.garnitur.includes("Sadece Et")) sifat = "Minimalist";
    else if (s.aci === "Acılı") sifat = "Acı Sever";
    else if (s.garnitur.length >= 3) sifat = "Bol Malzemeli";
    else if (s.tavuk === "Göğüs (Yağsız)") sifat = "Formda";
    return sifat + " " + isim;
  }
  function renderFis() {
    $("#fis-tip").textContent = doneTipi();
    const mt = $("#mbar-tip"); if (mt) mt.textContent = doneTipi();
    $("#fis-liste").innerHTML = STEPS.map(s => ({ label: s.fis, val: s.multi ? state[s.k].join(", ") : state[s.k], or: s.or })).map(r =>
      `<div><dt>${r.label}</dt><dd class="${r.val ? (r.or ? "or" : "") : "empty"}">${r.val ? esc(r.val) : "Seçilmedi"}</dd></div>`).join("");
  }

  /* ---------- save recipe ---------- */
  let savedSig = null;
  async function saveRecipe() {
    const secimler = {}; STEPS.forEach(s => secimler[s.k] = state[s.k]);
    secimler.not = ($("#r-not").value || "").trim().slice(0, 200);
    const loc = konum($("#r-il").value, $("#r-ilce").value);
    const sig = JSON.stringify([secimler, loc]);
    if (sig === savedSig) return true;
    const d = getDb(); if (!d) return false;
    const { error } = await d.from("receteler").insert({ secimler, ...loc });
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
  function cone(x, cx, cy, s) {
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
  async function makeStory(s = state) {
    try { await Promise.all(["800 90px Poppins", "700 40px Poppins", "600 30px Poppins", "500 30px Poppins"].map(f => document.fonts.load(f))); } catch (e) {}
    const W = 1080, H = 1920, cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const x = cv.getContext("2d"); const F = "Poppins, sans-serif";
    x.fillStyle = "#2340B8"; x.fillRect(0, 0, W, H);
    x.fillStyle = "#FF6A00"; x.beginPath(); x.arc(W + 60, 250, 360, 0, 7); x.fill();
    x.fillStyle = "#1B3296"; x.beginPath(); x.arc(-120, H - 420, 380, 0, 7); x.fill();
    x.fillStyle = "#FFD500"; x.beginPath(); x.arc(W - 70, H - 300, 90, 0, 7); x.fill();
    cone(x, 850, 330, 300);
    x.font = `700 26px ${F}`; x.textBaseline = "middle"; x.textAlign = "left";
    const pill = "DENEDİK • TAVUK DÖNER DOSYASI", pw = x.measureText(pill).width + 56;
    x.fillStyle = "#FFD500"; rr(x, 80, 110, pw, 60, 30); x.fill(); x.fillStyle = "#121212"; x.fillText(pill, 108, 142);
    x.textBaseline = "alphabetic"; x.fillStyle = "#fff"; x.font = `800 150px ${F}`; x.fillText("BENİM", 72, 340);
    x.fillStyle = "#FFD500"; x.fillText("DÖNERİM", 72, 490);
    const tip = doneTipi(s);
    x.save(); x.translate(80, 560); x.rotate(-0.035);
    x.font = `800 58px ${F}`; const tl = wrapLines(x, tip, 780); const bh = 70 + tl.length * 66;
    const bw = Math.max(...tl.map(l => x.measureText(l).width), 300) + 80;
    x.fillStyle = "rgba(0,0,0,.2)"; rr(x, 8, 10, bw, bh, 30); x.fill();
    x.fillStyle = "#FF6A00"; rr(x, 0, 0, bw, bh, 30); x.fill();
    x.fillStyle = "rgba(255,255,255,.85)"; x.font = `700 24px ${F}`; x.fillText("DÖNER TİPİM", 40, 48);
    x.fillStyle = "#fff"; x.font = `800 58px ${F}`; tl.forEach((l, i) => x.fillText(l, 40, 112 + i * 66));
    x.restore();
    const j = (...a) => a.filter(Boolean).join(" · ");
    const rows = [
      { label: "Ekmek", val: s.ekmek },
      { label: "İç sos", val: s.sos.join(", "), multi: true },
      { label: "Acı", val: s.aci },
      { label: "Garnitür", val: s.garnitur.join(", "), multi: true },
      { label: "Tavuk", val: j(s.tavuk, s.pisme) },
      { label: "Peynir", val: s.peynir && s.peynir !== "Peynirsiz" ? s.peynir : "" },
      { label: "Yanına", val: j(s.icecek, s.patates && s.patates !== "Patatessiz" ? s.patates : "") },
    ].filter(r => r.val);
    const cardX = 80, cardW = W - 160, top = 600 + bh + 60, pad = 50;
    const lay = rows.map(r => {
      if (r.multi) {
        const chips = r.val.split(", "); let lines = 1, lw = 0;
        x.font = `700 30px ${F}`;
        chips.forEach(c => { const w = x.measureText(c).width + 44; if (lw + w > cardW - pad * 2) { lines++; lw = 0; } lw += w + 12; });
        return { r, chips, h: 56 + lines * 64 + 22 };
      }
      return { r, h: 108 };
    });
    const cardH = lay.reduce((a, l) => a + l.h, 0) + pad * 2 - 10;
    const maxCard = 1560 - top; const scale = cardH > maxCard ? maxCard / cardH : 1;
    x.save(); x.translate(cardX + cardW / 2, top); x.rotate(0.02); x.scale(scale, scale); x.translate(-cardW / 2, 0);
    x.fillStyle = "rgba(0,0,0,.22)"; rr(x, 12, 16, cardW, cardH, 40); x.fill();
    x.fillStyle = "#fff"; rr(x, 0, 0, cardW, cardH, 40); x.fill();
    let y = pad;
    if (!rows.length) { x.fillStyle = "#8A90A8"; x.font = `600 38px ${F}`; x.textAlign = "center"; x.fillText("Henüz seçim yapılmadı", cardW / 2, 90); x.textAlign = "left"; }
    lay.forEach((l, i) => {
      x.textBaseline = "alphabetic"; x.fillStyle = "#8A90A8"; x.font = `700 24px ${F}`;
      x.fillText(l.r.label.toLocaleUpperCase(TR), pad, y + 30);
      if (l.chips) {
        let cx = pad, cy = y + 52; x.font = `700 30px ${F}`;
        l.chips.forEach((c, k) => { const w = x.measureText(c).width + 44;
          if (cx + w > cardW - pad) { cx = pad; cy += 64; }
          x.fillStyle = ["#FF6A00", "#2340B8", "#FFD500"][k % 3]; rr(x, cx, cy, w, 52, 26); x.fill();
          x.fillStyle = k % 3 === 2 ? "#121212" : "#fff"; x.textBaseline = "middle"; x.fillText(c, cx + 22, cy + 28); x.textBaseline = "alphabetic";
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
    sticker(x, "#EnİyiTavukDöner", 800, top - 20, 0.09, "#FFD500", "#121212", 30);
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
        try { await navigator.share({ files: [file], title: "Benim dönerim", text: "Sen de tasarla: eniyitavukdoner.com" }); }
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
  async function heroStory() {
    const img = $("#hero-story"); if (!img) return;
    const ornek = { ekmek: "Lavaş", sos: ["Sarımsak Kreması", "Hatay Domates Sosu"], peynir: "Peynirsiz", aci: "Az Acılı",
      garnitur: ["Sumaklı Soğan", "Kornişon Turşu", "Patates Kızartması"], tavuk: "But (Sulu)", pisme: "Çok Pişmiş",
      icecek: "Köpüklü Ayran", patates: "", yansos: [] };
    try { const b = await makeStory(ornek); img.src = URL.createObjectURL(b); } catch (e) {}
  }

  /* ---------- forms ---------- */
  const OK_ICO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>';
  function normPhone(v, yurtdisi) {
    const raw = String(v || "").trim(), d = raw.replace(/\D/g, "");
    if (/^(90)?0?5\d{9}$/.test(d)) return "+90" + d.slice(-10);
    if (yurtdisi && raw.startsWith("+") && d.length >= 8 && d.length <= 15) return "+" + d;
    if (yurtdisi && raw.startsWith("00") && d.length >= 10 && d.length <= 17) return "+" + d.slice(2);
    return null;
  }
  function fmtPhoneInput(el) {
    el.addEventListener("input", () => {
      const v = el.value; if (v.startsWith("+") && !v.startsWith("+90")) return;
      let d = v.replace(/\D/g, ""); if (d.startsWith("90")) d = d.slice(2); if (d && d[0] !== "0") d = "0" + d; d = d.slice(0, 11);
      const p = [d.slice(0, 4), d.slice(4, 7), d.slice(7, 9), d.slice(9, 11)].filter(Boolean);
      const nv = p.join(" "); if (nv !== v) el.value = nv;
    });
  }
  async function insert(table, row) {
    const d = getDb(); if (!d) return { message: "no-db" };
    const { error } = await d.from(table).insert(row); return error;
  }

  // Mekân öner: önce Google Maps linki, alanlar kendiliğinden dolar
  const of = $("#oner-form");
  bindIlIlce(of.il, of.ilce);
  const lnkCard = $("#lnk-card"), manual = $("#oner-manual"), elleBtn = $("[data-elle]", of);
  const anahtar = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase(TR).replace(/[^a-z0-9]/g, "");
  const eslesen = (list, ad) => { const k = anahtar(ad); return k ? list.find(x => anahtar(x) === k) || null : null; };
  let YER = null, lnkT = null, lnkSon = "";
  const PIN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-5.6-7-11a7 7 0 0114 0c0 5.4-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>';
  function elle(acik, odak) {
    manual.hidden = !acik; elleBtn.hidden = acik;
    if (acik && odak) setTimeout(() => (of.mekan_adi.value ? of.il : of.mekan_adi).focus(), 30);
  }
  function kart(durum, html) { lnkCard.hidden = !durum; lnkCard.className = "lnk-card" + (durum ? " " + durum : ""); lnkCard.innerHTML = html || ""; }
  function yerYaz(y) {
    YER = y;
    of.mekan_adi.value = y.ad || "";
    if (y.il === "Yurt dışı") { of.il.value = "Yurt dışı"; fillIlce(of.ilce, "Yurt dışı"); const u = eslesen(ULKELER, y.ulke); if (u) of.ilce.value = u; }
    else {
      const il = eslesen(ILLER(), y.il);
      if (il) { of.il.value = il; fillIlce(of.ilce, il); const ic = eslesen((window.ILCELER || {})[il] || [], y.ilce); if (ic) of.ilce.value = ic; }
    }
    [of.mekan_adi, of.il, of.ilce].forEach(clearErr);
    const yer = [y.ilce && y.il !== "Yurt dışı" ? y.ilce.normalize("NFC").replace(/̇/g, "") : "", y.il === "Yurt dışı" ? y.ulke : y.il].filter(Boolean).join(", ");
    kart("ok", `<span class="lc-ico">${PIN}</span><div class="lc-txt"><b>${esc(y.ad)}</b><span>${esc(yer)}</span>${y.kapali ? `<em class="lc-warn">Google'a göre kalıcı olarak kapanmış</em>` : ""}</div><button type="button" class="linkish" data-duzelt>Düzelt</button>`);
    elle(false); elleBtn.hidden = true;
  }
  async function linkTani(url) {
    if (url === lnkSon) return; lnkSon = url; YER = null;
    if (!url) { kart(null); if (manual.hidden) elleBtn.hidden = false; return; }
    if (!/^https?:\/\/\S+\.\S+/i.test(url)) { kart("err", `<div class="lc-txt"><span>Bu bir link gibi görünmüyor. Google Maps'ten “Bağlantıyı kopyala” ile aldığın linki yapıştır.</span></div>`); return; }
    kart("load", `<span class="lc-spin" aria-hidden="true"></span><div class="lc-txt"><span>Mekân Google Maps'te tanınıyor…</span></div>`);
    const d = getDb(); let r = null;
    try { const res = await d.functions.invoke("google-mekan", { body: { islem: "link_genel", url } }); r = res.data || null; } catch (e) { r = null; }
    if (url !== lnkSon) return;
    if (r && r.yer) return yerYaz(r.yer);
    if (r && r.ad && !of.mekan_adi.value) of.mekan_adi.value = r.ad;
    kart("info", `<div class="lc-txt"><span>${r && r.error ? esc(r.error) : "Linki kaydettik. Mekânın adını ve ilini aşağıya yazar mısın?"}</span></div>`);
    elle(true, true);
  }
  of.link.addEventListener("input", () => { clearTimeout(lnkT); const u = of.link.value.trim(); lnkT = setTimeout(() => linkTani(u), u ? 450 : 0); });
  of.link.addEventListener("paste", () => setTimeout(() => { clearTimeout(lnkT); linkTani(of.link.value.trim()); }, 0));
  const pasteBtn = $("[data-paste]", of);
  if (navigator.clipboard && navigator.clipboard.readText && matchMedia("(pointer:coarse)").matches) {
    pasteBtn.hidden = false;
    pasteBtn.addEventListener("click", async () => { try { const t = (await navigator.clipboard.readText()).trim(); if (t) { of.link.value = t; linkTani(t); } } catch (e) { of.link.focus(); } });
  }
  elleBtn.addEventListener("click", () => elle(true, true));
  lnkCard.addEventListener("click", e => { if (e.target.closest("[data-duzelt]")) { YER = null; elle(true, true); kart(null); } });
  function onerSifirla() { of.reset(); fillIlce(of.ilce, ""); YER = null; lnkSon = ""; kart(null); elle(false); }

  of.addEventListener("submit", async e => {
    e.preventDefault(); if (of.web.value) return;
    const v = n => (of[n].value || "").trim(); let bad = null;
    const need = (el, ok, msg) => { if (!ok) { fieldErr(el, msg); bad = bad || el; } else clearErr(el); };
    if (!YER) {
      if (manual.hidden && !v("link")) { elle(true); }
      need(of.mekan_adi, v("mekan_adi").length >= 2, "Mekânın adını yazar mısın?");
      need(of.il, !!v("il"), "İl seç.");
      need(of.ilce, of.ilce.disabled || !!v("ilce"), v("il") === "Yurt dışı" ? "Ülke seç." : "İlçe seç.");
    }
    need(of.kvkk_onay, of.kvkk_onay.checked, "Devam etmek için onaylaman gerekiyor.");
    if (bad) { bad.focus(); return; }
    const btn = $("button[type=submit]", of), msgEl = $(".form-msg", of);
    btn.disabled = true; btn.textContent = "Gönderiliyor…"; msgEl.textContent = "";
    let hata = null;
    if (YER) {
      const k = konum(v("il"), v("ilce"));
      const body = { islem: "oner", place_id: YER.place_id, link: v("link"), mekan_adi: v("mekan_adi") || YER.ad,
        il: k.il || YER.il, ilce: k.ilce || (YER.ilce ? YER.ilce.replace(/̇/g, "") : null), ulke: k.ulke || YER.ulke,
        neden: v("neden") || null, takma_ad: v("takma_ad") || null, yayin_izni: of.yayin_izni.checked, kvkk_onay: true, web: of.web.value };
      try { const { data, error } = await getDb().functions.invoke("google-mekan", { body }); hata = error ? "ag" : (data && data.error) || null; }
      catch (err) { hata = "ag"; }
    } else {
      const err = await insert("mekan_onerileri", { mekan_adi: v("mekan_adi"), ...konum(v("il"), v("ilce")), adres: v("link") || null,
        neden: v("neden") || null, takma_ad: v("takma_ad") || null, yayin_izni: of.yayin_izni.checked, kvkk_onay: true });
      if (err) { console.warn(err); hata = /Çok fazla|yoğun/.test(err.message || "") ? err.message : "ag"; }
    }
    btn.disabled = false; btn.textContent = "Önerimi gönder";
    if (hata) { msgEl.className = "form-msg err"; msgEl.textContent = hata === "ag" ? "Bir sorun oldu, birazdan tekrar dener misin?" : hata; return; }
    const il = YER ? (YER.il === "Yurt dışı" ? YER.ulke : YER.il) : (v("il") === "Yurt dışı" ? v("ilce") : v("il"));
    const ad = YER ? (v("mekan_adi") || YER.ad) : v("mekan_adi");
    of.hidden = true;
    const done = document.createElement("div"); done.className = "done";
    done.innerHTML = `<div class="ok-ico">${OK_ICO}</div><h3>Önerin bize ulaştı!</h3>
      <p>${esc(ad)}${il ? ` (${esc(il)})` : ""} listemizde. İnceledikten sonra Türkiye Tavuk Dönerci Haritası'na ekleyeceğiz; belki bir sonraki bölüm orada.</p>
      <div class="cta"><button class="btn" type="button" data-again>Bir mekân daha öner</button><a class="btn btn-line" href="#harita">Haritaya bak</a></div>`;
    $("#oner-kart").appendChild(done);
    done.querySelector("[data-again]").addEventListener("click", () => { done.remove(); onerSifirla(); of.hidden = false; of.link.focus(); });
    toast("Önerin alındı, teşekkürler!");
  });

  // Bana haber ver
  const hf = $("#haber-form");
  bindIlIlce(hf.il, hf.ilce);
  fmtPhoneInput(hf.telefon);
  hf.addEventListener("submit", async e => {
    e.preventDefault(); if (hf.web.value) return;
    let bad = null;
    const need = (el, ok, msg) => { if (!ok) { fieldErr(el, msg); bad = bad || el; } else clearErr(el); };
    const mail = hf.eposta.value.trim().toLowerCase();
    const tel = normPhone(hf.telefon.value, hf.il.value === "Yurt dışı");
    need(hf.eposta, /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail), "Geçerli bir e-posta adresi yazar mısın?");
    need(hf.telefon, !!tel, hf.il.value === "Yurt dışı" ? "Numaranı ülke koduyla yaz (örn. +49…)." : "05XX XXX XX XX biçiminde bir cep numarası yazar mısın?");
    need(hf.il, !!hf.il.value, "İl seç.");
    need(hf.ilce, hf.ilce.disabled || !!hf.ilce.value, hf.il.value === "Yurt dışı" ? "Ülke seç." : "İlçe seç.");
    need(hf.ileti_onay, hf.ileti_onay.checked, "Sana haber verebilmemiz için bu onay gerekli.");
    need(hf.kvkk_onay, hf.kvkk_onay.checked, "Devam etmek için onaylaman gerekiyor.");
    if (bad) { bad.focus(); return; }
    const btn = $("button[type=submit]", hf); btn.disabled = true; btn.textContent = "Kaydediliyor…";
    const err = await insert("bekleme_listesi", { eposta: mail, telefon: tel, ...konum(hf.il.value, hf.ilce.value),
      ileti_onay: true, onay_metni: ONAY_METNI, kvkk_onay: true });
    btn.disabled = false; btn.textContent = "Bana haber ver";
    const dup = err && err.code === "23505";
    if (err && !dup) { console.warn(err); const m = $(".form-msg", hf); m.className = "form-msg err"; m.textContent = "Bir sorun oldu, birazdan tekrar dener misin?"; return; }
    hf.hidden = true;
    const done = document.createElement("div"); done.className = "done";
    done.innerHTML = `<div class="ok-ico">${OK_ICO}</div><h3>${dup ? "Zaten listedesin!" : "Listedesin!"}</h3>
      <p>${dup ? "Bu e-posta ya da telefon zaten kayıtlı. Bulduğumuz gün ilk sen duyacaksın." : "En iyi tavuk döneri bulduğumuz gün ilk sen duyacaksın."}</p>
      <div class="cta"><button class="btn btn-o" type="button" data-share>Arkadaşına da söyle</button></div>`;
    $("#haber-kart").appendChild(done);
    done.querySelector("[data-share]").addEventListener("click", async () => {
      const data = { title: "Türkiye'nin en iyi tavuk dönerini arıyoruz", text: "Hayalindeki döneri tasarla, favori dönercini öner:", url: "https://eniyitavukdoner.com" };
      if (navigator.share) { try { await navigator.share(data); } catch (e) {} }
      else { try { await navigator.clipboard.writeText(data.url); toast("Bağlantı kopyalandı"); } catch (e) { toast("eniyitavukdoner.com"); } }
    });
    if (!dup) { toast("Listedesin!"); loadStats(); }
  });

  // Mobil reçete çubuğu: builder görünürken ve fiş görünmüyorken
  if ("IntersectionObserver" in window) {
    const mbar = $("#mbar"); let inB = false, fisV = false;
    const upd = () => mbar.classList.toggle("show", inB && !fisV);
    new IntersectionObserver(e => { inB = e[0].isIntersecting; upd(); }, { rootMargin: "-30% 0px -30% 0px" }).observe($("#recete-form"));
    new IntersectionObserver(e => { fisV = e[0].isIntersecting; upd(); }).observe($("#fis"));
  }

  // Reçete il/ilçe
  bindIlIlce($("#r-il"), $("#r-ilce"));
  syncButtons();

  /* ---------- boot ---------- */
  function boot() {
    loadStats();
    setTimeout(heroStory, 250);
  }
  if (window.ILCELER && window.supabase) boot();
  else window.addEventListener("load", boot);
})();

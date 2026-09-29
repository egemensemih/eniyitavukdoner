/* eniyitavukdoner.com — yönetim paneli */
(function () {
  "use strict";
  const C = window.SITE_CONFIG || {};
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const TR = "tr-TR";
  const db = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY, { auth: { persistSession: true, storageKey: "etd-panel", detectSessionInUrl: true } });
  const D = { oneri: [], bekleme: [], mekan: [], recete: [] };
  const DURUM = { yeni: "Yeni", incelendi: "İncelendi", listede: "Rotada", gidildi: "Gidildi", uygun_degil: "Uygun değil" };
  const ILLER = Object.keys(window.ILCELER || {}).sort((a, b) => a.localeCompare(b, TR));
  const fmtD = s => new Date(s).toLocaleDateString(TR, { day: "2-digit", month: "short", year: "numeric" });
  const fmtDT = s => new Date(s).toLocaleString(TR, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  const norm = s => String(s || "").toLocaleLowerCase(TR).replace(/[^a-zçğıöşü0-9]+/g, " ").trim();
  const nf = n => Number(n).toLocaleString(TR);

  /* ---------- toast / modal ---------- */
  function toast(msg) {
    let t = $(".toast"); if (!t) { t = document.createElement("div"); t.className = "toast"; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add("show"); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 2800);
  }
  const modal = $("#modal");
  function openModal(title, html, small) {
    $("#modal-title").textContent = title; $("#modal-body").innerHTML = html;
    $(".modal-card", modal).classList.toggle("sm", !!small); modal.hidden = false;
    const f = $("input,select,textarea", $("#modal-body")); if (f) setTimeout(() => f.focus(), 30);
  }
  function closeModal() { modal.hidden = true; $("#modal-body").innerHTML = ""; }
  modal.addEventListener("click", e => { if (e.target.closest("[data-close]")) closeModal(); });
  addEventListener("keydown", e => { if (e.key === "Escape" && !modal.hidden) closeModal(); });
  function confirmBox(msg, okText = "Sil") {
    return new Promise(res => {
      openModal("Emin misin?", `<p style="margin-bottom:22px;line-height:1.55">${msg}</p><div class="m-foot"><button class="btn btn-line btn-sm" data-no>Vazgeç</button><button class="btn btn-danger btn-sm" data-yes>${esc(okText)}</button></div>`, true);
      $("#modal-body").onclick = e => { if (e.target.closest("[data-yes]")) { closeModal(); res(true); } else if (e.target.closest("[data-no]")) { closeModal(); res(false); } };
    });
  }
  const tip = $("#tip");
  document.addEventListener("mousemove", e => {
    const t = e.target.closest("[data-tip]");
    if (!t) { tip.hidden = true; return; }
    tip.textContent = t.dataset.tip; tip.hidden = false;
    const w = tip.offsetWidth; tip.style.left = Math.min(innerWidth - w - 8, e.clientX + 12) + "px"; tip.style.top = (e.clientY - 38) + "px";
  });

  /* ---------- auth ---------- */
  const lf = $("#login-form"), npf = $("#newpass-form");
  function msg(f, t, ok) { const m = $(".form-msg", f); m.textContent = t; m.className = "form-msg " + (ok ? "" : "err"); m.style.color = ok ? "var(--ok)" : ""; }
  lf.addEventListener("submit", async e => {
    e.preventDefault(); const btn = $("button[type=submit]", lf); btn.disabled = true; msg(lf, "");
    const { error } = await db.auth.signInWithPassword({ email: lf.email.value.trim(), password: lf.password.value });
    btn.disabled = false;
    if (error) return msg(lf, "E-posta ya da şifre hatalı.");
    start();
  });
  $("#forgot").addEventListener("click", async () => {
    const email = lf.email.value.trim(); if (!email) return msg(lf, "Önce e-posta adresini yaz.");
    const { error } = await db.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    msg(lf, error ? "Şu an gönderilemedi, biraz sonra dene." : "Şifre sıfırlama bağlantısı e-postana gönderildi.", !error);
  });
  npf.addEventListener("submit", async e => {
    e.preventDefault(); if (npf.password.value.length < 8) return msg(npf, "En az 8 karakter olmalı.");
    const { error } = await db.auth.updateUser({ password: npf.password.value });
    if (error) return msg(npf, "Kaydedilemedi: " + error.message);
    npf.hidden = true; lf.hidden = false; start();
  });
  db.auth.onAuthStateChange(ev => { if (ev === "PASSWORD_RECOVERY") { $("#login").hidden = false; $("#app").hidden = true; lf.hidden = true; npf.hidden = false; } });
  $("#logout").addEventListener("click", async () => { await db.auth.signOut(); location.reload(); });

  async function start() {
    const { data: { session } } = await db.auth.getSession();
    if (!session) { $("#login").hidden = false; $("#app").hidden = true; return; }
    const { data: ok } = await db.rpc("is_admin");
    if (!ok) { $("#login").hidden = false; $("#app").hidden = true; msg(lf, "Bu hesabın panel yetkisi yok."); await db.auth.signOut(); return; }
    $("#login").hidden = true; $("#app").hidden = false; $("#me-mail").textContent = session.user.email;
    await loadAll();
  }

  /* ---------- data ---------- */
  async function fetchAll(table, order = "created_at") {
    const out = []; let from = 0;
    for (;;) {
      const { data, error } = await db.from(table).select("*").order(order, { ascending: false }).range(from, from + 999);
      if (error) { toast("Veri alınamadı: " + error.message); break; }
      out.push(...data); if (data.length < 1000) break; from += 1000;
    }
    return out;
  }
  async function loadAll() {
    [D.oneri, D.bekleme, D.mekan, D.recete] = await Promise.all([fetchAll("mekan_onerileri"), fetchAll("bekleme_listesi"), fetchAll("mekanlar"), fetchAll("receteler")]);
    renderAll();
  }
  function renderAll() {
    $("#cnt-oneri").textContent = D.oneri.length; $("#cnt-bekleme").textContent = D.bekleme.length;
    $("#cnt-mekan").textContent = D.mekan.length; $("#cnt-recete").textContent = D.recete.length;
    $("#cnt-rota").textContent = D.oneri.filter(r => r.durum === "listede").length;
    renderOzet(); renderOneri(); renderBekleme(); renderMekan(); renderRecete(); renderRota();
  }
  $$("[data-refresh]").forEach(b => b.addEventListener("click", async () => { b.disabled = true; await loadAll(); b.disabled = false; toast("Güncellendi"); }));

  /* ---------- tabs ---------- */
  $("#tabs").addEventListener("click", e => {
    const b = e.target.closest("[data-tab]"); if (!b) return;
    $$("#tabs [data-tab]").forEach(x => x.setAttribute("aria-selected", x === b));
    $$("[data-pane]").forEach(p => p.hidden = p.dataset.pane !== b.dataset.tab);
    history.replaceState(null, "", "#" + b.dataset.tab);
  });
  function goTab(t) { const b = $(`#tabs [data-tab="${t}"]`); if (b) b.click(); }

  /* ---------- charts ---------- */
  function lastDays(rows, n = 30) {
    const days = []; const now = new Date(); now.setHours(0, 0, 0, 0);
    for (let i = n - 1; i >= 0; i--) { const d = new Date(now); d.setDate(d.getDate() - i); days.push({ d, k: d.toDateString(), v: 0 }); }
    const idx = Object.fromEntries(days.map((x, i) => [x.k, i]));
    rows.forEach(r => { const k = new Date(r.created_at); k.setHours(0, 0, 0, 0); const i = idx[k.toDateString()]; if (i !== undefined) days[i].v++; });
    return days;
  }
  function barChart(el, days, unit) {
    const W = 600, H = 170, pl = 28, pb = 22, pt = 8, max = Math.max(1, ...days.map(d => d.v));
    const nice = max <= 4 ? max : Math.ceil(max / 4) * 4, bw = (W - pl) / days.length;
    let s = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Son 30 gün">`;
    (nice >= 2 ? [0, .5, 1] : [0, 1]).forEach(f => { const y = pt + (H - pt - pb) * (1 - f); s += `<line class="grid" x1="${pl}" x2="${W}" y1="${y}" y2="${y}"/><text class="ax" x="${pl - 6}" y="${y + 3}" text-anchor="end">${Math.round(nice * f)}</text>`; });
    days.forEach((d, i) => {
      const h = (H - pt - pb) * d.v / nice, x = pl + i * bw + 1, y = H - pb - h;
      const lbl = `${d.d.toLocaleDateString(TR, { day: "numeric", month: "short" })}: ${d.v} ${unit}`;
      s += `<g data-tip="${esc(lbl)}"><rect class="hit" x="${pl + i * bw}" y="${pt}" width="${bw}" height="${H - pt - pb}"/>${d.v ? `<rect class="b" x="${x}" y="${y}" width="${Math.max(2, bw - 2)}" height="${h}" rx="3"/>` : ""}</g>`;
      if (i % 7 === 0 && i < days.length - 3 || i === days.length - 1) s += `<text class="ax" x="${pl + i * bw + bw / 2}" y="${H - 6}" text-anchor="middle">${d.d.toLocaleDateString(TR, { day: "numeric", month: "short" })}</text>`;
    });
    el.innerHTML = s + "</svg>";
  }
  function hbars(el, items, max) {
    if (!items.length) { el.innerHTML = `<div class="empty">Henüz veri yok.</div>`; return; }
    max = max || Math.max(...items.map(x => x[1]));
    el.innerHTML = items.map(([l, v]) => `<div class="hb" data-tip="${esc(l)}: ${v}"><span class="l">${esc(l)}</span><span class="t"><i style="width:${Math.max(2, 100 * v / max)}%"></i></span><span class="v">${nf(v)}</span></div>`).join("");
  }
  const countBy = (rows, fn) => { const m = new Map(); rows.forEach(r => [].concat(fn(r)).forEach(k => { if (k) m.set(k, (m.get(k) || 0) + 1); })); return [...m.entries()].sort((a, b) => b[1] - a[1]); };
  const since = (rows, days) => rows.filter(r => Date.now() - new Date(r.created_at) < days * 864e5).length;

  /* ---------- özet ---------- */
  function kpi(label, val, week) { return `<div class="kpi"><small>${label}</small><b>${nf(val)}</b><span class="${week ? "" : "zero"}">${week ? "+" + nf(week) + " son 7 gün" : "son 7 günde yok"}</span></div>`; }
  function renderOzet() {
    const yay = D.mekan.filter(m => m.yayinda).length;
    $("#kpis").innerHTML = kpi("Bekleme listesi", D.bekleme.length, since(D.bekleme, 7)) + kpi("Mekân önerisi", D.oneri.length, since(D.oneri, 7)) +
      kpi("Tasarlanan döner", D.recete.length, since(D.recete, 7)) + `<div class="kpi"><small>Haritadaki mekân</small><b>${yay}</b><span class="zero">${D.mekan.length - yay} taslak</span></div>`;
    barChart($("#ch-bekleme"), lastDays(D.bekleme), "kayıt");
    barChart($("#ch-oneri"), lastDays(D.oneri), "öneri");
    hbars($("#top-il"), countBy(D.oneri, r => r.il).slice(0, 10));
    const g = new Map();
    D.oneri.forEach(r => { const k = norm(r.mekan_adi) + "|" + r.il; const x = g.get(k) || { ad: r.mekan_adi, il: r.il, n: 0 }; x.n++; g.set(k, x); });
    hbars($("#top-mekan"), [...g.values()].sort((a, b) => b.n - a.n).slice(0, 10).map(x => [`${x.ad} · ${x.il}`, x.n]));
  }

  /* ---------- filtre select'leri ---------- */
  function ilFilter(sel, rows) {
    const ils = [...new Set(rows.map(r => r.il).filter(Boolean))].sort((a, b) => a.localeCompare(b, TR));
    const cur = sel.value; sel.innerHTML = `<option value="">Tüm iller</option>` + ils.map(i => `<option>${esc(i)}</option>`).join(""); sel.value = ils.includes(cur) ? cur : "";
  }
  const ilOpts = (v, withAbroad = true) => `<option value="">İl seç</option>` + ILLER.map(i => `<option${i === v ? " selected" : ""}>${esc(i)}</option>`).join("") + (withAbroad ? `<option${v === "Yurt dışı" ? " selected" : ""}>Yurt dışı</option>` : "");
  const ilceOpts = (il, v) => { const l = (window.ILCELER || {})[il]; return l ? `<option value="">İlçe seç</option>` + [...l].sort((a, b) => a.localeCompare(b, TR)).map(i => `<option${i === v ? " selected" : ""}>${esc(i)}</option>`).join("") : `<option value="">—</option>`; };
  function wireIlIlce(root) {
    const il = $("[name=il]", root), ilce = $("[name=ilce]", root);
    il.addEventListener("change", () => { ilce.innerHTML = ilceOpts(il.value); ilce.disabled = !(window.ILCELER || {})[il.value]; });
  }

  /* ---------- öneriler ---------- */
  let openRow = null;
  function oneriRows() {
    const q = norm($("#q-oneri").value), il = $("#f-oneri-il").value, du = $("#f-oneri-durum").value;
    const duOk = r => !du || (du === "_onayli" ? r.onayli : du === "_bekleyen" ? !r.onayli && r.durum !== "listede" && r.durum !== "gidildi" && r.durum !== "uygun_degil" : r.durum === du);
    return D.oneri.filter(r => (!il || r.il === il) && duOk(r) &&
      (!q || norm([r.mekan_adi, r.takma_ad, r.neden, r.adres, r.ilce, r.yonetici_notu].join(" ")).includes(q)));
  }
  function renderOneri() {
    ilFilter($("#f-oneri-il"), D.oneri);
    const same = new Map(); D.oneri.forEach(r => { const k = norm(r.mekan_adi) + "|" + r.il; same.set(k, (same.get(k) || 0) + 1); });
    const rows = oneriRows();
    $("#t-oneri").innerHTML = `<thead><tr><th>Tarih</th><th>Mekân</th><th>İl / ilçe</th><th>Google</th><th data-tip="Sitedeki haritada 'Önerilen' olarak görünsün mü?">Haritada</th><th>Öneren</th><th>Durum</th></tr></thead><tbody>` +
      (rows.length ? rows.map(r => { const n = same.get(norm(r.mekan_adi) + "|" + r.il);
        return `<tr class="row" data-id="${r.id}"><td class="sm">${fmtDT(r.created_at)}</td>
        <td><span class="nm">${esc(r.mekan_adi)}</span> ${n > 1 ? `<span class="badge b-dup" data-tip="Bu mekân ${n} kez önerildi">×${n}</span>` : ""}${r.neden ? `<div class="sm" style="max-width:420px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.neden)}</div>` : ""}</td>
        <td>${esc(r.il)}<div class="sm">${esc(r.ulke || r.ilce || "")}</div></td>
        <td>${gCell(r)}</td>
        <td>${onayCell(r)}</td>
        <td>${esc(r.takma_ad || "—")} ${r.yayin_izni ? `<span class="badge b-ok" data-tip="Takma adın videoda gösterilmesine izin verdi">izinli</span>` : ""}</td>
        <td><select class="inl b-${r.durum}" data-durum="${r.id}">${Object.entries(DURUM).map(([k, v]) => `<option value="${k}"${k === r.durum ? " selected" : ""}>${v}</option>`).join("")}</select></td></tr>
        ${openRow === r.id ? detRow(r) : ""}`; }).join("") : `<tr><td colspan="7" class="empty">Kayıt bulunamadı.</td></tr>`) + "</tbody>";
  }
  const mapsAra = r => "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent([r.google_ad || r.mekan_adi || r.ad, r.ilce, r.il === "Yurt dışı" ? r.ulke : r.il].filter(Boolean).join(" "));
  function gCell(r) {
    if (r.google_puan == null && r.google_yorum == null) return `<a class="icon-btn" href="${esc(r.google_url || mapsAra(r))}" target="_blank" rel="noopener" data-tip="Google Maps'te aç; puanı görüp 'Konum ve Google' ile kaydedebilirsin">Maps'te ara ↗</a>`;
    return `<a class="gstar" href="${esc(r.google_url || mapsAra(r))}" target="_blank" rel="noopener" data-tip="${r.google_tarih ? "Kaydedildi: " + fmtD(r.google_tarih) : "Google Maps'te aç"}">★ ${r.google_puan != null ? Number(r.google_puan).toFixed(1) : "–"}<small>${r.google_yorum != null ? nf(r.google_yorum) + " yorum" : ""}</small></a>`;
  }
  function onayCell(r) {
    if (r.durum === "listede" || r.durum === "gidildi") return `<span class="badge b-listede" data-tip="Rotadaki mekânlar haritada 'Rotamızda' olarak görünür">Rota</span>`;
    return `<label class="sw" data-tip="${r.onayli ? "Haritada görünüyor" : "Onayla: haritada 'Önerilen' olarak göster"}"><input type="checkbox" data-onay="${r.id}"${r.onayli ? " checked" : ""}${r.durum === "uygun_degil" ? " disabled" : ""}><i></i></label>${r.lat == null ? `<div class="sm" style="margin-top:4px">konum yok</div>` : ""}`;
  }
  function gBox(r) {
    return `<h4>Google ve konum</h4><p>${r.google_puan != null || r.google_yorum != null ? `★ <b>${r.google_puan != null ? Number(r.google_puan).toFixed(1) : "–"}</b> · ${r.google_yorum != null ? nf(r.google_yorum) : "–"} yorum<br>` : `<span class="sm">Google puanı girilmedi.</span><br>`}
      <span class="sm">${r.lat != null ? "Konum seçildi" : "Konum seçilmedi"}${r.google_tarih ? " · " + fmtD(r.google_tarih) : ""}</span></p>
      <div class="det-acts" style="margin:-4px 0 14px"><a class="btn btn-line btn-sm" href="${esc(r.google_url || mapsAra(r))}" target="_blank" rel="noopener">Google Maps'te ara ↗</a><button class="btn btn-line btn-sm" data-gfind="${r.id}">Konum ve Google bilgisi</button></div>`;
  }
  function detRow(r) {
    const link = /^https?:\/\//i.test(r.adres || "") ? `<a href="${esc(r.adres)}" target="_blank" rel="noopener">${esc(r.adres)}</a>` : esc(r.adres || "—");
    return `<tr class="det"><td colspan="7"><div class="det-grid"><div>
      <h4>Neden gitmeliyiz?</h4><p>${esc(r.neden || "—")}</p>
      <h4>Adres / harita</h4><p>${link}</p>
      <h4>Öneren</h4><p>${esc(r.takma_ad || "—")} · ${r.yayin_izni ? "videoda gösterilebilir" : "videoda gösterilmemeli"}</p>
      ${gBox(r)}</div>
      <div><h4>Senin notun</h4><textarea rows="4" data-not="${r.id}" placeholder="Örn: Mart rotasına ekle, ustanın adı Mehmet usta…">${esc(r.yonetici_notu || "")}</textarea>
      <div class="det-acts"><button class="btn btn-sm" data-save-not="${r.id}">Notu kaydet</button><button class="btn btn-y btn-sm" data-rota="${r.id}">${r.durum === "listede" ? "Rota puanını düzenle" : "Rotaya ekle"}</button><button class="btn btn-o btn-sm" data-to-map="${r.id}">Gidildi: puanla</button><button class="icon-btn danger" data-del-oneri="${r.id}">Sil</button></div></div></div></td></tr>`;
  }
  ["#q-oneri", "#f-oneri-il", "#f-oneri-durum"].forEach(s => $(s).addEventListener("input", renderOneri));
  $("#t-oneri").addEventListener("click", async e => {
    if (e.target.closest("label.sw")) return;
    if (e.target.closest("select,textarea,button,a")) {
      const b = e.target.closest("button"); if (!b) return;
      if (b.dataset.saveNot) {
        const id = +b.dataset.saveNot, v = $(`[data-not="${id}"]`).value.trim() || null;
        const { error } = await db.from("mekan_onerileri").update({ yonetici_notu: v }).eq("id", id);
        if (error) return toast("Kaydedilemedi: " + error.message); D.oneri.find(x => x.id === id).yonetici_notu = v; toast("Not kaydedildi");
      }
      if (b.dataset.toMap) toMap(D.oneri.find(x => x.id === +b.dataset.toMap));
      if (b.dataset.rota) rotaForm(D.oneri.find(x => x.id === +b.dataset.rota));
      if (b.dataset.gfind) googleFind(D.oneri.find(x => x.id === +b.dataset.gfind));
      if (b.dataset.delOneri) {
        const id = +b.dataset.delOneri; if (!(await confirmBox("Bu öneri kalıcı olarak silinecek. Bu işlem geri alınamaz."))) return;
        const { error } = await db.from("mekan_onerileri").delete().eq("id", id);
        if (error) return toast("Silinemedi: " + error.message); D.oneri = D.oneri.filter(x => x.id !== id); openRow = null; renderAll(); toast("Silindi");
      }
      return;
    }
    const tr = e.target.closest("tr.row"); if (!tr) return;
    openRow = openRow === +tr.dataset.id ? null : +tr.dataset.id; renderOneri();
  });
  $("#t-oneri").addEventListener("change", async e => {
    const c = e.target.closest("[data-onay]");
    if (c) {
      const r = D.oneri.find(x => x.id === +c.dataset.onay);
      if (c.checked && r.lat == null) { c.checked = false; return konumForm(r, true); }
      const { error } = await db.from("mekan_onerileri").update({ onayli: c.checked }).eq("id", r.id);
      if (error) { c.checked = !c.checked; return toast("Güncellenemedi: " + error.message); }
      r.onayli = c.checked; toast(c.checked ? "Onaylandı: sitedeki haritada görünüyor" : "Haritadan kaldırıldı"); return renderOneri();
    }
    const s = e.target.closest("[data-durum]"); if (!s) return;
    const id = +s.dataset.durum, v = s.value;
    if (v === "listede") { const r = D.oneri.find(x => x.id === id); s.value = r.durum; return rotaForm(r); }
    const { error } = await db.from("mekan_onerileri").update({ durum: v }).eq("id", id);
    if (error) { toast("Güncellenemedi: " + error.message); return renderOneri(); }
    D.oneri.find(x => x.id === id).durum = v; s.className = "inl b-" + v; toast("Durum: " + DURUM[v]); renderAll();
  });
  function toMap(r) {
    const url = /^https?:/i.test(r.adres || "") ? r.adres : "";
    mekanForm({ ad: r.google_ad || r.mekan_adi, il: r.il === "Yurt dışı" ? "" : r.il, ilce: r.ilce, adres: url ? "" : (r.adres || ""), maps_url: r.google_url || url, lat: r.lat, lng: r.lng, oneri_id: r.id });
  }

  /* ---------- ücretsiz konum arama (Photon / OpenStreetMap) + elle Google bilgisi ---------- */
  const OSM_TUR = { fast_food: "Fast food", restaurant: "Restoran", cafe: "Kafe", food_court: "Yemek alanı", bakery: "Fırın" };
  async function photon(q) {
    const res = await fetch("https://photon.komoot.io/api/?limit=7&q=" + encodeURIComponent(q));
    if (!res.ok) throw new Error("HTTP " + res.status);
    const d = await res.json();
    return (d.features || []).map(f => { const p = f.properties || {};
      return { ad: p.name || [p.street, p.housenumber].filter(Boolean).join(" "), tur: p.osm_value, lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0],
        alt: [[p.street, p.housenumber].filter(Boolean).join(" "), p.district || p.locality, p.city || p.county, p.state, p.country && p.country !== "Türkiye" ? p.country : ""].filter(Boolean).join(", ") }; });
  }
  const kpHtml = q => `<div class="kp-search"><input type="search" data-kp-q value="${esc(q)}" placeholder="Mekân adı, ilçe, il"><button type="button" class="btn btn-line btn-sm" data-kp-go>Haritada ara</button></div><div class="kp-res" data-kp-res></div>`;
  function kpWire(root, onPick, auto) {
    const inp = $("[data-kp-q]", root), box = $("[data-kp-res]", root);
    const go = async () => {
      const q = inp.value.trim(); if (q.length < 2) return;
      box.innerHTML = `<div class="kp-msg">Aranıyor…</div>`;
      try {
        const list = await photon(q);
        box.innerHTML = list.length ? list.map((p, i) => `<button type="button" class="kp-item" data-i="${i}"><b>${esc(p.ad || "(adsız)")}${OSM_TUR[p.tur] ? ` <em>${OSM_TUR[p.tur]}</em>` : ""}</b><small>${esc(p.alt)}</small></button>`).join("")
          : `<div class="kp-msg">Bulunamadı. Aramayı kısalt (ör. sadece mekân adı + ilçe), haritada elle işaretle ya da Google Maps linkini yapıştır.</div>`;
        box.onclick = e => { const b = e.target.closest("[data-i]"); if (!b) return; $$(".kp-item", box).forEach(x => x.classList.toggle("on", x === b)); const p = list[+b.dataset.i]; onPick(p.lat, p.lng); };
      } catch (err) { box.innerHTML = `<div class="kp-msg">Arama şu an çalışmadı. Haritaya tıklayarak işaretleyebilirsin.</div>`; }
    };
    $("[data-kp-go]", root).addEventListener("click", go);
    inp.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); go(); } });
    if (auto) go();
  }
  function miniMap(el, lat, lng, color, f) {
    if (!window.maplibregl) return () => {};
    const has = lat != null && lng != null;
    const mp = new maplibregl.Map({ container: el, style: "https://tiles.openfreemap.org/styles/liberty", center: has ? [lng, lat] : [35.2, 39], zoom: has ? 15.5 : 4.6, attributionControl: { compact: true } });
    mp.addControl(new maplibregl.NavigationControl({ showCompass: false }));
    let mk = null;
    const set = (la, ln, fly) => {
      f.lat.value = (+la).toFixed(6); f.lng.value = (+ln).toFixed(6);
      if (!mk) mk = new maplibregl.Marker({ color, draggable: true }).setLngLat([ln, la]).addTo(mp).on("dragend", () => { const p = mk.getLngLat(); f.lat.value = p.lat.toFixed(6); f.lng.value = p.lng.toFixed(6); });
      else mk.setLngLat([ln, la]);
      if (fly) mp.flyTo({ center: [ln, la], zoom: 16.5 });
    };
    mp.on("click", e => set(e.lngLat.lat, e.lngLat.lng));
    if (has) set(lat, lng);
    return set;
  }
  const gFields = r => `<label class="field"><span>Google Maps linki <small>uzun linkten konum otomatik okunur</small></span><input name="gurl" type="url" value="${esc(r.google_url || "")}" placeholder="https://www.google.com/maps/place/…"></label>
    <div class="row2"><label class="field"><span>Google puanı <small>(isteğe bağlı)</small></span><input name="gp" type="number" min="1" max="5" step="0.1" inputmode="decimal" value="${r.google_puan ?? ""}" placeholder="4.6"></label>
      <label class="field"><span>Yorum sayısı</span><input name="gy" type="number" min="0" step="1" inputmode="numeric" value="${r.google_yorum ?? ""}" placeholder="1250"></label></div>`;
  function gWire(f, set) {
    f.gurl.addEventListener("input", () => { const p = parseMaps(f.gurl.value); if (p) set(p[0], p[1], true); else if (/goo\.gl|maps\.app/.test(f.gurl.value)) toast("Kısa linkten konum okunamıyor; haritada ara ya da elle işaretle. Link yine de kaydedilir."); });
  }
  function gVals(f, r) {
    const gp = parseFloat(f.gp.value), gy = parseInt(f.gy.value, 10);
    const o = { google_url: f.gurl.value.trim() || null, google_puan: isNaN(gp) ? null : Math.min(5, Math.max(0, Math.round(gp * 10) / 10)), google_yorum: isNaN(gy) ? null : Math.max(0, gy) };
    if (o.google_puan !== (r.google_puan == null ? null : +r.google_puan) || o.google_yorum !== (r.google_yorum == null ? null : +r.google_yorum)) o.google_tarih = new Date().toISOString();
    return o;
  }
  const qOf = r => [r.google_ad || r.mekan_adi, r.ilce, r.il === "Yurt dışı" ? r.ulke : r.il].filter(Boolean).join(" ");
  function konumForm(r, onayla) {
    const rotada = r.durum === "listede" || r.durum === "gidildi";
    openModal("Konum ve Google bilgisi", `<form id="kf" novalidate>
      <p style="margin-bottom:6px"><b>${esc(r.google_ad || r.mekan_adi)}</b> <span class="sm">${esc([r.ilce, r.il === "Yurt dışı" ? r.ulke : r.il].filter(Boolean).join(" · "))}</span></p>
      <p class="sm" style="margin-bottom:16px">Önce <a href="${esc(mapsAra(r))}" target="_blank" rel="noopener" style="color:var(--cobalt);font-weight:600">Google Maps'te ara ↗</a> ve gerçekten bir dönerci mi bak. Konumu aşağıdan bul ya da haritaya tıkla.</p>
      <div class="field"><span>Konum <small>arama OpenStreetMap ile ücretsiz; pini sürükleyebilirsin</small></span>${kpHtml(qOf(r))}
        <div class="mini-map" id="k-map"></div><input type="hidden" name="lat" value="${r.lat ?? ""}"><input type="hidden" name="lng" value="${r.lng ?? ""}"></div>
      ${gFields(r)}
      ${rotada ? "" : `<label class="check"><input type="checkbox" name="onayli"${r.onayli || onayla ? " checked" : ""}><span><b>Onayla:</b> sitedeki haritada “Önerilen” olarak göster <small>(sadece mekân adı, ilçe ve öneri sayısı görünür)</small></span></label>`}
      <div class="m-foot"><button type="button" class="btn btn-line btn-sm" data-close>Vazgeç</button><button class="btn btn-sm">Kaydet</button></div></form>`);
    const f = $("#kf"); const set = miniMap("k-map", r.lat, r.lng, "#FF6A00", f);
    kpWire(f, (la, ln) => set(la, ln, true), r.lat == null); gWire(f, set);
    f.addEventListener("submit", async e => {
      e.preventDefault();
      const lat = parseFloat(f.lat.value), lng = parseFloat(f.lng.value);
      const upd = { lat: isNaN(lat) ? null : lat, lng: isNaN(lng) ? null : lng, ...gVals(f, r) };
      if (f.onayli) upd.onayli = f.onayli.checked;
      if (upd.onayli && upd.lat == null) return toast("Haritada göstermek için konum seçmelisin.");
      const { error } = await db.from("mekan_onerileri").update(upd).eq("id", r.id);
      if (error) return toast("Kaydedilemedi: " + error.message);
      Object.assign(r, upd); closeModal(); renderAll(); toast(upd.onayli ? "Kaydedildi, sitedeki haritada görünüyor" : "Kaydedildi");
    });
  }
  const googleFind = r => konumForm(r);

  /* ---------- rota ---------- */
  const BOLGE = { "Marmara": "İstanbul Edirne Kırklareli Tekirdağ Çanakkale Kocaeli Yalova Sakarya Bilecik Bursa Balıkesir", "Ege": "İzmir Manisa Aydın Denizli Muğla Afyonkarahisar Kütahya Uşak",
    "Akdeniz": "Antalya Isparta Burdur Mersin Adana Hatay Osmaniye Kahramanmaraş", "İç Anadolu": "Ankara Konya Kayseri Eskişehir Sivas Kırıkkale Aksaray Karaman Kırşehir Niğde Nevşehir Yozgat Çankırı",
    "Karadeniz": "Rize Trabzon Artvin Giresun Ordu Samsun Sinop Kastamonu Bartın Zonguldak Karabük Düzce Bolu Amasya Tokat Çorum Gümüşhane Bayburt",
    "Doğu Anadolu": "Erzurum Erzincan Kars Ağrı Iğdır Ardahan Malatya Elazığ Tunceli Bingöl Muş Bitlis Van Hakkâri", "Güneydoğu Anadolu": "Gaziantep Adıyaman Kilis Şanlıurfa Diyarbakır Mardin Batman Siirt Şırnak" };
  const IL_BOLGE = {}; Object.entries(BOLGE).forEach(([b, l]) => l.split(" ").forEach(i => IL_BOLGE[i] = b));
  const bolgeOf = r => r.il === "Yurt dışı" ? "Yurt dışı" : (IL_BOLGE[r.il] || "Diğer");
  const yerOf = r => r.il === "Yurt dışı" ? (r.ulke || "Yurt dışı") : r.il;
  function renderRota() {
    const same = new Map(); D.oneri.forEach(r => { const k = norm(r.mekan_adi) + "|" + yerOf(r); same.set(k, (same.get(k) || 0) + 1); });
    const sel = $("#f-rota-bolge"), cur = sel.value, sirala = $("#f-rota-sira").value;
    const rows = D.oneri.filter(r => r.durum === "listede");
    const bolgeler = [...Object.keys(BOLGE), "Yurt dışı", "Diğer"].filter(b => rows.some(r => bolgeOf(r) === b));
    sel.innerHTML = `<option value="">Tüm bölgeler</option>` + bolgeler.map(b => `<option${b === cur ? " selected" : ""}>${esc(b)}</option>`).join("");
    const key = r => sirala === "google" ? (r.google_puan ?? -1) : sirala === "yorum" ? (r.google_yorum ?? -1) : sirala === "oneri" ? same.get(norm(r.mekan_adi) + "|" + yerOf(r)) : (r.rota_puani ?? -1);
    const box = $("#rota-list");
    if (!rows.length) { box.innerHTML = `<div class="box empty">Rotada henüz mekân yok. Öneriler sekmesinde bir öneriyi açıp <b>Rotaya ekle</b> de.</div>`; return; }
    box.innerHTML = bolgeler.filter(b => !sel.value || b === sel.value).map(b => {
      const inB = rows.filter(r => bolgeOf(r) === b);
      const iller = [...new Set(inB.map(yerOf))].sort((x, y) => Math.max(...inB.filter(r => yerOf(r) === y).map(key)) - Math.max(...inB.filter(r => yerOf(r) === x).map(key)) || x.localeCompare(y, TR));
      return `<section class="rbolge"><h3>${esc(b)} <small>${inB.length} mekân</small></h3>` + iller.map(il => {
        const list = inB.filter(r => yerOf(r) === il).sort((x, y) => key(y) - key(x));
        return `<div class="ril"><h4>${esc(il)} <small>${list.length}</small></h4>` + list.map((r, i) => `<div class="rrow">
          <span class="rk">${i + 1}</span>
          <span class="rp" data-tip="Senin rota puanın">${r.rota_puani != null ? Number(r.rota_puani).toFixed(1) : "–"}</span>
          <div class="rn"><b>${esc(r.google_ad || r.mekan_adi)}</b><div class="sm">${esc([r.ilce, r.ulke].filter(Boolean).join(" · "))}${same.get(norm(r.mekan_adi) + "|" + yerOf(r)) > 1 ? ` · <span class="badge b-dup">×${same.get(norm(r.mekan_adi) + "|" + yerOf(r))} öneri</span>` : ""}${r.yonetici_notu ? ` · ${esc(r.yonetici_notu)}` : ""}</div></div>
          <div class="rg">${gCell(r)}</div>
          <label class="sw" data-tip="Sitedeki haritada 'Rotamızda' olarak göster"><input type="checkbox" data-hg="${r.id}"${r.haritada_goster ? " checked" : ""}${r.lat == null ? " disabled" : ""}><i></i></label>
          <div class="ra"><button class="icon-btn" data-rota="${r.id}">Düzenle</button><button class="icon-btn" data-tomap2="${r.id}">Gidildi</button><button class="icon-btn danger" data-cikar="${r.id}">Çıkar</button></div>
        </div>`).join("") + `</div>`;
      }).join("") + `</section>`;
    }).join("");
  }
  ["#f-rota-bolge", "#f-rota-sira"].forEach(x => $(x).addEventListener("input", renderRota));
  $("#rota-list").addEventListener("click", async e => {
    const b = e.target.closest("button"); if (!b) return;
    const r = D.oneri.find(x => x.id === +(b.dataset.rota || b.dataset.tomap2 || b.dataset.cikar || b.dataset.gfind));
    if (b.dataset.rota) rotaForm(r);
    if (b.dataset.gfind) googleFind(r);
    if (b.dataset.tomap2) toMap(r);
    if (b.dataset.cikar) {
      if (!(await confirmBox("Bu mekân rotadan çıkarılacak (öneri silinmez, durumu 'İncelendi' olur).", "Rotadan çıkar"))) return;
      const { error } = await db.from("mekan_onerileri").update({ durum: "incelendi" }).eq("id", r.id);
      if (error) return toast("Güncellenemedi: " + error.message); r.durum = "incelendi"; renderAll(); toast("Rotadan çıkarıldı");
    }
  });
  $("#rota-list").addEventListener("change", async e => {
    const c = e.target.closest("[data-hg]"); if (!c) return; const r = D.oneri.find(x => x.id === +c.dataset.hg);
    const { error } = await db.from("mekan_onerileri").update({ haritada_goster: c.checked }).eq("id", r.id);
    if (error) { c.checked = !c.checked; return toast("Güncellenemedi: " + error.message); }
    r.haritada_goster = c.checked; toast(c.checked ? "Sitedeki haritada görünüyor" : "Sitedeki haritadan gizlendi");
  });
  function rotaForm(r) {
    openModal(r.durum === "listede" ? "Rota puanını düzenle" : "Rotaya ekle", `<form id="rf" novalidate>
      <p style="margin-bottom:14px"><b>${esc(r.google_ad || r.mekan_adi)}</b> <span class="sm">${esc([r.ilce, r.il === "Yurt dışı" ? r.ulke : r.il].filter(Boolean).join(" · "))}</span>
      <br><a class="sm" href="${esc(r.google_url || mapsAra(r))}" target="_blank" rel="noopener" style="color:var(--cobalt);font-weight:600">Google Maps'te aç ↗</a></p>
      <label class="field"><span>Rota puanın (0–10) <small>Rotadaki sıralama buna göre yapılır</small></span>
        <div class="rp-row"><input type="range" name="rp" min="0" max="10" step="0.5" value="${r.rota_puani ?? 7}"><output>${Number(r.rota_puani ?? 7).toFixed(1)}</output></div></label>
      <div class="field"><span>Konum <small>ara, haritaya tıkla ya da Maps linkini yapıştır; pini sürükleyebilirsin</small></span>${kpHtml(qOf(r))}
        <div class="mini-map" id="rota-map"></div>
        <input type="hidden" name="lat" value="${r.lat ?? ""}"><input type="hidden" name="lng" value="${r.lng ?? ""}"></div>
      ${gFields(r)}
      <label class="check"><input type="checkbox" name="hg"${r.haritada_goster !== false ? " checked" : ""}><span>Sitedeki haritada <b>“Rotamızda”</b> olarak göster <small>(sadece mekân adı ve konumu görünür)</small></span></label>
      <label class="field"><span>Not <small>(sadece panelde)</small></span><textarea name="not" rows="2">${esc(r.yonetici_notu || "")}</textarea></label>
      <div class="m-foot"><button type="button" class="btn btn-line btn-sm" data-close>Vazgeç</button><button class="btn btn-y btn-sm">Rotaya kaydet</button></div></form>`);
    const f = $("#rf"); const out = $("output", f);
    f.rp.addEventListener("input", () => out.textContent = Number(f.rp.value).toFixed(1));
    const set = miniMap("rota-map", r.lat, r.lng, "#FFD500", f);
    kpWire(f, (la, ln) => set(la, ln, true), r.lat == null); gWire(f, set);
    f.addEventListener("submit", async e => {
      e.preventDefault();
      const lat = parseFloat(f.lat.value), lng = parseFloat(f.lng.value);
      const upd = { durum: "listede", rota_puani: Number(f.rp.value), haritada_goster: f.hg.checked, yonetici_notu: f.not.value.trim() || null,
        lat: isNaN(lat) ? null : lat, lng: isNaN(lng) ? null : lng, ...gVals(f, r) };
      const { error } = await db.from("mekan_onerileri").update(upd).eq("id", r.id);
      if (error) return toast("Kaydedilemedi: " + error.message);
      Object.assign(r, upd); closeModal(); renderAll();
      toast(upd.lat == null && upd.haritada_goster ? "Rotaya eklendi. Sitede görünmesi için konum seçmelisin." : "Rotaya eklendi");
    });
  }
  $("#add-oneri").addEventListener("click", () => {
    openModal("Öneri ekle", `<form id="mf" novalidate>
      <label class="field"><span>Mekân / usta adı</span><input name="mekan_adi" required maxlength="120"></label>
      <div class="row2"><label class="field"><span>İl</span><select name="il" required>${ilOpts("")}</select></label><label class="field"><span>İlçe</span><select name="ilce" disabled><option value="">—</option></select></label></div>
      <label class="field"><span>Adres veya Maps linki</span><input name="adres" maxlength="400"></label>
      <label class="field"><span>Neden?</span><textarea name="neden" rows="3" maxlength="1000"></textarea></label>
      <label class="field"><span>Öneren (takma ad / kaynak)</span><input name="takma_ad" maxlength="60" placeholder="Örn: Instagram DM · @kullanici"></label>
      <div class="m-foot"><button type="button" class="btn btn-line btn-sm" data-close>Vazgeç</button><button class="btn btn-sm">Kaydet</button></div></form>`);
    const f = $("#mf"); wireIlIlce(f);
    f.addEventListener("submit", async e => {
      e.preventDefault(); const v = n => (f[n].value || "").trim();
      if (!v("mekan_adi") || !v("il")) return toast("Mekân adı ve il gerekli.");
      const row = { mekan_adi: v("mekan_adi"), il: v("il"), ilce: v("ilce") || null, adres: v("adres") || null, neden: v("neden") || null, takma_ad: v("takma_ad") || null, kvkk_onay: true, durum: "yeni" };
      const { data, error } = await db.from("mekan_onerileri").insert(row).select().single();
      if (error) return toast("Kaydedilemedi: " + error.message);
      D.oneri.unshift(data); closeModal(); renderAll(); toast("Öneri eklendi");
    });
  });

  /* ---------- bekleme ---------- */
  function bekRows() {
    const q = norm($("#q-bekleme").value), il = $("#f-bekleme-il").value;
    return D.bekleme.filter(r => (!il || r.il === il) && (!q || norm([r.eposta, r.telefon, r.iletisim, r.ilce].join(" ")).includes(q)));
  }
  function renderBekleme() {
    ilFilter($("#f-bekleme-il"), D.bekleme);
    const rows = bekRows();
    $("#t-bekleme").innerHTML = `<thead><tr><th>Tarih</th><th>E-posta</th><th>Telefon</th><th>İl / ilçe</th><th>İleti onayı</th><th></th></tr></thead><tbody>` +
      (rows.length ? rows.map(r => `<tr><td class="sm">${fmtDT(r.created_at)}</td>
        <td>${esc(r.eposta || (r.iletisim && r.iletisim.includes("@") ? r.iletisim : "—"))}</td>
        <td>${esc(r.telefon || (r.iletisim && !r.iletisim.includes("@") ? r.iletisim : "—"))}</td>
        <td>${esc(r.il || "—")}<div class="sm">${esc(r.ulke || r.ilce || "")}</div></td>
        <td>${r.ileti_onay ? `<span class="badge b-ok" data-tip="${esc(r.onay_metni || "")}">Var</span>` : `<span class="badge b-no">Yok</span>`}</td>
        <td class="num"><button class="icon-btn danger" data-del-bek="${r.id}">Sil</button></td></tr>`).join("") : `<tr><td colspan="6" class="empty">Kayıt bulunamadı.</td></tr>`) + "</tbody>";
  }
  ["#q-bekleme", "#f-bekleme-il"].forEach(s => $(s).addEventListener("input", renderBekleme));
  $("#t-bekleme").addEventListener("click", async e => {
    const b = e.target.closest("[data-del-bek]"); if (!b) return;
    const id = +b.dataset.delBek; if (!(await confirmBox("Bu kişi bekleme listesinden kalıcı olarak silinecek. Silme talebi (KVKK) için bu doğru yol."))) return;
    const { error } = await db.from("bekleme_listesi").delete().eq("id", id);
    if (error) return toast("Silinemedi: " + error.message); D.bekleme = D.bekleme.filter(x => x.id !== id); renderAll(); toast("Silindi");
  });
  $("#add-bekleme").addEventListener("click", () => {
    openModal("Bekleme listesine ekle", `<form id="mf" novalidate>
      <label class="field"><span>E-posta</span><input name="eposta" type="email" maxlength="120"></label>
      <label class="field"><span>Telefon</span><input name="telefon" type="tel" maxlength="20" placeholder="+905XXXXXXXXX"></label>
      <div class="row2"><label class="field"><span>İl</span><select name="il">${ilOpts("")}</select></label><label class="field"><span>İlçe</span><select name="ilce" disabled><option value="">—</option></select></label></div>
      <label class="check"><input type="checkbox" name="ileti_onay"><span>Bu kişinin e-posta/SMS onayı var (yazılı ya da kayıtlı olarak aldım).</span></label>
      <div class="m-foot"><button type="button" class="btn btn-line btn-sm" data-close>Vazgeç</button><button class="btn btn-sm">Kaydet</button></div></form>`);
    const f = $("#mf"); wireIlIlce(f);
    f.addEventListener("submit", async e => {
      e.preventDefault();
      const mail = f.eposta.value.trim().toLowerCase() || null; let tel = f.telefon.value.replace(/[^\d+]/g, "") || null;
      if (tel && /^0?5\d{9}$/.test(tel)) tel = "+90" + tel.slice(-10);
      if (!mail && !tel) return toast("E-posta ya da telefon gerekli.");
      const row = { eposta: mail, telefon: tel, il: f.il.value || null, ilce: f.ilce.value || null, kvkk_onay: true, ileti_onay: f.ileti_onay.checked,
        onay_metni: f.ileti_onay.checked ? "Panelden elle eklendi · onay yönetici beyanı" : null };
      const { data, error } = await db.from("bekleme_listesi").insert(row).select().single();
      if (error) return toast(error.code === "23505" ? "Bu e-posta ya da telefon zaten listede." : "Kaydedilemedi: " + error.message);
      D.bekleme.unshift(data); closeModal(); renderAll(); toast("Eklendi");
    });
  });

  /* ---------- mekânlar ---------- */
  const KRITER = [["lezzet", "Lezzet"], ["tavuk", "Tavuk"], ["ekmek", "Ekmek"], ["hijyen", "Hijyen"], ["fiyat", "Fiyat/perf."], ["hizmet", "Hizmet"]];
  function renderMekan() {
    const rows = D.mekan;
    $("#t-mekan").innerHTML = `<thead><tr><th>Puan</th><th>Mekân</th><th>İl / ilçe</th><th>Bölüm</th><th>Yayında</th><th></th></tr></thead><tbody>` +
      (rows.length ? rows.map(m => `<tr><td><span class="score-b">${Number(m.puan).toFixed(1)}</span></td>
        <td><span class="nm">${esc(m.ad)}</span><div class="sm">${esc(m.puan_notu || "")}</div></td>
        <td>${esc(m.il)}<div class="sm">${esc(m.ilce || "")}</div></td>
        <td>${m.bolum_url ? `<a href="${esc(m.bolum_url)}" target="_blank" rel="noopener" style="color:var(--cobalt);font-weight:600">İzle ↗</a>` : `<span class="sm">—</span>`}</td>
        <td><label class="sw"><input type="checkbox" data-yayin="${m.id}"${m.yayinda ? " checked" : ""}><i></i></label></td>
        <td class="num" style="white-space:nowrap">${m.yayinda ? `<a class="icon-btn" href="mekan.html?id=${m.id}" target="_blank" rel="noopener">Sayfa ↗</a>` : ""}<button class="icon-btn" data-edit="${m.id}">Düzenle</button><button class="icon-btn danger" data-del-mek="${m.id}">Sil</button></td></tr>`).join("")
        : `<tr><td colspan="6" class="empty">Henüz mekân yok. İlk bölümü çektiğinde “Yeni mekân” ile ekle.</td></tr>`) + "</tbody>";
  }
  $("#t-mekan").addEventListener("change", async e => {
    const c = e.target.closest("[data-yayin]"); if (!c) return;
    const id = +c.dataset.yayin;
    const { error } = await db.from("mekanlar").update({ yayinda: c.checked }).eq("id", id);
    if (error) { c.checked = !c.checked; return toast("Güncellenemedi: " + error.message); }
    D.mekan.find(x => x.id === id).yayinda = c.checked; renderOzet(); toast(c.checked ? "Haritada yayında" : "Haritadan kaldırıldı");
  });
  $("#t-mekan").addEventListener("click", async e => {
    const ed = e.target.closest("[data-edit]"); if (ed) return mekanForm(D.mekan.find(x => x.id === +ed.dataset.edit));
    const dl = e.target.closest("[data-del-mek]"); if (!dl) return;
    const id = +dl.dataset.delMek; if (!(await confirmBox("Bu mekân haritadan ve listeden kalıcı olarak silinecek."))) return;
    const { error } = await db.from("mekanlar").delete().eq("id", id);
    if (error) return toast("Silinemedi: " + error.message); D.mekan = D.mekan.filter(x => x.id !== id); renderAll(); toast("Silindi");
  });
  $("#add-mekan").addEventListener("click", () => mekanForm({}));
  function parseMaps(u) {
    const s = decodeURIComponent(String(u || ""));
    let m = s.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) || s.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) || s.match(/[?&](?:q|query|ll|destination)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/) || s.match(/^\s*(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)\s*$/);
    return m ? [parseFloat(m[1]), parseFloat(m[2])] : null;
  }
  function mekanForm(m) {
    const isNew = !m.id;
    openModal(isNew ? "Yeni mekân" : "Mekânı düzenle", `<form id="mf" novalidate>
      <label class="field"><span>Mekân adı</span><input name="ad" required maxlength="120" value="${esc(m.ad || "")}"></label>
      <div class="row2"><label class="field"><span>İl</span><select name="il" required>${ilOpts(m.il || "", true)}</select></label>
        <label class="field"><span>İlçe</span><select name="ilce"${(window.ILCELER || {})[m.il] ? "" : " disabled"}>${ilceOpts(m.il, m.ilce)}</select></label></div>
      <label class="field"><span>Adres <small>(sitede görünür)</small></span><input name="adres" maxlength="200" value="${esc(m.adres || "")}"></label>
      <div class="row3">
        <label class="field"><span>Genel puan (0–10)</span><input name="puan" type="number" min="0" max="10" step="0.1" value="${m.puan ?? ""}"></label>
        <label class="field" style="grid-column:span 2"><span>Etiketler <small>(virgülle)</small></span><input name="etiketler" value="${esc((m.etiketler || []).join(", "))}" placeholder="Lavaş, Sulu tavuk, Uygun fiyat"></label>
      </div>
      <div class="field"><span>Altı kriter <small>(0–10; puanı boş bırakırsan ortalaması alınır)</small></span>
        <div class="row3 krit">${KRITER.map(([k, ad]) => `<label><small>${ad}</small><input name="k_${k}" type="number" min="0" max="10" step="0.1" inputmode="decimal" value="${(m.kriterler || {})[k] ?? ""}"></label>`).join("")}</div></div>
      <label class="field"><span>Puan notu <small>(haritada ve sayfanın başında tırnak içinde)</small></span><textarea name="puan_notu" rows="2" maxlength="300">${esc(m.puan_notu || "")}</textarea></label>
      <label class="field"><span>Detay sayfası yazısı <small>(paragrafları boş satırla ayır)</small></span><textarea name="aciklama" rows="7" maxlength="6000" placeholder="Ustanın hikâyesi, döneri nasıl hazırladığı, neyi sevdik, neyi sevmedik…">${esc(m.aciklama || "")}</textarea></label>
      <div class="row2">
        <label class="field"><span>Bölüm linki (YouTube)</span><input name="bolum_url" type="url" value="${esc(m.bolum_url || "")}"></label>
        <label class="field"><span>Google Maps linki</span><input name="maps_url" type="url" value="${esc(m.maps_url || "")}"></label>
      </div>
      <div class="field"><span>Konum <small>(ara, haritaya tıkla ya da Maps linkini yapıştır)</small></span>${kpHtml([m.ad, m.ilce, m.il].filter(Boolean).join(" "))}
        <div class="mini-map" id="mini-map"></div>
        <div class="row2"><input name="lat" inputmode="decimal" placeholder="Enlem" value="${m.lat ?? ""}"><input name="lng" inputmode="decimal" placeholder="Boylam" value="${m.lng ?? ""}"></div></div>
      <label class="check"><input type="checkbox" name="yayinda"${m.yayinda ? " checked" : ""}><span><b>Haritada yayınla</b> · işaretlemezsen taslak olarak kaydedilir.</span></label>
      <div class="m-foot"><button type="button" class="btn btn-line btn-sm" data-close>Vazgeç</button><button class="btn btn-o btn-sm">${isNew ? "Mekânı kaydet" : "Değişiklikleri kaydet"}</button></div></form>`);
    const f = $("#mf"); wireIlIlce(f);
    let mk = null, mp = null;
    const setPt = (lat, lng, fly) => {
      f.lat.value = lat.toFixed(6); f.lng.value = lng.toFixed(6);
      if (!mp) return; if (!mk) mk = new maplibregl.Marker({ color: "#FF6A00", draggable: true }).setLngLat([lng, lat]).addTo(mp).on("dragend", () => { const p = mk.getLngLat(); f.lat.value = p.lat.toFixed(6); f.lng.value = p.lng.toFixed(6); });
      else mk.setLngLat([lng, lat]); if (fly) mp.flyTo({ center: [lng, lat], zoom: 15 });
    };
    if (window.maplibregl) {
      const has = m.lat && m.lng;
      mp = new maplibregl.Map({ container: "mini-map", style: "https://tiles.openfreemap.org/styles/liberty", center: has ? [m.lng, m.lat] : [35.2, 39], zoom: has ? 15 : 4.6, attributionControl: { compact: true } });
      mp.addControl(new maplibregl.NavigationControl({ showCompass: false }));
      mp.on("click", e => setPt(e.lngLat.lat, e.lngLat.lng));
      mp.on("load", () => { if (has) setPt(+m.lat, +m.lng); });
    }
    kpWire(f, (la, ln) => setPt(la, ln, true));
    const kAvg = () => { const v = KRITER.map(([k]) => parseFloat(f["k_" + k].value)).filter(x => !isNaN(x)); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length * 10) / 10 : null; };
    const kUpd = () => { const a = kAvg(); f.puan.placeholder = a != null ? "Ortalama: " + a.toFixed(1) : ""; };
    KRITER.forEach(([k]) => f["k_" + k].addEventListener("input", kUpd)); kUpd();
    f.maps_url.addEventListener("input", () => { const p = parseMaps(f.maps_url.value); if (p) setPt(p[0], p[1], true); else if (/goo\.gl|maps\.app/.test(f.maps_url.value)) toast("Kısa linkten konum okunamıyor; linki tarayıcıda açıp adres çubuğundaki uzun linki yapıştır ya da haritaya tıkla."); });
    ["lat", "lng"].forEach(n => f[n].addEventListener("change", () => { const a = parseFloat(f.lat.value), b = parseFloat(f.lng.value); if (!isNaN(a) && !isNaN(b)) setPt(a, b, true); }));
    f.il.addEventListener("change", () => { if (mp && !f.lat.value) { const c = { "İstanbul": [28.98, 41.01], "Ankara": [32.86, 39.93], "İzmir": [27.14, 38.42] }[f.il.value]; if (c) mp.flyTo({ center: c, zoom: 10 }); } });
    f.addEventListener("submit", async e => {
      e.preventDefault(); const v = n => (f[n].value || "").trim();
      const lat = parseFloat(v("lat")), lng = parseFloat(v("lng"));
      let puan = parseFloat(v("puan")); if (isNaN(puan)) puan = kAvg() ?? NaN;
      const kriterler = {}; KRITER.forEach(([k]) => { const x = parseFloat(f["k_" + k].value); if (!isNaN(x)) kriterler[k] = Math.min(10, Math.max(0, Math.round(x * 10) / 10)); });
      if (!v("ad") || !v("il")) return toast("Mekân adı ve il gerekli.");
      if (isNaN(puan) || puan < 0 || puan > 10) return toast("Genel puanı ya da kriter puanlarını gir (0–10).");
      if (isNaN(lat) || isNaN(lng)) return toast("Konumu seç: haritaya tıkla ya da Maps linki yapıştır.");
      const row = { ad: v("ad"), il: v("il"), ilce: v("ilce") || null, adres: v("adres") || null, puan: Math.round(puan * 10) / 10, puan_notu: v("puan_notu") || null,
        etiketler: v("etiketler") ? v("etiketler").split(",").map(s => s.trim()).filter(Boolean) : [], bolum_url: v("bolum_url") || null, maps_url: v("maps_url") || null,
        lat, lng, yayinda: f.yayinda.checked, kriterler, aciklama: v("aciklama") || null };
      if (m.oneri_id) row.oneri_id = m.oneri_id;
      const q = isNew ? db.from("mekanlar").insert(row).select().single() : db.from("mekanlar").update(row).eq("id", m.id).select().single();
      const { data, error } = await q;
      if (error) return toast("Kaydedilemedi: " + error.message);
      if (isNew) D.mekan.unshift(data); else D.mekan[D.mekan.findIndex(x => x.id === m.id)] = data;
      if (m.oneri_id) { await db.from("mekan_onerileri").update({ durum: "gidildi" }).eq("id", m.oneri_id); const o = D.oneri.find(x => x.id === m.oneri_id); if (o) o.durum = "gidildi"; }
      closeModal(); renderAll(); if (m.oneri_id) goTab("mekan"); toast(row.yayinda ? "Kaydedildi, haritada yayında" : "Taslak olarak kaydedildi");
    });
  }

  /* ---------- reçeteler ---------- */
  const STEP_AD = { ekmek: "Ekmek", sos: "İç sos", peynir: "Peynir", aci: "Acı", garnitur: "Garnitür", tavuk: "Tavuk", pisme: "Pişme", icecek: "İçecek", patates: "Patates", yansos: "Yan sos" };
  $("#f-recete-il").addEventListener("input", renderRecete);
  function renderRecete() {
    ilFilter($("#f-recete-il"), D.recete);
    const il = $("#f-recete-il").value, rows = D.recete.filter(r => !il || r.il === il);
    const withLoc = rows.filter(r => r.il).length;
    $("#recete-kpi").innerHTML = kpi("Tasarlanan döner", rows.length, since(rows, 7)) + `<div class="kpi"><small>Konum paylaşan</small><b>${nf(withLoc)}</b><span class="zero">%${rows.length ? Math.round(100 * withLoc / rows.length) : 0}</span></div>` +
      `<div class="kpi"><small>En popüler ekmek</small><b style="font-size:24px">${esc((countBy(rows, r => r.secimler && r.secimler.ekmek)[0] || ["—"])[0])}</b><span class="zero">&nbsp;</span></div>` +
      `<div class="kpi"><small>En çok tasarlanan il</small><b style="font-size:24px">${esc((countBy(rows, r => r.il)[0] || ["—"])[0])}</b><span class="zero">&nbsp;</span></div>`;
    $("#picks").innerHTML = Object.entries(STEP_AD).map(([k, ad]) => `<div class="box"><h3>${ad} <small>${nf(rows.filter(r => r.secimler && [].concat(r.secimler[k] || []).filter(Boolean).length).length)} seçim</small></h3><div data-pick="${k}"></div></div>`).join("");
    Object.keys(STEP_AD).forEach(k => hbars($(`[data-pick="${k}"]`), countBy(rows, r => r.secimler ? r.secimler[k] : null).slice(0, 7), rows.length || 1));
    const notes = rows.filter(r => r.secimler && r.secimler.not).slice(0, 30);
    $("#notlar").innerHTML = notes.length ? notes.map(r => `<div class="hb" style="grid-template-columns:120px 1fr"><span class="sm">${fmtD(r.created_at)}${r.il ? " · " + esc(r.il) : ""}</span><span>${esc(r.secimler.not)}</span></div>`).join("") : `<div class="empty">Henüz not yok.</div>`;
  }

  /* ---------- CSV ---------- */
  function csv(name, head, rows) {
    const q = v => { const s = String(v ?? ""); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const body = "﻿" + [head.map(q).join(";"), ...rows.map(r => r.map(q).join(";"))].join("\r\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([body], { type: "text/csv;charset=utf-8" }));
    a.download = `${name}-${new Date().toISOString().slice(0, 10)}.csv`; document.body.appendChild(a); a.click(); a.remove();
  }
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-csv]"); if (!b) return;
    const t = b.dataset.csv, dt = s => new Date(s).toLocaleString(TR);
    if (t === "oneri") csv("mekan-onerileri", ["Tarih", "Mekân", "İl", "İlçe", "Adres", "Neden", "Öneren", "Yayın izni", "Durum", "Not"],
      oneriRows().map(r => [dt(r.created_at), r.mekan_adi, r.il, r.ilce, r.adres, r.neden, r.takma_ad, r.yayin_izni ? "Evet" : "Hayır", DURUM[r.durum], r.yonetici_notu]));
    if (t === "bekleme") csv("bekleme-listesi", ["Tarih", "E-posta", "Telefon", "İl", "İlçe", "İleti onayı", "Onay metni"],
      bekRows().map(r => [dt(r.created_at), r.eposta || (r.iletisim || "").includes("@") && r.iletisim || "", r.telefon || "", r.il, r.ilce, r.ileti_onay ? "Evet" : "Hayır", r.onay_metni]));
    if (t === "recete") csv("receteler", ["Tarih", "İl", "İlçe", ...Object.values(STEP_AD), "Not"],
      D.recete.map(r => [dt(r.created_at), r.il, r.ilce, ...Object.keys(STEP_AD).map(k => [].concat((r.secimler || {})[k] || []).join(", ")), (r.secimler || {}).not]));
  });

  /* ---------- boot ---------- */
  start().then(() => { const h = location.hash.slice(1); if (["oneri", "rota", "bekleme", "mekan", "recete"].includes(h)) goTab(h); });
})();

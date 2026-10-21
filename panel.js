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
    DEG.clear(); await degYukle(D.mekan.map(m => m.id));
    renderAll(); gKullanim(); otoEslestir();
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
  const YEMEK = /(döner|kebap|restoran|lokanta|yemek|fast food|büfe|dürüm|tavuk|et |ızgara|pide|kafe|restaurant|food|meal|cafe|imbiss|grill)/i;
  const starHtml = r => `★ ${r.google_puan != null ? Number(r.google_puan).toFixed(1) : "–"}<small>${r.google_yorum != null ? nf(r.google_yorum) + " yorum" : ""}</small>`;
  function gCell(r) {
    if (r.google_puan != null || r.google_yorum != null) return `<a class="gstar" href="${esc(r.google_url || mapsAra(r))}" target="_blank" rel="noopener" data-tip="${esc((r.google_ad || "") + (r.google_puan_tarih || r.google_tarih ? " · " + fmtD(r.google_puan_tarih || r.google_tarih) : ""))}">${starHtml(r)}</a>`;
    if (r.google_place_id) return `<button class="icon-btn gget" data-gpuan="${r.id}" data-tip="${esc(r.google_ad || "")}${r.google_tur ? " · " + esc(r.google_tur) : ""}">★ Puanı getir</button>${r.google_tur && !YEMEK.test(r.google_tur) ? `<div class="sm warn">${esc(r.google_tur)}</div>` : ""}${r.google_eslesme === "kapali" ? `<div class="sm warn">Kalıcı kapalı</div>` : ""}`;
    if (r.google_eslesme === "bulunamadi") return `<button class="icon-btn" data-gfind="${r.id}">Bulunamadı · ara</button>`;
    return `<a class="icon-btn" href="${esc(mapsAra(r))}" target="_blank" rel="noopener">Maps'te ara ↗</a>`;
  }
  function onayCell(r) {
    if (r.durum === "listede" || r.durum === "gidildi") return `<span class="badge b-listede" data-tip="Rotadaki mekânlar haritada 'Rotamızda' olarak görünür">Rota</span>`;
    return `<label class="sw" data-tip="${r.onayli ? "Haritada görünüyor" : "Onayla: haritada 'Önerilen' olarak göster"}"><input type="checkbox" data-onay="${r.id}"${r.onayli ? " checked" : ""}${r.durum === "uygun_degil" ? " disabled" : ""}><i></i></label>${r.lat == null ? `<div class="sm" style="margin-top:4px">konum yok</div>` : ""}`;
  }
  function gBox(r) {
    const tarih = r.google_puan_tarih || r.google_tarih;
    const bilgi = r.google_place_id
      ? `<b>${esc(r.google_ad || "")}</b>${r.google_tur ? ` <span class="badge ${YEMEK.test(r.google_tur) ? "b-ok" : "b-dup"}">${esc(r.google_tur)}</span>` : ""}${r.google_eslesme === "kapali" ? ` <span class="badge b-uygun_degil">Kalıcı kapalı</span>` : ""}<br><span class="sm">${esc(r.google_adres || "")}</span><br>
         ${r.google_puan != null || r.google_yorum != null ? `<span class="gbig">${starHtml(r)}</span>${tarih ? `<span class="sm"> · ${fmtD(tarih)}</span>` : ""}` : `<span class="sm">Puan henüz çekilmedi.</span>`}`
      : `<span class="sm">${r.google_eslesme === "bulunamadi" ? "Google'da otomatik bulunamadı. Aramayı değiştirerek dene." : "Google ile henüz eşleşmedi."}</span>`;
    return `<h4>Google</h4><p>${bilgi}</p>
      <div class="det-acts" style="margin:-4px 0 14px">${r.google_place_id ? `<button class="btn btn-sm" data-gpuan="${r.id}">${r.google_puan != null ? "Puanı yenile" : "★ Puanı getir"}</button>` : ""}<button class="btn btn-line btn-sm" data-gfind="${r.id}">${r.google_place_id ? "Eşleşmeyi değiştir / konum" : "Google'da ara / konum"}</button><a class="btn btn-line btn-sm" href="${esc(r.google_url || mapsAra(r))}" target="_blank" rel="noopener">Maps'te aç ↗</a></div>`;
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
      if (b.dataset.gpuan) puanGetir(D.oneri.find(x => x.id === +b.dataset.gpuan), b);
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
    mekanForm({ ad: r.google_ad || r.mekan_adi, il: r.il, ilce: r.ilce, ulke: r.ulke, adres: url ? "" : (r.adres || ""), maps_url: r.google_url || url, lat: r.lat, lng: r.lng, oneri_id: r.id, google_place_id: r.google_place_id || null });
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
  /* ---------- Google Places (sunucu fonksiyonu üzerinden, günlük sınırlı) ---------- */
  let G_OFF = false;
  async function gfn(islem, body) {
    if (G_OFF) return { error: "GOOGLE_MAPS_KEY eklenmemiş." };
    try {
      const { data, error } = await db.functions.invoke("google-mekan", { body: { islem, ...body } });
      let err = data && data.error;
      if (error && !err) { const j = error.context && error.context.json ? await error.context.json().catch(() => null) : null; err = (j && j.error) || error.message || "Bilinmeyen hata"; }
      if (err && /GOOGLE_MAPS_KEY/.test(err)) G_OFF = true;
      return err ? { error: err } : data;
    } catch (e) { return { error: String(e) }; }
  }
  async function gKullanim() {
    const el = $("#g-kullanim"); if (!el) return;
    const gun = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });
    const [{ data }, { data: genel }] = await Promise.all([db.from("google_kullanim").select("tur,adet").eq("gun", gun), db.from("istek_sayac").select("adet").eq("anahtar", "google:genel:" + gun).maybeSingle()]);
    const m = Object.fromEntries((data || []).map(x => [x.tur, x.adet]));
    el.textContent = G_OFF ? "Google bağlantısı: anahtar bekleniyor" : `Bugün Google: panel ${m.ara || 0}/60 arama · ${(m.detay || 0) + (m.puan || 0)}/30 detay · ziyaretçi linkleri ${Math.min(100, (genel && genel.adet) || 0)}/100 (ücretsiz sınır içinde)`;
  }
  let ESLESIYOR = false;
  async function otoEslestir() {
    if (ESLESIYOR || G_OFF) return; ESLESIYOR = true;
    const bek = D.oneri.filter(r => !r.google_place_id && !r.google_eslesme && r.durum !== "uygun_degil").slice(0, 20);
    let n = 0;
    for (const r of bek) {
      const d = await gfn("eslestir", { id: r.id });
      if (d.error) { if (!G_OFF) toast("Google eşleştirme: " + d.error); break; }
      if (d.satir) { Object.assign(r, d.satir); n++; }
    }
    ESLESIYOR = false;
    if (n) { renderAll(); toast(n + " öneri Google ile eşleşti"); }
    gKullanim();
  }
  async function puanGetir(r, btn) {
    if (!r) return;
    if (btn) { btn.disabled = true; btn.textContent = "Getiriliyor…"; }
    const d = await gfn("puan", { id: r.id, zorla: r.google_puan != null });
    if (d.error) { if (btn) { btn.disabled = false; btn.textContent = "★ Puanı getir"; } return toast(G_OFF ? "Google anahtarı henüz eklenmemiş." : d.error); }
    D.oneri.filter(x => x.google_place_id === d.place_id).forEach(x => Object.assign(x, d.puan));
    renderAll(); gKullanim(); toast(`★ ${d.puan.google_puan ?? "–"} · ${nf(d.puan.google_yorum || 0)} yorum`);
  }
  async function konumAra(q) {
    if (!G_OFF) {
      const d = await gfn("ara", { q });
      if (!d.error) return (d.sonuc || []).map(p => ({ ad: p.ad, alt: p.adres, tur: p.tur, lat: p.lat, lng: p.lng, g: p, kaynak: "Google" }));
    }
    return (await photon(q)).map(p => ({ ...p, tur: OSM_TUR[p.tur] || null, kaynak: "OSM" }));
  }
  const kpHtml = q => `<div class="kp-search"><input type="search" data-kp-q value="${esc(q)}" placeholder="Mekân adı, ilçe, il"><button type="button" class="btn btn-line btn-sm" data-kp-go>Haritada ara</button></div><div class="kp-res" data-kp-res></div>`;
  function kpWire(root, onPick, auto) {
    const inp = $("[data-kp-q]", root), box = $("[data-kp-res]", root);
    const go = async () => {
      const q = inp.value.trim(); if (q.length < 2) return;
      box.innerHTML = `<div class="kp-msg">Aranıyor…</div>`;
      try {
        const list = await konumAra(q);
        box.innerHTML = list.length ? list.map((p, i) => `<button type="button" class="kp-item" data-i="${i}"><b>${esc(p.ad || "(adsız)")}${p.tur ? ` <em>${esc(p.tur)}</em>` : ""}${p.g && p.g.kapali ? ` <em class="kapali">Kalıcı kapalı</em>` : ""}</b><small>${esc(p.alt)}${p.g ? "" : " · OpenStreetMap"}</small></button>`).join("")
          : `<div class="kp-msg">Bulunamadı. Aramayı kısalt (ör. sadece mekân adı + ilçe), haritada elle işaretle ya da Google Maps linkini yapıştır.</div>`;
        box.onclick = e => { const b = e.target.closest("[data-i]"); if (!b) return; $$(".kp-item", box).forEach(x => x.classList.toggle("on", x === b)); const p = list[+b.dataset.i]; onPick(p.lat, p.lng, p.g); };
      } catch (err) { box.innerHTML = `<div class="kp-msg">Arama şu an çalışmadı. Haritaya tıklayarak işaretleyebilirsin.</div>`; }
    };
    $("[data-kp-go]", root).addEventListener("click", go);
    inp.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); go(); } });
    if (auto) go();
  }
  function miniMap(el, lat, lng, color, f) {
    if (!window.maplibregl) return (la, ln) => { f.lat.value = (+la).toFixed(6); f.lng.value = (+ln).toFixed(6); };
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
  const gFields = r => `<input type="hidden" name="gid"><input type="hidden" name="gad"><input type="hidden" name="gadres"><input type="hidden" name="gtur">
    <label class="field"><span>Google Maps linki <small>yapıştırınca mekân otomatik tanınır (kısa linkler dahil)</small></span><input name="gurl" type="url" value="${esc(r.google_url || "")}" placeholder="https://maps.app.goo.gl/…"><span class="sm" data-gnote></span></label>
    <div class="row2"><label class="field"><span>Google puanı <small>(elle düzeltmek için)</small></span><input name="gp" type="number" min="1" max="5" step="0.1" inputmode="decimal" value="${r.google_puan ?? ""}" placeholder="4.6"></label>
      <label class="field"><span>Yorum sayısı</span><input name="gy" type="number" min="0" step="1" inputmode="numeric" value="${r.google_yorum ?? ""}" placeholder="1250"></label></div>`;
  function gSec(f, g, set) {
    if (!g) return;
    f.gid.value = g.id; f.gad.value = g.ad || ""; f.gadres.value = g.adres || ""; f.gtur.value = g.tur || ""; if (g.url) f.gurl.value = g.url;
    if (g.lat != null) set(g.lat, g.lng, true);
    const n = $("[data-gnote]", f); if (n) n.textContent = `Google: ${g.ad}${g.tur ? " · " + g.tur : ""}${g.kapali ? " · KALICI KAPALI" : ""} — kaydedince eşleşir, puanı panelden çekebilirsin.`;
  }
  function gWire(f, set) {
    let t;
    f.gurl.addEventListener("input", () => {
      const u = f.gurl.value.trim(), p = parseMaps(u); if (p) set(p[0], p[1], true);
      clearTimeout(t); if (!/^https?:\/\//i.test(u)) return;
      t = setTimeout(async () => {
        const n = $("[data-gnote]", f); if (n) n.textContent = "Google'da tanınıyor…";
        const d = await gfn("link", { url: u });
        if (d.error) { if (n) n.textContent = G_OFF ? "Google anahtarı eklenince link otomatik tanınacak." : d.error; return; }
        if (d.sonuc && d.sonuc[0]) { const url = f.gurl.value; gSec(f, d.sonuc[0], set); f.gurl.value = url; }
        else if (d.konum && d.konum.lat != null) { set(d.konum.lat, d.konum.lng, true); if (n) n.textContent = "Konum linkten alındı."; }
      }, 500);
    });
  }
  function gVals(f, r) {
    const gp = parseFloat(f.gp.value), gy = parseInt(f.gy.value, 10);
    const o = { google_url: f.gurl.value.trim() || null, google_puan: isNaN(gp) ? null : Math.min(5, Math.max(0, Math.round(gp * 10) / 10)), google_yorum: isNaN(gy) ? null : Math.max(0, gy) };
    if (o.google_puan !== (r.google_puan == null ? null : +r.google_puan) || o.google_yorum !== (r.google_yorum == null ? null : +r.google_yorum)) o.google_tarih = new Date().toISOString();
    if (f.gid.value && f.gid.value !== r.google_place_id) {
      Object.assign(o, { google_place_id: f.gid.value, google_ad: f.gad.value || null, google_adres: f.gadres.value || null, google_tur: f.gtur.value || null,
        google_eslesme: "elle", google_puan: null, google_yorum: null, google_puan_tarih: null });
    }
    return o;
  }
  const qOf = r => [r.google_ad || r.mekan_adi, r.ilce, r.il === "Yurt dışı" ? r.ulke : r.il].filter(Boolean).join(" ");
  function konumForm(r, onayla) {
    const rotada = r.durum === "listede" || r.durum === "gidildi";
    openModal("Konum ve Google bilgisi", `<form id="kf" novalidate>
      <p style="margin-bottom:6px"><b>${esc(r.google_ad || r.mekan_adi)}</b> <span class="sm">${esc([r.ilce, r.il === "Yurt dışı" ? r.ulke : r.il].filter(Boolean).join(" · "))}</span></p>
      <p class="sm" style="margin-bottom:16px">Önce <a href="${esc(mapsAra(r))}" target="_blank" rel="noopener" style="color:var(--cobalt);font-weight:600">Google Maps'te ara ↗</a> ve gerçekten bir dönerci mi bak. Aşağıdan doğru mekânı seçince Google bilgileri eşleşir.</p>
      <div class="field"><span>Konum <small>Google'da ara, linki yapıştır ya da haritaya tıkla; pini sürükleyebilirsin</small></span>${kpHtml(qOf(r))}
        <div class="mini-map" id="k-map"></div><input type="hidden" name="lat" value="${r.lat ?? ""}"><input type="hidden" name="lng" value="${r.lng ?? ""}"></div>
      ${gFields(r)}
      ${rotada ? "" : `<label class="check"><input type="checkbox" name="onayli"${r.onayli || onayla ? " checked" : ""}><span><b>Onayla:</b> sitedeki haritada “Önerilen” olarak göster <small>(sadece mekân adı, ilçe ve öneri sayısı görünür)</small></span></label>`}
      <div class="m-foot"><button type="button" class="btn btn-line btn-sm" data-close>Vazgeç</button><button class="btn btn-sm">Kaydet</button></div></form>`);
    const f = $("#kf"); const set = miniMap("k-map", r.lat, r.lng, "#FF6A00", f);
    kpWire(f, (la, ln, g) => g ? gSec(f, g, set) : set(la, ln, true), r.lat == null && !r.google_place_id); gWire(f, set);
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
    const r = D.oneri.find(x => x.id === +(b.dataset.rota || b.dataset.tomap2 || b.dataset.cikar || b.dataset.gfind || b.dataset.gpuan));
    if (b.dataset.gpuan) return puanGetir(r, b);
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
    kpWire(f, (la, ln, g) => g ? gSec(f, g, set) : set(la, ln, true), r.lat == null && !r.google_place_id); gWire(f, set);
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

  /* ---------- mekânlar: Google linki + Tahsin/Egemen değerlendirmesi ---------- */
  const KRITER = C.KRITERLER || [];
  const KISI = C.KISILER || [{ k: "tahsin", ad: "Tahsin" }, { k: "egemen", ad: "Egemen" }];
  const fP = p => { if (p == null || p === "") return "–"; const n = Math.round(Number(p) * 10) / 10; return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ","); };
  const guvenli = u => /^https?:\/\/[^\s"'<>]+$/i.test(String(u || "").trim()) ? String(u).trim() : "";
  const anahtar = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase(TR).replace(/[^a-z0-9]/g, "");
  const eslesen = (list, ad) => { const k = anahtar(ad); return k ? list.find(x => anahtar(x) === k) || null : null; };
  const temizAd = s => String(s || "").replace(/̇/g, "").normalize("NFC");
  const DEG = new Map(); // mekan_id -> {tahsin:{}, egemen:{}}
  async function degYukle(ids) {
    if (!ids.length) return;
    const { data } = await db.from("degerlendirmeler").select("*").in("mekan_id", ids);
    (data || []).forEach(d => { if (!DEG.has(d.mekan_id)) DEG.set(d.mekan_id, {}); DEG.get(d.mekan_id)[d.kisi] = d; });
  }

  function renderMekan() {
    const rows = D.mekan;
    $("#t-mekan").innerHTML = `<thead><tr><th>Puan</th><th>Mekân</th><th>İl / ilçe</th>${KISI.map(k => `<th class="num">${esc(k.ad)}</th>`).join("")}<th>Bölüm</th><th>Yayında</th><th></th></tr></thead><tbody>` +
      (rows.length ? rows.map(m => `<tr><td><span class="score-b">${fP(m.puan)}</span></td>
        <td><span class="nm">${esc(m.ad)}</span><div class="sm">${esc(m.puan_notu || "")}</div></td>
        <td>${esc(m.il === "Yurt dışı" ? (m.ulke || m.il) : m.il)}<div class="sm">${esc(m.ilce || "")}</div></td>
        ${KISI.map(k => `<td class="num"><b>${fP(m["puan_" + k.k])}</b></td>`).join("")}
        <td>${guvenli(m.bolum_url) ? `<a href="${esc(m.bolum_url)}" target="_blank" rel="noopener" style="color:var(--cobalt);font-weight:600">İzle ↗</a>` : `<span class="sm">—</span>`}</td>
        <td><label class="sw"><input type="checkbox" data-yayin="${m.id}"${m.yayinda ? " checked" : ""}><i></i></label></td>
        <td class="num" style="white-space:nowrap">${m.yayinda ? `<a class="icon-btn" href="mekan.html?id=${m.id}" target="_blank" rel="noopener">Sayfa ↗</a>` : ""}<button class="icon-btn" data-edit="${m.id}">Düzenle</button><button class="icon-btn danger" data-del-mek="${m.id}">Sil</button></td></tr>`).join("")
        : `<tr><td colspan="${6 + KISI.length}" class="empty">Henüz mekân yok. Gittiğiniz ilk mekânı “Yeni mekân” ile ekleyin ya da Rota'dan “Gidildi” deyin.</td></tr>`) + "</tbody>";
  }
  $("#t-mekan").addEventListener("change", async e => {
    const c = e.target.closest("[data-yayin]"); if (!c) return;
    const id = +c.dataset.yayin, m = D.mekan.find(x => x.id === id);
    if (c.checked && m.puan == null) { c.checked = false; return toast("Yayına almadan önce en az bir kişinin puanını girin."); }
    const { error } = await db.from("mekanlar").update({ yayinda: c.checked }).eq("id", id);
    if (error) { c.checked = !c.checked; return toast("Güncellenemedi: " + error.message); }
    m.yayinda = c.checked; renderOzet(); toast(c.checked ? "Sitede yayında" : "Siteden kaldırıldı");
  });
  $("#t-mekan").addEventListener("click", async e => {
    const ed = e.target.closest("[data-edit]"); if (ed) return mekanForm(D.mekan.find(x => x.id === +ed.dataset.edit));
    const dl = e.target.closest("[data-del-mek]"); if (!dl) return;
    const id = +dl.dataset.delMek; if (!(await confirmBox("Bu mekân, Tahsin ve Egemen'in puanlarıyla birlikte kalıcı olarak silinecek."))) return;
    const { error } = await db.from("mekanlar").delete().eq("id", id);
    if (error) return toast("Silinemedi: " + error.message); D.mekan = D.mekan.filter(x => x.id !== id); DEG.delete(id); renderAll(); toast("Silindi");
  });
  $("#add-mekan").addEventListener("click", () => mekanForm({}));
  function parseMaps(u) {
    const s = decodeURIComponent(String(u || ""));
    let m = s.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) || s.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) || s.match(/[?&](?:q|query|ll|destination)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/) || s.match(/^\s*(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)\s*$/);
    return m ? [parseFloat(m[1]), parseFloat(m[2])] : null;
  }

  // Google bilgileri kutusu (sadece panelde; sitede gösterilmez)
  function gDetayHtml(y) {
    if (!y) return "";
    const saat = Array.isArray(y.saatler) && y.saatler.length ? `<details class="gd-saat"><summary>Çalışma saatleri</summary>${y.saatler.map(t => `<div>${esc(t)}</div>`).join("")}</details>` : "";
    const yor = Array.isArray(y.yorumlar) && y.yorumlar.length ? `<div class="gd-yor">${y.yorumlar.map(r => `<div class="gd-y"><div class="gd-yh"><b>${esc(r.yazar || "Google kullanıcısı")}</b><span>${"★".repeat(Math.round(r.puan || 0))}<em>${esc(r.zaman || "")}</em></span></div><p>${esc(r.metin || "")}</p></div>`).join("")}</div>` : "";
    return `<div class="gd">
      <div class="gd-top">${y.puan != null ? `<span class="gd-p">★ ${Number(y.puan).toFixed(1)}</span><span class="sm">${nf(y.yorum_sayisi || 0)} Google yorumu</span>` : `<span class="sm">Google puanı henüz çekilmedi.</span>`}
        ${y.detay_tarih ? `<span class="sm">· ${fmtD(y.detay_tarih)}</span>` : ""}</div>
      <div class="gd-info">${y.telefon ? `<span>☎ ${esc(y.telefon)}</span>` : ""}${guvenli(y.web) ? `<a href="${esc(y.web)}" target="_blank" rel="noopener">${esc(y.web.replace(/^https?:\/\/(www\.)?/, "").slice(0, 40))} ↗</a>` : ""}${guvenli(y.url) ? `<a href="${esc(y.url)}" target="_blank" rel="noopener">Google sayfası ↗</a>` : ""}</div>
      ${saat}${yor}${yor ? `<p class="sm" style="margin-top:6px">Google yorumları sadece panelde görünür; sitede yayınlanmaz.</p>` : ""}</div>`;
  }
  async function gDetayGetir(place_id, zorla) {
    const d = await gfn("detay", { place_id, zorla: !!zorla });
    gKullanim();
    return d;
  }

  // Değerlendirme satırları: dokunulmamış kriter "–" kalır, kaydedilmez
  function puanKolon(kisi, d, i) {
    const p = (d && d.puanlar) || {};
    return `<div class="dg p${i}" data-kisi="${kisi.k}">
      <div class="dg-h"><span class="dg-av">${esc(kisi.ad[0])}</span><b>${esc(kisi.ad)}</b><span class="dg-top"><b data-top>–</b><small>/100</small></span></div>
      ${KRITER.map(([k, ad]) => { const v = p[k]; const has = v != null; return `<div class="dg-r${has ? "" : " bos"}" data-k="${k}">
        <span class="dg-l">${esc(ad)}</span><input type="range" min="0" max="10" step="0.5" value="${has ? v : 5}" aria-label="${esc(kisi.ad)} · ${esc(ad)}"><output>${has ? fP(v) : "–"}</output><button type="button" class="dg-x" title="Temizle" aria-label="Temizle">×</button></div>`; }).join("")}
      <label class="field" style="margin:14px 0 0"><span>${esc(kisi.ad)}'in yorumu <small>(sayfada görünür)</small></span><textarea name="yorum_${kisi.k}" rows="5" maxlength="4000" placeholder="Neyi sevdin, neyi sevmedin? Tavuk, ekmek, sos, usta…">${esc((d && d.yorum) || "")}</textarea></label>
    </div>`;
  }
  function puanTopla(root) {
    const sonuc = {};
    $$(".dg", root).forEach(col => {
      const vals = {}; $$(".dg-r:not(.bos)", col).forEach(r => vals[r.dataset.k] = Number($("input", r).value));
      const n = Object.keys(vals).length, t = n ? Math.round(Object.values(vals).reduce((a, b) => a + b, 0) / n * 100) / 10 : null;
      $("[data-top]", col).textContent = fP(t); sonuc[col.dataset.kisi] = { puanlar: vals, toplam: t };
    });
    const ts = Object.values(sonuc).map(x => x.toplam).filter(x => x != null);
    const ort = ts.length ? Math.round(ts.reduce((a, b) => a + b, 0) / ts.length * 10) / 10 : null;
    const o = $("[data-ort]", root); if (o) o.textContent = fP(ort);
    return sonuc;
  }

  async function mekanForm(m, kaynak) {
    const isNew = !m.id;
    if (!isNew && !DEG.has(m.id)) await degYukle([m.id]);
    const dg = DEG.get(m.id) || {};
    const yurt = m.il === "Yurt dışı";
    openModal(isNew ? "Yeni mekân" : "Mekânı düzenle", `<form id="mf" class="mf" novalidate>
      <section class="mf-s">
        <label class="field"><span>Google Maps linki <small>yapıştırınca ad, adres, il, ilçe, konum ve Google bilgileri gelir</small></span>
          <input name="maps_url" type="url" value="${esc(m.maps_url || "")}" placeholder="https://maps.app.goo.gl/…" autocomplete="off"></label>
        <div data-gnote class="sm" style="margin:-8px 0 10px"></div>
        <input type="hidden" name="gid" value="${esc(m.google_place_id || "")}">
        <div id="g-detay"></div>
      </section>
      <section class="mf-s">
        <h4 class="mf-t">Mekân</h4>
        <label class="field"><span>Mekân adı</span><input name="ad" required maxlength="160" value="${esc(m.ad || "")}"></label>
        <div class="row2"><label class="field"><span>İl</span><select name="il" required>${ilOpts(m.il || "", true)}</select></label>
          <label class="field" data-ilce-w${yurt ? " hidden" : ""}><span>İlçe</span><select name="ilce"${(window.ILCELER || {})[m.il] ? "" : " disabled"}>${ilceOpts(m.il, m.ilce)}</select></label>
          <label class="field" data-ulke-w${yurt ? "" : " hidden"}><span>Ülke / şehir</span><input name="ulke" maxlength="60" value="${esc(m.ulke || "")}"></label></div>
        <label class="field"><span>Adres <small>(sayfada görünür)</small></span><input name="adres" maxlength="200" value="${esc(m.adres || "")}"></label>
        <div class="row3">
          <label class="field"><span>Instagram</span><input name="instagram" maxlength="200" value="${esc(m.instagram || "")}" placeholder="@hesap ya da link"></label>
          <label class="field"><span>Ziyaret tarihi</span><input name="ziyaret_tarihi" type="date" value="${esc(m.ziyaret_tarihi || "")}"></label>
          <label class="field"><span>Bölüm linki (YouTube)</span><input name="bolum_url" type="url" value="${esc(m.bolum_url || "")}"></label>
        </div>
        <label class="field"><span>Etiketler <small>(virgülle)</small></span><input name="etiketler" value="${esc((m.etiketler || []).join(", "))}" placeholder="Lavaş, Sulu tavuk, Uygun fiyat"></label>
      </section>
      <section class="mf-s">
        <div class="mf-th"><h4 class="mf-t">Değerlendirme</h4><span class="mf-ort">Mekân puanı <b data-ort>–</b><small>/100</small></span></div>
        <p class="sm" style="margin:-4px 0 12px">Her kriteri 0–10 arası kaydırarak puanlayın. Dokunmadığınız kriter boş kalır, toplam girilenlerin ortalamasıyla 100'e ölçeklenir.</p>
        <div class="dg-grid">${KISI.map((k, i) => puanKolon(k, dg[k.k], i)).join("")}</div>
      </section>
      <section class="mf-s">
        <h4 class="mf-t">Sayfa yazısı</h4>
        <label class="field"><span>Kısa özet <small>(sayfanın başında, tırnak içinde)</small></span><textarea name="puan_notu" rows="2" maxlength="400">${esc(m.puan_notu || "")}</textarea></label>
        <label class="field"><span>Detay yazısı <small>(paragrafları boş satırla ayır)</small></span><textarea name="aciklama" rows="6" maxlength="6000" placeholder="Ustanın hikâyesi, döneri nasıl hazırladığı…">${esc(m.aciklama || "")}</textarea></label>
      </section>
      <section class="mf-s">
        <div class="field"><span>Konum <small>(linkten gelir; ara, haritaya tıkla ya da pini sürükle)</small></span>${kpHtml([m.ad, m.ilce, m.il].filter(Boolean).join(" "))}
          <div class="mini-map" id="mini-map"></div>
          <div class="row2"><input name="lat" inputmode="decimal" placeholder="Enlem" value="${m.lat ?? ""}"><input name="lng" inputmode="decimal" placeholder="Boylam" value="${m.lng ?? ""}"></div></div>
        <label class="check"><input type="checkbox" name="yayinda"${m.yayinda ? " checked" : ""}><span><b>Sitede yayınla</b> · işaretlemezsen taslak olarak kaydedilir.</span></label>
      </section>
      <div class="m-foot mf-foot"><button type="button" class="btn btn-line btn-sm" data-close>Vazgeç</button><button class="btn btn-o btn-sm">${isNew ? "Mekânı kaydet" : "Değişiklikleri kaydet"}</button></div></form>`);
    $(".modal-card").classList.add("wide");
    const f = $("#mf"); wireIlIlce(f);
    const ilceW = $("[data-ilce-w]", f), ulkeW = $("[data-ulke-w]", f);
    f.il.addEventListener("change", () => { const y = f.il.value === "Yurt dışı"; ilceW.hidden = y; ulkeW.hidden = !y; });
    const set = miniMap("mini-map", m.lat != null ? +m.lat : null, m.lng != null ? +m.lng : null, "#FF6A00", f);

    // değerlendirme etkileşimi
    const dgRoot = $(".dg-grid", f);
    dgRoot.addEventListener("input", e => { const r = e.target.closest(".dg-r"); if (!r) return; r.classList.remove("bos"); $("output", r).textContent = fP(e.target.value); puanTopla(f); });
    dgRoot.addEventListener("click", e => { const x = e.target.closest(".dg-x"); if (!x) return; const r = x.closest(".dg-r"); r.classList.add("bos"); $("output", r).textContent = "–"; puanTopla(f); });
    puanTopla(f);

    // Google
    const gBox = $("#g-detay", f), note = $("[data-gnote]", f);
    const detayGoster = async (pid, zorla) => {
      if (!pid) { gBox.innerHTML = ""; return; }
      gBox.innerHTML = `<div class="gd sm">Google bilgileri getiriliyor…</div>`;
      const d = await gDetayGetir(pid, zorla);
      if (d.error) { gBox.innerHTML = `<div class="gd sm">${esc(G_OFF ? "Google anahtarı eklenmemiş." : d.error)}</div>`; return; }
      gBox.innerHTML = gDetayHtml(d.detay) + `<button type="button" class="linkish" data-gyenile style="margin-top:6px">Google bilgilerini yenile</button>`;
      const ig = d.detay && d.detay.instagram; if (ig && !f.instagram.value) f.instagram.value = ig;
    };
    gBox.addEventListener("click", e => { if (e.target.closest("[data-gyenile]")) detayGoster(f.gid.value, true); });
    const yerYaz = g => {
      f.gid.value = g.place_id || g.id || "";
      if (!f.ad.value || isNew) f.ad.value = g.ad || f.ad.value;
      if (g.il === "Yurt dışı") { f.il.value = "Yurt dışı"; f.il.dispatchEvent(new Event("change")); f.ulke.value = g.ulke || ""; }
      else { const il = eslesen(ILLER, g.il); if (il) { f.il.value = il; f.il.dispatchEvent(new Event("change")); const ic = eslesen((window.ILCELER || {})[il] || [], g.ilce); if (ic) f.ilce.value = ic; } }
      if (!f.adres.value && g.adres) f.adres.value = String(g.adres).split(",").slice(0, 2).join(",").trim().slice(0, 200);
      if (g.url && !/goo\.gl|share\.google/.test(f.maps_url.value)) f.maps_url.value = g.url;
      if (g.lat != null) set(g.lat, g.lng, true);
      note.innerHTML = `Google: <b>${esc(g.ad)}</b>${g.tur ? " · " + esc(g.tur) : ""}${g.kapali ? ` · <b style="color:var(--err)">KALICI KAPALI</b>` : ""} · ${esc(temizAd(g.adres))}`;
      detayGoster(f.gid.value);
    };
    let lt;
    f.maps_url.addEventListener("input", () => {
      const u = f.maps_url.value.trim(), p = parseMaps(u); if (p) set(p[0], p[1], true);
      clearTimeout(lt); if (!/^https?:\/\//i.test(u)) return;
      lt = setTimeout(async () => {
        note.textContent = "Google'da tanınıyor…";
        const d = await gfn("link", { url: u });
        if (d.error) { note.textContent = G_OFF ? "Google anahtarı eklenince link otomatik tanınacak." : d.error; return; }
        if (d.sonuc && d.sonuc[0]) yerYaz(d.sonuc[0]);
        else if (d.konum && d.konum.lat != null) { set(d.konum.lat, d.konum.lng, true); note.textContent = "Konum linkten alındı; mekân Google'da bulunamadı."; }
        else note.textContent = "Linkten mekân okunamadı.";
      }, 450);
    });
    kpWire(f, (la, ln, g) => g ? yerYaz(g) : set(la, ln, true));
    if (m.google_place_id) detayGoster(m.google_place_id);
    else if (isNew && m.maps_url) f.maps_url.dispatchEvent(new Event("input"));

    f.addEventListener("submit", async e => {
      e.preventDefault(); const v = n => (f[n].value || "").trim();
      const lat = parseFloat(v("lat")), lng = parseFloat(v("lng"));
      if (!v("ad") || !v("il")) return toast("Mekân adı ve il gerekli.");
      if (isNaN(lat) || isNaN(lng)) return toast("Konumu seç: Maps linki yapıştır, ara ya da haritaya tıkla.");
      const sonuc = puanTopla(f);
      const herhangi = KISI.some(k => sonuc[k.k].toplam != null);
      if (f.yayinda.checked && !herhangi) return toast("Yayınlamak için en az bir kişinin puanını girin.");
      const yurtd = v("il") === "Yurt dışı";
      const row = { ad: v("ad"), il: v("il"), ilce: yurtd ? null : (v("ilce") || null), ulke: yurtd ? (v("ulke") || null) : null, adres: v("adres") || null,
        puan_notu: v("puan_notu") || null, etiketler: v("etiketler") ? v("etiketler").split(",").map(s => s.trim()).filter(Boolean).slice(0, 12) : [],
        bolum_url: guvenli(v("bolum_url")) || null, maps_url: guvenli(v("maps_url")) || null, instagram: v("instagram") || null,
        ziyaret_tarihi: v("ziyaret_tarihi") || null, google_place_id: v("gid") || null, lat, lng, yayinda: f.yayinda.checked, aciklama: v("aciklama") || null };
      if (m.oneri_id) row.oneri_id = m.oneri_id;
      const btn = $(".mf-foot .btn-o", f); btn.disabled = true;
      const q = isNew ? db.from("mekanlar").insert({ ...row, yayinda: false }).select().single() : db.from("mekanlar").update(row).eq("id", m.id).select().single();
      let { data, error } = await q;
      if (error) { btn.disabled = false; return toast("Kaydedilemedi: " + error.message); }
      const id = data.id;
      // değerlendirmeler
      const up = [], sil = [];
      KISI.forEach(k => { const s = sonuc[k.k], yorum = (f["yorum_" + k.k].value || "").trim() || null;
        if (Object.keys(s.puanlar).length || yorum) up.push({ mekan_id: id, kisi: k.k, puanlar: s.puanlar, yorum }); else sil.push(k.k); });
      if (up.length) { const r = await db.from("degerlendirmeler").upsert(up, { onConflict: "mekan_id,kisi" }); if (r.error) toast("Puanlar kaydedilemedi: " + r.error.message); }
      if (sil.length && !isNew) await db.from("degerlendirmeler").delete().eq("mekan_id", id).in("kisi", sil);
      if (isNew && row.yayinda) await db.from("mekanlar").update({ yayinda: true }).eq("id", id);
      ({ data } = await db.from("mekanlar").select("*").eq("id", id).single());
      DEG.delete(id); await degYukle([id]);
      if (isNew) D.mekan.unshift(data); else D.mekan[D.mekan.findIndex(x => x.id === m.id)] = data;
      if (m.oneri_id) { await db.from("mekan_onerileri").update({ durum: "gidildi" }).eq("id", m.oneri_id); const o = D.oneri.find(x => x.id === m.oneri_id); if (o) o.durum = "gidildi"; }
      closeModal(); renderAll(); if (m.oneri_id) goTab("mekan");
      toast(data.yayinda ? `Kaydedildi, sitede yayında · ${fP(data.puan)}/100` : "Taslak olarak kaydedildi");
    });
  }

  // Rotaya Google Maps linkiyle hızlı ekleme
  function rotaLinkForm() {
    openModal("Link ile rotaya ekle", `<form id="rl" novalidate>
      <label class="field"><span>Google Maps linki</span><input name="url" type="url" required placeholder="https://maps.app.goo.gl/…" autocomplete="off"></label>
      <div id="rl-sonuc" class="rl-sonuc"><p class="sm">Linki yapıştırınca mekân Google'dan tanınır: ad, adres, il, ilçe, konum, puan ve yorumlar.</p></div>
      <label class="field"><span>Rota puanın (0–10) <small>rotadaki sıralama buna göre</small></span>
        <div class="rp-row"><input type="range" name="rp" min="0" max="10" step="0.5" value="7"><output>7,0</output></div></label>
      <label class="field"><span>Not <small>(sadece panelde)</small></span><textarea name="not" rows="2" placeholder="Örn: Mart rotası, ustanın adı Mehmet"></textarea></label>
      <label class="check"><input type="checkbox" name="hg" checked><span>Sitedeki haritada <b>“Rotamızda”</b> olarak göster</span></label>
      <div class="m-foot"><button type="button" class="btn btn-line btn-sm" data-close>Vazgeç</button><button class="btn btn-y btn-sm" disabled data-kaydet>Rotaya ekle</button></div></form>`);
    const f = $("#rl"), box = $("#rl-sonuc"), kb = $("[data-kaydet]", f); let SEC = null, LISTE = [], t;
    f.rp.addEventListener("input", () => $("output", f).textContent = Number(f.rp.value).toFixed(1).replace(".", ","));
    const ciz = () => {
      if (!LISTE.length) return;
      box.innerHTML = LISTE.map((g, i) => `<button type="button" class="kp-item${g === SEC ? " on" : ""}" data-i="${i}"><b>${esc(g.ad)}${g.tur ? ` <em>${esc(g.tur)}</em>` : ""}${g.kapali ? ` <em class="kapali">Kalıcı kapalı</em>` : ""}</b><small>${esc(temizAd(g.adres))}</small></button>`).join("") + `<div id="rl-gd"></div>`;
    };
    box.addEventListener("click", async e => { const b = e.target.closest("[data-i]"); if (!b) return; SEC = LISTE[+b.dataset.i]; ciz(); detay(); });
    const detay = async () => { const el = $("#rl-gd"); if (!el || !SEC) return; el.innerHTML = `<div class="gd sm">Google bilgileri getiriliyor…</div>`; const d = await gDetayGetir(SEC.place_id || SEC.id); el.innerHTML = d.error ? `<div class="gd sm">${esc(d.error)}</div>` : gDetayHtml(d.detay); };
    f.url.addEventListener("input", () => {
      clearTimeout(t); const u = f.url.value.trim(); if (!/^https?:\/\//i.test(u)) return;
      t = setTimeout(async () => {
        box.innerHTML = `<p class="sm">Google'da tanınıyor…</p>`; kb.disabled = true;
        const d = await gfn("link", { url: u });
        if (d.error) { box.innerHTML = `<p class="sm" style="color:var(--err)">${esc(d.error)}</p>`; return; }
        LISTE = d.sonuc || []; SEC = LISTE[0] || null;
        if (!SEC) { box.innerHTML = `<p class="sm" style="color:var(--err)">Bu linkten mekân bulunamadı. Öneriler sekmesinden elle ekleyebilirsin.</p>`; return; }
        const ayni = D.oneri.find(r => r.google_place_id === (SEC.place_id || SEC.id) && (r.durum === "listede" || r.durum === "gidildi"));
        ciz(); detay(); kb.disabled = false;
        if (ayni) box.insertAdjacentHTML("afterbegin", `<p class="sm" style="color:var(--warn,#B86400);font-weight:600;margin-bottom:8px">Bu mekân zaten rotada (${esc(DURUM[ayni.durum])}).</p>`);
      }, 400);
    });
    f.addEventListener("submit", async e => {
      e.preventDefault(); if (!SEC) return;
      const g = SEC, yurtd = g.il === "Yurt dışı";
      const il = yurtd ? "Yurt dışı" : (eslesen(ILLER, g.il) || temizAd(g.il) || null);
      const ilce = yurtd ? null : (eslesen((window.ILCELER || {})[il] || [], g.ilce) || temizAd(g.ilce) || null);
      const row = { mekan_adi: String(g.ad || "").slice(0, 120), il: il ? String(il).slice(0, 40) : null, ilce: ilce ? String(ilce).slice(0, 60) : null, ulke: yurtd ? (g.ulke || null) : null,
        adres: f.url.value.trim().slice(0, 400), neden: null, takma_ad: "Panel", kvkk_onay: true, durum: "listede", kaynak: "panel",
        rota_puani: Number(f.rp.value), yonetici_notu: f.not.value.trim() || null, haritada_goster: f.hg.checked,
        google_place_id: g.place_id || g.id, google_ad: g.ad, google_adres: g.adres, google_url: g.url || null, google_tur: g.tur || null,
        google_eslesme: g.kapali ? "kapali" : "elle", lat: g.lat, lng: g.lng };
      const y = await db.from("google_yerler").select("puan,yorum_sayisi,detay_tarih").eq("place_id", row.google_place_id).maybeSingle();
      if (y.data && y.data.puan != null) Object.assign(row, { google_puan: y.data.puan, google_yorum: y.data.yorum_sayisi, google_puan_tarih: y.data.detay_tarih });
      const { data, error } = await db.from("mekan_onerileri").insert(row).select().single();
      if (error) return toast("Kaydedilemedi: " + error.message);
      D.oneri.unshift(data); closeModal(); renderAll(); goTab("rota"); toast(`${g.ad} rotaya eklendi`);
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
  if (window.top !== window.self) { document.body.innerHTML = ""; return; }
  $("#add-rota-link").addEventListener("click", rotaLinkForm);
  start().then(() => { const h = location.hash.slice(1); if (["oneri", "rota", "bekleme", "mekan", "recete"].includes(h)) goTab(h); });
})();

/* eniyitavukdoner.com — panellerin ortak parçaları: fotoğraf yöneticisi, Google kutusu */
(function () {
  "use strict";
  const TR = "tr-TR";
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const guvenli = u => /^https:\/\/[^\s"'<>]+$/i.test(String(u || "").trim()) ? String(u).trim() : "";
  const nf = n => Number(n).toLocaleString(TR);
  const fmtD = s => new Date(s).toLocaleDateString(TR, { day: "2-digit", month: "short", year: "numeric" });
  const BUCKET = "mekan-foto";
  const MAKS_KENAR = 1800, KALITE = 0.84, MAKS_DOSYA = 25 * 1024 * 1024;

  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)));

  // Fotoğrafı tarayıcıda küçült, JPEG'e çevir. Yeniden kodlama EXIF'i (konum dahil) siler.
  async function kucult(file) {
    if (!/^image\//.test(file.type) && !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)) throw new Error("Bu dosya bir fotoğraf değil.");
    if (file.size > MAKS_DOSYA) throw new Error("Fotoğraf çok büyük (en fazla 25 MB).");
    let bmp;
    try { bmp = await createImageBitmap(file, { imageOrientation: "from-image" }); }
    catch (e) {
      bmp = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("Bu fotoğraf biçimi açılamadı. JPEG ya da PNG dene.")); i.src = URL.createObjectURL(file); });
    }
    const w0 = bmp.width, h0 = bmp.height, o = Math.min(1, MAKS_KENAR / Math.max(w0, h0));
    const w = Math.max(1, Math.round(w0 * o)), h = Math.max(1, Math.round(h0 * o));
    const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
    const cx = cv.getContext("2d"); cx.fillStyle = "#fff"; cx.fillRect(0, 0, w, h); cx.drawImage(bmp, 0, 0, w, h);
    if (bmp.close) bmp.close();
    const blob = await new Promise(r => cv.toBlob(r, "image/jpeg", KALITE));
    if (!blob) throw new Error("Fotoğraf işlenemedi.");
    return { blob, w, h };
  }

  /**
   * Fotoğraf yöneticisi
   * el: kapsayıcı, db: supabase istemcisi, mekanId, opt: { toast, onay(msg) -> Promise<bool>, url }
   */
  function fotoYoneticisi(el, db, mekanId, opt = {}) {
    const toast = opt.toast || (m => alert(m));
    const onay = opt.onay || (m => Promise.resolve(confirm(m)));
    const pub = yol => `${opt.url}/storage/v1/object/public/${BUCKET}/${yol.split("/").map(encodeURIComponent).join("/")}`;
    let L = [], mesgul = false;
    el.innerHTML = `<div class="ft">
      <label class="ft-ekle"><input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple hidden>
        <span class="ft-ekle-i" aria-hidden="true">+</span><b>Fotoğraf ekle</b><small>Birden çok seçebilirsin · otomatik küçültülür</small></label>
      <div class="ft-durum sm" role="status" aria-live="polite"></div>
      <ol class="ft-list"></ol></div>`;
    const inp = el.querySelector("input[type=file]"), list = el.querySelector(".ft-list"), durum = el.querySelector(".ft-durum");

    const ciz = () => {
      list.innerHTML = L.length ? L.map((f, i) => `<li class="ft-i" data-id="${f.id}">
        <img src="${esc(pub(f.yol))}" alt="" loading="lazy" width="${f.genislik || 300}" height="${f.yukseklik || 200}">
        <div class="ft-alt"><input type="text" maxlength="200" value="${esc(f.aciklama || "")}" placeholder="Açıklama (isteğe bağlı)" aria-label="Fotoğraf açıklaması" data-acik>
          <div class="ft-btn">${i === 0 ? `<span class="ft-kapak">Kapak</span>` : `<button type="button" data-kapak title="Kapak yap">Kapak yap</button>`}
            <button type="button" data-sol aria-label="Sola taşı"${i === 0 ? " disabled" : ""}>←</button><button type="button" data-sag aria-label="Sağa taşı"${i === L.length - 1 ? " disabled" : ""}>→</button>
            <button type="button" class="ft-sil" data-sil aria-label="Fotoğrafı sil">Sil</button></div></div></li>`).join("")
        : `<li class="ft-bos sm">Henüz fotoğraf yok. İlk fotoğraf mekân sayfasında kapak olarak görünür.</li>`;
    };
    const yukle = async () => {
      const { data, error } = await db.from("mekan_fotolar").select("id,yol,aciklama,sira,genislik,yukseklik").eq("mekan_id", mekanId).order("sira").order("id");
      if (error) { durum.textContent = "Fotoğraflar alınamadı."; return; }
      L = data || []; ciz();
    };
    const siraKaydet = async () => {
      const ups = L.map((f, i) => f.sira === i ? null : db.from("mekan_fotolar").update({ sira: i }).eq("id", f.id).then(r => { if (!r.error) f.sira = i; return r; })).filter(Boolean);
      const r = await Promise.all(ups); if (r.some(x => x.error)) toast("Sıra kaydedilemedi.");
    };

    inp.addEventListener("change", async () => {
      const files = [...inp.files]; inp.value = ""; if (!files.length || mesgul) return;
      mesgul = true; el.classList.add("yukleniyor"); let ok = 0;
      for (let i = 0; i < files.length; i++) {
        durum.textContent = `Yükleniyor ${i + 1}/${files.length}…`;
        try {
          const { blob, w, h } = await kucult(files[i]);
          const yol = `${mekanId}/${uuid()}.jpg`;
          const up = await db.storage.from(BUCKET).upload(yol, blob, { contentType: "image/jpeg", cacheControl: "31536000", upsert: false });
          if (up.error) throw new Error(up.error.message);
          const { data, error } = await db.from("mekan_fotolar").insert({ mekan_id: mekanId, yol, sira: L.length, genislik: w, yukseklik: h }).select("id,yol,aciklama,sira,genislik,yukseklik").single();
          if (error) { await db.storage.from(BUCKET).remove([yol]); throw new Error(error.message); }
          L.push(data); ciz(); ok++;
        } catch (e) { toast(`${files[i].name}: ${e.message || "yüklenemedi"}`); }
      }
      durum.textContent = ok ? `${ok} fotoğraf eklendi.` : ""; mesgul = false; el.classList.remove("yukleniyor");
    });
    list.addEventListener("change", async e => {
      const a = e.target.closest("[data-acik]"); if (!a) return;
      const id = +a.closest("[data-id]").dataset.id, f = L.find(x => x.id === id), v = a.value.trim().slice(0, 200) || null;
      const { error } = await db.from("mekan_fotolar").update({ aciklama: v }).eq("id", id);
      if (error) return toast("Açıklama kaydedilemedi."); f.aciklama = v; durum.textContent = "Açıklama kaydedildi.";
    });
    list.addEventListener("click", async e => {
      const li = e.target.closest("[data-id]"); if (!li) return;
      const id = +li.dataset.id, i = L.findIndex(x => x.id === id); if (i < 0) return;
      if (e.target.closest("[data-sil]")) {
        if (!(await onay("Bu fotoğraf kalıcı olarak silinecek."))) return;
        const f = L[i];
        const { error } = await db.from("mekan_fotolar").delete().eq("id", id);
        if (error) return toast("Silinemedi: " + error.message);
        await db.storage.from(BUCKET).remove([f.yol]);
        L.splice(i, 1); ciz(); siraKaydet(); durum.textContent = "Fotoğraf silindi."; return;
      }
      let j = null;
      if (e.target.closest("[data-sol]")) j = i - 1; else if (e.target.closest("[data-sag]")) j = i + 1; else if (e.target.closest("[data-kapak]")) j = 0;
      if (j == null || j < 0 || j >= L.length) return;
      const [f] = L.splice(i, 1); L.splice(j, 0, f); ciz(); siraKaydet();
    });
    yukle();
    return { yenile: yukle };
  }

  // Google bilgileri kutusu (paneller için)
  function gDetayHtml(y, not) {
    if (!y) return "";
    const saat = Array.isArray(y.saatler) && y.saatler.length ? `<details class="gd-saat"><summary>Çalışma saatleri</summary>${y.saatler.map(t => `<div>${esc(t)}</div>`).join("")}</details>` : "";
    const yor = Array.isArray(y.yorumlar) && y.yorumlar.length ? `<details class="gd-saat"><summary>Son Google yorumları (${y.yorumlar.length})</summary><div class="gd-yor">${y.yorumlar.map(r => `<div class="gd-y"><div class="gd-yh"><b>${esc(r.yazar || "Google kullanıcısı")}</b><span>${"★".repeat(Math.max(0, Math.min(5, Math.round(r.puan || 0))))}<em>${esc(r.zaman || "")}</em></span></div><p>${esc(r.metin || "")}</p></div>`).join("")}</div></details>` : "";
    return `<div class="gd">
      <div class="gd-top">${y.puan != null ? `<span class="gd-p">★ ${Number(y.puan).toFixed(1).replace(".", ",")}</span><span class="sm">${nf(y.yorum_sayisi || 0)} Google yorumu</span>` : `<span class="sm">Google puanı yok.</span>`}
        ${y.detay_tarih ? `<span class="sm">· ${fmtD(y.detay_tarih)}</span>` : ""}</div>
      <div class="gd-info">${y.telefon ? `<span>☎ ${esc(y.telefon)}</span>` : ""}${guvenli(y.web) ? `<a href="${esc(y.web)}" target="_blank" rel="noopener noreferrer">${esc(y.web.replace(/^https?:\/\/(www\.)?/, "").slice(0, 40))} ↗</a>` : ""}${guvenli(y.url) ? `<a href="${esc(y.url)}" target="_blank" rel="noopener noreferrer">Google sayfası ↗</a>` : ""}</div>
      ${saat}${yor}${not ? `<p class="sm" style="margin-top:6px">${esc(not)}</p>` : ""}</div>`;
  }

  // Instagram girdisini tek biçime getir: https://www.instagram.com/kullanici/
  function instaTemiz(v) {
    const s = String(v || "").trim(); if (!s) return "";
    const m = s.match(/^@?([a-z0-9._]{1,30})$/i) || s.match(/instagram\.com\/([a-z0-9._]{1,30})/i);
    return m && !/^(p|reel|reels|stories|explore)$/i.test(m[1]) ? `https://www.instagram.com/${m[1]}/` : null;
  }

  window.ETDP = { esc, guvenli, kucult, fotoYoneticisi, gDetayHtml, instaTemiz, BUCKET };
})();

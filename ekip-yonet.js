/* eniyitavukdoner.com — yönetim paneli: çekim ekibi hesapları (kullanıcı adı + şifre) */
(function () {
  "use strict";
  const P = window.PANEL; if (!P) return;
  const $ = (s, r = document) => r.querySelector(s);
  const esc = P.esc, toast = P.toast;
  const ROL = { sunucu: "Tahsin abi · puan verir", ekip: "Çekim ekibi" };
  const kok = $("#ekipy"); if (!kok) return;
  const fmtDT = s => new Date(s).toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  async function fn(islem, body) {
    try {
      const { data, error } = await P.db.functions.invoke("ekip-yonet", { body: { islem, ...body } });
      if (error) { let m = error.message || "Bağlantı hatası"; try { const j = await error.context.json(); if (j && j.error) m = j.error; } catch (e) { /* */ } return { error: m }; }
      return data || {};
    } catch (e) { return { error: "Bağlantı hatası." }; }
  }
  // Okunaklı, telefonda kolay yazılan şifre: ör. "tavuk-4821-lavas"
  const KELIME = ["tavuk", "doner", "lavas", "ayran", "sos", "tursu", "pilav", "ekmek", "usta", "salata", "kibrit", "biber", "durum", "kepce", "tepsi", "kasar"];
  function sifreUret() {
    const r = new Uint32Array(3); crypto.getRandomValues(r);
    return `${KELIME[r[0] % KELIME.length]}-${String(1000 + r[1] % 9000)}-${KELIME[r[2] % KELIME.length]}`;
  }
  const girisAdresi = rol => rol === "sunucu" ? "eniyitavukdoner.com/panel/tahsin" : "eniyitavukdoner.com/ekip";

  function bilgiKutusu(u, sifre) {
    const metin = `Çekim paneli: https://${girisAdresi(u.rol)}\nKullanıcı adı: ${u.kullanici_adi}\nŞifre: ${sifre}`;
    $("#ekipy-bilgi").innerHTML = `<div class="ekipy-bilgi"><div><b>${esc(u.ad)} için giriş bilgisi</b><pre>${esc(metin)}</pre></div>
      <div class="ekipy-bilgi-a"><button type="button" class="btn btn-o btn-sm" data-kopya>Kopyala</button><button type="button" class="btn btn-line btn-sm" data-gizle>Kapat</button></div></div>
      <p class="sm">Bu şifre bir daha gösterilmez. Kopyalayıp kişiye WhatsApp'tan gönder.</p>`;
    $("[data-kopya]", $("#ekipy-bilgi")).onclick = async () => { try { await navigator.clipboard.writeText(metin); toast("Kopyalandı"); } catch (e) { toast("Kopyalanamadı, elle seç."); } };
    $("[data-gizle]", $("#ekipy-bilgi")).onclick = () => { $("#ekipy-bilgi").innerHTML = ""; };
    $("#ekipy-bilgi").scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  let L = [];
  async function ciz() {
    const box = $("#ekipy-liste"); box.innerHTML = `<div class="empty">Yükleniyor…</div>`;
    const d = await fn("liste", {});
    if (d.error) { box.innerHTML = `<div class="empty" style="color:var(--err)">${esc(d.error)}</div>`; return; }
    L = d.uyeler || [];
    const sunucuVar = L.some(u => u.rol === "sunucu");
    const sel = $("#ekipy-form").rol; if (sunucuVar && sel.value === "sunucu") sel.value = "ekip";
    sel.querySelector('option[value="sunucu"]').disabled = sunucuVar;
    box.innerHTML = !L.length ? `<div class="empty">Henüz kimse eklenmemiş. Aşağıdan Tahsin abiyi ve çekim ekibini ekle.</div>` :
      `<table class="tbl ekipy-tbl"><thead><tr><th>Kişi</th><th>Kullanıcı adı</th><th>Rol</th><th>Son giriş</th><th></th></tr></thead><tbody>${L.map(u => `
        <tr data-k="${esc(u.kullanici_adi)}" class="${u.aktif ? "" : "pasif"}"><td><b>${esc(u.ad)}</b>${u.aktif ? "" : ` <span class="badge b-uygun_degil">erişim kapalı</span>`}</td>
        <td><code>${esc(u.kullanici_adi)}</code></td><td>${esc(ROL[u.rol] || u.rol)}</td><td class="sm">${u.son ? fmtDT(u.son) : "henüz girmedi"}</td>
        <td class="ekipy-a"><button type="button" class="icon-btn" data-sifre>Şifre değiştir</button><button type="button" class="icon-btn" data-durum>${u.aktif ? "Erişimi kapat" : "Erişimi aç"}</button></td></tr>`).join("")}</tbody></table>`;
  }

  kok.addEventListener("click", async e => {
    const tr = e.target.closest("tr[data-k]");
    if (e.target.closest("[data-uret]")) { const f = $("#ekipy-form"); f.sifre.value = sifreUret(); f.sifre.type = "text"; return; }
    if (!tr) return;
    const u = L.find(x => x.kullanici_adi === tr.dataset.k); if (!u) return;
    if (e.target.closest("[data-sifre]")) {
      const yeni = sifreUret();
      if (!(await P.confirmBox(`<b>${esc(u.ad)}</b> için yeni şifre oluşturulacak: <code>${esc(yeni)}</code><br>Eski şifresi çalışmaz olur.`, "Şifreyi değiştir"))) return;
      const d = await fn("sifre", { kullanici_adi: u.kullanici_adi, sifre: yeni });
      if (d.error) return toast(d.error);
      toast("Şifre değiştirildi"); bilgiKutusu(u, yeni);
    }
    if (e.target.closest("[data-durum]")) {
      if (u.aktif && !(await P.confirmBox(`<b>${esc(u.ad)}</b> artık çekim paneline giremeyecek. Hesap silinmez; istediğinde yeniden açabilirsin.`, "Erişimi kapat"))) return;
      const d = await fn("durum", { kullanici_adi: u.kullanici_adi, aktif: !u.aktif });
      if (d.error) return toast(d.error);
      toast(u.aktif ? "Erişim kapatıldı" : "Erişim açıldı"); ciz();
    }
  });

  $("#ekipy-form").addEventListener("submit", async e => {
    e.preventDefault(); const f = e.currentTarget, b = $("button[type=submit]", f);
    const u = { ad: f.ad.value.trim(), kullanici_adi: f.kadi.value.trim().toLowerCase(), rol: f.rol.value }, sifre = f.sifre.value;
    if (!u.ad || !u.kullanici_adi || !sifre) return toast("Ad, kullanıcı adı ve şifre gerekli.");
    b.disabled = true; const d = await fn("ekle", { ...u, sifre }); b.disabled = false;
    if (d.error) return toast(d.error);
    f.reset(); f.sifre.type = "password"; toast(`${u.ad} eklendi`); bilgiKutusu(u, sifre); ciz();
  });
  $("#ekipy-form").kadi.addEventListener("input", e => {
    const v = e.target.value, t = v.toLocaleLowerCase("tr-TR").replace(/ı/g, "i").replace(/ş/g, "s").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ö/g, "o").replace(/ç/g, "c").replace(/\s+/g, "").replace(/[^a-z0-9._-]/g, "");
    if (t !== v) e.target.value = t;
  });

  window.EKIPY = { ciz };
})();

/* eniyitavukdoner.com — çekim paneli (Tahsin abi + çekim ekibi) */
(function () {
  "use strict";
  if (window.top !== window.self) { document.documentElement.innerHTML = ""; return; }
  const C = window.SITE_CONFIG || {};
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const TR = "tr-TR", ALAN = "ekip.eniyitavukdoner.com";
  const KRITER = C.KRITERLER || [];
  const KAD = Object.fromEntries(KRITER);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const guvenli = u => /^https:\/\/[^\s"'<>]+$/i.test(String(u || "").trim()) ? String(u).trim() : "";
  const fP = p => { if (p == null || p === "") return "–"; const n = Math.round(Number(p) * 10) / 10; return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ","); };
  const fmtD = s => { try { return new Date(String(s).length === 10 ? s + "T12:00:00" : s).toLocaleDateString(TR, { day: "numeric", month: "long", weekday: "long" }); } catch (e) { return ""; } };
  const ls = { get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* */ } }, del(k) { try { localStorage.removeItem(k); } catch (e) { /* */ } } };
  const kadiTemiz = s => String(s || "").trim().toLocaleLowerCase(TR).replace(/ı/g, "i").replace(/ş/g, "s").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ö/g, "o").replace(/ç/g, "c");

  const db = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, storageKey: "etd-cekim", detectSessionInUrl: false } });

  function toast(msg) {
    let t = $(".toast"); if (!t) { t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
    t.textContent = msg; t.classList.add("show"); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 3200);
  }
  const modal = $("#modal");
  let modalKapat = null;
  function modalAc(baslik, html, kapanirken) {
    $("#modal-title").textContent = baslik; $("#modal-body").innerHTML = html; modal.hidden = false; document.body.classList.add("ck-kilit");
    modalKapat = kapanirken || null;
  }
  async function kapat(zorla) {
    if (!zorla && modalKapat && !(await modalKapat())) return;
    modal.hidden = true; $("#modal-body").innerHTML = ""; modalKapat = null; document.body.classList.remove("ck-kilit");
  }
  modal.addEventListener("click", e => { if (e.target.closest("[data-close]")) kapat(); });
  addEventListener("keydown", e => { if (e.key === "Escape" && !modal.hidden) kapat(); });
  const mesaj = (f, t) => { const m = $(".form-msg", f); m.textContent = t || ""; m.className = "form-msg" + (t ? " err" : ""); };

  /* ---------- giriş ---------- */
  const lf = $("#login-form");
  const ekran = ad => { $("#login").hidden = ad !== "login"; $("#app").hidden = ad !== "app"; };
  const yolKadi = (location.pathname.match(/^\/panel\/([a-z0-9._-]+)\/?$/i) || [])[1];
  if (yolKadi && !lf.kadi.value) lf.kadi.value = yolKadi.toLowerCase();
  lf.addEventListener("submit", async e => {
    e.preventDefault(); const b = $("button[type=submit]", lf);
    const k = lf.kadi.value.trim(), p = lf.password.value;
    if (!k || !p) return mesaj(lf, "Kullanıcı adını ve şifreni yaz.");
    b.disabled = true; mesaj(lf, "");
    const email = k.includes("@") ? k.toLowerCase() : `${kadiTemiz(k)}@${ALAN}`;
    const { error } = await db.auth.signInWithPassword({ email, password: p });
    b.disabled = false;
    if (error) return mesaj(lf, /rate|many/i.test(error.message) ? "Çok fazla deneme yapıldı, birkaç dakika sonra tekrar dene." : /banned/i.test(error.message) ? "Bu hesabın erişimi kapatılmış." : "Kullanıcı adı ya da şifre hatalı.");
    lf.password.value = ""; basla();
  });
  $("#logout").addEventListener("click", async () => {
    if (TASLAK_VAR() && !confirm("Kaydedilmemiş puanın var. Yine de çıkılsın mı?")) return;
    await db.auth.signOut(); location.replace(location.pathname);
  });

  /* ---------- veri ---------- */
  let D = null, BEN = null, SEC = null, SON_JSON = "";
  const SUNUCU = () => BEN && (BEN.rol === "sunucu");
  const TASLAK_VAR = () => !modal.hidden && !!modalKapat;

  async function basla() {
    const { data: { session } } = await db.auth.getSession();
    if (!session) { ekran("login"); return; }
    const ok = await yukle(true);
    if (!ok) return;
    ekran("app");
    ciz();
  }

  async function yukle(ilk) {
    const { data, error } = await db.rpc("cekim_verisi");
    if (error) {
      if (ilk) {
        if (/yetki|42501/i.test(error.message + error.code)) { await db.auth.signOut(); ekran("login"); mesaj(lf, "Bu hesabın çekim paneline erişimi yok."); }
        else { ekran("login"); mesaj(lf, "Bağlantı sorunu. Sayfayı yenile."); }
      }
      return false;
    }
    const j = JSON.stringify(data);
    const degisti = j !== SON_JSON; SON_JSON = j;
    D = data; BEN = data.ben || {};
    $("#ck-ben").textContent = BEN.rol === "sunucu" ? `${BEN.ad} · puan veren` : BEN.rol === "ekip" ? `${BEN.ad} · çekim ekibi` : "Yönetici önizlemesi";
    return ilk ? true : degisti;
  }

  function varsayilanBolum() {
    const L = D.bolumler || []; if (!L.length) return null;
    const bugun = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });
    const plan = L.filter(b => b.durum === "planlaniyor");
    const yakin = plan.filter(b => b.cekim_tarihi && b.cekim_tarihi >= bugun).sort((a, b) => a.cekim_tarihi.localeCompare(b.cekim_tarihi))[0];
    return (yakin || plan[0] || L.filter(b => b.durum === "cekildi").pop() || L[L.length - 1]).id;
  }

  /* ---------- çizim ---------- */
  const DURUM = { planlaniyor: "Planlanıyor", cekildi: "Çekildi", yayinda: "Yayında" };
  const yer = m => [m.ilce, m.il === "Yurt dışı" ? m.ulke : m.il].filter(Boolean).join(" · ");
  const tel = t => { const d = String(t || "").replace(/[^\d+]/g, ""); return d.startsWith("+") ? d : d.startsWith("0") ? "+90" + d.slice(1) : d ? "+90" + d : ""; };
  const yolTarifi = m => m.lat != null ? `https://www.google.com/maps/dir/?api=1&destination=${m.lat},${m.lng}` : guvenli(m.maps) || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([m.ad, m.ilce, m.il].filter(Boolean).join(" "))}`;
  const igAd = u => (String(u || "").match(/instagram\.com\/([a-z0-9._]{1,30})/i) || [])[1];
  function bugunSaat(s) {
    if (!Array.isArray(s) || !s.length) return null;
    const g = new Date().toLocaleDateString(TR, { weekday: "long", timeZone: "Europe/Istanbul" }).toLocaleLowerCase(TR);
    const r = s.find(x => String(x).toLocaleLowerCase(TR).startsWith(g));
    return r ? String(r).replace(/^[^:]+:\s*/, "") : null;
  }
  function rotaLink(L) {
    const n = L.filter(m => m.lat != null); if (!n.length) return "";
    const son = n[n.length - 1], ara = n.slice(0, -1).slice(0, 9);
    return `https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=${son.lat},${son.lng}` + (ara.length ? `&waypoints=${encodeURIComponent(ara.map(m => `${m.lat},${m.lng}`).join("|"))}` : "");
  }

  function puanHtml(p) {
    const k = KRITER.filter(([x]) => p.puanlar && p.puanlar[x] != null);
    return `<div class="ck-puan">
      <div class="ck-puan-h"><span>${esc(p.ad)}</span><b>${fP(p.toplam)}<small>/100</small></b></div>
      ${k.length ? `<div class="ck-krit">${k.map(([x, ad]) => `<span><em>${esc(ad)}</em><b>${fP(p.puanlar[x])}</b></span>`).join("")}</div>` : ""}
      ${p.yorum ? `<p class="ck-yorum">“${esc(p.yorum)}”</p>` : ""}</div>`;
  }

  function kart(m, i) {
    const bugun = bugunSaat(m.saatler), ig = igAd(m.instagram), t = tel(m.telefon);
    const puanlar = m.puanlar || [], benim = puanlar.find(p => BEN && p.kisi === BEN.kisi);
    const taslak = SUNUCU() && ls.get(`etd-cekim-taslak-${m.oneri_id}`);
    const nedenler = (m.nedenler || []).filter(n => n && n.neden);
    const yorumlar = Array.isArray(m.yorumlar) ? m.yorumlar : [];
    return `<article class="ck-kart" id="m-${m.oneri_id}" data-id="${m.oneri_id}">
      <header class="ck-kh"><span class="ck-no">${i + 1}</span><div class="ck-kt"><h3>${esc(m.ad)}</h3><small>${esc([yer(m), m.tur].filter(Boolean).join(" · "))}</small></div>
        ${puanlar.length ? `<span class="ck-rozet">${fP(puanlar[0].toplam)}</span>` : ""}</header>
      ${m.kapali ? `<p class="ck-uyari">Google'da “kalıcı olarak kapandı” görünüyor.</p>` : ""}
      ${m.not ? `<p class="ck-not">${esc(m.not)}</p>` : ""}
      ${m.adres ? `<p class="ck-adres">${esc(m.adres)}</p>` : ""}
      <div class="ck-chips">
        <a class="ck-chip ck-yol" href="${esc(yolTarifi(m))}" target="_blank" rel="noopener noreferrer">Yol tarifi ↗</a>
        ${t ? `<a class="ck-chip" href="tel:${esc(t)}">☎ ${esc(m.telefon)}</a>` : ""}
        ${ig ? `<a class="ck-chip ck-ig" href="https://www.instagram.com/${esc(ig)}/" target="_blank" rel="noopener noreferrer">@${esc(ig)}</a>` : ""}
        ${m.gpuan != null ? `<a class="ck-chip ck-g" href="${esc(guvenli(m.maps) || yolTarifi(m))}" target="_blank" rel="noopener noreferrer">★ ${fP(m.gpuan)} <small>${Number(m.gyorum || 0).toLocaleString(TR)}</small></a>` : ""}
        ${guvenli(m.web) && !/instagram\.com/i.test(m.web) ? `<a class="ck-chip" href="${esc(m.web)}" target="_blank" rel="noopener noreferrer">${esc(m.web.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "").slice(0, 28))} ↗</a>` : ""}
      </div>
      ${bugun ? `<p class="ck-saat"><b>Bugün:</b> ${esc(bugun)}</p>` : ""}
      <div class="ck-alt">
        ${Array.isArray(m.saatler) && m.saatler.length ? `<details data-k="s${m.oneri_id}"><summary>Çalışma saatleri</summary>${m.saatler.map(x => `<div>${esc(x)}</div>`).join("")}</details>` : ""}
        ${nedenler.length ? `<details data-k="n${m.oneri_id}" ${SUNUCU() ? "open" : ""}><summary>Neden gidiyoruz? (${nedenler.length})</summary>${nedenler.map(n => `<blockquote>${esc(n.neden)}${n.kim ? `<cite>— ${esc(n.kim)}</cite>` : ""}</blockquote>`).join("")}</details>` : ""}
        ${yorumlar.length ? `<details data-k="y${m.oneri_id}"><summary>Son Google yorumları (${yorumlar.length})</summary>${yorumlar.map(r => `<blockquote><span class="ck-yp">${"★".repeat(Math.max(0, Math.min(5, Math.round(r.puan || 0))))}</span> ${esc(r.metin || "")}<cite>${esc(r.yazar || "")}${r.zaman ? " · " + esc(r.zaman) : ""}</cite></blockquote>`).join("")}</details>` : ""}
      </div>
      <section class="ck-puanlar">
        ${puanlar.length ? puanlar.map(puanHtml).join("") : `<p class="ck-bos-p">${SUNUCU() ? "Henüz puan vermedin." : "Henüz puan verilmedi."}</p>`}
        ${SUNUCU() ? `<button type="button" class="btn ${benim ? "btn-line" : "btn-o"} full ck-puanla" data-puanla="${m.oneri_id}">${taslak ? "Taslağa devam et" : benim ? "Puanı düzenle" : "Puan ver"}</button>` : ""}
      </section>
    </article>`;
  }

  function ozet(b) {
    const L = (b.mekanlar || []).map((m, i) => ({ m, i, p: (m.puanlar || [])[0] })).filter(x => x.p && x.p.toplam != null);
    if (!L.length) return "";
    const s = [...L].sort((a, b) => b.p.toplam - a.p.toplam);
    return `<section class="ck-ozet"><div class="ck-ozet-h"><h3>Puan tablosu</h3><button type="button" class="btn btn-line btn-sm" data-kopyala>Kopyala</button></div>
      <ol>${s.map(x => `<li><a href="#m-${x.m.oneri_id}"><span>${esc(x.m.ad)}</span><b>${fP(x.p.toplam)}</b></a></li>`).join("")}</ol>
      <p class="sm">${L.length}/${b.mekanlar.length} mekân puanlandı.</p></section>`;
  }
  function ozetMetni(b) {
    const satir = [];
    satir.push(`${b.no ? "Bölüm " + b.no + " — " : ""}${b.baslik}`);
    (b.mekanlar || []).forEach((m, i) => {
      const p = (m.puanlar || [])[0];
      satir.push("", `${i + 1}. ${m.ad}${p && p.toplam != null ? ` — ${fP(p.toplam)}/100` : " — puan yok"}`);
      if (p) {
        KRITER.forEach(([k, ad]) => { if (p.puanlar && p.puanlar[k] != null) satir.push(`   ${ad}: ${fP(p.puanlar[k])}`); });
        if (p.yorum) satir.push(`   Yorum: ${p.yorum}`);
      }
    });
    return satir.join("\n");
  }

  function ciz() {
    const L = D.bolumler || [];
    const h = (location.hash.match(/^#b\/(\d+)/) || [])[1];
    if (h && L.some(b => b.id === +h)) SEC = +h;
    if (!SEC || !L.some(b => b.id === SEC)) SEC = varsayilanBolum();
    $("#ck-bolumler").innerHTML = L.length > 1 ? L.map(b => `<a href="#b/${b.id}" class="ck-bt${b.id === SEC ? " on" : ""}" aria-current="${b.id === SEC}"><b>${b.no ? "Bölüm " + b.no : "Bölüm"}</b><small>${esc(DURUM[b.durum] || b.durum)}${b.cekim_tarihi ? " · " + esc(new Date(b.cekim_tarihi + "T12:00:00").toLocaleDateString(TR, { day: "numeric", month: "short" })) : ""}</small></a>`).join("") : "";
    const b = L.find(x => x.id === SEC);
    if (!b) {
      $("#ck-icerik").innerHTML = `<div class="ck-bos"><div aria-hidden="true">🎬</div><h3>Şu an planlanan bölüm yok</h3><p>Egemen yeni bir bölüm açıp mekânları eklediğinde burada görünür.</p></div>`;
      return;
    }
    const M = b.mekanlar || [], rl = rotaLink(M);
    $("#ck-icerik").innerHTML = `
      <section class="ck-bh">
        <span class="ck-durum d-${esc(b.durum)}">${esc(DURUM[b.durum] || b.durum)}</span>
        <h2>${b.no ? `<small>Bölüm ${b.no}</small>` : ""}${esc(b.baslik)}</h2>
        <p class="ck-meta">${[b.cekim_tarihi ? "Çekim: " + esc(fmtD(b.cekim_tarihi)) : "", b.sehir ? esc(b.sehir) : "", `${M.length} mekân`].filter(Boolean).join(" · ")}</p>
        ${b.aciklama ? `<p class="ck-acik">${esc(b.aciklama)}</p>` : ""}
        ${rl ? `<a class="btn btn-o btn-sm" href="${esc(rl)}" target="_blank" rel="noopener noreferrer">Bütün rotayı Google Maps'te aç ↗</a>` : ""}
      </section>
      ${ozet(b)}
      <div class="ck-liste">${M.length ? M.map(kart).join("") : `<div class="ck-bos"><p>Bu bölüme henüz mekân eklenmemiş.</p></div>`}</div>`;
  }

  addEventListener("hashchange", () => { if (/^#b\/\d+/.test(location.hash) && D) { ciz(); scrollTo(0, 0); } });
  $("#ck-icerik").addEventListener("click", async e => {
    const p = e.target.closest("[data-puanla]"); if (p) return puanla(+p.dataset.puanla);
    if (e.target.closest("[data-kopyala]")) {
      const b = (D.bolumler || []).find(x => x.id === SEC); if (!b) return;
      try { await navigator.clipboard.writeText(ozetMetni(b)); toast("Puanlar kopyalandı"); }
      catch (er) { modalAc("Puanlar", `<textarea class="ck-kopya" rows="14" readonly>${esc(ozetMetni(b))}</textarea>`); }
      return;
    }
    const a = e.target.closest('a[href^="#m-"]');
    if (a) { e.preventDefault(); const k = $(a.getAttribute("href")); if (k) { k.scrollIntoView({ behavior: "smooth", block: "start" }); k.classList.add("vurgu"); setTimeout(() => k.classList.remove("vurgu"), 1600); } }
  });

  /* ---------- puan verme (sadece Tahsin abi) ---------- */
  function puanla(id) {
    if (!SUNUCU()) return;
    const b = (D.bolumler || []).find(x => x.id === SEC), m = b && b.mekanlar.find(x => x.oneri_id === id); if (!m) return;
    const kayit = (m.puanlar || []).find(p => p.kisi === BEN.kisi) || {};
    const tk = `etd-cekim-taslak-${id}`, taslak = ls.get(tk);
    const geri = taslak && (!kayit.updated_at || taslak.t > Date.parse(kayit.updated_at));
    const P0 = geri ? taslak.puanlar || {} : kayit.puanlar || {}, Y0 = geri ? taslak.yorum || "" : kayit.yorum || "";
    let kirli = !!geri;
    modalAc(m.ad, `
      ${geri ? `<p class="ck-bilgi">Kaydedilmemiş taslağın geri yüklendi. <button type="button" class="linkish" data-at>Taslağı at</button></p>` : ""}
      <form id="cp-form" novalidate>
        <div class="cp-top"><span>Toplam</span><b data-top>–</b><small>/100</small><em data-n></em></div>
        <p class="sm cp-ip">Her kriteri 0–10 arası kaydır. Dokunmadığın kriter boş kalır; toplam, girdiğin kriterlerin ortalamasıdır.</p>
        <div class="cp-list">${KRITER.map(([k, ad]) => { const v = P0[k], has = v != null;
          return `<div class="cp-r${has ? "" : " bos"}" data-k="${k}"><label for="cp-${k}">${esc(ad)}</label><output>${has ? fP(v) : "–"}</output>
            <input id="cp-${k}" type="range" min="0" max="10" step="0.5" value="${has ? v : 5}"><button type="button" class="cp-x" aria-label="${esc(ad)} puanını temizle">×</button></div>`; }).join("")}</div>
        <label class="field" style="margin-top:14px"><span>Yorumun <small>(isteğe bağlı)</small></span><textarea name="yorum" rows="4" maxlength="4000" placeholder="Tavuk, ekmek, sos, usta… Neyi sevdin, neyi sevmedin?">${esc(Y0)}</textarea></label>
        <div class="cp-alt"><button type="button" class="btn btn-line" data-close>Vazgeç</button><button class="btn btn-o" type="submit">Kaydet</button></div>
      </form>`, async () => !kirli || confirm("Kaydetmeden kapatılsın mı? (Taslağın bu telefonda saklanıyor.)"));
    const f = $("#cp-form");
    const topla = () => {
      const v = {}; $$(".cp-r:not(.bos)", f).forEach(r => v[r.dataset.k] = Number($("input", r).value));
      const n = Object.keys(v).length, t = n ? Math.round(Object.values(v).reduce((a, c) => a + c, 0) / n * 100) / 10 : null;
      $("[data-top]", f).textContent = fP(t); $("[data-n]", f).textContent = `${n}/${KRITER.length} kriter`;
      return { v, n };
    };
    const taslakYaz = () => { const s = topla(); ls.set(tk, { t: Date.now(), puanlar: s.v, yorum: f.yorum.value }); };
    let tt; const degisti = () => { kirli = true; clearTimeout(tt); tt = setTimeout(taslakYaz, 300); };
    f.addEventListener("input", e => {
      const r = e.target.closest(".cp-r"); if (r) { r.classList.remove("bos"); $("output", r).textContent = fP(e.target.value); topla(); }
      degisti();
    });
    f.addEventListener("click", e => {
      const x = e.target.closest(".cp-x"); if (!x) return; const r = x.closest(".cp-r");
      r.classList.add("bos"); $("output", r).textContent = "–"; topla(); degisti();
    });
    const at = $("[data-at]"); if (at) at.addEventListener("click", () => { ls.del(tk); kirli = false; kapat(true).then(() => puanla(id)); });
    topla();
    f.addEventListener("submit", async e => {
      e.preventDefault(); const s = topla(), y = f.yorum.value.trim();
      if (!s.n && !y) return toast("En az bir kriter puanla ya da yorum yaz.");
      const btn = $("button[type=submit]", f); btn.disabled = true; btn.textContent = "Kaydediliyor…";
      const { data, error } = await db.rpc("cekim_puan_kaydet", { p_oneri: id, p_puanlar: s.v, p_yorum: y || null });
      btn.disabled = false; btn.textContent = "Kaydet";
      if (error) return toast(/fetch|network/i.test(error.message) ? "İnternet yok gibi. Taslağın saklandı, bağlanınca tekrar Kaydet'e bas." : "Kaydedilemedi: " + error.message);
      ls.del(tk); kirli = false; await kapat(true);
      await yukle(false); ciz();
      toast(data && data.toplam != null ? `Kaydedildi · ${fP(data.toplam)}/100` : "Kaydedildi");
      const k = $(`#m-${id}`); if (k) k.scrollIntoView({ block: "center" });
    });
  }

  /* ---------- yenileme ---------- */
  async function tazele(elle) {
    if (!D || !modal.hidden) return;
    const acik = new Set($$("#ck-icerik details[open]").map(d => d.dataset.k)), y = scrollY;
    const degisti = await yukle(false);
    if (degisti || elle) {
      ciz(); $$("#ck-icerik details").forEach(d => { if (acik.has(d.dataset.k)) d.open = true; }); scrollTo(0, y);
    }
  }
  $("#ck-yenile").addEventListener("click", async e => { const b = e.currentTarget; b.disabled = true; await tazele(true); b.disabled = false; toast("Güncellendi"); });
  setInterval(() => { if (document.visibilityState === "visible") tazele(false); }, 45000);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") tazele(false); });
  db.auth.onAuthStateChange(ev => { if (ev === "SIGNED_OUT") ekran("login"); });

  basla();
})();

(function () {
  "use strict";
  var SB = "https://glonoumtcfrzjybuslnw.supabase.co";
  var KEY = "sb_publishable_8aQzEW5k8xWrFZxtoSrhsQ_FpqOkrao";
  var ONAY = "v2 (2026-11) · Bu proje ve açılış haberleri için bana e-posta gönderilmesine onay veriyorum. · kaynak: eniyitavukdoner.com yakında sayfası";
  var $ = function (s) { return document.querySelector(s); };

  /* ---- ilerleme çubuğu: hızlıca ~%87'ye çıkar, sonra çok yavaş ilerler, %100 olmaz ---- */
  var dolu = $("#dolu"), yuzde = $("#yuzde"), durum = $("#durum"), ilerleme = $("#ilerleme");
  var mesajlar = ["Ocak yakılıyor…", "Tavuklar marine ediliyor…", "Şiş diziliyor…", "Usta bıçağı biliyor…",
    "Lavaşlar ısınıyor…", "Turşular diziliyor…", "Sos kıvamına geliyor…", "Puanlar hesaplanıyor…",
    "Harita çiziliyor…", "Son tadım yapılıyor…", "Servis tabakları hazır…"];
  var hedef = 87, deger = 0, mi = 0;
  var azalt = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  function ciz(v) {
    deger = v;
    dolu.style.width = v + "%";
    yuzde.textContent = "%" + Math.floor(v);
    ilerleme.setAttribute("aria-valuenow", String(Math.floor(v)));
  }
  if (azalt) ciz(hedef);
  else {
    setTimeout(function () { ciz(hedef); }, 250);
    var say = 0, sayac = setInterval(function () { say += 3; yuzde.textContent = "%" + Math.min(say, hedef); if (say >= hedef) clearInterval(sayac); }, 40);
    setInterval(function () { if (deger < 97) ciz(Math.min(97, deger + Math.random() * 0.6)); }, 2600);
  }
  setInterval(function () {
    durum.classList.add("gizle");
    setTimeout(function () { mi = (mi + 1) % mesajlar.length; durum.textContent = mesajlar[mi]; durum.classList.remove("gizle"); }, 260);
  }, 2400);

  /* ---- açılınca haber ver ---- */
  var f = $("#haber-form"), kart = $("#haber-kart"), msg = $("#mesaj"), btn = f.querySelector(".gonder");
  function hata(t) { msg.className = "mesaj hata"; msg.textContent = t; }
  f.addEventListener("submit", function (e) {
    e.preventDefault();
    if (f.web.value) return;
    msg.className = "mesaj"; msg.textContent = "";
    var mail = f.eposta.value.trim().toLowerCase();
    var okMail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail) && mail.length <= 120;
    f.eposta.setAttribute("aria-invalid", okMail ? "false" : "true");
    [f.ileti_onay, f.kvkk_onay].forEach(function (c) { c.closest(".check").classList.toggle("hata", !c.checked); });
    if (!okMail) { hata("Geçerli bir e-posta adresi yazar mısın?"); f.eposta.focus(); return; }
    if (!f.ileti_onay.checked) { hata("Sana haber verebilmemiz için e-posta onayı gerekli."); f.ileti_onay.focus(); return; }
    if (!f.kvkk_onay.checked) { hata("Devam etmek için aydınlatma metnini onaylaman gerekiyor."); f.kvkk_onay.focus(); return; }
    btn.disabled = true; btn.textContent = "…";
    fetch(SB + "/rest/v1/bekleme_listesi", {
      method: "POST",
      headers: { "apikey": KEY, "Authorization": "Bearer " + KEY, "Content-Type": "application/json", "Prefer": "return=minimal" },
      body: JSON.stringify({ eposta: mail, ileti_onay: true, kvkk_onay: true, onay_metni: ONAY })
    }).then(function (r) {
      if (r.ok) return { ok: true };
      return r.json().catch(function () { return {}; }).then(function (j) { return { ok: false, kod: j && j.code, m: j && j.message }; });
    }).catch(function () { return { ok: false }; }).then(function (s) {
      btn.disabled = false; btn.textContent = "Haber ver";
      var dup = !s.ok && s.kod === "23505";
      if (!s.ok && !dup) { hata(/Çok fazla|yoğun/i.test(s.m || "") ? "Çok sık denedin, biraz sonra tekrar dener misin?" : "Bir sorun oldu, birazdan tekrar dener misin?"); return; }
      if (dup) { $("#tamam-b").textContent = "Zaten listedesin!"; $("#tamam-p").textContent = "Bu e-posta zaten kayıtlı. Site açıldığı gün ilk sen duyacaksın."; }
      kart.classList.add("bitti");
    });
  });
})();

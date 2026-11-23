/* eniyitavukdoner.com — ana sayfa "Karakterler" bölümü */
(function () {
  "use strict";
  var K = window.KARAKTER, C = window.SITE_CONFIG || {};
  var grid = document.getElementById("kar-grid"), panel = document.getElementById("kar-panel");
  if (!K || !grid) return;
  var esc = K.esc, TR = "tr-TR", MEK = null, SECILI = null;
  var yer = function (d) { return [d.ilce, d.il === "Yurt dışı" ? d.ulke : d.il].filter(Boolean).join(", "); };

  grid.innerHTML = K.L.map(function (c) {
    return '<button type="button" class="kar-k" data-k="' + c.k + '" aria-pressed="false" aria-controls="kar-panel">' +
      K.sticker(c.k, { w: 170, alt: c.ad + " Dönerci" }) + "<small>" + esc(c.kisa) + '</small><em data-say hidden></em></button>';
  }).join("");

  function sayilar() {
    if (!MEK) return;
    grid.querySelectorAll(".kar-k").forEach(function (b) {
      var n = MEK.filter(function (m) { return K.liste(m.karakterler).indexOf(b.dataset.k) > -1; }).length, em = b.querySelector("[data-say]");
      em.textContent = n ? n + " dükkân" : ""; em.hidden = !n;
    });
  }
  function ciz() {
    var c = K.bul(SECILI);
    grid.querySelectorAll(".kar-k").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.k === SECILI)); });
    if (!c) { panel.hidden = true; return; }
    panel.style.setProperty("--kr", c.renk);
    var l = (MEK || []).filter(function (m) { return K.liste(m.karakterler).indexOf(c.k) > -1; })
      .sort(function (a, b) { return (K.kapi(a).indexOf(c.k) > -1 ? 0 : 1) - (K.kapi(b).indexOf(c.k) > -1 ? 0 : 1) || a.ad.localeCompare(b.ad, TR); });
    panel.innerHTML = '<div class="kar-panel-h">' + K.sticker(c.k, { w: 70, alt: "" }) + "<div><h3>" + esc(c.ad) + " Dönerci</h3><p>" + esc(c.uzun) + "</p></div></div>" +
      (MEK == null ? '<p class="kar-bos">Dükkânlar yükleniyor…</p>' :
        l.length ? '<div class="mb-l">' + l.map(function (m) { var a = K.ana(m), kapida = K.kapi(m).indexOf(c.k) > -1;
          return '<a class="mb" href="mekan.html?id=' + m.id + '" style="--kr:' + K.bul(a).renk + '">' + K.sticker(a, { w: 52, alt: "" }) + "<span><b>" + esc(m.ad) + "</b><small>" + esc(yer(m)) + (kapida ? " · kapısında bu sticker var" : "") + "</small></span></a>"; }).join("") + "</div>"
        : '<p class="kar-bos">Bu karakteri henüz hiçbir dükkâna yakıştırmadık. Bölümler yayınlandıkça burası dolacak. Aklında bir dükkân mı var? <a href="#oner">Bize öner</a>.</p>');
    panel.hidden = false;
  }
  grid.addEventListener("click", function (e) {
    var b = e.target.closest(".kar-k"); if (!b) return;
    SECILI = SECILI === b.dataset.k ? null : b.dataset.k; ciz();
    if (SECILI && panel.getBoundingClientRect().top > innerHeight * .7) panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });

  function yukle() {
    if (!window.supabase || !C.SUPABASE_URL) { MEK = []; sayilar(); ciz(); return; }
    var db = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    db.from("mekanlar").select("id,ad,il,ilce,ulke,karakterler,kapi").eq("yayinda", true).then(function (r) {
      MEK = (r.data || []).filter(function (m) { return K.liste(m.karakterler).length; }); sayilar(); ciz();
    }, function () { MEK = []; ciz(); });
  }
  var ilk = new URLSearchParams(location.search).get("karakter");
  if (ilk && K.bul(ilk)) { SECILI = K.bul(ilk).k; ciz(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", yukle); else yukle();
  if (ilk) addEventListener("load", function () { setTimeout(function () { var s = document.getElementById("karakterler"); if (s) s.scrollIntoView(); }, 400); });
})();

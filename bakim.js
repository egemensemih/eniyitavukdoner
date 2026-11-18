/* eniyitavukdoner.com — bakım / "yakında" anahtarı
   ACIK = true  → ziyaretçiler /yakinda/ sayfasını görür
   ACIK = false → site normal açılır (/yakinda/ ana sayfaya yönlenir)
   Ekip önizlemesi: herhangi bir sayfaya ?onizleme=denedik-756879cd ekleyip bir kez açın
   (bu tarayıcı hatırlar). Kapatmak için ?onizleme=kapat */
(function () {
  "use strict";
  var ACIK = true;
  var ANAHTAR = "denedik-756879cd";
  var s = document.currentScript, yakinda = s && s.getAttribute("data-sayfa") === "yakinda";
  var izinli = false;
  try {
    var o = new URLSearchParams(location.search).get("onizleme");
    if (o === ANAHTAR) localStorage.setItem("etd-onizleme", "1");
    if (o === "kapat") localStorage.removeItem("etd-onizleme");
    izinli = localStorage.getItem("etd-onizleme") === "1";
  } catch (e) {}
  if (yakinda) { if (!ACIK) location.replace("/"); return; }
  if (!ACIK || izinli) return;
  document.documentElement.style.visibility = "hidden";
  location.replace("/yakinda/");
})();

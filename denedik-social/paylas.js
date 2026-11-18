(function () {
  "use strict";
  var b = document.getElementById("paylas"), t = document.getElementById("toast"), url = location.origin + location.pathname;
  function goster(m) { t.textContent = m; t.classList.add("on"); clearTimeout(t._h); t._h = setTimeout(function () { t.classList.remove("on"); }, 2400); }
  if (!b) return;
  b.addEventListener("click", function () {
    if (navigator.share) { navigator.share({ title: "Denedik · Sosyal Medya Hesapları", url: url }).catch(function () {}); return; }
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(function () { goster("Bağlantı kopyalandı"); }, function () { goster(url); });
    else goster(url);
  });
})();

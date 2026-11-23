/* eniyitavukdoner.com — döner karakterleri (kapı sticker'ları)
   Mekânlara puan vermiyoruz; her dükkâna yakıştırdığımız karakterleri veriyoruz.
   mekanlar.karakterler dizisinin ilk elemanı "ana karakter"dir (kapıdaki sticker). */
(function () {
  "use strict";
  var L = [
    { k: "ates",          ad: "Ateşten Korkmayan", renk: "#FF7628", yazi: "#000", kisa: "Ocak harlı, kenarlar közde kızarmış.",           uzun: "Ateşle arası iyi. Döner harlı ocakta, kenarları közde kızarmış; cesur pişirim, gür lezzet." },
    { k: "sossuz",        ad: "Sossuz",            renk: "#8AE885", yazi: "#000", kisa: "Tavuğuna güvenir, tat etin kendisinde.",       uzun: "Sosa saklanmıyor. Marinasyon ve et kendini anlatıyor; sossuz yenince bile tam." },
    { k: "sos-canavari",  ad: "Sos Canavarı",      renk: "#CE72C0", yazi: "#000", kisa: "Soslar cömert, dürüm taşıyor.",                uzun: "Sos şişesi elinden düşmüyor. Bol, cömert, çeşit çeşit sos; her lokma ayrı bir sos macerası." },
    { k: "kitir",         ad: "Kıtır Kıtır",       renk: "#F8DE22", yazi: "#000", kisa: "Her lokmada çıtırlık.",                         uzun: "Et kıtır, lavaş kıtır. Sacda çıtırlatılmış, ısırınca ses veren bir döner." },
    { k: "minimalist",    ad: "Minimalist",        renk: "#FFF5DF", yazi: "#271B18", kisa: "Az malzeme, çok emek; sade ve dengeli.",     uzun: "Fazlası yok. Az ama doğru malzeme, sade ve dengeli bir döner." },
    { k: "aci-sever",     ad: "Acı Sever",         renk: "#FF9C9C", yazi: "#000", kisa: "Pul biber, acı sos; yürekli olanlara.",         uzun: "Acıyı seviyor ve sevdiriyor. Pul biber, acı sos, közlenmiş biber; yürekli olanlara." },
    { k: "bol-malzemeli", ad: "Bol Malzemeli",     renk: "#BBD65D", yazi: "#000", kisa: "Patates, turşu, domates; ne varsa içinde.",     uzun: "Dürüm taşıyor. Patates, turşu, domates, soğan; ne varsa içinde, doyurmadan bırakmıyor." },
    { k: "klasik",        ad: "Klasik",            renk: "#F0B56D", yazi: "#492C23", kisa: "Yılların ustası, değişmeyen tarif.",          uzun: "Yılların ustası. Tarif değişmiyor, tat da değişmiyor; bildiğimiz, özlediğimiz döner." },
    { k: "almanci",       ad: "Almancı",           renk: "#F4BD4F", yazi: "#000", kisa: "Berlin usulü, ekmek arası, bol salata.",        uzun: "Berlin'den selam var. Ekmek arası, bol salata, yoğurtlu sos; gurbetçi döner kültürü." },
    { k: "yeni-nesil",    ad: "Yeni Nesil",        renk: "#91DDCF", yazi: "#000", kisa: "Yeni soslar, sıra dışı tarifler.",              uzun: "Kuralları yeniden yazıyor. Yeni soslar, farklı ekmekler, sıra dışı sunumlar." }
  ];
  var I = {}; L.forEach(function (c, i) { c.i = i; I[c.k] = c; I[c.ad] = c; });
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var V = "1";
  var img = function (k) { return "/karakter/" + k + ".webp?v=" + V; };

  /* Hayalimdeki döner testi: sıfat (10 sticker karakteri) × isim (4) = 40 karakter */
  var ISIM = { "Lavaş": "Dürümcü", "Pide (Tombik)": "Tombikçi", "Somun Ekmek": "Ekmek Arası Ustası" };
  var ISIMLER = ["Dürümcü", "Tombikçi", "Ekmek Arası Ustası", "Dönerci"];
  var YENI = ["Cheddar", "Kolot Peyniri", "Jalapeno Turşusu", "Trüflü Mayonez", "Ranch Sos", "Barbekü Sos", "Ballı Hardal", "Hardallı Sos", "Elma Dilim Patates"];
  function testKarakteri(s) {
    var sos = s.sos || [], gar = s.garnitur || [], ys = s.yansos || [];
    var isim = ISIM[s.ekmek] || "Dönerci";
    var k = "klasik";
    var yeni = [s.peynir, s.patates].concat(sos, gar, ys).filter(function (v) { return YENI.indexOf(v) > -1; }).length;
    var berlin = (sos.indexOf("Yoğurtlu Otlu Sos") > -1 || sos.indexOf("Sarımsak Kreması") > -1) && gar.indexOf("Çıtır Beyaz Lahana") > -1 && gar.indexOf("Domates & Marul") > -1;
    if (s.aci === "İnanılmaz Acılı") k = "ates";
    else if (sos.indexOf("Sossuz") > -1) k = "sossuz";
    else if (sos.length >= 3) k = "sos-canavari";
    else if (s.pisme === "Yanığa Yakın (Kıtır)") k = "kitir";
    else if (berlin) k = "almanci";
    else if (gar.indexOf("Sadece Et") > -1) k = "minimalist";
    else if (s.aci === "Acılı") k = "aci-sever";
    else if (yeni >= 2) k = "yeni-nesil";
    else if (gar.length >= 3) k = "bol-malzemeli";
    return { k: k, sifat: I[k].ad, isim: isim, ad: I[k].ad + " " + isim, kar: I[k] };
  }

  /* HTML yardımcıları */
  function sticker(k, o) {
    o = o || {}; var c = I[k]; if (!c) return "";
    var w = o.w || 120;
    return '<img class="stk' + (o.cls ? " " + o.cls : "") + '" src="' + img(c.k) + '" alt="' + esc(o.alt != null ? o.alt : c.ad + " Dönerci") + '" width="' + w + '" height="' + w + '"' + (o.eager ? ' fetchpriority="high"' : ' loading="lazy"') + ' decoding="async"' + (o.don != null ? ' style="--don:' + o.don + 'deg"' : "") + ">";
  }
  function rozet(k, o) {
    o = o || {}; var c = I[k]; if (!c) return "";
    return '<span class="krz" style="--kr:' + c.renk + ";--ky:" + c.yazi + '"><img src="' + img(c.k) + '" alt="" width="28" height="28" loading="lazy" decoding="async"><b>' + esc(c.ad) + "</b></span>";
  }
  function liste(a) { return (Array.isArray(a) ? a : []).filter(function (k) { return I[k] && I[k].k === k; }); }
  /* Kapıya en fazla 3 sticker yapıştırılır; m.kapi bunları tutar (m.karakterler'in alt kümesi). */
  function kapi(m) { var k = liste(m && m.karakterler); return liste(m && m.kapi).filter(function (x) { return k.indexOf(x) > -1; }).slice(0, 3); }
  function ana(m) { return kapi(m)[0] || liste(m && m.karakterler)[0] || null; }
  function sirali(m) { var d = kapi(m); return d.concat(liste(m && m.karakterler).filter(function (x) { return d.indexOf(x) < 0; })); }

  window.KARAKTER = { L: L, bul: function (k) { return I[k] || null; }, img: img, sticker: sticker, rozet: rozet, liste: liste, kapi: kapi, ana: ana, sirali: sirali, testKarakteri: testKarakteri, ISIMLER: ISIMLER, esc: esc };
})();

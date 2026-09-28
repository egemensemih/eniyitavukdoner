// eniyitavukdoner.com — ayarlar
window.SITE_CONFIG = {
  SUPABASE_URL: "https://glonoumtcfrzjybuslnw.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_8aQzEW5k8xWrFZxtoSrhsQ_FpqOkrao",

  // Serinin başlangıç tarihi (geri sayım bu tarihe göre çalışır)
  SERI_BASLANGIC: "2027-01-01T00:00:00+03:00",

  // Bağlantılar
  // "Seriyi izle" düğmesi bu kanala gider
  YOUTUBE_URL: "https://www.youtube.com/@Denedik",
  // Sayfanın altındaki sosyal medya hesapları
  SOSYAL: [
    { tur: "youtube",   ad: "@denedik",         url: "https://www.youtube.com/@Denedik" },
    { tur: "youtube",   ad: "@eniyitavukdoner", url: "https://www.youtube.com/@eniyitavukdoner" },
    { tur: "instagram", ad: "@denedikco",       url: "https://www.instagram.com/denedikco/" },
    { tur: "instagram", ad: "@eniyitavukdoner", url: "https://www.instagram.com/eniyitavukdoner/" }
  ],

  // İletişim / KVKK başvuru adresi (sitenin altında ve KVKK sayfasında görünür)
  ILETISIM_EPOSTA: "iletisim@eniyitavukdoner.com",

  // KVKK: veri sorumlusunun resmî bilgileri (KVKK sayfasında görünür).
  // Şahıs işletmesiyse ad soyad, şirketse ticaret unvanı yazılır.
  VERI_SORUMLUSU: { unvan: "", adres: "", kep: "" },

  // Sayaç tabanı: gerçek sayı bu değerin altındayken sitede bu değer görünür,
  // gerçek sayı tabanı geçince gerçek sayı akmaya devam eder.
  // Kapatmak için ikisini de 0 yap.
  SAYAC_TABANI: { recete: 250, bekleyen: 250 }
};

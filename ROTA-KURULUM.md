# Döner rotası: kartlar, kategoriler ve notlar

Bu değişiklik mevcut siteye kartlı bir rota görünümü ekler. Şehir, kategori ve metin araması; Google puanı, yorum sayısı veya dengeli puana göre sıralama vardır. Panelde kategori, Instagram, “Neden listemde?” ve kişisel not düzenlenebilir. Yeni mekân eklemek için mevcut Google Maps akışı kullanılır.

## Yayına alma sırası

1. Mevcut Supabase projesinin SQL Editor bölümünde `schema_v7.sql` dosyasını çalıştır. Önceki şemaların zaten kurulu olduğu varsayılır. Bu dosya kayıtları silmez; rota alanları ve yalnız paylaşımı açık rotaları döndüren bir okuma işlevi ekler. Mevcut yönetici yetkileri korunur. Özel notlar ve gerekçeler halka açık işlevin çıktısında bulunmaz.
2. Kod değişikliğini ana dala al. Mevcut GitHub Pages düzeniyle site güncellenir.
3. `/panel#rota` içinde **Liste içe aktar** düğmesinden mevcut `doner-ana-liste.json` dosyasını seç. Önce kaç mevcut kaydın eşleştiğini ve kaç yeni kayıt ekleneceğini incele. 25 öneri mevcutsa 25 güncelleme + 4 yeni kayıt görünmelidir. **Rotaya aktar** ile uygula.
4. Yeni kayıtlar paylaşımı kapalı başlar. Her karttaki **Rota ayarları** bölümünde konumu kontrol et ve paylaşımı aç. Paylaşılan katalog `/rota.html` adresindedir. Daha önce paylaşımı açık olan mevcut kayıtların görünürlüğü korunur.

## Veri davranışı

- Her fiziksel şube ayrı `DNR-xxxx` kimliği taşır. Önceki form kayıtları açıklamadaki kimlik veya özgün Maps bağlantısıyla eşleşir. Birden fazla kayıt eşleşirse aktarım başlamaz.
- Aktarım mevcut özel notu, gerekçeyi ve elle seçilmiş kategoriyi korur. Kategorileri tamamen temizlemek de korunur. Gidildi / uygun değil durumları geri alınmaz. Daha yeni tarihli Google verisinin üzerine eski görüntü yazılmaz.
- Aktarım yarıda kalırsa başarılı satırlar korunur. Liste yeniden seçildiğinde bu satırlar tekrar oluşturulmaz. Veritabanındaki benzersiz kimlik eş zamanlı kopya kaydı engeller.
- Boş kategori alanı henüz incelenmemiş öneriyi; boş dizi kullanıcının kategorileri bilerek temizlediğini gösterir. Açıklamadaki açık “Kategori önerisi” ifadesi panelde ön aday olarak gösterilir.
- Google puanı 1–5 arası; dengeli puan `(puan*yorum + 4.2*200)/(yorum+200)` biçimindedir. Altı basamakta eşitlikte yorum sayısı ve kayıt kimliği kullanılır. Kişisel rota puanı ayrı bir sıralama seçeneğidir.
- Not ve gerekçe yalnız yetkili panelde kalır. Halka açık katalog yalnız paylaşımı açık ve rotada olan mekânların adı, şehir/ilçe, Maps, Google verileri, kategori ve Instagram bağlantısını döndürür.
- Önizleme ve onun dışa aktarılan paylaşım kopyası canlı veritabanına bağlanmaz. Önizlemedeki değişikliklerin ana listeye alınması için notlarla dışa aktarılan JSON kullanılmalıdır. Statik paylaşım kopyası anlık görüntüdür; otomatik güncellenmez.

## Doğrulama

`node tests/rota-plan.cjs` ile sıralama, eksik değerler, kategori temizleme, URL doğrulama ve tekrar eklemeden aktarım davranışı kontrol edilir. Canlı veritabanı değişikliği uygulanmadan oturum açma, RLS ve kaydetme entegrasyonunun gerçek hesapla ayrıca kontrol edilmesi gerekir. Bu değişiklik sırasında canlı veritabanına erişilmedi ve şema uygulanmadı.

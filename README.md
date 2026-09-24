# eniyitavukdoner.com

Denedik "Türkiye'nin En İyi Tavuk Dönerini Arıyoruz" serisinin web sitesi. Sade HTML, CSS ve JavaScript'ten oluşuyor; derleme adımı yok. Veriler Supabase'de tutuluyor.

## Dosyalar
| Dosya | Ne işe yarar |
|---|---|
| `index.html` | Ana sayfa |
| `kvkk.html` | KVKK aydınlatma metni (**köşeli parantezli alanlar doldurulmalı**) |
| `assets/config.js` | Tüm ayarlar: Supabase anahtarları, seri tarihi, bağlantılar |
| `assets/app.js` | Harita, reçete oluşturucu, story kartı ve formlar |
| `assets/style.css` | Tasarım |
| `supabase/schema.sql` | Veritabanı kurulumu (bir kere çalıştırılır) |

---

## Adım 1: Supabase projesini aç (yaklaşık 10 dakika)
1. supabase.com'da ücretsiz hesap aç ve **New project** de.
   - Bölge olarak **Frankfurt (eu-central-1)** seç, Türkiye'ye en yakın bölge bu.
2. Sol menüden **SQL Editor > New query**'ye gir. `supabase/schema.sql` dosyasının tamamını yapıştırıp **Run**'a bas.
3. **Project Settings > API** sayfasına git. Buradaki iki bilgiyi kopyala:
   - **Project URL**
   - **anon public** anahtarı

   > `service_role` anahtarını asla siteye koyma. Sadece **anon** anahtarını kullan.

## Adım 2: Ayarları doldur
`assets/config.js` dosyasını aç ve kopyaladığın iki bilgiyi yapıştır:
```js
SUPABASE_URL: "https://xxxx.supabase.co",
SUPABASE_ANON_KEY: "eyJhbGciOi...",
```
Aynı dosyada Instagram bağlantısını da ekleyebilirsin.

## Adım 3: GitHub Pages'te yayınla
1. GitHub'da yeni bir **public** repo aç, örneğin `eniyitavukdoner`.
2. **Add file > Upload files** ile bu klasördeki her şeyi yükle. `index.html` reponun ana dizininde olmalı.
3. **Settings > Pages** sayfasına git. Kaynak olarak **Deploy from a branch** seç, branch olarak da **main / (root)**. Kaydet.
4. 1-2 dakika içinde site şu adreste açılır: `https://KULLANICIADIN.github.io/eniyitavukdoner/`

## Adım 4: Kendi alan adına taşıma (hazır olduğunda)
1. GitHub'da **Settings > Pages > Custom domain** alanına `eniyitavukdoner.com` yaz.
2. Alan adını aldığın firmanın DNS panelinde şu kayıtları ekle:
   - **A** kayıtları: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - **CNAME** kaydı: `www` → `KULLANICIADIN.github.io`
3. DNS kayıtları aktif olunca **Enforce HTTPS** kutusunu işaretle.
4. `index.html` içindeki `og:image` değerini tam adresle değiştir: `https://eniyitavukdoner.com/assets/og.png`. WhatsApp ve Instagram önizlemeleri tam adres ister.

Başka bir hostinge taşımak da aynı mantıkla çalışır: dosyaları olduğu gibi yüklemen yeterli.

---

## Günlük kullanım

### Haritaya mekân eklemek
Supabase'de **Table Editor > mekanlar > Insert row**:
- `ad`, `il`, `adres`
- `lat`, `lng`: Google Maps'te mekâna sağ tıkla, çıkan ilk satır koordinatlardır.
- `puan`: 0-10 arası, örneğin 9.4
- `puan_notu`, `etiketler` (örneğin `{Sulu But,Köz Ateşi}`), `bolum_url`, `maps_url`
- `yayinda` = **true** yaparsan mekân sitede görünür.

Haritada ilk mekân görünene kadar "İlk puanlar seriyle birlikte geliyor" kartı gösterilir.

### Gelen verileri görmek
**Table Editor**'da üç tablo var:
- `bekleme_listesi`: "Bana Haber Ver" kayıtları
- `mekan_onerileri`: izleyicilerden gelen mekân önerileri
- `receteler`: tasarlanan dönerler

Semt semt özet için SQL Editor'da şu sorguyu çalıştır:
```sql
select * from semt_ozeti limit 50;
```

En çok tercih edilen sosları görmek için:
```sql
select s, count(*) from receteler, jsonb_array_elements_text(secimler->'sos') s group by 1 order by 2 desc;
```

### Sayaçlar
Ana sayfadaki "döner tasarlandı" ve "kişi haber bekliyor" sayaçları, gerçek sayı 250'ye ulaşana kadar 250 gösterir. Gerçek sayı 250'yi geçince gerçek sayı gösterilir ve her dakika güncellenir. Taban değerleri `config.js` dosyasındaki `SAYAC_TABANI` ile değiştirilir; kapatmak için ikisini de 0 yap. "Mekân puanlandı" sayacı tabansızdır, ilk mekân yayına girince görünür.

---

## Yayına almadan önce kontrol listesi
- [ ] `config.js` dosyasına Supabase bilgileri girildi
- [ ] Formlar test edildi. Kayıtlar Supabase'de görünüyor mu?
- [ ] `kvkk.html` içindeki köşeli parantezli alanlar dolduruldu ve metin bir hukukçuya kontrol ettirildi
- [ ] YouTube ve Instagram bağlantıları doğru
- [ ] Telefonda story kartı oluşturuldu ve paylaşıldı

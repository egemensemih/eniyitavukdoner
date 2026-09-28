# eniyitavukdoner.com

Türkiye'nin en iyi tavuk dönerini arayan Denedik serisinin sitesi. Statik site (GitHub Pages) + Supabase.

## Dosyalar
| Dosya | Ne işe yarar |
|---|---|
| `index.html`, `style.css`, `app.js` | Ana sayfa |
| `config.js` | Ayarlar: Supabase adresi, sosyal hesaplar, iletişim e-postası, KVKK veri sorumlusu, sayaç tabanı |
| `ilceler.js` | 81 il, 973 ilçe listesi (formlardaki seçmeli alanlar) |
| `panel.html`, `panel.css`, `panel.js` | Yönetim paneli: eniyitavukdoner.com/panel.html |
| `kvkk.html` | KVKK aydınlatma metni, ticari ileti onayı, yayın izni, çerez bilgisi |
| `schema.sql`, `schema_v2.sql` | Veritabanı kurulumu (ikisi de Supabase'de çalıştırıldı) |
| `.github/workflows/supabase-uyanik.yml` | Supabase'in 7 günlük uykuya geçmesini önler (iki günde bir) |

## Yönetim paneli
- Adres: https://eniyitavukdoner.com/panel.html (arama motorlarına kapalı).
- Giriş: Supabase > Authentication > Users'ta oluşturulan kullanıcı. Yetki `yoneticiler` tablosundaki e-postalara verilir.
- Yeni yönetici eklemek için SQL: `insert into yoneticiler (email) values ('kisi@ornek.com');` ve aynı e-postayla Authentication'da kullanıcı oluştur.

## Harita
MapLibre + OpenFreeMap (ücretsiz, API anahtarı gerektirmez). Puanlı mekânlar panelden eklenir; "Yayında" açıkken haritada görünür.

## Supabase uykusu
Ücretsiz planda 7 gün hareketsiz proje duraklatılır. GitHub Actions iki günde bir `canli_mi()` fonksiyonunu çağırır. Actions sekmesinden "Supabase uyanik tut" işini elle de çalıştırabilirsin. Kalıcı çözüm: Supabase Pro plan.

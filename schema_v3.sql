-- eniyitavukdoner.com — v3: rota, Google verileri, yurt dışı önerileri
-- 1) Öneriler: yurt dışı, rota puanı, konum ve Google alanları
alter table public.mekan_onerileri add column if not exists ulke text check (char_length(ulke) <= 60);
alter table public.mekan_onerileri add column if not exists rota_puani numeric(3,1) check (rota_puani between 0 and 10);
alter table public.mekan_onerileri add column if not exists haritada_goster boolean not null default true;
alter table public.mekan_onerileri add column if not exists lat double precision;
alter table public.mekan_onerileri add column if not exists lng double precision;
alter table public.mekan_onerileri add column if not exists google_place_id text;
alter table public.mekan_onerileri add column if not exists google_ad text;
alter table public.mekan_onerileri add column if not exists google_adres text;
alter table public.mekan_onerileri add column if not exists google_puan numeric(2,1);
alter table public.mekan_onerileri add column if not exists google_yorum int;
alter table public.mekan_onerileri add column if not exists google_url text;
alter table public.mekan_onerileri add column if not exists google_tarih timestamptz;

-- Ziyaretçi eklerken panel alanlarını dolduramasın
drop policy if exists "herkes_ekler" on public.mekan_onerileri;
create policy "herkes_ekler" on public.mekan_onerileri for insert to anon
  with check (kvkk_onay = true and durum = 'yeni' and yonetici_notu is null and rota_puani is null
              and google_place_id is null and lat is null and lng is null);

-- 2) Haritadaki öneri daireleri: yurt dışı önerileri ülke adıyla gruplanır
drop function if exists public.il_oneri_sayilari();
create function public.il_oneri_sayilari()
returns table(il text, adet int) language sql security definer set search_path = public as $$
  select case when il = 'Yurt dışı' then coalesce(nullif(ulke, ''), 'Yurt dışı') else il end as il, count(*)::int
  from mekan_onerileri
  where il is not null and durum <> 'uygun_degil'
  group by 1;
$$;
grant execute on function public.il_oneri_sayilari() to anon;

-- 3) Rotadaki mekânlar (haritada "Rotamızda" pinleri) — sadece ad ve konum paylaşılır
create or replace function public.rota_mekanlari()
returns table(id bigint, ad text, il text, ilce text, lat double precision, lng double precision)
language sql security definer set search_path = public as $$
  select distinct on (coalesce(google_place_id, lower(mekan_adi) || il))
         id, coalesce(google_ad, mekan_adi), il, ilce, lat, lng
  from mekan_onerileri
  where durum = 'listede' and haritada_goster and lat is not null and lng is not null
  order by coalesce(google_place_id, lower(mekan_adi) || il), rota_puani desc nulls last, id;
$$;
grant execute on function public.rota_mekanlari() to anon;

-- 4) Yurt dışı: bekleme listesi ve reçetelerde ülke
alter table public.bekleme_listesi add column if not exists ulke text check (char_length(ulke) <= 60);
alter table public.receteler add column if not exists ulke text check (char_length(ulke) <= 60);

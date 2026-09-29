-- eniyitavukdoner.com — v4: Türkiye Tavuk Dönerci Haritası
-- 1) Öneriler: yönetici onayı (onaylanan öneri sitedeki haritada görünür)
alter table public.mekan_onerileri add column if not exists onayli boolean not null default false;

drop policy if exists "herkes_ekler" on public.mekan_onerileri;
create policy "herkes_ekler" on public.mekan_onerileri for insert to anon
  with check (kvkk_onay = true and durum = 'yeni' and onayli = false and yonetici_notu is null and rota_puani is null
              and google_place_id is null and google_puan is null and google_url is null and lat is null and lng is null);

-- 2) Denedik mekânları: detay sayfası için açıklama, altı kriter puanı, ülke
alter table public.mekanlar add column if not exists aciklama text check (char_length(aciklama) <= 6000);
alter table public.mekanlar add column if not exists kriterler jsonb not null default '{}'::jsonb;
alter table public.mekanlar add column if not exists ulke text check (char_length(ulke) <= 60);

-- 3) Haritadaki rota ve onaylı öneri noktaları.
--    Aynı mekân için gelen öneriler tek noktada toplanır; öneren kişi ve yorum bilgisi paylaşılmaz.
drop function if exists public.harita_mekanlari();
create function public.harita_mekanlari()
returns table(anahtar text, ad text, il text, ilce text, ulke text, lat double precision, lng double precision,
              adet int, tur text, maps_url text)
language sql stable security definer set search_path = public as $$
  with g as (
    select o.*,
           lower(regexp_replace(trim(coalesce(o.google_ad, o.mekan_adi)), '\s+', ' ', 'g')) || '|' ||
           coalesce(nullif(o.ulke, ''), o.il, '') as k
    from mekan_onerileri o
    where o.durum <> 'uygun_degil'
  ),
  sayi as (select k, count(*)::int as adet from g group by k),
  gorunen as (
    select distinct on (g.k) g.k, coalesce(g.google_ad, g.mekan_adi) as ad, g.il, g.ilce, g.ulke, g.lat, g.lng,
           case when g.durum in ('listede', 'gidildi') then 'rota' else 'oneri' end as tur, g.google_url
    from g
    where g.lat is not null and g.lng is not null and g.haritada_goster
      and (g.onayli or g.durum in ('listede', 'gidildi'))
      and not exists (select 1 from mekanlar m where m.oneri_id = g.id and m.yayinda)
    order by g.k, (g.durum in ('listede', 'gidildi')) desc, g.onayli desc, g.rota_puani desc nulls last, g.id
  )
  select md5(v.k), v.ad, v.il, v.ilce, v.ulke, v.lat, v.lng, s.adet, v.tur, v.google_url
  from gorunen v join sayi s using (k);
$$;
grant execute on function public.harita_mekanlari() to anon;

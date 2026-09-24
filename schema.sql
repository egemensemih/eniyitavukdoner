-- eniyitavukdoner.com — Supabase veritabanı kurulumu
-- Supabase panelinde: SQL Editor > New query > bu dosyanın tamamını yapıştır > Run

-- 1) Bekleme listesi ("Bana Haber Ver")
create table if not exists public.bekleme_listesi (
  id          bigint generated always as identity primary key,
  iletisim    text not null unique check (char_length(iletisim) between 5 and 120),
  il          text check (char_length(il) <= 40),
  ilce        text check (char_length(ilce) <= 60),
  kvkk_onay   boolean not null check (kvkk_onay = true),
  created_at  timestamptz not null default now()
);

-- 2) Mekân önerileri ("Gidip Deneyelim")
create table if not exists public.mekan_onerileri (
  id          bigint generated always as identity primary key,
  mekan_adi   text not null check (char_length(mekan_adi) between 2 and 120),
  il          text not null check (char_length(il) <= 40),
  ilce        text check (char_length(ilce) <= 60),
  adres       text check (char_length(adres) <= 400),
  neden       text check (char_length(neden) <= 1000),
  takma_ad    text check (char_length(takma_ad) <= 60),
  kvkk_onay   boolean not null check (kvkk_onay = true),
  created_at  timestamptz not null default now()
);

-- 3) Tasarlanan dönerler ("Hayalindeki Döneri Tasarla") — anonim, kişisel veri yok
create table if not exists public.receteler (
  id          bigint generated always as identity primary key,
  secimler    jsonb not null check (pg_column_size(secimler) < 8000),
  il          text check (char_length(il) <= 40),
  ilce        text check (char_length(ilce) <= 60),
  created_at  timestamptz not null default now()
);

-- 4) Haritadaki puanlı mekânlar (sen Table Editor'dan eklersin)
create table if not exists public.mekanlar (
  id          bigint generated always as identity primary key,
  ad          text not null,
  il          text not null,
  adres       text,
  lat         double precision not null,
  lng         double precision not null,
  puan        numeric(3,1) not null check (puan between 0 and 10),
  puan_notu   text,
  etiketler   text[] default '{}',
  bolum_url   text,
  maps_url    text,
  yayinda     boolean not null default false,
  created_at  timestamptz not null default now()
);

-- Güvenlik: Ziyaretçiler sadece ekleme yapabilir, kimse başkasının verisini okuyamaz.
alter table public.bekleme_listesi enable row level security;
alter table public.mekan_onerileri enable row level security;
alter table public.receteler       enable row level security;
alter table public.mekanlar        enable row level security;

drop policy if exists "herkes_ekler" on public.bekleme_listesi;
create policy "herkes_ekler" on public.bekleme_listesi for insert to anon with check (true);
drop policy if exists "herkes_ekler" on public.mekan_onerileri;
create policy "herkes_ekler" on public.mekan_onerileri for insert to anon with check (true);
drop policy if exists "herkes_ekler" on public.receteler;
create policy "herkes_ekler" on public.receteler for insert to anon with check (true);
drop policy if exists "yayindakiler_okunur" on public.mekanlar;
create policy "yayindakiler_okunur" on public.mekanlar for select to anon using (yayinda = true);

-- Sitedeki sayaçlar için sadece toplam sayıları döndüren fonksiyon
create or replace function public.site_istatistik()
returns json language sql security definer set search_path = public as $$
  select json_build_object(
    'recete',  (select count(*) from receteler),
    'bekleyen',(select count(*) from bekleme_listesi),
    'mekan',   (select count(*) from mekanlar where yayinda)
  );
$$;
grant execute on function public.site_istatistik() to anon;

-- Semt semt analiz için hazır görünüm (sadece panelden görülür)
create or replace view public.semt_ozeti as
  select coalesce(il,'—') il, coalesce(ilce,'—') ilce,
         count(*) recete_sayisi
  from receteler group by 1,2 order by 3 desc;
revoke all on public.semt_ozeti from anon;

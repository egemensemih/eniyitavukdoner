-- eniyitavukdoner.com — şema v6
-- Tahsin + Egemen ayrı değerlendirme (10 kriter × 10 = 100 puan), Google önbelleği,
-- Instagram, link ile öneri, hız sınırları ve güvenlik sıkılaştırmaları.

-- ============ 1) Mekânlar: 100 üzerinden puan, yeni alanlar ============
alter table public.mekanlar drop constraint if exists mekanlar_puan_check;
alter table public.mekanlar alter column puan drop not null;
update public.mekanlar set puan = round(puan * 10, 1) where puan is not null and puan <= 10;
alter table public.mekanlar add constraint mekanlar_puan_check check (puan is null or (puan >= 0 and puan <= 100));

alter table public.mekanlar
  add column if not exists instagram text check (instagram is null or char_length(instagram) <= 200),
  add column if not exists google_place_id text,
  add column if not exists ziyaret_tarihi date,
  add column if not exists puan_tahsin numeric,
  add column if not exists puan_egemen numeric;
alter table public.mekanlar drop constraint if exists mekanlar_ad_len;
alter table public.mekanlar add constraint mekanlar_ad_len check (char_length(ad) between 1 and 160);
alter table public.mekanlar drop constraint if exists mekanlar_notu_len;
alter table public.mekanlar add constraint mekanlar_notu_len check (puan_notu is null or char_length(puan_notu) <= 400);

-- ============ 2) Değerlendirmeler (Tahsin / Egemen) ============
create table if not exists public.degerlendirmeler (
  mekan_id   bigint not null references public.mekanlar(id) on delete cascade,
  kisi       text   not null check (kisi in ('tahsin', 'egemen')),
  puanlar    jsonb  not null default '{}'::jsonb,
  yorum      text   check (yorum is null or char_length(yorum) <= 4000),
  toplam     numeric,
  updated_at timestamptz not null default now(),
  primary key (mekan_id, kisi)
);
alter table public.degerlendirmeler enable row level security;

-- 10 kriter: et, marinasyon, ekmek, sos, garnitur, porsiyon, fiyat, hijyen, hizmet, ortam
create or replace function public.degerlendirme_hazirla() returns trigger
language plpgsql set search_path = public as $$
declare k text; v numeric; n int := 0; s numeric := 0;
  izinli constant text[] := array['et','marinasyon','ekmek','sos','garnitur','porsiyon','fiyat','hijyen','hizmet','ortam'];
  temiz jsonb := '{}'::jsonb;
begin
  for k, v in select key, (value #>> '{}')::numeric from jsonb_each(coalesce(new.puanlar, '{}'::jsonb))
              where jsonb_typeof(value) = 'number' loop
    if k = any(izinli) and v >= 0 and v <= 10 then
      temiz := temiz || jsonb_build_object(k, round(v * 2) / 2);
      n := n + 1; s := s + round(v * 2) / 2;
    end if;
  end loop;
  new.puanlar := temiz;
  -- eksik kriter varsa girilenlerin ortalamasıyla 100'e ölçeklenir
  new.toplam := case when n = 0 then null else round(s / n * 10, 1) end;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists degerlendirme_hazirla on public.degerlendirmeler;
create trigger degerlendirme_hazirla before insert or update on public.degerlendirmeler
  for each row execute function public.degerlendirme_hazirla();

-- Mekânın puanı = iki kişinin toplamlarının ortalaması; kriterler = kişilerin kriter ortalaması
create or replace function public.mekan_puan_guncelle(p_id bigint) returns void
language sql security definer set search_path = public as $$
  update mekanlar m set
    puan_tahsin = (select toplam from degerlendirmeler where mekan_id = p_id and kisi = 'tahsin'),
    puan_egemen = (select toplam from degerlendirmeler where mekan_id = p_id and kisi = 'egemen'),
    puan = (select round(avg(toplam), 1) from degerlendirmeler where mekan_id = p_id and toplam is not null),
    kriterler = coalesce((select jsonb_object_agg(key, ort) from (
        select e.key, round(avg((e.value #>> '{}')::numeric), 1) as ort
        from degerlendirmeler d, jsonb_each(d.puanlar) e where d.mekan_id = p_id group by e.key) x), '{}'::jsonb)
  where m.id = p_id;
$$;
revoke all on function public.mekan_puan_guncelle(bigint) from public, anon, authenticated;

create or replace function public.degerlendirme_sonra() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform mekan_puan_guncelle(coalesce(new.mekan_id, old.mekan_id));
  return null;
end $$;
revoke all on function public.degerlendirme_sonra() from public, anon, authenticated;
drop trigger if exists degerlendirme_sonra on public.degerlendirmeler;
create trigger degerlendirme_sonra after insert or update or delete on public.degerlendirmeler
  for each row execute function public.degerlendirme_sonra();

drop policy if exists yonetici_tam on public.degerlendirmeler;
create policy yonetici_tam on public.degerlendirmeler for all to authenticated using (is_admin()) with check (is_admin());
drop policy if exists yayindakiler_okunur on public.degerlendirmeler;
create policy yayindakiler_okunur on public.degerlendirmeler for select to anon
  using (exists (select 1 from mekanlar m where m.id = mekan_id and m.yayinda));

-- ============ 3) Google önbelleği (sadece yönetici okur; sunucu fonksiyonu yazar) ============
create table if not exists public.google_yerler (
  place_id     text primary key,
  ad           text,
  adres        text,
  lat          double precision,
  lng          double precision,
  url          text,
  tur          text,
  kapali       boolean default false,
  il           text,
  ilce         text,
  ulke         text,
  temel_tarih  timestamptz default now(),
  puan         numeric,
  yorum_sayisi integer,
  telefon      text,
  web          text,
  instagram    text,
  saatler      jsonb,
  yorumlar     jsonb,
  fiyat        text,
  detay_tarih  timestamptz
);
alter table public.google_yerler enable row level security;
drop policy if exists yonetici_okur on public.google_yerler;
create policy yonetici_okur on public.google_yerler for select to authenticated using (is_admin());

-- Link → place_id önbelleği (aynı link ikinci kez Google'a sorulmaz)
create table if not exists public.google_link_onbellek (
  anahtar  text primary key,
  place_id text,
  tarih    timestamptz default now()
);
alter table public.google_link_onbellek enable row level security;

alter table public.mekan_onerileri add column if not exists kaynak text default 'site';

-- ============ 4) Sayaçlar ve hız sınırı ============
create table if not exists public.istek_sayac (
  anahtar text primary key,
  pencere timestamptz not null default now(),
  adet    integer not null default 0
);
alter table public.istek_sayac enable row level security;

-- Genel sayaç: sadece sunucu fonksiyonu (service_role) çağırır
create or replace function public.sayac_artir(p_anahtar text, p_limit integer) returns boolean
language plpgsql security definer set search_path = public as $$
declare v int;
begin
  insert into istek_sayac (anahtar, pencere, adet) values (p_anahtar, now(), 1)
  on conflict (anahtar) do update set adet = istek_sayac.adet + 1 returning adet into v;
  if v > p_limit then return false; end if;
  if random() < 0.02 then delete from istek_sayac where pencere < now() - interval '3 days'; end if;
  return true;
end $$;
revoke all on function public.sayac_artir(text, integer) from public, anon, authenticated;
grant execute on function public.sayac_artir(text, integer) to service_role;

-- Ziyaretçi eklemelerinde IP başına saatlik ve tüm site için dakikalık sınır
create or replace function public.hiz_siniri() returns trigger
language plpgsql security definer set search_path = public as $$
declare h json; ip text; saat text := to_char(now() at time zone 'UTC', 'YYYYMMDDHH24'); dk text := to_char(now() at time zone 'UTC', 'YYYYMMDDHH24MI');
begin
  if coalesce(auth.role(), 'anon') <> 'anon' then return new; end if;
  h := nullif(current_setting('request.headers', true), '')::json;
  ip := nullif(trim(coalesce(h ->> 'cf-connecting-ip', split_part(h ->> 'x-forwarded-for', ',', 1), h ->> 'x-real-ip', '')), '');
  -- IP okunamazsa kişi sınırı atlanır (herkesi tek kişi saymamak için), genel sınır yine geçerli
  if ip is not null and not sayac_artir(tg_table_name || ':ip:' || md5(ip) || ':' || saat, tg_argv[0]::int) then
    raise exception 'Çok fazla deneme. Biraz sonra tekrar dene.' using errcode = 'P0001';
  end if;
  if not sayac_artir(tg_table_name || ':tum:' || dk, tg_argv[1]::int) then
    raise exception 'Şu an çok yoğunuz. Birkaç dakika sonra tekrar dene.' using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke all on function public.hiz_siniri() from public, anon, authenticated;

drop trigger if exists hiz_siniri on public.mekan_onerileri;
create trigger hiz_siniri before insert on public.mekan_onerileri for each row execute function public.hiz_siniri('20', '120');
drop trigger if exists hiz_siniri on public.bekleme_listesi;
create trigger hiz_siniri before insert on public.bekleme_listesi for each row execute function public.hiz_siniri('15', '300');
drop trigger if exists hiz_siniri on public.receteler;
create trigger hiz_siniri before insert on public.receteler for each row execute function public.hiz_siniri('60', '1500');
drop trigger if exists hiz_siniri on public.oyun_skorlar;
create trigger hiz_siniri before insert on public.oyun_skorlar for each row execute function public.hiz_siniri('30', '600');

-- ============ 5) Güvenlik sıkılaştırma ============
-- Ziyaretçi rolü tablolarda sadece okuyup ekleyebilir (RLS zaten süzüyor; bu ikinci kilit)
revoke update, delete, truncate, references, trigger on all tables in schema public from anon;
alter default privileges in schema public revoke update, delete, truncate, references, trigger on tables from anon;
revoke all on public.google_kullanim, public.google_yerler, public.google_link_onbellek, public.istek_sayac, public.yoneticiler from anon;

-- İç yardımcı fonksiyonlar dışarıdan çağrılamasın
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
revoke execute on function public.canli_mi() from public, anon, authenticated;
revoke execute on function public.google_hak(text, integer) from public, anon;

-- Görünüm, çağıranın yetkisiyle çalışsın
alter view public.semt_ozeti set (security_invoker = true);

-- Harita ve sayfa sorguları için indeksler
create index if not exists mekanlar_yayinda_idx on public.mekanlar (yayinda) where yayinda;
create index if not exists mekan_onerileri_durum_idx on public.mekan_onerileri (durum);
create index if not exists degerlendirmeler_mekan_idx on public.degerlendirmeler (mekan_id);

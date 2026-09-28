-- eniyitavukdoner.com — v2 güncellemesi (schema.sql'den sonra bir kez çalıştırılır)
-- 1) Bekleme listesi: e-posta + telefon ayrı alanlar, ilçe, ticari ileti onayı
alter table public.bekleme_listesi alter column iletisim drop not null;
alter table public.bekleme_listesi add column if not exists eposta text check (char_length(eposta) <= 120);
alter table public.bekleme_listesi add column if not exists telefon text check (char_length(telefon) <= 20);
alter table public.bekleme_listesi add column if not exists ileti_onay boolean not null default false;
alter table public.bekleme_listesi add column if not exists onay_metni text;
alter table public.bekleme_listesi add column if not exists not_ text;
create unique index if not exists bekleme_eposta_uq on public.bekleme_listesi (lower(eposta)) where eposta is not null;
create unique index if not exists bekleme_telefon_uq on public.bekleme_listesi (telefon) where telefon is not null;

-- 2) Mekân önerileri: yayın izni + panel için durum ve not
alter table public.mekan_onerileri add column if not exists yayin_izni boolean not null default false;
alter table public.mekan_onerileri add column if not exists durum text not null default 'yeni'
  check (durum in ('yeni','incelendi','listede','gidildi','uygun_degil'));
alter table public.mekan_onerileri add column if not exists yonetici_notu text;

-- 3) Haritadaki mekânlar: ilçe + hangi öneriden geldiği
alter table public.mekanlar add column if not exists ilce text;
alter table public.mekanlar add column if not exists oneri_id bigint;

-- 4) Yöneticiler (panel erişimi)
create table if not exists public.yoneticiler (
  email text primary key,
  created_at timestamptz not null default now()
);
alter table public.yoneticiler enable row level security;
revoke all on public.yoneticiler from anon, authenticated;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from yoneticiler where lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;
grant execute on function public.is_admin() to authenticated, anon;

-- Yönetici politikaları: sadece yöneticiler tabloları okuyup düzenleyebilir
do $$
declare t text;
begin
  foreach t in array array['bekleme_listesi','mekan_onerileri','receteler','mekanlar'] loop
    execute format('drop policy if exists "yonetici_tam" on public.%I', t);
    execute format('create policy "yonetici_tam" on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- 5) Ziyaretçi eklemeleri için sıkı kurallar (sadece izin verilen kolonlar, onaylar zorunlu)
drop policy if exists "herkes_ekler" on public.bekleme_listesi;
create policy "herkes_ekler" on public.bekleme_listesi for insert to anon
  with check (kvkk_onay = true and ileti_onay = true and eposta is not null and telefon is not null and not_ is null);
drop policy if exists "herkes_ekler" on public.mekan_onerileri;
create policy "herkes_ekler" on public.mekan_onerileri for insert to anon
  with check (kvkk_onay = true and durum = 'yeni' and yonetici_notu is null);

-- 6) Sayaç ve harita fonksiyonları (değişmedi, garanti olsun diye yeniden)
create or replace function public.il_oneri_sayilari()
returns table(il text, adet int) language sql security definer set search_path = public as $$
  select il, count(*)::int from mekan_onerileri where il is not null and durum <> 'uygun_degil' group by il;
$$;
grant execute on function public.il_oneri_sayilari() to anon;

-- 7) Uyku önleyici için hafif kontrol fonksiyonu
create or replace function public.canli_mi()
returns text language sql security definer set search_path = public as $$
  select 'evet ' || (select count(*) from receteler)::text;
$$;
grant execute on function public.canli_mi() to anon;

-- 8) Yönetici e-postası
insert into public.yoneticiler (email) values ('egemensemih@gmail.com') on conflict do nothing;

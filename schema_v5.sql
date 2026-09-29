-- eniyitavukdoner.com — v5: Google Places entegrasyonu (ücretsiz kullanım korumalı)
alter table public.mekan_onerileri add column if not exists google_tur text;
alter table public.mekan_onerileri add column if not exists google_eslesme text;          -- otomatik | elle | kapali | bulunamadi
alter table public.mekan_onerileri add column if not exists google_puan_tarih timestamptz;
create index if not exists mekan_onerileri_gpid on public.mekan_onerileri (google_place_id);

-- Ziyaretçi Google alanlarını dolduramasın
drop policy if exists "herkes_ekler" on public.mekan_onerileri;
create policy "herkes_ekler" on public.mekan_onerileri for insert to anon
  with check (kvkk_onay = true and durum = 'yeni' and onayli = false and yonetici_notu is null and rota_puani is null
              and google_place_id is null and google_puan is null and google_url is null and google_tur is null
              and google_eslesme is null and lat is null and lng is null);

-- Günlük Google sorgu sayacı: sınır aşılırsa sorgu yapılmaz, fatura oluşmaz
create table if not exists public.google_kullanim (
  gun  date not null default (now() at time zone 'Europe/Istanbul')::date,
  tur  text not null,
  adet int  not null default 0,
  primary key (gun, tur)
);
alter table public.google_kullanim enable row level security;
drop policy if exists "yonetici_okur" on public.google_kullanim;
create policy "yonetici_okur" on public.google_kullanim for select to authenticated using (public.is_admin());

create or replace function public.google_hak(p_tur text, p_limit int)
returns boolean language plpgsql security definer set search_path = public as $$
declare v int;
begin
  if not public.is_admin() then return false; end if;
  insert into google_kullanim (gun, tur, adet) values ((now() at time zone 'Europe/Istanbul')::date, p_tur, 1)
  on conflict (gun, tur) do update set adet = google_kullanim.adet + 1
  returning adet into v;
  if v > p_limit then
    update google_kullanim set adet = adet - 1 where gun = (now() at time zone 'Europe/Istanbul')::date and tur = p_tur;
    return false;
  end if;
  return true;
end $$;
revoke all on function public.google_hak(text, int) from anon;
grant execute on function public.google_hak(text, int) to authenticated;

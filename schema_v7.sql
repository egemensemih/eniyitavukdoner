-- Route planning metadata. Apply once in the existing Supabase SQL editor.
-- Nullable categories mean “suggestion not reviewed”; [] means explicitly cleared.
begin;
alter table public.mekan_onerileri
  add column if not exists plan_kategorileri text[],
  add column if not exists plan_gerekcesi text check (char_length(plan_gerekcesi) <= 2000),
  add column if not exists plan_instagram text check (plan_instagram is null or plan_instagram = '' or (char_length(plan_instagram) <= 200 and plan_instagram ~ '^https://(www\.)?instagram\.com/[^[:space:]]+$')),
  add column if not exists plan_kayit_id text check (plan_kayit_id is null or plan_kayit_id ~ '^DNR-[0-9]{4,}$');
alter table public.mekan_onerileri drop constraint if exists plan_kategori_boyutu;
alter table public.mekan_onerileri add constraint plan_kategori_boyutu check (plan_kategorileri is null or (cardinality(plan_kategorileri) <= 12 and array_position(plan_kategorileri,null) is null and char_length(array_to_string(plan_kategorileri,',')) <= 731));
create unique index if not exists mekan_onerileri_plan_id on public.mekan_onerileri(plan_kayit_id) where plan_kayit_id is not null;

-- Retain all existing policies. Anonymous suggestions cannot set private plan fields.
drop policy if exists planlama_alanlari_korumasi on public.mekan_onerileri;
create policy planlama_alanlari_korumasi on public.mekan_onerileri as restrictive for insert to anon
  with check (plan_kategorileri is null and plan_gerekcesi is null and plan_instagram is null and plan_kayit_id is null);

-- Public catalogue exposes only routes the owner already opted to share.
-- No reason, private note, submitter, contact, or evaluation text is returned.
create or replace function public.rota_katalogu()
returns table(id bigint, mekan_adi text, il text, ilce text, ulke text, google_url text,
              google_puan numeric, google_yorum integer, google_puan_tarih timestamptz,
              plan_kategorileri text[], plan_instagram text)
language sql stable security definer set search_path = public as $$
  select distinct on (coalesce(o.plan_kayit_id,o.google_place_id,o.google_url,lower(o.mekan_adi)||'|'||o.il||'|'||coalesce(o.ilce,'')||'|'||coalesce(o.adres,'')))
         o.id, coalesce(o.google_ad,o.mekan_adi), o.il, o.ilce, o.ulke,
         coalesce(o.google_url,case when o.adres ~ '^https://' then o.adres else null end),
         o.google_puan, o.google_yorum, coalesce(o.google_puan_tarih,o.google_tarih),
         o.plan_kategorileri, o.plan_instagram
  from public.mekan_onerileri o
  where o.durum='listede' and o.haritada_goster
  order by coalesce(o.plan_kayit_id,o.google_place_id,o.google_url,lower(o.mekan_adi)||'|'||o.il||'|'||coalesce(o.ilce,'')||'|'||coalesce(o.adres,'')), o.id;
$$;
revoke all on function public.rota_katalogu() from public;
grant execute on function public.rota_katalogu() to anon, authenticated;
commit;

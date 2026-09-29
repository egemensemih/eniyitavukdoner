// Supabase Edge Function: google-mekan  (v2)
// Sadece yöneticiler kullanabilir. Google anahtarı: Edge Functions > Secrets > GOOGLE_MAPS_KEY
//
// İşlemler (body.islem):
//   eslestir {id}          Öneriyi Google'da bulur; ad, adres, konum, link, tür kaydedilir.   (Text Search Pro)
//   ara      {q, lat?, lng?} Aday mekân listesi döndürür.                                    (Text Search Pro)
//   link     {url}          Google Maps linkini (kısa linkler dahil) çözer, aday döndürür.     (Text Search Pro)
//   puan     {id}           Google puanı ve yorum sayısı. 30 gün içinde çekildiyse tekrar sormaz. (Place Details Enterprise)
//
// Maliyet emniyeti: günlük üst sınırlar aşağıda. Google Cloud tarafında da kota koyulmalı.
import { createClient } from "npm:@supabase/supabase-js@2";

const GUNLUK = { ara: 150, puan: 30 };
const PRO_ALANLAR = "places.id,places.displayName,places.formattedAddress,places.location,places.googleMapsUri,places.primaryTypeDisplayName,places.businessStatus";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

type Aday = { id: string; ad: string; adres: string; lat: number | null; lng: number | null; url: string; tur: string | null; kapali: boolean };

function linkCoz(u: string) {
  const s = decodeURIComponent(u).replace(/\+/g, " ");
  const ad = (s.match(/\/place\/([^/@?]+)/) || [])[1] || (s.match(/[?&]q=([^&]+)/) || [])[1] || null;
  const m = s.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) || s.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  return { ad: ad && !/^-?\d+\.\d+,/.test(ad) ? ad.trim() : null, lat: m ? parseFloat(m[1]) : null, lng: m ? parseFloat(m[2]) : null };
}

async function linkAc(url: string) {
  if (!/^https?:\/\/([a-z0-9-]+\.)*(google\.[a-z.]+|goo\.gl|maps\.app\.goo\.gl)\//i.test(url)) return linkCoz(url);
  try {
    const r = await fetch(url, { redirect: "follow", headers: { "User-Agent": "Mozilla/5.0" } });
    return linkCoz(r.url || url);
  } catch { return linkCoz(url); }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const apikey = Deno.env.get("SUPABASE_ANON_KEY") ?? req.headers.get("apikey") ?? "";
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, apikey, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: ok } = await sb.rpc("is_admin");
    if (!ok) return json({ error: "Bu işlem için yönetici girişi gerekli." }, 403);

    const key = Deno.env.get("GOOGLE_MAPS_KEY");
    if (!key) return json({ error: "GOOGLE_MAPS_KEY eklenmemiş." });

    const body = await req.json().catch(() => ({}));
    const islem = String(body.islem || "ara");

    const hak = async (tur: "ara" | "puan") => {
      const { data } = await sb.rpc("google_hak", { p_tur: tur, p_limit: GUNLUK[tur] });
      return data === true;
    };

    const textSearch = async (q: string, lat?: number | null, lng?: number | null, adet = 5): Promise<Aday[]> => {
      const b: Record<string, unknown> = { textQuery: q.slice(0, 200), languageCode: "tr", regionCode: "TR", pageSize: adet };
      if (lat != null && lng != null) b.locationBias = { circle: { center: { latitude: lat, longitude: lng }, radius: 500 } };
      const r = await fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": PRO_ALANLAR },
        body: JSON.stringify(b),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error?.message ?? "Google hatası");
      return (d.places ?? []).map((p: any) => ({
        id: p.id, ad: p.displayName?.text ?? "", adres: p.formattedAddress ?? "",
        lat: p.location?.latitude ?? null, lng: p.location?.longitude ?? null, url: p.googleMapsUri ?? "",
        tur: p.primaryTypeDisplayName?.text ?? null, kapali: p.businessStatus === "CLOSED_PERMANENTLY",
      }));
    };

    // ---- ara ----
    if (islem === "ara") {
      const q = String(body.q || "").trim();
      if (q.length < 2) return json({ error: "Arama metni boş." });
      if (!(await hak("ara"))) return json({ error: "Bugünkü Google arama sınırı doldu (ücretsiz kullanım koruması)." });
      return json({ sonuc: await textSearch(q, body.lat ?? null, body.lng ?? null) });
    }

    // ---- link ----
    if (islem === "link") {
      const c = await linkAc(String(body.url || ""));
      if (!c.ad && c.lat == null) return json({ error: "Linkten mekân okunamadı." });
      if (!c.ad) return json({ sonuc: [], konum: { lat: c.lat, lng: c.lng } });
      if (!(await hak("ara"))) return json({ error: "Bugünkü Google arama sınırı doldu." });
      return json({ sonuc: await textSearch(c.ad, c.lat, c.lng, 3), konum: { lat: c.lat, lng: c.lng } });
    }

    // ---- eslestir ----
    if (islem === "eslestir") {
      const { data: r } = await sb.from("mekan_onerileri").select("*").eq("id", body.id).single();
      if (!r) return json({ error: "Öneri bulunamadı." });
      if (r.google_place_id) return json({ satir: r });
      let q = [r.mekan_adi, r.ilce, r.il === "Yurt dışı" ? r.ulke : r.il].filter(Boolean).join(" ");
      let lat: number | null = null, lng: number | null = null;
      if (/^https?:\/\//i.test(r.adres || "")) {
        const c = await linkAc(r.adres);
        if (c.ad) q = c.ad + (c.lat == null ? " " + [r.ilce, r.il === "Yurt dışı" ? r.ulke : r.il].filter(Boolean).join(" ") : "");
        lat = c.lat; lng = c.lng;
      } else if (r.adres) q += " " + r.adres;
      if (!(await hak("ara"))) return json({ error: "Bugünkü Google arama sınırı doldu." });
      const list = await textSearch(q, lat, lng, 1);
      const p = list[0];
      const upd: Record<string, unknown> = p
        ? { google_place_id: p.id, google_ad: p.ad, google_adres: p.adres, google_url: p.url, google_tur: p.tur,
            google_eslesme: p.kapali ? "kapali" : "otomatik" }
        : { google_eslesme: "bulunamadi" };
      if (p && r.lat == null && p.lat != null) { upd.lat = p.lat; upd.lng = p.lng; }
      const { data: yeni, error } = await sb.from("mekan_onerileri").update(upd).eq("id", r.id).select().single();
      if (error) return json({ error: error.message });
      return json({ satir: yeni });
    }

    // ---- puan ----
    if (islem === "puan") {
      const { data: r } = await sb.from("mekan_onerileri").select("id,google_place_id").eq("id", body.id).single();
      if (!r?.google_place_id) return json({ error: "Önce mekânı Google ile eşleştir." });
      const esik = new Date(Date.now() - 30 * 864e5).toISOString();
      const { data: onbellek } = await sb.from("mekan_onerileri")
        .select("google_puan,google_yorum,google_puan_tarih").eq("google_place_id", r.google_place_id)
        .gte("google_puan_tarih", esik).order("google_puan_tarih", { ascending: false }).limit(1);
      let upd: Record<string, unknown>;
      if (onbellek && onbellek.length && !body.zorla) {
        upd = { google_puan: onbellek[0].google_puan, google_yorum: onbellek[0].google_yorum, google_puan_tarih: onbellek[0].google_puan_tarih };
      } else {
        if (!(await hak("puan"))) return json({ error: "Bugünkü puan sorgusu sınırı doldu (ücretsiz kullanım koruması)." });
        const g = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(r.google_place_id)}?languageCode=tr`, {
          headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": "rating,userRatingCount" },
        });
        const d = await g.json();
        if (!g.ok) return json({ error: d?.error?.message ?? "Google hatası" });
        upd = { google_puan: d.rating ?? null, google_yorum: d.userRatingCount ?? 0, google_puan_tarih: new Date().toISOString() };
      }
      const { error } = await sb.from("mekan_onerileri").update(upd).eq("google_place_id", r.google_place_id);
      if (error) return json({ error: error.message });
      return json({ puan: upd, place_id: r.google_place_id });
    }

    return json({ error: "Bilinmeyen işlem." });
  } catch (e) {
    return json({ error: String(e?.message ?? e) });
  }
});

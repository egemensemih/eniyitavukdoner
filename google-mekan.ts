// Supabase Edge Function: google-mekan
// Paneldeki "Google'da bul" düğmesi bu fonksiyonu çağırır. Sadece yöneticiler kullanabilir.
// Google anahtarı Supabase > Edge Functions > Secrets içinde GOOGLE_MAPS_KEY olarak durur.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

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

    const { q } = await req.json();
    if (!q || String(q).length < 2) return json({ error: "Arama metni boş." });

    const r = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.googleMapsUri",
      },
      body: JSON.stringify({ textQuery: String(q).slice(0, 200), languageCode: "tr", regionCode: "TR", pageSize: 5 }),
    });
    const d = await r.json();
    if (!r.ok) return json({ error: d?.error?.message ?? "Google hatası" });
    return json({
      sonuc: (d.places ?? []).map((p: any) => ({
        id: p.id, ad: p.displayName?.text, adres: p.formattedAddress,
        lat: p.location?.latitude ?? null, lng: p.location?.longitude ?? null,
        puan: p.rating ?? null, yorum: p.userRatingCount ?? null, url: p.googleMapsUri,
      })),
    });
  } catch (e) {
    return json({ error: String(e) });
  }
});

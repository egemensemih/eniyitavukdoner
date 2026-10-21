// Supabase Edge Function: google-mekan  (v3)
// Google anahtarı: Edge Functions > Secrets > GOOGLE_MAPS_KEY
//
// Ziyaretçiye açık işlemler (giriş gerekmez, IP başına ve günlük sınırlı):
//   link_genel {url}   Google Maps linkini çözer: ad, adres, il, ilçe, konum.            (Text Search Pro)
//   oner       {...}   Linkten tanınan mekânı öneri olarak kaydeder (Google bilgileriyle).
//
// Sadece yöneticiler:
//   ara      {q, lat?, lng?}  Aday mekân listesi.                                          (Text Search Pro)
//   link     {url}            Linki çözer; aday + il/ilçe döndürür.                          (Text Search Pro)
//   eslestir {id}             Öneriyi Google'da bulur ve kaydeder.                           (Text Search Pro)
//   detay    {place_id | id, zorla?}  Puan, yorum sayısı, son yorumlar, telefon, site,
//                             çalışma saatleri. 30 gün önbellek.                              (Place Details Enterprise + Atmosphere)
//   puan     {id}             (eski ad) detay ile aynı.
//
// Maliyet emniyeti: günlük üst sınırlar ücretsiz aylık kotaların altında tutulur.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const GUNLUK = { ara: 60, genel: 100, detay: 30 };        // Text Search Pro: 5.000/ay ücretsiz · Details: 1.000/ay
const IP_GUNLUK = 15;                                     // bir kişi günde en çok 15 link tanıtabilir
const IP_ONERI_SAAT = 8;                                  // bir kişi saatte en çok 8 öneri gönderebilir
const IZINLI_KAYNAK = ["https://eniyitavukdoner.com", "https://www.eniyitavukdoner.com", "https://egemensemih.github.io"];
const ARAMA_ALANLARI = [
  "places.id", "places.displayName", "places.formattedAddress", "places.location", "places.googleMapsUri",
  "places.primaryTypeDisplayName", "places.businessStatus", "places.addressComponents",
].join(",");
const DETAY_ALANLARI = "rating,userRatingCount,websiteUri,nationalPhoneNumber,regularOpeningHours.weekdayDescriptions,reviews,priceLevel,googleMapsUri";

const corsOf = (req: Request) => {
  const o = req.headers.get("Origin") ?? "";
  return {
    "Access-Control-Allow-Origin": IZINLI_KAYNAK.includes(o) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o) ? o : IZINLI_KAYNAK[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
};

type Yer = {
  place_id: string; ad: string; adres: string; lat: number | null; lng: number | null; url: string;
  tur: string | null; kapali: boolean; il: string | null; ilce: string | null; ulke: string | null;
};

const istGun = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });
const istSaat = () => istGun() + "T" + new Date().toLocaleTimeString("en-GB", { timeZone: "Europe/Istanbul", hour: "2-digit" });

async function sha(s: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

function linkCoz(u: string) {
  let s = u;
  try { s = decodeURIComponent(u); } catch { /* bozuk kodlama */ }
  s = s.replace(/\+/g, " ");
  const ad = (s.match(/\/place\/([^/@?]+)/) || [])[1] || (s.match(/[?&](?:q|query)=([^&]+)/) || [])[1] || null;
  const m = s.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) || s.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) ||
    s.match(/[?&](?:q|query|ll)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
  const temizAd = ad && !/^-?\d+\.\d+,/.test(ad) ? ad.trim().slice(0, 160) : null;
  return { ad: temizAd, lat: m ? parseFloat(m[1]) : null, lng: m ? parseFloat(m[2]) : null };
}

const GOOGLE_LINK = /^https:\/\/((www|maps)\.google\.[a-z.]{2,8}\/maps|maps\.app\.goo\.gl\/|goo\.gl\/maps\/|g\.co\/kgs\/|share\.google\/)/i;

async function linkAc(url: string) {
  if (!GOOGLE_LINK.test(url)) return linkCoz(url);
  try {
    // Sadece Google'ın kendi kısa link yönlendirmesi izlenir
    const r = await fetch(url, { redirect: "follow", headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(6000) });
    const son = r.url || url;
    await r.body?.cancel();
    return linkCoz(/^https:\/\/([a-z0-9-]+\.)*google\.[a-z.]+\//i.test(son) ? son : url);
  } catch { return linkCoz(url); }
}

function adresParcala(comps: any[] | undefined) {
  const bul = (t: string) => (comps || []).find((c: any) => (c.types || []).includes(t));
  const ulkeC = bul("country");
  const tr = !ulkeC || ulkeC.shortText === "TR";
  const il = bul("administrative_area_level_1")?.longText ?? null;
  const ilce = bul("administrative_area_level_2")?.longText ?? bul("sublocality_level_1")?.longText ?? bul("locality")?.longText ?? null;
  return tr ? { il, ilce, ulke: null } : { il: "Yurt dışı", ilce: null, ulke: ulkeC?.longText ?? null };
}

Deno.serve(async (req) => {
  const cors = corsOf(req);
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Yöntem desteklenmiyor." }, 405);
  try {
    const URL_ = Deno.env.get("SUPABASE_URL")!;
    const servis = createClient(URL_, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const key = Deno.env.get("GOOGLE_MAPS_KEY");
    const body = await req.json().catch(() => ({}));
    const islem = String(body.islem || "ara");
    const ip = (req.headers.get("cf-connecting-ip") || (req.headers.get("x-forwarded-for") || "").split(",")[0] || "").trim();
    const ipH = await sha("etd|" + ip);

    const sayac = async (anahtar: string, limit: number) => {
      const { data, error } = await servis.rpc("sayac_artir", { p_anahtar: anahtar, p_limit: limit });
      return !error && data === true;
    };

    const textSearch = async (q: string, lat?: number | null, lng?: number | null, adet = 5): Promise<Yer[]> => {
      const b: Record<string, unknown> = { textQuery: q.slice(0, 200), languageCode: "tr", regionCode: "TR", pageSize: adet };
      if (lat != null && lng != null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180)
        b.locationBias = { circle: { center: { latitude: lat, longitude: lng }, radius: 500 } };
      const r = await fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST", signal: AbortSignal.timeout(8000),
        headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key!, "X-Goog-FieldMask": ARAMA_ALANLARI },
        body: JSON.stringify(b),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error?.message ?? "Google hatası");
      return (d.places ?? []).map((p: any) => ({
        place_id: p.id, ad: p.displayName?.text ?? "", adres: p.formattedAddress ?? "",
        lat: p.location?.latitude ?? null, lng: p.location?.longitude ?? null, url: p.googleMapsUri ?? "",
        tur: p.primaryTypeDisplayName?.text ?? null, kapali: p.businessStatus === "CLOSED_PERMANENTLY",
        ...adresParcala(p.addressComponents),
      }));
    };
    const kaydet = async (list: Yer[]) => {
      if (!list.length) return;
      await servis.from("google_yerler").upsert(list.map(y => ({ ...y, temel_tarih: new Date().toISOString() })), { onConflict: "place_id" });
    };
    // Link çözümü, önbellekli. sinir: Google'a sormadan önce çağrılır, false dönerse sorulmaz.
    const linktenYer = async (url: string, sinir: () => Promise<boolean>): Promise<any> => {
      const anahtar = url.trim().slice(0, 600);
      const { data: ob } = await servis.from("google_link_onbellek").select("place_id").eq("anahtar", anahtar).maybeSingle();
      if (ob?.place_id) {
        const { data: y } = await servis.from("google_yerler").select("place_id,ad,adres,lat,lng,url,tur,kapali,il,ilce,ulke").eq("place_id", ob.place_id).maybeSingle();
        if (y) return { yer: y as Yer, adaylar: [y as Yer] };
      }
      const c = await linkAc(anahtar);
      if (!c.ad && c.lat == null) return { hata: "Bu linkten mekân okunamadı. Google Maps'te mekânı açıp Paylaş > Bağlantıyı kopyala ile aldığın linki yapıştır." };
      if (!c.ad) return { konum: { lat: c.lat, lng: c.lng } };
      if (!(await sinir())) return { sinir: true, ad: c.ad, konum: { lat: c.lat, lng: c.lng } };
      const list = await textSearch(c.ad, c.lat, c.lng, 3);
      await kaydet(list);
      if (list[0]) await servis.from("google_link_onbellek").upsert({ anahtar, place_id: list[0].place_id, tarih: new Date().toISOString() });
      return { yer: list[0] ?? null, adaylar: list, konum: { lat: c.lat, lng: c.lng } };
    };

    // =================== ziyaretçi işlemleri ===================
    if (islem === "link_genel" || islem === "oner") {
      const origin = req.headers.get("Origin") ?? "";
      if (origin && !IZINLI_KAYNAK.includes(origin) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return json({ error: "İzin yok." }, 403);
    }

    if (islem === "link_genel") {
      const url = String(body.url || "").trim();
      if (!/^https?:\/\//i.test(url) || url.length > 600) return json({ error: "Geçerli bir Google Maps linki yapıştır." });
      if (!key) return json({ sinir: true });
      const r: any = await linktenYer(url, async () =>
        (await sayac(`glink:ip:${ipH}:${istGun()}`, IP_GUNLUK)) && (await sayac(`google:genel:${istGun()}`, GUNLUK.genel)));
      if ("hata" in r) return json({ error: r.hata });
      if ("sinir" in r) return json({ sinir: true, ad: r.ad, konum: r.konum });
      if (!r.yer) return json({ konum: r.konum ?? null });
      const y = r.yer;
      return json({ yer: { place_id: y.place_id, ad: y.ad, adres: y.adres, il: y.il, ilce: y.ilce, ulke: y.ulke, lat: y.lat, lng: y.lng, kapali: y.kapali, tur: y.tur } });
    }

    if (islem === "oner") {
      const t = (v: unknown, n: number) => { const s = String(v ?? "").trim(); return s ? s.slice(0, n) : null; };
      if (body.kvkk_onay !== true) return json({ error: "Aydınlatma metni onayı gerekli." });
      if (body.web) return json({ ok: true });                       // bal küpü doluysa sessizce geç
      const pid = t(body.place_id, 300);
      if (!pid) return json({ error: "Mekân bilgisi eksik." });
      const { data: y } = await servis.from("google_yerler").select("*").eq("place_id", pid).maybeSingle();
      if (!y) return json({ error: "Mekân bulunamadı, linki yeniden yapıştırır mısın?" });
      if (!(await sayac(`oner:ip:${ipH}:${istSaat()}`, IP_ONERI_SAAT))) return json({ error: "Çok fazla öneri gönderdin, biraz sonra tekrar dene." });
      let il = t(body.il, 40) ?? y.il, ilce = t(body.ilce, 60) ?? y.ilce, ulke = t(body.ulke, 60) ?? y.ulke;
      if (il === "Yurt dışı") ilce = null; else ulke = null;
      const row = {
        mekan_adi: (t(body.mekan_adi, 120) ?? y.ad ?? "").slice(0, 120), il, ilce, ulke,
        adres: t(body.link, 400), neden: t(body.neden, 1000), takma_ad: t(body.takma_ad, 60),
        yayin_izni: body.yayin_izni === true, kvkk_onay: true, durum: "yeni", onayli: false, kaynak: "site_link",
        google_place_id: y.place_id, google_ad: y.ad, google_adres: y.adres, google_url: y.url, google_tur: y.tur,
        google_eslesme: y.kapali ? "kapali" : "otomatik", lat: y.lat, lng: y.lng,
      };
      if (!row.mekan_adi || row.mekan_adi.length < 2) return json({ error: "Mekân adı eksik." });
      const { error } = await servis.from("mekan_onerileri").insert(row);
      if (error) return json({ error: "Kaydedilemedi, biraz sonra tekrar dener misin?" });
      return json({ ok: true });
    }

    // =================== yönetici işlemleri ===================
    const kul = createClient(URL_, Deno.env.get("SUPABASE_ANON_KEY") ?? req.headers.get("apikey") ?? "", {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } }, auth: { persistSession: false },
    });
    const { data: ok } = await kul.rpc("is_admin");
    if (!ok) return json({ error: "Bu işlem için yönetici girişi gerekli." }, 403);
    if (!key) return json({ error: "GOOGLE_MAPS_KEY eklenmemiş." });
    const hak = async (tur: "ara" | "detay") => {
      const { data } = await kul.rpc("google_hak", { p_tur: tur, p_limit: GUNLUK[tur] });
      return data === true;
    };

    if (islem === "ara") {
      const q = String(body.q || "").trim();
      if (q.length < 2) return json({ error: "Arama metni boş." });
      if (!(await hak("ara"))) return json({ error: "Bugünkü Google arama sınırı doldu (ücretsiz kullanım koruması)." });
      const list = await textSearch(q, body.lat ?? null, body.lng ?? null);
      await kaydet(list);
      return json({ sonuc: list.map(y => ({ ...y, id: y.place_id })) });
    }

    if (islem === "link") {
      const r: any = await linktenYer(String(body.url || ""), () => hak("ara"));
      if ("hata" in r) return json({ error: r.hata });
      if ("sinir" in r) return json({ error: "Bugünkü Google arama sınırı doldu.", konum: r.konum });
      return json({ sonuc: (r.adaylar ?? []).map((y: Yer) => ({ ...y, id: y.place_id })), konum: r.konum ?? null });
    }

    if (islem === "eslestir") {
      const { data: r } = await servis.from("mekan_onerileri").select("*").eq("id", body.id).single();
      if (!r) return json({ error: "Öneri bulunamadı." });
      if (r.google_place_id) return json({ satir: r });
      const yer = [r.ilce, r.il === "Yurt dışı" ? r.ulke : r.il].filter(Boolean).join(" ");
      let q = [r.mekan_adi, yer].filter(Boolean).join(" ");
      let lat: number | null = null, lng: number | null = null;
      if (/^https?:\/\//i.test(r.adres || "")) {
        const c = await linkAc(r.adres);
        if (c.ad) q = c.ad + (c.lat == null ? " " + yer : "");
        lat = c.lat; lng = c.lng;
      } else if (r.adres) q += " " + r.adres;
      if (!(await hak("ara"))) return json({ error: "Bugünkü Google arama sınırı doldu." });
      const list = await textSearch(q, lat, lng, 1);
      await kaydet(list);
      const p = list[0];
      const upd: Record<string, unknown> = p
        ? { google_place_id: p.place_id, google_ad: p.ad, google_adres: p.adres, google_url: p.url, google_tur: p.tur, google_eslesme: p.kapali ? "kapali" : "otomatik" }
        : { google_eslesme: "bulunamadi" };
      if (p && r.lat == null && p.lat != null) { upd.lat = p.lat; upd.lng = p.lng; }
      const { data: yeni, error } = await servis.from("mekan_onerileri").update(upd).eq("id", r.id).select().single();
      if (error) return json({ error: error.message });
      return json({ satir: yeni });
    }

    if (islem === "detay" || islem === "puan") {
      let pid: string | null = body.place_id ? String(body.place_id) : null;
      if (!pid && body.id) {
        const { data: r } = await servis.from("mekan_onerileri").select("google_place_id").eq("id", body.id).single();
        pid = r?.google_place_id ?? null;
      }
      if (!pid) return json({ error: "Önce mekânı Google ile eşleştir." });
      const { data: once } = await servis.from("google_yerler").select("*").eq("place_id", pid).maybeSingle();
      const taze = once?.detay_tarih && Date.now() - new Date(once.detay_tarih).getTime() < 30 * 864e5;
      let y = once;
      if (!taze || body.zorla) {
        if (!(await hak("detay"))) {
          if (once?.detay_tarih) y = once; else return json({ error: "Bugünkü Google detay sorgusu sınırı doldu (ücretsiz kullanım koruması)." });
        } else {
          const g = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(pid)}?languageCode=tr`, {
            headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": DETAY_ALANLARI }, signal: AbortSignal.timeout(8000),
          });
          const d = await g.json();
          if (!g.ok) return json({ error: d?.error?.message ?? "Google hatası" });
          const web = d.websiteUri ?? null;
          const det = {
            place_id: pid, puan: d.rating ?? null, yorum_sayisi: d.userRatingCount ?? 0, web,
            instagram: web && /instagram\.com/i.test(web) ? web : (once?.instagram ?? null),
            telefon: d.nationalPhoneNumber ?? null, saatler: d.regularOpeningHours?.weekdayDescriptions ?? null,
            fiyat: d.priceLevel ?? null, detay_tarih: new Date().toISOString(),
            url: d.googleMapsUri ?? once?.url ?? null,
            yorumlar: (d.reviews ?? []).slice(0, 5).map((r: any) => ({
              yazar: r.authorAttribution?.displayName ?? "", puan: r.rating ?? null, zaman: r.relativePublishTimeDescription ?? "",
              metin: (r.text?.text ?? r.originalText?.text ?? "").slice(0, 1200), link: r.googleMapsUri ?? null,
            })),
          };
          await servis.from("google_yerler").upsert(det, { onConflict: "place_id" });
          y = { ...(once ?? {}), ...det };
        }
      }
      const puan = { google_puan: y?.puan ?? null, google_yorum: y?.yorum_sayisi ?? null, google_puan_tarih: y?.detay_tarih ?? null };
      await servis.from("mekan_onerileri").update(puan).eq("google_place_id", pid);
      return json({ detay: y, puan, place_id: pid });
    }

    return json({ error: "Bilinmeyen işlem." });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) });
  }
});

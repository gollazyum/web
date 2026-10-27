import type { PlaceHit } from "@/lib/places";

// 숙소 검색창 자동완성. Google Places 자동완성으로 호텔·도시 이름을 추천한다.
// 키는 Vercel 환경변수 GOOGLE_MAPS_API_KEY 에만 둔다. 없으면 503이고, 화면은 도시 목록만 보여 준다.
export const runtime = "nodejs";

const CACHE_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX = 2000;
const LIMIT_PER_WINDOW = 120;
const WINDOW_MS = 10 * 60 * 1000;

// 서버 인스턴스마다 따로 두는 저장소와 요청 횟수 제한
const cache = new Map<string, { at: number; data: PlaceHit[] }>();
const hits = new Map<string, { count: number; reset: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || entry.reset < now) {
    hits.set(ip, { count: 1, reset: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > LIMIT_PER_WINDOW;
}

type Prediction = {
  placePrediction?: {
    types?: string[];
    structuredFormat?: { mainText?: { text?: string }; secondaryText?: { text?: string } };
  };
};

export async function GET(req: Request) {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return Response.json({ error: "not_configured" }, { status: 503 });

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 60);
  const session = (url.searchParams.get("session") ?? "").slice(0, 64);
  if (q.length < 2) return Response.json({ places: [] });

  const saved = cache.get(q);
  if (saved && Date.now() - saved.at < CACHE_MS) return Response.json({ places: saved.data });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  if (rateLimited(ip)) return Response.json({ error: "rate_limited" }, { status: 429 });

  let json: { suggestions?: Prediction[] };
  try {
    const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key },
      body: JSON.stringify({
        input: q,
        languageCode: "ko",
        includedPrimaryTypes: ["lodging", "locality", "sublocality", "administrative_area_level_1"],
        ...(session ? { sessionToken: session } : {}),
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    json = await res.json();
    if (!res.ok) {
      console.error("places", res.status, JSON.stringify(json).slice(0, 300));
      return Response.json({ error: "upstream" }, { status: 502 });
    }
  } catch (e) {
    console.error("places", e);
    return Response.json({ error: "upstream" }, { status: 502 });
  }

  const places: PlaceHit[] = (json.suggestions ?? [])
    .map((s) => s.placePrediction)
    .filter((p): p is NonNullable<Prediction["placePrediction"]> => !!p?.structuredFormat?.mainText?.text)
    .map((p) => ({
      name: p.structuredFormat!.mainText!.text!,
      sub: p.structuredFormat?.secondaryText?.text ?? "",
      kind: p.types?.includes("lodging") ? "hotel" : "city",
    }));

  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
  cache.set(q, { at: Date.now(), data: places });
  return Response.json({ places });
}

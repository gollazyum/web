import type { FlightOption, FlightResults } from "@/lib/flights";

// 실시간 항공권 가격. SerpApi의 Google Flights 결과를 받아 화면용으로 줄인다.
// API 키는 Vercel 환경변수 SERPAPI_API_KEY 에만 둔다. 검색 1번마다 SerpApi 요금이 나가서
// 같은 조건은 잠깐 저장해 두고 다시 쓰고, 한 사람이 너무 자주 찾지 못하게 막는다.
export const runtime = "nodejs";

const CACHE_MS = 30 * 60 * 1000;
const CACHE_MAX = 500;
const LIMIT_PER_WINDOW = 10;
const WINDOW_MS = 10 * 60 * 1000;
const MAX_OPTIONS = 15;

const AIRPORTS = /^[A-Z]{3}(,[A-Z]{3}){0,3}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

// 서버 인스턴스마다 따로 두는 저장소와 검색 횟수 제한
const cache = new Map<string, { at: number; data: FlightResults }>();
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

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseQuery(body: unknown) {
  if (!body || typeof body !== "object") return null;
  const { from, to, depart, ret, adults } = body as Record<string, unknown>;
  if (typeof from !== "string" || !AIRPORTS.test(from)) return null;
  if (typeof to !== "string" || !AIRPORTS.test(to)) return null;
  if (typeof depart !== "string" || !DATE.test(depart) || depart < today()) return null;
  if (typeof ret !== "string" || (ret && (!DATE.test(ret) || ret < depart))) return null;
  if (typeof adults !== "number" || !Number.isInteger(adults) || adults < 1 || adults > 9) return null;
  return { from, to, depart, ret, adults };
}

type Segment = {
  airline?: string;
  departure_airport?: { id?: string; time?: string };
  arrival_airport?: { id?: string; time?: string };
};
type Trip = {
  flights?: Segment[];
  layovers?: { id?: string }[];
  total_duration?: number;
  price?: number;
  airline_logo?: string;
};
type SerpResponse = {
  error?: string;
  best_flights?: Trip[];
  other_flights?: Trip[];
  price_insights?: { lowest_price?: number; price_level?: string; typical_price_range?: [number, number] };
};

function toOption(t: Trip): FlightOption | null {
  const segs = t.flights ?? [];
  const first = segs[0];
  const last = segs[segs.length - 1];
  if (!first || !last || typeof t.price !== "number") return null;
  return {
    price: t.price,
    airlines: [...new Set(segs.map((s) => s.airline).filter((a): a is string => !!a))],
    logo: t.airline_logo ?? "",
    departTime: first.departure_airport?.time ?? "",
    arriveTime: last.arrival_airport?.time ?? "",
    fromId: first.departure_airport?.id ?? "",
    toId: last.arrival_airport?.id ?? "",
    minutes: t.total_duration ?? 0,
    stops: (t.layovers ?? []).map((l) => l.id ?? "").filter(Boolean),
  };
}

export async function POST(req: Request) {
  const key = process.env.SERPAPI_API_KEY;
  if (!key) return Response.json({ error: "not_configured" }, { status: 503 });

  const q = parseQuery(await req.json().catch(() => null));
  if (!q) return Response.json({ error: "bad_request" }, { status: 400 });

  const cacheKey = `${q.from}|${q.to}|${q.depart}|${q.ret}|${q.adults}`;
  const saved = cache.get(cacheKey);
  if (saved && Date.now() - saved.at < CACHE_MS) return Response.json(saved.data);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  if (rateLimited(ip)) return Response.json({ error: "rate_limited" }, { status: 429 });

  const params = new URLSearchParams({
    engine: "google_flights",
    departure_id: q.from,
    arrival_id: q.to,
    outbound_date: q.depart,
    type: q.ret ? "1" : "2",
    adults: String(q.adults),
    currency: "KRW",
    hl: "ko",
    gl: "kr",
    api_key: key,
  });
  if (q.ret) params.set("return_date", q.ret);

  let json: SerpResponse;
  try {
    const res = await fetch(`https://serpapi.com/search.json?${params}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(25_000),
    });
    json = (await res.json()) as SerpResponse;
    // 결과가 없는 노선도 error 문구로 오므로 빈 목록으로 돌려준다
    if (!res.ok && !json.error?.includes("hasn't returned any results")) {
      console.error("serpapi", res.status, json.error);
      return Response.json({ error: "upstream" }, { status: 502 });
    }
  } catch (e) {
    console.error("serpapi", e);
    return Response.json({ error: "upstream" }, { status: 502 });
  }

  const options = [...(json.best_flights ?? []), ...(json.other_flights ?? [])]
    .map(toOption)
    .filter((o): o is FlightOption => !!o)
    .sort((a, b) => a.price - b.price)
    .slice(0, MAX_OPTIONS);
  const insights = json.price_insights;
  const data: FlightResults = {
    options,
    lowest: insights?.lowest_price ?? options[0]?.price ?? null,
    level: insights?.price_level ?? null,
    typical: insights?.typical_price_range ?? null,
  };

  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
  cache.set(cacheKey, { at: Date.now(), data });
  return Response.json(data);
}

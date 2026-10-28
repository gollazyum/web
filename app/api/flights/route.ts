import type { FlightOption, FlightResults } from "@/lib/flights";
import { DATE, serpSearch, today } from "@/lib/serpapi";

// 실시간 항공권 가격. SerpApi의 Google Flights 결과를 받아 화면용으로 줄인다.
export const runtime = "nodejs";
// SerpApi 응답이 10초를 넘길 때가 있어 함수 시간을 넉넉히 준다
export const maxDuration = 30;

const MAX_OPTIONS = 30;
const AIRPORTS = /^[A-Z]{3}(,[A-Z]{3}){0,3}$/;
const TOKEN = /^[A-Za-z0-9_\-=+/]{1,2000}$/;

function parseQuery(body: unknown) {
  if (!body || typeof body !== "object") return null;
  const { from, to, depart, ret, adults, token } = body as Record<string, unknown>;
  if (typeof from !== "string" || !AIRPORTS.test(from)) return null;
  if (typeof to !== "string" || !AIRPORTS.test(to)) return null;
  if (typeof depart !== "string" || !DATE.test(depart) || depart < today()) return null;
  if (typeof ret !== "string" || (ret && (!DATE.test(ret) || ret < depart))) return null;
  if (typeof adults !== "number" || !Number.isInteger(adults) || adults < 1 || adults > 9) return null;
  // 오는 편 조회: 가는 편 결과의 departure_token (왕복일 때만)
  if (token !== undefined && (typeof token !== "string" || !ret || !TOKEN.test(token))) return null;
  return { from, to, depart, ret, adults, token: (token as string | undefined) ?? "" };
}

type Segment = {
  airline?: string;
  flight_number?: string;
  airplane?: string;
  duration?: number;
  departure_airport?: { id?: string; name?: string; time?: string };
  arrival_airport?: { id?: string; name?: string; time?: string };
};
type Trip = {
  flights?: Segment[];
  layovers?: { id?: string; duration?: number }[];
  total_duration?: number;
  price?: number;
  airline_logo?: string;
  departure_token?: string;
};
type SerpFlights = {
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
    segments: segs.map((s) => ({
      airline: s.airline ?? "",
      flightNo: s.flight_number ?? "",
      plane: s.airplane ?? "",
      fromId: s.departure_airport?.id ?? "",
      fromName: s.departure_airport?.name ?? "",
      toId: s.arrival_airport?.id ?? "",
      toName: s.arrival_airport?.name ?? "",
      departTime: s.departure_airport?.time ?? "",
      arriveTime: s.arrival_airport?.time ?? "",
      minutes: s.duration ?? 0,
    })),
    layovers: (t.layovers ?? []).filter((l) => l.id).map((l) => l.duration ?? 0),
    ...(t.departure_token ? { token: t.departure_token } : {}),
  };
}

function shape(raw: Record<string, unknown>): FlightResults {
  const json = raw as SerpFlights;
  const options = [...(json.best_flights ?? []), ...(json.other_flights ?? [])]
    .map(toOption)
    .filter((o): o is FlightOption => !!o)
    .sort((a, b) => a.price - b.price)
    .slice(0, MAX_OPTIONS);
  const insights = json.price_insights;
  return {
    options,
    lowest: insights?.lowest_price ?? options[0]?.price ?? null,
    level: insights?.price_level ?? null,
    typical: insights?.typical_price_range ?? null,
  };
}

export async function POST(req: Request) {
  const q = parseQuery(await req.json().catch(() => null));
  if (!q) return Response.json({ error: "bad_request" }, { status: 400 });

  const params: Record<string, string> = {
    engine: "google_flights",
    departure_id: q.from,
    arrival_id: q.to,
    outbound_date: q.depart,
    type: q.ret ? "1" : "2",
    adults: String(q.adults),
    currency: "KRW",
    hl: "ko",
    gl: "kr",
  };
  if (q.ret) params.return_date = q.ret;
  // 왕복 첫 검색에는 가는 편만 온다. 카드의 '상세 보기'를 누르면 그 가는 편의 토큰으로 오는 편을 한 번 더 찾는다
  if (q.token) params.departure_token = q.token;
  return serpSearch(req, params, shape);
}

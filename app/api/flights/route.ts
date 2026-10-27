import type { FlightOption, FlightResults } from "@/lib/flights";
import { DATE, serpSearch, today } from "@/lib/serpapi";

// 실시간 항공권 가격. SerpApi의 Google Flights 결과를 받아 화면용으로 줄인다.
export const runtime = "nodejs";
// SerpApi 응답이 10초를 넘길 때가 있어 함수 시간을 넉넉히 준다
export const maxDuration = 30;

const MAX_OPTIONS = 15;
const AIRPORTS = /^[A-Z]{3}(,[A-Z]{3}){0,3}$/;

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
  return serpSearch(req, params, shape);
}

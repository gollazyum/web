"use client";

import type { FlightResults } from "@/lib/flights";
import type { HotelPrices, HotelResults } from "@/lib/hotels";
import type { FlightQuery, ParseResult, PickResult, StayQuery } from "@/lib/trip";
import { airportsFor } from "@/lib/airports";
import { distText, nearby } from "@/lib/landmarks";
import { hhmm } from "@/lib/trip";
import type { FlightOption } from "@/lib/flights";
import type { HotelOption } from "@/lib/hotels";

// 화면 → 서버 호출. 실패하면 status(연결 실패는 null)만 돌려준다 (서버 오류 원문은 화면에 쓰지 않는다)
export type Res<T> = { ok: true; data: T } | { ok: false; status: number | null };

async function post<T>(url: string, body: unknown): Promise<Res<T>> {
  try {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!r.ok) return { ok: false, status: r.status };
    return { ok: true, data: (await r.json()) as T };
  } catch {
    return { ok: false, status: null };
  }
}

// 같은 조건의 검색은 이 탭(sessionStorage)에 30분 담아 두고 다시 부르지 않는다. 결과는 20~30곳이라 작다
const CACHE_MS = 30 * 60 * 1000;
const CACHE_PREFIX = "tb-cache-v1:";

type Cached<T> = { at: number; data: T };

function readCache<T>(key: string): Cached<T> | null {
  try {
    const raw = sessionStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const c = JSON.parse(raw) as Cached<T>;
    return Date.now() - c.at < CACHE_MS ? c : null;
  } catch {
    return null;
  }
}

function writeCache<T>(key: string, data: T) {
  try {
    sessionStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ at: Date.now(), data }));
  } catch {
    // 저장소가 가득 차면 오래된 것부터 지우고 넘어간다
    try {
      Object.keys(sessionStorage)
        .filter((k) => k.startsWith(CACHE_PREFIX))
        .forEach((k) => sessionStorage.removeItem(k));
    } catch {
      // 저장소를 못 쓰면 캐시 없이 쓴다
    }
  }
}

// 성공한 응답만 담는다. at: 가격을 받아 온 시각 (예약처 시트의 '가격 확인 시각')
// 같은 조건을 동시에 부르면(미리 조회 + 시트 열기) 한 번만 보낸다
const pending = new Map<string, Promise<Res<unknown> & { at?: number }>>();

async function cached<T>(key: string, load: () => Promise<Res<T>>, fresh = false): Promise<Res<T> & { at?: number }> {
  const hit = fresh ? null : readCache<T>(key);
  if (hit) return { ok: true, data: hit.data, at: hit.at };
  const going = !fresh && pending.get(key);
  if (going) return going as Promise<Res<T> & { at?: number }>;
  const run = load().then((r) => {
    pending.delete(key);
    if (r.ok) writeCache(key, r.data);
    return r.ok ? { ...r, at: Date.now() } : r;
  });
  pending.set(key, run);
  return run;
}

// stars: 성급 필터를 눌렀을 때만 "4" 또는 "4,5"처럼 그 성급만 다시 찾는다
export const searchStays = (q: StayQuery, stars?: string) => {
  const body = { q: q.place, checkIn: q.checkIn, checkOut: q.checkOut, adults: q.adults, ...kids(q), ...(stars ? { stars } : {}) };
  return cached(`stay:${JSON.stringify(body)}`, () => post<HotelResults>("/api/hotels", body));
};

// 숙소 목록 다음 쪽 (스크롤 끝에서만 부른다. 한 쪽 = 검색 1번). 같은 쪽은 이 탭에 30분 담아 둔다
export const searchStaysPage = (q: StayQuery, page: string, stars?: string) => {
  const body = { q: q.place, checkIn: q.checkIn, checkOut: q.checkOut, adults: q.adults, ...kids(q), page, ...(stars ? { stars } : {}) };
  return cached(`stay-page:${JSON.stringify(body)}`, () => post<HotelResults>("/api/hotels", body));
};

// P1-4: 아동·소아·좌석 등급은 있을 때만 보낸다 (없으면 예전과 같은 요청 → 캐시도 그대로)
const kids = (q: { childAges?: number[] }) => (q.childAges?.length ? { childAges: q.childAges } : {});
const pax = (q: { children?: number; cabin?: string }) => ({ ...(q.children ? { children: q.children } : {}), ...(q.cabin && q.cabin !== "y" ? { cabin: q.cabin } : {}) });

// fresh: '다시 검색'·'가격 다시 보기'를 눌렀을 때만 이 탭과 서버의 저장된 가격을 건너뛴다
export const stayPrices = (token: string, q: StayQuery, name: string, fresh = false) => {
  const body = { q: name.slice(0, 100), checkIn: q.checkIn, checkOut: q.checkOut, adults: q.adults, ...kids(q), token, ...(fresh ? { fresh: true } : {}) };
  return cached(`price:${token}:${q.checkIn}:${q.checkOut}:${q.adults}:${(q.childAges ?? []).join(".")}`, () => post<HotelPrices>("/api/hotels", body), fresh);
};

export async function searchFlights(q: FlightQuery) {
  // 도시 코드(SEL, OSA)는 그 도시 공항들로 바꿔 보낸다
  const [from, to] = await Promise.all([airportsFor(q.from), airportsFor(q.to)]);
  const body = { from, to, depart: q.depart, ret: q.ret, adults: q.adults, ...pax(q) };
  return cached(`flight:${JSON.stringify(body)}`, () => post<FlightResults>("/api/flights", body));
}

// 왕복: 가는 편 하나의 토큰으로 오는 편 후보를 한 번 찾는다 (카드 상세를 열 때만)
export async function searchFlightReturns(q: FlightQuery, token: string) {
  const [from, to] = await Promise.all([airportsFor(q.from), airportsFor(q.to)]);
  const body = { from, to, depart: q.depart, ret: q.ret, adults: q.adults, ...pax(q), token };
  return cached(`flightret:${token}`, () => post<FlightResults>("/api/flights", body));
}

export const parseText = (text: string, today: string, context: string) => post<ParseResult>("/api/trip-ai", { mode: "parse", text, today, context });

// P2: 같은 목록·같은 취향의 AI 추천은 이 탭에 담아 두고 다시 부르지 않는다 (홈 검색이 주소를 바꾸며 두 번 불리는 경우 포함)
function hashOf(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36) + text.length.toString(36);
}
const pickCached = (body: Record<string, unknown>) => {
  const key = `pick:${hashOf(JSON.stringify(body))}`;
  return cached(key, () => post<PickResult>("/api/trip-ai", body));
};

export const pickStays = (list: HotelOption[], taste: string, budget: number) =>
  pickCached({
    mode: "pick",
    kind: "stay",
    taste,
    budget,
    items: list.map((h) => ({
      name: h.name,
      kind: h.kind,
      stars: h.stars ?? 0,
      rating: h.rating ?? 0,
      reviews: h.reviews ?? 0,
      total: h.total ?? 0,
      perNight: h.perNight ?? 0,
      amenities: h.amenities.slice(0, 12).join(", "),
      deal: h.deal,
      // 패널에 보이는 거리 정보도 같이 넘긴다 (가까운 역·장소 소요 시간 + 주요 장소까지 직선거리)
      distance: [h.near ? `${h.near.name} ${h.near.how} ${h.near.mins}분` : "", ...nearby(h.gps).slice(0, 2).map((n) => `${n.name} 직선 ${distText(n.km)}`)].filter(Boolean).join(", "),
    })),
  });

// 항공 AI: 실패하면(사용량 초과·설정 없음 제외) 한 번만 다시 부른다
export async function pickFlights(list: FlightOption[], taste: string) {
  const first = await pickFlightsOnce(list, taste);
  if (first.ok || first.status === 429 || first.status === 503 || first.status === 400) return first;
  return pickFlightsOnce(list, taste);
}

const pickFlightsOnce = (list: FlightOption[], taste: string) =>
  pickCached({
    mode: "pick",
    kind: "flight",
    taste,
    items: list.map((o) => ({
      airlines: o.airlines.join(", "),
      depart: hhmm(o.departTime),
      arrive: hhmm(o.arriveTime),
      minutes: o.minutes,
      stops: o.stops.length,
      via: o.stops.join(", "),
      price: o.price,
    })),
  });

// 숙소 상세 'AI에게 물어보기': facts는 화면에 보이는 그 숙소 정보 (글)
export const askHotel = (facts: string, question: string) => post<{ answer: string }>("/api/trip-ai", { mode: "hotel", facts, question });

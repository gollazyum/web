"use client";

import type { FlightResults } from "@/lib/flights";
import type { HotelPrices, HotelResults } from "@/lib/hotels";
import type { FlightQuery, ParseResult, PickResult, StayQuery } from "@/lib/trip";
import { airportsFor } from "@/lib/airports";
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
async function cached<T>(key: string, load: () => Promise<Res<T>>, fresh = false): Promise<Res<T> & { at?: number }> {
  const hit = fresh ? null : readCache<T>(key);
  if (hit) return { ok: true, data: hit.data, at: hit.at };
  const r = await load();
  if (r.ok) writeCache(key, r.data);
  return r.ok ? { ...r, at: Date.now() } : r;
}

export const searchStays = (q: StayQuery) => {
  const body = { q: q.place, checkIn: q.checkIn, checkOut: q.checkOut, adults: q.adults };
  return cached(`stay:${JSON.stringify(body)}`, () => post<HotelResults>("/api/hotels", body));
};

// fresh: '다시 검색'을 눌렀을 때만 캐시를 건너뛴다
export const stayPrices = (token: string, q: StayQuery, name: string, fresh = false) => {
  const body = { q: name.slice(0, 100), checkIn: q.checkIn, checkOut: q.checkOut, adults: q.adults, token };
  return cached(`price:${token}:${q.checkIn}:${q.checkOut}:${q.adults}`, () => post<HotelPrices>("/api/hotels", body), fresh);
};

export async function searchFlights(q: FlightQuery) {
  // 도시 코드(SEL, OSA)는 그 도시 공항들로 바꿔 보낸다
  const [from, to] = await Promise.all([airportsFor(q.from), airportsFor(q.to)]);
  const body = { from, to, depart: q.depart, ret: q.ret, adults: q.adults };
  return cached(`flight:${JSON.stringify(body)}`, () => post<FlightResults>("/api/flights", body));
}

export const parseText = (text: string, today: string, context: string) => post<ParseResult>("/api/trip-ai", { mode: "parse", text, today, context });

export const pickStays = (list: HotelOption[], taste: string, budget: number) =>
  post<PickResult>("/api/trip-ai", {
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
    })),
  });

export const pickFlights = (list: FlightOption[], taste: string) =>
  post<PickResult>("/api/trip-ai", {
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

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

export const searchStays = (q: StayQuery) =>
  post<HotelResults>("/api/hotels", { q: q.place, checkIn: q.checkIn, checkOut: q.checkOut, adults: q.adults });

export const stayPrices = (token: string, q: StayQuery, name: string) =>
  post<HotelPrices>("/api/hotels", { q: name.slice(0, 100), checkIn: q.checkIn, checkOut: q.checkOut, adults: q.adults, token });

export async function searchFlights(q: FlightQuery) {
  // 도시 코드(SEL, OSA)는 그 도시 공항들로 바꿔 보낸다
  const [from, to] = await Promise.all([airportsFor(q.from), airportsFor(q.to)]);
  return post<FlightResults>("/api/flights", { from, to, depart: q.depart, ret: q.ret, adults: q.adults });
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

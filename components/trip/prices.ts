"use client";

import { useSyncExternalStore } from "react";
import { sellerRows, type HotelOption } from "@/lib/hotels";
import { nightsOf, stayTotal, type StayQuery } from "@/lib/trip";
import { stayPrices } from "./api";

// 카드 금액 ↔ 예약처 시트 1위 총액 맞추기.
// 시트(또는 미리 조회)에서 허용 예약처 가격을 받으면 그 1위 총액을 여기 적어 두고, 목록 카드는 이 값을 먼저 쓴다.
// 같은 탭에서는 sessionStorage에 30분 남겨 새로고침해도 맞춘 금액이 유지된다
export type Verified = { total: number | null; count: number; at: number }; // total null: 비교할 수 있는 예약처 0곳

const KEEP_MS = 30 * 60 * 1000;
const PREFIX = "tb-verified-v1:";
const mem = new Map<string, Verified>();
const subs = new Set<() => void>();
let version = 0;

const keyOf = (token: string, q: Pick<StayQuery, "checkIn" | "checkOut" | "adults">) => `${token}:${q.checkIn}:${q.checkOut}:${q.adults}`;

export function getVerified(token: string, q: Pick<StayQuery, "checkIn" | "checkOut" | "adults">): Verified | undefined {
  const k = keyOf(token, q);
  const hit = mem.get(k);
  if (hit) return hit;
  try {
    const raw = sessionStorage.getItem(PREFIX + k);
    if (!raw) return undefined;
    const v = JSON.parse(raw) as Verified;
    if (Date.now() - v.at > KEEP_MS) return undefined;
    mem.set(k, v);
    return v;
  } catch {
    return undefined;
  }
}

export function setVerified(token: string, q: Pick<StayQuery, "checkIn" | "checkOut" | "adults">, rows: { cost: number }[]) {
  const k = keyOf(token, q);
  const v: Verified = { total: rows[0]?.cost ?? null, count: rows.length, at: Date.now() };
  const old = mem.get(k);
  if (old && old.total === v.total && old.count === v.count) return;
  mem.set(k, v);
  try {
    sessionStorage.setItem(PREFIX + k, JSON.stringify(v));
  } catch {
    // 저장소를 못 쓰면 이 화면에서만 맞춘다
  }
  version++;
  subs.forEach((f) => f());
}

// 맞춘 금액이 바뀌면 목록을 다시 그린다
export function usePriceVersion(): number {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => version,
    () => 0,
  );
}

// 카드에 보여 줄 금액. verified: 시트 1위 총액과 같은 값, none: 허용 예약처 0곳
export type ShownPrice = { value: number | null; verified: boolean; none: boolean; count: number | null };

export function shownPrice(h: HotelOption, q: StayQuery): ShownPrice {
  const v = getVerified(h.token, q);
  if (v) return { value: v.total, verified: v.total !== null, none: v.total === null, count: v.count };
  return { value: stayTotal(h, nightsOf(q))?.value ?? null, verified: false, none: false, count: null };
}

// 정렬용 금액 (0곳이면 맨 뒤)
export const shownCost = (h: HotelOption, q: StayQuery) => {
  const p = shownPrice(h, q);
  return p.none || p.value === null ? Infinity : p.value;
};

// AI 추천 상위 몇 곳은 미리 예약처 가격을 받아 카드 금액을 맞춘다 (같은 조건은 캐시라 다시 부르지 않는다)
const inflight = new Set<string>();
export function prefetchPrices(list: HotelOption[], q: StayQuery) {
  const hq = { q: q.place, checkIn: q.checkIn, checkOut: q.checkOut, adults: q.adults };
  for (const h of list) {
    const k = keyOf(h.token, q);
    if (inflight.has(k) || getVerified(h.token, q)) continue;
    inflight.add(k);
    stayPrices(h.token, q, h.name).then((r) => {
      inflight.delete(k);
      if (r.ok) setVerified(h.token, q, sellerRows(r.data.sources, nightsOf(q), h.name, hq));
    });
  }
}

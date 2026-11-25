"use client";

import { useSyncExternalStore } from "react";
import { sellerRows, type HotelOption } from "@/lib/hotels";
import type { HotelSellerKey } from "@/lib/hotel-sellers";
import { nightsOf, stayTotal, type StayQuery } from "@/lib/trip";
import { stayPrices } from "./api";
import { savingsOf } from "@/lib/savings";

// 카드 금액 ↔ 예약처 시트 1위 총액 맞추기.
// 시트(또는 미리 조회)에서 허용 예약처 가격을 받으면 그 1위 총액을 여기 적어 두고, 목록 카드는 이 값을 먼저 쓴다.
// 같은 탭에서는 sessionStorage에 30분 남겨 새로고침해도 맞춘 금액이 유지된다
export type Verified = { total: number | null; count: number; at: number; seller?: HotelSellerKey; fc?: boolean; save?: number }; // save: 가장 비싼 예약처보다 아끼는 금액 (확인한 세금 포함 총액끼리, lib/savings.ts) // total null: 비교할 수 있는 예약처 0곳, seller: 1위 예약처, fc: 무료 취소라고 온 예약처가 있음

const KEEP_MS = 30 * 60 * 1000;
const PREFIX = "tb-verified-v2:";
const mem = new Map<string, Verified>();
const subs = new Set<() => void>();
let version = 0;

const keyOf = (token: string, q: Pick<StayQuery, "checkIn" | "checkOut" | "adults" | "childAges" | "rooms">) => `${token}:${q.checkIn}:${q.checkOut}:${q.adults}${q.childAges?.length ? `:c${q.childAges.join(".")}` : ""}${(q.rooms ?? 1) > 1 ? `:r${q.rooms}` : ""}`;

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

export function setVerified(token: string, q: Pick<StayQuery, "checkIn" | "checkOut" | "adults">, rows: { cost: number; key: HotelSellerKey; freeCancel?: boolean; approx?: boolean }[], fresh = true) {
  const k = keyOf(token, q);
  // fresh false: 예약처 조회에 실패해 검색 목록에 같이 온 값으로 맞출 때 → 아낀 금액은 보여 주지 않는다
  const save = fresh ? savingsOf(rows)?.amount : undefined;
  const v: Verified = { total: rows[0]?.cost ?? null, count: rows.length, at: Date.now(), seller: rows[0]?.key, ...(rows.some((r) => r.freeCancel) ? { fc: true } : {}), ...(save ? { save } : {}) };
  const old = mem.get(k);
  if (old && old.total === v.total && old.count === v.count && old.seller === v.seller && old.fc === v.fc && old.save === v.save) return;
  mem.set(k, v);
  try {
    sessionStorage.setItem(PREFIX + k, JSON.stringify(v));
  } catch {
    // 저장소를 못 쓰면 이 화면에서만 맞춘다
  }
  version++;
  subs.forEach((f) => f());
}

// 예약처 가격을 받는 중인 숙소 (카드에 '예약처 가격을 확인하는 중'을 보여 준다)
const checking = new Set<string>();
const bump = () => {
  version++;
  subs.forEach((f) => f());
};
export function setChecking(token: string, q: Pick<StayQuery, "checkIn" | "checkOut" | "adults">, on: boolean) {
  const k = keyOf(token, q);
  if (on === checking.has(k)) return;
  if (on) checking.add(k);
  else checking.delete(k);
  bump();
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

// 카드에 보여 줄 금액. verified: 시트 1위 총액과 같은 값, none: 허용 예약처 0곳, checking: 예약처 가격을 받는 중
// verified가 아니면 검색 목록에 같이 온 '예상' 금액이다 (예약처마다 달라질 수 있어 화면에 '예상'을 크게 붙인다)
export type ShownPrice = { value: number | null; verified: boolean; none: boolean; count: number | null; checking?: boolean; seller?: HotelSellerKey; fc?: boolean; was?: number; at?: number; save?: number }; // at: 예약처 가격을 확인한 시각, was: 검색 때 보였던 예상 금액 (확인한 금액과 다를 때만)

export function shownPrice(h: HotelOption, q: StayQuery): ShownPrice {
  const v = getVerified(h.token, q);
  if (v) {
    const est = stayTotal(h, nightsOf(q))?.value ?? null;
    const was = est !== null && v.total !== null && Math.abs(est - v.total) >= 100 ? est : undefined;
    return { value: v.total, verified: v.total !== null, none: v.total === null, count: v.count, seller: v.seller, fc: v.fc, at: v.at, ...(was ? { was } : {}), ...(v.save ? { save: v.save } : {}) };
  }
  return { value: stayTotal(h, nightsOf(q))?.value ?? null, verified: false, none: false, count: null, checking: checking.has(keyOf(h.token, q)) };
}

// 정렬용 금액 (0곳이면 맨 뒤)
export const shownCost = (h: HotelOption, q: StayQuery) => {
  const p = shownPrice(h, q);
  return p.none || p.value === null ? Infinity : p.value;
};

// 정렬·요금 필터·'최저가' 배지용: 예약처에서 확인한 금액만. 확인 전이면 Infinity
export const verifiedCost = (h: HotelOption, q: StayQuery) => {
  const p = shownPrice(h, q);
  return p.verified && p.value !== null ? p.value : Infinity;
};

// 예약처 가격을 받아 카드 금액을 맞춘다 (같은 조건은 캐시라 다시 부르지 않는다).
// 검색 직후에는 AI 추천 1위만 부르고, 나머지 숙소는 눌러서 시트를 열 때만 부른다 (스크롤로는 부르지 않는다)
const inflight = new Set<string>();
export function prefetchPrices(list: HotelOption[], q: StayQuery) {
  const hq = { q: q.place, checkIn: q.checkIn, checkOut: q.checkOut, adults: q.adults, rooms: q.rooms, childAges: q.childAges };
  for (const h of list) {
    const k = keyOf(h.token, q);
    if (inflight.has(k) || getVerified(h.token, q)) continue;
    inflight.add(k);
    setChecking(h.token, q, true);
    stayPrices(h.token, q, h.name).then((r) => {
      inflight.delete(k);
      if (r.ok) setVerified(h.token, q, sellerRows(r.data.sources, nightsOf(q), h.name, hq));
      setChecking(h.token, q, false);
    });
  }
}


"use client";

import { useSyncExternalStore } from "react";
import type { HotelOption, HotelQuery } from "./hotels";

// 가입 없이 쓰는 로보티 저장소. 브라우저 localStorage의 키 하나(lowboti:v1)에 비교함·선호·마지막 검색을 담는다.
// 브라우저를 닫았다 열어도, 새 탭에서도 남고, 다른 탭에서 바꾸면 storage 이벤트로 바로 따라 바뀐다.
// Google 약관 때문에 후기 글은 담지 않는다 (점수·후기 수만)
const KEY = "lowboti:v1";
export const MAX_COMPARE = 3; // 비교함은 검색이 달라도 합쳐서 3곳까지

export type SearchParams = { q: string; checkin: string; checkout: string; adults: number };

export type CompareItem = {
  token: string;
  id: string; // 지금은 token과 같다 (Google 호텔 번호)
  name: string;
  stars: number | null;
  rating: number | null;
  reviews: number | null;
  perNight: number | null; // 담은 시점 가격
  total: number | null;
  thumbnail: string;
  amenities: string[];
  searchParams: SearchParams;
  addedAt: number;
};

export type Prefs = { chips: string[]; maxBudgetPerNight: number | null };
export type LastSearch = SearchParams & { cachedAt: number };
export type LowbotiStore = { compare: CompareItem[]; prefs: Prefs; lastSearch: LastSearch | null };

const EMPTY: LowbotiStore = { compare: [], prefs: { chips: [], maxBudgetPerNight: null }, lastSearch: null };

export function toSearchParams(q: HotelQuery): SearchParams {
  return { q: q.q, checkin: q.checkIn, checkout: q.checkOut, adults: q.adults };
}

export function sameSearch(a: SearchParams, b: SearchParams): boolean {
  return a.q === b.q && a.checkin === b.checkin && a.checkout === b.checkout && a.adults === b.adults;
}

export function compareItem(h: HotelOption, query: HotelQuery): CompareItem {
  return {
    token: h.token,
    id: h.token,
    name: h.name,
    stars: h.stars,
    rating: h.rating,
    reviews: h.reviews,
    perNight: h.perNight,
    total: h.total,
    thumbnail: h.image,
    amenities: h.amenities,
    searchParams: toSearchParams(query),
    addedAt: Date.now(),
  };
}

// 손으로 고쳤거나 옛 모양으로 남은 값이 있어도 화면이 깨지지 않게 모양을 맞춘다
function clean(raw: unknown): LowbotiStore {
  if (!raw || typeof raw !== "object") return EMPTY;
  const r = raw as Partial<LowbotiStore>;
  const isParams = (p: unknown): p is SearchParams =>
    !!p && typeof p === "object" && typeof (p as SearchParams).q === "string" && typeof (p as SearchParams).checkin === "string";
  const compare = Array.isArray(r.compare)
    ? r.compare.filter((c): c is CompareItem => !!c && typeof c.token === "string" && typeof c.name === "string" && isParams(c.searchParams))
    : [];
  const prefs: Prefs = {
    chips: Array.isArray(r.prefs?.chips) ? r.prefs.chips.filter((c): c is string => typeof c === "string") : [],
    maxBudgetPerNight: typeof r.prefs?.maxBudgetPerNight === "number" ? r.prefs.maxBudgetPerNight : null,
  };
  const lastSearch = isParams(r.lastSearch) ? r.lastSearch : null;
  return { compare, prefs, lastSearch };
}

let cache: { text: string | null; value: LowbotiStore } = { text: null, value: EMPTY };

function read(): LowbotiStore {
  let text: string | null = null;
  try {
    text = localStorage.getItem(KEY);
  } catch {
    // 저장소를 막아 둔 브라우저면 빈 상태로 둔다
  }
  if (text === cache.text) return cache.value;
  let value = EMPTY;
  try {
    value = text ? clean(JSON.parse(text)) : EMPTY;
  } catch {
    value = EMPTY;
  }
  cache = { text, value };
  return value;
}

const listeners = new Set<() => void>();

export function updateStore(fn: (s: LowbotiStore) => LowbotiStore) {
  const next = fn(read());
  next.compare = [...next.compare].sort((a, b) => a.addedAt - b.addedAt).slice(-MAX_COMPARE);
  const text = JSON.stringify(next);
  try {
    localStorage.setItem(KEY, text);
    cache = { text, value: next };
  } catch {
    // 저장 못 하면 이번 화면에서만 기억한다
    cache = { text: cache.text, value: next };
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY || e.key === null) cb();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function useLowbotiStore(): LowbotiStore {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

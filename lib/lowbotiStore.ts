"use client";

import { useSyncExternalStore } from "react";
import type { HotelOption, HotelQuery, ReviewTopic } from "./hotels";

// 가입 없이 쓰는 저장소. 브라우저 localStorage의 키 하나(gollazyum:v1)에 비교함·선호·마지막 검색·후기 주제 캐시를 담는다.
// 예전 키(lowboti:v1)가 있으면 처음 읽을 때 한 번만 새 키로 옮기고 옛 키는 지운다.
// 브라우저를 닫았다 열어도, 새 탭에서도 남고, 다른 탭에서 바꾸면 storage 이벤트로 바로 따라 바뀐다.
// Google 약관 때문에 후기 글은 담지 않는다 (점수·후기 수만)
const KEY = "gollazyum:v1";
const LEGACY_KEY = "lowboti:v1";
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
// 호텔별 후기 주제 숫자 캐시 (7일). 같은 호텔을 다시 비교할 때 주제를 바로 보여 준다
export type TopicCache = Record<string, { at: number; list: ReviewTopic[] | null }>;
export type LowbotiStore = { compare: CompareItem[]; prefs: Prefs; lastSearch: LastSearch | null; topics: TopicCache };
export const TOPIC_TTL = 7 * 24 * 60 * 60 * 1000;
const MAX_TOPICS = 30;

const EMPTY: LowbotiStore = { compare: [], prefs: { chips: [], maxBudgetPerNight: null }, lastSearch: null, topics: {} };

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
  const topics: TopicCache = {};
  if (r.topics && typeof r.topics === "object") {
    for (const [token, v] of Object.entries(r.topics)) {
      if (v && typeof v.at === "number" && Date.now() - v.at < TOPIC_TTL && (v.list === null || Array.isArray(v.list))) topics[token] = v;
    }
  }
  return { compare, prefs, lastSearch, topics };
}

let cache: { text: string | null; value: LowbotiStore } = { text: null, value: EMPTY };

function storedText(): string | null {
  try {
    const current = localStorage.getItem(KEY);
    if (current !== null) return current;
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy === null) return null;
    try {
      localStorage.setItem(KEY, legacy);
      localStorage.removeItem(LEGACY_KEY);
    } catch {
      // 새 키를 못 쓰면 옛 값을 그대로 읽는다. 다음 기회에 다시 옮긴다.
    }
    return legacy;
  } catch {
    return null;
  }
}

// 브라우저에 남아 있는 Gollazyum 저장을 모두 지운다. 옛 키도 함께 지운다.
export function clearStoredData() {
  try {
    const drop: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k === KEY || k === LEGACY_KEY || k.startsWith("gollazyum:") || k.startsWith("lowboti:"))) drop.push(k);
    }
    for (const k of drop) localStorage.removeItem(k);
    localStorage.removeItem(KEY);
    localStorage.removeItem(LEGACY_KEY);
    const sessionDrop: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && (k.startsWith("gollazyum:") || k.startsWith("lowboti:"))) sessionDrop.push(k);
    }
    for (const k of sessionDrop) sessionStorage.removeItem(k);
  } catch {
    // 저장소를 막아 둔 브라우저면 메모리만 비운다
  }
  cache = { text: null, value: EMPTY };
  listeners.forEach((l) => l());
}

function read(): LowbotiStore {
  let text = storedText();
  if (text === cache.text) return cache.value;
  let value = EMPTY;
  try {
    if (text) {
      const raw = JSON.parse(text) as { topics?: unknown };
      const before = raw?.topics && typeof raw.topics === "object" ? Object.keys(raw.topics).length : 0;
      value = clean(raw);
      // 7일이 지난 후기 주제 숫자는 읽을 때 저장소에서도 지운다
      if (before > Object.keys(value.topics).length) {
        const next = JSON.stringify(value);
        try {
          localStorage.setItem(KEY, next);
          text = next;
        } catch {
          // 다시 못 써도 화면에는 기한이 지난 주제를 빼서 보여 준다
        }
      }
    }
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
  next.topics = Object.fromEntries(Object.entries(next.topics).sort((a, b) => b[1].at - a[1].at).slice(0, MAX_TOPICS));
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
    if (e.key === KEY || e.key === LEGACY_KEY || e.key === null || e.key.startsWith("gollazyum:") || e.key.startsWith("lowboti:")) cb();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function saveTopics(token: string, list: ReviewTopic[] | null) {
  updateStore((s) => ({ ...s, topics: { ...s.topics, [token]: { at: Date.now(), list } } }));
}

export function useLowbotiStore(): LowbotiStore {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

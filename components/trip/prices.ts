"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { sellerRows, type HotelOption } from "@/lib/hotels";
import type { HotelSellerKey } from "@/lib/hotel-sellers";
import { nightsOf, stayTotal, type StayQuery } from "@/lib/trip";
import { stayPrices } from "./api";
import { priceCacheSec } from "@/lib/stay-cache";
import { savingsOf } from "@/lib/savings";

// 전 화면 가격·확인 시각 단일화 (2026-11-27).
// 숙소 한 곳의 예약처 가격 확인 결과를 (숙소 token, 체크인, 체크아웃, 성인, 아동 나이, 객실) 한 키로 묶어
// 홈 · 검색 목록 · 지도 핀 · 숙소 상세 · 내 여행이 모두 같은 최저 총액 · 같은 예약처 배열 · 같은 확인 시각(at, Unix ms)을 읽는다.
// - 이 기기 localStorage에 남겨 새 탭(PC 상세)과 원래 탭이 같은 값을 본다. 다른 탭에서 바뀌면 storage 이벤트로 바로 맞춘다
// - 확인 시각은 서버가 예약처 가격을 실제로 받은 시각(checkedAt)이다. 서버 저장분을 다시 받아도 시각이 새로 찍히지 않는다
// - [옛 가격 덮어쓰기 방지] 새 값의 확인 시각이 기존 값보다 같거나 최신일 때만 덮어쓴다.
//   예약처 확인을 마친 값(partial 아님)은 확인 전·실패 대체 값(partial)으로 덮어쓰지 않는다
export type StoredRow = { key: HotelSellerKey; cost: number; fc?: boolean; approx?: boolean; href?: string; name?: string };
export type Verified = {
  total: number | null; // 1위 총액. null: 비교할 수 있는 예약처 0곳
  count: number;
  at: number; // 확인 시각 (Unix ms)
  seller?: HotelSellerKey; // 1위 예약처
  fc?: boolean; // 무료 취소라고 온 예약처가 있음
  save?: number; // 두 번째로 싼 곳보다 싼 금액 (lib/savings.ts)
  top?: { key: HotelSellerKey; cost: number; fc?: boolean }[]; // 낮은 예약처 2곳 (PC 목록 행 안)
  rows?: StoredRow[]; // 예약처 배열 전체 (싼 순). 상세·시트가 같은 배열을 그린다
  partial?: true; // 예약처 조회에 실패해 검색 목록 값으로 맞춘 값 (확정 값이 아님)
};

const PREFIX = "tb-price-v3:";
const MAX_KEEP = 300;
const mem = new Map<string, Verified>();
const subs = new Set<() => void>();
let version = 0;

const keyOf = (token: string, q: Pick<StayQuery, "checkIn" | "checkOut" | "adults" | "childAges" | "rooms">) => `${token}:${q.checkIn}:${q.checkOut}:${q.adults}${q.childAges?.length ? `:c${q.childAges.join(".")}` : ""}${(q.rooms ?? 1) > 1 ? `:r${q.rooms}` : ""}`;
const checkInOf = (k: string) => /:(\d{4}-\d{2}-\d{2}):\d{4}-\d{2}-\d{2}:/.exec(k)?.[1] ?? "";
const alive = (k: string, v: Verified, now = Date.now()) => now - v.at <= priceCacheSec(checkInOf(k), now) * 1000;

// 새 값을 받아도 되는지 (옛 가격·미확정 값이 최신 확정 값을 덮어쓰지 않게)
export function acceptIncoming(existing: Verified | undefined, incoming: Verified): boolean {
  if (!existing) return true;
  if (!existing.partial && incoming.partial) return false;
  if (existing.partial && !incoming.partial) return true;
  return incoming.at >= existing.at;
}

const bumpAll = () => {
  version++;
  subs.forEach((f) => f());
};

// 오래된 값 정리 + 다른 탭 변경 듣기 (처음 한 번)
let ready = false;
function init() {
  if (ready || typeof window === "undefined") return;
  ready = true;
  try {
    const keys = Object.keys(localStorage).filter((k) => k.startsWith(PREFIX));
    const now = Date.now();
    const live: { k: string; at: number }[] = [];
    for (const k of keys) {
      try {
        const v = JSON.parse(localStorage.getItem(k) ?? "null") as Verified | null;
        if (!v || typeof v.at !== "number" || !alive(k.slice(PREFIX.length), v, now)) localStorage.removeItem(k);
        else live.push({ k, at: v.at });
      } catch {
        localStorage.removeItem(k);
      }
    }
    live.sort((a, b) => b.at - a.at).slice(MAX_KEEP).forEach((x) => localStorage.removeItem(x.k));
  } catch {
    // 저장소를 못 쓰면 이 화면에서만 맞춘다
  }
  window.addEventListener("storage", (e) => {
    if (!e.key?.startsWith(PREFIX) || !e.newValue) return;
    try {
      const k = e.key.slice(PREFIX.length);
      const inc = JSON.parse(e.newValue) as Verified;
      if (typeof inc.at !== "number" || !acceptIncoming(mem.get(k), inc)) return;
      mem.set(k, inc);
      bumpAll();
    } catch {
      // 깨진 값은 무시한다
    }
  });
}

export function getVerified(token: string, q: Pick<StayQuery, "checkIn" | "checkOut" | "adults">): Verified | undefined {
  init();
  const k = keyOf(token, q);
  const hit = mem.get(k);
  if (hit) return alive(k, hit) ? hit : undefined;
  try {
    const raw = localStorage.getItem(PREFIX + k);
    if (!raw) return undefined;
    const v = JSON.parse(raw) as Verified;
    if (typeof v.at !== "number" || !alive(k, v)) return undefined;
    mem.set(k, v);
    return v;
  } catch {
    return undefined;
  }
}

type InRow = { cost: number; key: HotelSellerKey; freeCancel?: boolean; approx?: boolean; href?: string; name?: string };

// fresh false: 예약처 조회에 실패해 검색 목록에 같이 온 값으로 맞출 때 → partial (아낀 금액은 보여 주지 않는다)
// at: 서버가 가격을 받은 시각 (없으면 지금). 받아들였으면 true
export function setVerified(token: string, q: Pick<StayQuery, "checkIn" | "checkOut" | "adults">, rows: InRow[], fresh = true, at = Date.now()): boolean {
  init();
  const k = keyOf(token, q);
  const save = fresh ? savingsOf(rows)?.amount : undefined;
  const v: Verified = {
    total: rows[0]?.cost ?? null,
    count: rows.length,
    at,
    seller: rows[0]?.key,
    ...(rows.some((r) => r.freeCancel) ? { fc: true } : {}),
    ...(save ? { save } : {}),
    ...(fresh && rows.length > 1 ? { top: rows.slice(0, 2).map((r) => ({ key: r.key, cost: r.cost, ...(r.freeCancel ? { fc: true } : {}) })) } : {}),
    rows: rows.map((r) => ({ key: r.key, cost: r.cost, ...(r.freeCancel ? { fc: true } : {}), ...(r.approx ? { approx: true } : {}), ...(r.href ? { href: r.href } : {}), ...(r.name ? { name: r.name } : {}) })),
    ...(fresh ? {} : { partial: true as const }),
  };
  const old = getVerified(token, q);
  if (!acceptIncoming(old, v)) return false;
  if (old && old.at === v.at && JSON.stringify(old) === JSON.stringify(v)) return true;
  mem.set(k, v);
  try {
    localStorage.setItem(PREFIX + k, JSON.stringify(v));
  } catch {
    // 저장소가 가득 차면 이 화면에서만 맞춘다
  }
  bumpAll();
  return true;
}

// 예약처 가격을 받는 중인 숙소 (카드에 '예약처 가격을 확인하는 중'을 보여 준다)
const checking = new Set<string>();
const bump = bumpAll;
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

// 가격 확인 응답의 확인 시각: 서버가 실제로 받은 시각 → 이 탭 캐시에 담은 시각 → 지금
export const checkedAtOf = (r: { data?: { checkedAt?: number }; at?: number }) => r.data?.checkedAt ?? r.at ?? Date.now();

// 예약처 가격을 받아 카드 금액을 맞춘다 (같은 조건은 캐시라 다시 부르지 않는다).
// 검색 직후에는 AI 추천 1위만 부르고, 나머지 추천 카드는 화면에 보이면(useLazyPrice) 또는 눌러서 시트를 열면 부른다
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
      if (r.ok) setVerified(h.token, q, sellerRows(r.data.sources, nightsOf(q), h.name, hq), true, checkedAtOf(r));
      setChecking(h.token, q, false);
    });
  }
}

// 카드가 화면에 잠깐(0.3초) 머물면 그때 예약처 가격을 받는다. 스쳐 지나가는 카드는 부르지 않는다.
// IntersectionObserver가 없는 브라우저는 미리 받지 않고, 카드를 눌러 시트를 열 때 받는다
const DWELL_MS = 300;
export function useLazyPrice<T extends Element>(h: HotelOption | undefined, q: StayQuery, on: boolean) {
  const ref = useRef<T>(null);
  const token = h?.token;
  useEffect(() => {
    const el = ref.current;
    if (!on || !h || !el || typeof IntersectionObserver === "undefined" || getVerified(h.token, q)) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const io = new IntersectionObserver(
      ([e]) => {
        clearTimeout(timer);
        if (!e.isIntersecting) return;
        timer = setTimeout(() => {
          io.disconnect();
          prefetchPrices([h], q);
        }, DWELL_MS);
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => {
      clearTimeout(timer);
      io.disconnect();
    };
  }, [token, q.checkIn, q.checkOut, q.adults, q.place, on]); // eslint-disable-line react-hooks/exhaustive-deps
  return ref;
}

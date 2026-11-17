import { isShownAmenity } from "@/lib/hotelText";
import type { HotelOption } from "./hotels";
import { inBand, PRICE_BANDS } from "./price-bands";

// 숙소 결과 필터. 이미 받은 목록 안에서만 거른다 (검색·AI 추가 호출 없음).
// 우리 데이터에 있는 것만: 성급, 1박 요금대, 후기 점수(5점 만점), 숙소 종류, 편의시설, 조식, 무료 취소
export type StayFilter = {
  stars: number[]; // 고른 성급 (여러 개)
  bands: string[]; // PRICE_BANDS id (여러 개)
  minRating: number; // 0이면 상관없음
  kinds: string[];
  amenities: string[];
  breakfast: boolean;
  freeCancel: boolean;
};

export const EMPTY_FILTER: StayFilter = { stars: [], bands: [], minRating: 0, kinds: [], amenities: [], breakfast: false, freeCancel: false };
export const RATING_STEPS = [3.5, 4, 4.5] as const;

const BREAKFAST = /조식|아침|breakfast/i;
const FREE_CANCEL = /무료 취소|free cancel/i;
export const hasBreakfast = (h: HotelOption) => h.amenities.some((a) => BREAKFAST.test(a));
export const hasFreeCancel = (h: HotelOption) => !!h.freeCancel || h.amenities.some((a) => FREE_CANCEL.test(a));
const starOf = (h: HotelOption) => (h.stars ? Math.min(5, Math.max(1, Math.round(h.stars))) : 0);

export function activeCount(f: StayFilter): number {
  return f.stars.length + f.bands.length + (f.minRating ? 1 : 0) + f.kinds.length + f.amenities.length + (f.breakfast ? 1 : 0) + (f.freeCancel ? 1 : 0);
}

// cost: 숙박 전체 총액 (모르면 Infinity). 요금대를 고르면 금액을 모르는 숙소는 빠진다
export function applyFilter(list: HotelOption[], f: StayFilter, cost: (h: HotelOption) => number, nights: number): HotelOption[] {
  const bands = PRICE_BANDS.filter((b) => f.bands.includes(b.id));
  return list.filter(
    (h) =>
      (!f.stars.length || f.stars.includes(starOf(h))) &&
      (!bands.length || bands.some((b) => inBand(cost(h), nights, b))) &&
      (!f.minRating || (h.rating ?? 0) >= f.minRating) &&
      (!f.kinds.length || f.kinds.includes(h.kind)) &&
      f.amenities.every((a) => h.amenities.includes(a)) &&
      (!f.breakfast || hasBreakfast(h)) &&
      (!f.freeCancel || hasFreeCancel(h)),
  );
}

export type FilterCounts = {
  stars: { n: number; count: number }[];
  bands: { id: string; label: string; count: number }[];
  ratings: { min: number; count: number }[];
  kinds: { name: string; count: number }[];
  amenities: { name: string; count: number }[];
  breakfast: number;
  freeCancel: number;
};

// 받은 목록 전체 기준으로 몇 곳인지 센다. 화면은 0곳인 항목을 숨긴다 (고른 항목은 남긴다)
export function countFilters(list: HotelOption[], cost: (h: HotelOption) => number, nights: number): FilterCounts {
  const tally = (names: string[]) => {
    const m = new Map<string, number>();
    names.forEach((n) => n && m.set(n, (m.get(n) ?? 0) + 1));
    return [...m].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  };
  return {
    stars: [1, 2, 3, 4, 5].map((n) => ({ n, count: list.filter((h) => starOf(h) === n).length })),
    bands: PRICE_BANDS.map((b) => ({ id: b.id, label: b.label, count: list.filter((h) => inBand(cost(h), nights, b)).length })),
    ratings: RATING_STEPS.map((min) => ({ min, count: list.filter((h) => (h.rating ?? 0) >= min).length })),
    kinds: tally(list.map((h) => h.kind)),
    // 조식·무료 취소는 따로 묻는다
    amenities: tally(list.flatMap((h) => [...new Set(h.amenities)].filter((a) => !BREAKFAST.test(a) && !FREE_CANCEL.test(a) && isShownAmenity(a)))),
    breakfast: list.filter(hasBreakfast).length,
    freeCancel: list.filter(hasFreeCancel).length,
  };
}

export const toggleIn = <T,>(arr: T[], v: T): T[] => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

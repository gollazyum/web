import type { HotelOption } from "./hotels";
import { fitsParty } from "./room-fit";
import { cityFirst } from "./city-bounds";
import { fallbackStayPicks, nightsOf, withinBudget, type StayQuery } from "./trip";

// 결과 화면 [내 취향 바꾸기]: 이미 받은 목록 안에서만 추천 3곳을 다시 고른다 (검색·AI·예약처 가격 조회 0회).
// 무게는 lib/taste.ts criteriaWeights와 같은 규칙 점수(평점·가격·편의시설 일치)를 쓴다
export type Priority = "balance" | "price" | "rating";
export const PRIORITIES: { id: Priority; label: string; w: { rating: number; price: number } }[] = [
  { id: "balance", label: "균형 있게", w: { rating: 2, price: 1.2 } },
  { id: "price", label: "가성비 먼저", w: { rating: 0.8, price: 4 } },
  { id: "rating", label: "평점·깨끗함 먼저", w: { rating: 4, price: 0.3 } },
];
// lib/trip.ts STAY_WANTS 낱말과 맞춘다
export const WANT_CHIPS = ["조식", "무료 취소", "온천·대욕장", "수영장", "주차", "아이 동반"] as const;
export type Want = (typeof WANT_CHIPS)[number];
export type TasteChoice = { priority: Priority; wants: Want[] };

export const choiceLabel = (c: TasteChoice) => [PRIORITIES.find((p) => p.id === c.priority)?.label ?? "", ...c.wants].filter(Boolean).join(" · ");

export function repickStays(options: HotelOption[], query: StayQuery, c: TasteChoice): { token: string; reason: string }[] {
  const nights = nightsOf(query);
  const { list: pool } = withinBudget(cityFirst(options, query.place), query.budget, nights); // 검색 도시 안 숙소 먼저 (lib/city-bounds.ts)
  const fit = pool.filter((h) => fitsParty(h, query.adults));
  const head = (fit.length ? fit : pool).slice(0, 60);
  if (!head.length) return [];
  const w = PRIORITIES.find((p) => p.id === c.priority)?.w ?? PRIORITIES[0].w;
  const taste = [c.wants.join(" "), query.taste].filter(Boolean).join(" ");
  return fallbackStayPicks(head, taste, query.budget, nights, w).map((p) => ({ token: head[p.n - 1].token, reason: p.reason }));
}

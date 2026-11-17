import type { HotelOption } from "./hotels";
import { hasBreakfast, hasFreeCancel } from "./stay-filters";
import { stayWants } from "./trip";

// 카드 한 줄: 가까운 역·장소까지 시간 · 무료 취소. 검색 결과에 실제로 온 값만 쓰고, 둘 다 없으면 빈 문자열(화면에서 숨김)
export function stayFactLine(h: HotelOption): string {
  const parts: string[] = [];
  if (h.near) parts.push(`${h.near.name}까지 ${h.near.how} ${h.near.mins}분`);
  if (h.freeCancel) parts.push("무료 취소 가능한 예약처 있음");
  return parts.join(" · ");
}

// 취향 조건이 이 숙소에서 맞는지: true 맞음, null 받은 정보로는 알 수 없음
function wantMet(h: HotelOption, label: string, amenity: RegExp): true | null {
  if (label === "무료 취소") return hasFreeCancel(h) ? true : null;
  if (label === "조식") return hasBreakfast(h) ? true : null;
  return h.amenities.some((a) => amenity.test(a.normalize("NFC"))) ? true : null;
}

export type RankNote = { why: string; unknown: string[] };

type Priced = { value: number | null; verified: boolean; none: boolean };

// AI가 먼저 보여 준 3곳의 '왜 1·2·3위인지'와 '확인하지 못한 조건'.
// 이미 받은 데이터(평점, 리뷰 수, 화면 금액, 시설, 취향 일치)끼리만 견준다. AI를 다시 부르지 않는다
export function rankNotes(picks: HotelOption[], taste: string, prices: Priced[]): RankNote[] {
  const wants = stayWants(taste);
  const near = /역|가까|도보|걸어/.test(taste);
  const n = picks.length;
  const ratings = picks.map((h) => h.rating ?? 0);
  const reviews = picks.map((h) => h.reviews ?? 0);
  const costs = prices.map((p) => (p.none || p.value === null ? Infinity : p.value));
  const maxR = Math.max(...ratings);
  const maxV = Math.max(...reviews);
  const minC = Math.min(...costs);
  const unique = (arr: number[], v: number) => arr.filter((x) => x === v).length === 1;
  return picks.map((h, i) => {
    const met = wants.filter((w) => wantMet(h, w.label, w.amenity));
    const facts: string[] = [];
    if (met.length) facts.push(`취향 ${met.map((w) => w.label).join("·")} 맞음`);
    if (n > 1 && ratings[i] > 0 && ratings[i] === maxR && unique(ratings, maxR)) facts.push(`평점 ${n}곳 중 가장 높음`);
    if (n > 1 && reviews[i] > 0 && reviews[i] === maxV && unique(reviews, maxV)) facts.push(`리뷰 수 가장 많음`);
    if (n > 1 && Number.isFinite(costs[i]) && costs[i] === minC && unique(costs, minC)) facts.push(prices[i].verified ? "확인한 가격 가장 낮음" : "예상 가격 가장 낮음");
    if (!facts.length && h.rating) facts.push(`평점 ${h.rating.toFixed(1)}${h.reviews ? ` · 리뷰 ${h.reviews.toLocaleString("ko-KR")}개` : ""}`);
    const unknown = wants.filter((w) => !wantMet(h, w.label, w.amenity)).map((w) => w.label);
    if (near && !h.near) unknown.push("역까지 거리");
    return { why: `${i + 1}위 · ${facts.slice(0, 2).join(" · ")}`, unknown };
  });
}

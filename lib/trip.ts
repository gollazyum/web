// 탐색 탭(AI 대화로 숙소·항공편 찾기)에서 서버와 화면이 같이 쓰는 모양과 계산.
// AI가 없거나 실패해도 같은 화면이 나오도록, 3곳 먼저 보여 주기는 규칙 기반 대체 계산을 같이 둔다.

import { findBannedWords } from "./brand-mode";
import type { FlightOption } from "./flights";
import type { HotelOption } from "./hotels";

export type StayQuery = {
  place: string; // "오사카 난바"
  checkIn: string; // 2026-12-05
  checkOut: string;
  adults: number;
  budget: number; // 숙박 전체 총액 상한(원). 0이면 정하지 않음
  taste: string; // 자유 입력 취향 ("조용하고 역에서 가까운 곳")
};

export type FlightQuery = {
  from: string; // 공항·도시 코드 (ICN, SEL)
  fromLabel: string;
  to: string;
  toLabel: string;
  depart: string;
  ret: string; // 편도면 ""
  adults: number;
  taste: string;
};

// AI가 되묻는 질문 하나. 칩을 누르면 value가 그 칸(slot)에 들어간다
export type AskSlot = "place" | "dates" | "adults" | "budget" | "from" | "to" | "taste";
export type AskOption = { label: string; value: string };
export type AskQuestion = { slot: AskSlot; q: string; options: AskOption[] };

// 자유 문장을 AI가 읽은 결과 (/api/trip-ai mode=parse)
export type ParseResult = {
  kind: "stay" | "flight" | "other";
  reply: string;
  stay: Partial<StayQuery>;
  flight: Partial<FlightQuery>;
  questions: AskQuestion[];
};

export type Pick = { n: number; reason: string }; // n: 목록 번호(1부터)
export type PickResult = { picks: Pick[]; note: string };

export const ASK_SLOTS: readonly AskSlot[] = ["place", "dates", "adults", "budget", "from", "to", "taste"];
export const MAX_QUESTIONS = 3;
export const TOP_PICKS = 3;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
export const isDate = (s: unknown): s is string => typeof s === "string" && DATE.test(s);

export function nightsOf(q: Pick2<StayQuery, "checkIn" | "checkOut">): number {
  const a = Date.parse(`${q.checkIn}T00:00:00Z`);
  const b = Date.parse(`${q.checkOut}T00:00:00Z`);
  return Math.max(1, Math.round((b - a) / 86_400_000));
}
type Pick2<T, K extends keyof T> = { [P in K]: T[P] };

export function stayReady(q: Partial<StayQuery>, today: string): q is StayQuery {
  return !!q.place?.trim() && isDate(q.checkIn) && isDate(q.checkOut) && q.checkIn >= today && q.checkOut > q.checkIn && !!q.adults && q.adults >= 1 && q.adults <= 9;
}

export function flightReady(q: Partial<FlightQuery>, today: string): q is FlightQuery {
  const code = /^[A-Z]{3}$/;
  return (
    code.test(q.from ?? "") &&
    code.test(q.to ?? "") &&
    q.from !== q.to &&
    isDate(q.depart) &&
    q.depart >= today &&
    (q.ret === "" || (isDate(q.ret) && q.ret >= q.depart)) &&
    !!q.adults &&
    q.adults >= 1 &&
    q.adults <= 9
  );
}

// ---------- 화면 문구 정리 ----------

// AI가 쓴 문구에 금지어가 섞이면 바꿔 쓴다. 바꿀 말이 없는 금지어(출처 이름 등)가 남으면 빈 문자열
const SWAPS: [RegExp, string][] = [
  [/최저가/g, "가장 낮은 가격"],
  [/가격\s*비교/g, "가격 모아 보기"],
  [/비교해/g, "모아 봐"],
  [/비교/g, "모아 보기"],
  [/추천해\s*드릴게요/g, "먼저 보여 드릴게요"],
  [/추천해\s*드려요/g, "보여 드려요"],
  [/추천/g, "잘 맞는 곳"],
  [/실시간/g, "지금"],
  [/골라\s*드릴게요/g, "찾아 드릴게요"],
  [/골라/g, "찾아"],
];

export function cleanCopy(text: string, max = 300): string {
  let out = String(text ?? "").replace(/\s+/g, " ").trim().slice(0, max);
  for (const [re, to] of SWAPS) out = out.replace(re, to);
  return findBannedWords(out, true).length ? "" : out;
}

// ---------- 숙소 3곳 먼저 (AI가 없을 때 쓰는 규칙) ----------

// 취향 글에 나온 말 → 편의시설 이름에 있으면 맞는 것으로 보는 말
const STAY_WANTS: { words: RegExp; amenity: RegExp; label: string }[] = [
  { words: /조식|아침/, amenity: /조식|아침/, label: "조식" },
  { words: /수영장|풀/, amenity: /수영장/, label: "수영장" },
  { words: /온천|대욕장|목욕|사우나/, amenity: /온천|대욕장|사우나|스파/, label: "온천·대욕장" },
  { words: /스파/, amenity: /스파/, label: "스파" },
  { words: /주차|차를|렌터카/, amenity: /주차/, label: "주차" },
  { words: /헬스|운동|피트니스/, amenity: /피트니스/, label: "피트니스" },
  { words: /취소/, amenity: /무료 취소/, label: "무료 취소" },
  { words: /공항\s*셔틀|셔틀/, amenity: /셔틀/, label: "셔틀" },
  { words: /아이|키즈|가족/, amenity: /키즈|가족|놀이/, label: "아이 동반" },
];

export function stayWants(taste: string): typeof STAY_WANTS {
  return STAY_WANTS.filter((w) => w.words.test(taste));
}

export const man = (won: number) => {
  const m = won / 10000;
  return `${m >= 100 ? Math.round(m) : Math.round(m * 10) / 10}만`;
};
export const won = (n: number) => `₩${Math.round(n).toLocaleString("ko-KR")}`;

// 숙박 전체 총액. 총액이 없으면 1박 요금 × 박수로 어림한다 (approx=true)
export function stayTotal(h: Pick2<HotelOption, "total" | "perNight">, nights: number): { value: number; approx: boolean } | null {
  if (h.total) return { value: h.total, approx: false };
  if (h.perNight) return { value: h.perNight * nights, approx: true };
  return null;
}

// 예산 안의 숙소만. 하나도 없으면 전체를 돌려주고 over=true
export function withinBudget(list: HotelOption[], budget: number, nights: number): { list: HotelOption[]; over: boolean } {
  if (!budget) return { list, over: false };
  const ok = list.filter((h) => (stayTotal(h, nights)?.value ?? Infinity) <= budget);
  return ok.length ? { list: ok, over: false } : { list, over: true };
}

// 받아 온 숫자로만 만드는 한 줄 이유
export function stayFactReason(h: HotelOption, taste: string): string {
  const parts: string[] = [];
  const hits = stayWants(taste).filter((w) => h.amenities.some((a) => w.amenity.test(a)));
  if (hits.length) parts.push(`${hits.map((w) => w.label).join("·")} 있어요`);
  if (h.rating) parts.push(`후기 ${h.rating.toFixed(1)}점${h.reviews ? `(${h.reviews.toLocaleString("ko-KR")}개)` : ""}`);
  if (h.stars) parts.push(`${h.stars}성급`);
  if (!parts.length && h.deal) parts.push(h.deal);
  return parts.join(" · ") || "조건에 맞는 숙소예요";
}

// 규칙 점수: 후기 점수 + 취향 편의시설 + 후기 수 − 가격 순위. list 순서 기준 번호(1부터)를 돌려준다
// w: 취향 온보딩에서 정한 순서로 평점·가격을 얼마나 칠지 (lib/taste.ts criteriaWeights)
export function fallbackStayPicks(list: HotelOption[], taste: string, budget: number, nights: number, w: { rating: number; price: number } = { rating: 2, price: 1.2 }): Pick[] {
  const wants = stayWants(taste);
  const totals = list.map((h) => stayTotal(h, nights)?.value ?? Infinity);
  const sorted = [...totals].sort((a, b) => a - b);
  const scored = list.map((h, i) => {
    const t = totals[i];
    const overBudget = budget > 0 && t > budget;
    const priceRank = sorted.indexOf(t) / Math.max(sorted.length - 1, 1); // 0 싼 쪽 ~ 1 비싼 쪽
    const hits = wants.filter((w) => h.amenities.some((a) => w.amenity.test(a))).length;
    const score = (h.rating ?? 3.5) * w.rating + hits * 1.5 + Math.log10((h.reviews ?? 0) + 1) * 0.4 - priceRank * w.price - (overBudget ? 5 : 0);
    return { n: i + 1, score };
  });
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_PICKS)
    .map((s) => ({ n: s.n, reason: stayFactReason(list[s.n - 1], taste) }));
}

// ---------- 항공편 ----------

export const hourOf = (time: string) => Number(time.slice(11, 13)) || 0; // "2026-12-05 07:25" → 7
export const hhmm = (time: string) => time.slice(11, 16);

const FLIGHT_WANTS: { words: RegExp; test: (o: FlightOption) => boolean; label: string }[] = [
  { words: /직항|경유\s*(없|싫|말)/, test: (o) => o.stops.length === 0, label: "직항" },
  { words: /새벽/, test: (o) => hourOf(o.departTime) < 7, label: "새벽 출발" },
  { words: /오전|아침/, test: (o) => hourOf(o.departTime) >= 6 && hourOf(o.departTime) < 12, label: "오전 출발" },
  { words: /오후|점심/, test: (o) => hourOf(o.departTime) >= 12 && hourOf(o.departTime) < 18, label: "오후 출발" },
  { words: /저녁|밤/, test: (o) => hourOf(o.departTime) >= 18, label: "저녁 출발" },
];

export function flightWants(taste: string) {
  return FLIGHT_WANTS.filter((w) => w.words.test(taste));
}

export function flightFactReason(o: FlightOption, taste: string): string {
  const parts: string[] = [];
  const hits = flightWants(taste).filter((w) => w.test(o));
  if (hits.length) parts.push(hits.map((w) => w.label).join("·"));
  else parts.push(o.stops.length ? `경유 ${o.stops.length}회` : "직항");
  if (o.minutes) parts.push(`${Math.floor(o.minutes / 60)}시간 ${o.minutes % 60}분`);
  return parts.join(" · ");
}

export function fallbackFlightPicks(list: FlightOption[], taste: string): Pick[] {
  const wants = flightWants(taste);
  const prices = list.map((o) => o.price);
  const lo = Math.min(...prices);
  const hi = Math.max(...prices);
  const scored = list.map((o, i) => {
    const hits = wants.filter((w) => w.test(o)).length;
    const priceRank = hi > lo ? (o.price - lo) / (hi - lo) : 0;
    const score = hits * 3 - priceRank * 2 - o.stops.length * 0.8 - o.minutes / 600;
    return { n: i + 1, score };
  });
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_PICKS)
    .map((s) => ({ n: s.n, reason: flightFactReason(list[s.n - 1], taste) }));
}

// AI가 준 번호를 검사한다: 범위 밖·중복은 빼고, 모자라면 규칙 결과로 채운다
export function mergePicks(ai: Pick[], fallback: Pick[], size: number, factReason: (n: number) => string): Pick[] {
  const out: Pick[] = [];
  const seen = new Set<number>();
  for (const p of ai) {
    if (!Number.isInteger(p.n) || p.n < 1 || p.n > size || seen.has(p.n)) continue;
    const reason = cleanCopy(p.reason, 80);
    out.push({ n: p.n, reason: reason || factReason(p.n) });
    seen.add(p.n);
    if (out.length === TOP_PICKS) return out;
  }
  for (const f of fallback) {
    if (out.length === TOP_PICKS) break;
    if (!seen.has(f.n)) {
      out.push(f);
      seen.add(f.n);
    }
  }
  return out;
}

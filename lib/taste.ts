// 처음 들어올 때 고르는 취향 (v7 01·02). 이 기기에만 저장하고, 숙소·항공 추천 순서에 반영한다

export type TasteId = "food" | "onsen" | "alley" | "nature" | "history" | "night";
export type CriterionId = "location" | "clean" | "price" | "breakfast" | "bath";
export type FlightPrefId = "direct" | "morning" | "bag" | "major" | "miles";

export const TASTES: { id: TasteId; label: string }[] = [
  { id: "food", label: "맛집 탐방" },
  { id: "onsen", label: "온천 · 휴식" },
  { id: "alley", label: "골목 · 쇼핑" },
  { id: "nature", label: "자연 풍경" },
  { id: "history", label: "역사 · 문화" },
  { id: "night", label: "야경 · 나이트" },
];

// say: AI와 규칙 점수에 넘기는 짧은 말 (lib/trip.ts의 STAY_WANTS·FLIGHT_WANTS 낱말과 맞춘다)
export const CRITERIA: { id: CriterionId; label: string; say: string }[] = [
  { id: "location", label: "역·관광지와 가까운 위치", say: "역·관광지와 가까운 위치" },
  { id: "clean", label: "깨끗한 객실 · 높은 평점", say: "깨끗하고 평점 높은 곳" },
  { id: "price", label: "최저가 · 가성비", say: "가성비" },
  { id: "breakfast", label: "조식 포함", say: "조식" },
  { id: "bath", label: "대욕장 · 수영장", say: "대욕장·수영장" },
];

export const FLIGHT_PREFS: { id: FlightPrefId; label: string; say: string }[] = [
  { id: "direct", label: "직항만", say: "직항" },
  { id: "morning", label: "오전 출발", say: "오전 출발" },
  { id: "bag", label: "위탁 수하물 포함", say: "위탁 수하물 포함" },
  { id: "major", label: "대형 항공사", say: "대형 항공사" },
  { id: "miles", label: "마일리지 적립", say: "마일리지 적립" },
];

export type TasteProfile = {
  tastes: TasteId[];
  criteria: CriterionId[]; // 중요한 순서
  flight: FlightPrefId[];
};

export const TASTE_KEY = "tb-taste-v1";
export const EMPTY_PROFILE: TasteProfile = { tastes: [], criteria: [], flight: [] };

const only = <T extends string>(v: unknown, ok: readonly T[]): T[] => (Array.isArray(v) ? [...new Set(v.filter((x): x is T => ok.includes(x as T)))] : []);

// 저장된 값을 믿지 않고 아는 값만 남긴다
export function cleanProfile(raw: unknown): TasteProfile | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  return {
    tastes: only(r.tastes, TASTES.map((t) => t.id)),
    criteria: only(r.criteria, CRITERIA.map((c) => c.id)),
    flight: only(r.flight, FLIGHT_PREFS.map((f) => f.id)),
  };
}

const label = (id: string) => TASTES.find((t) => t.id === id)?.label.replace(/\s/g, "") ?? "";
const say = <T extends { id: string; say: string }>(list: T[], id: string) => list.find((x) => x.id === id)?.say ?? "";

// 검색 때 적은 취향 글 뒤에 붙일 말. 사람이 그때 적은 말이 앞에 온다
export function profileTaste(p: TasteProfile | null, kind: "stay" | "flight"): string {
  if (!p) return "";
  if (kind === "flight") return p.flight.map((id) => say(FLIGHT_PREFS, id)).filter(Boolean).join(", ");
  const parts: string[] = [];
  if (p.criteria.length) parts.push(`중요한 순서 ${p.criteria.map((id, i) => `${i + 1}.${say(CRITERIA, id)}`).join(" ")}`);
  if (p.tastes.length) parts.push(`좋아하는 여행 ${p.tastes.map(label).join("·")}`);
  return parts.join(" / ");
}

export function withProfile(taste: string, p: TasteProfile | null, kind: "stay" | "flight"): string {
  const extra = profileTaste(p, kind);
  return [taste.trim(), extra].filter(Boolean).join(" / ").slice(0, 300);
}

// 규칙 점수의 무게. 앞 순서일수록 더 많이 친다
const BOOST = [1, 0.7, 0.45, 0.3, 0.2];
export function criteriaWeights(p: TasteProfile | null): { rating: number; price: number } {
  const at = (id: CriterionId) => (p ? p.criteria.indexOf(id) : -1);
  const c = at("clean");
  const pr = at("price");
  return { rating: 2 + (c >= 0 ? BOOST[c] * 1.5 : 0), price: 1.2 + (pr >= 0 ? BOOST[pr] * 3 : 0) };
}

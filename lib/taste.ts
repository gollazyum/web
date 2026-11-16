// 여행 취향 설문 (3단계). AI 채팅에 처음 들어갈 때만 묻고, 이 기기(localStorage)에만 저장한다.
// 답은 숙소·항공 'AI 추천 3곳'의 취향 글과 규칙 점수에 반영한다. 지금 대화에서 말한 조건이 항상 먼저다
// 화면: 1 여행 스타일(동행·예산·하루 이동량) → 2 좋아하는 여행(카드 6장) → 3 숙소·항공 기준

type Opt<T extends string> = { id: T; label: string; say?: string; icon?: string };

export type WhoId = "solo" | "couple" | "family" | "friends" | "parents";
export type BudgetId = "b1" | "b2" | "b3" | "b4";
export type PaceId = "slow" | "mid" | "full";
export type TasteId = "food" | "onsen" | "alley" | "nature" | "history" | "night";
export type StayId = "luxury" | "value" | "ryokan" | "mood" | "house" | "guesthouse";
export type CriterionId = "location" | "clean" | "price" | "cancel" | "breakfast" | "bath";
export type FlightPrefId = "cheap" | "direct" | "morning" | "bag" | "major" | "business";

// say: AI와 규칙 점수(lib/trip.ts의 STAY_WANTS·FLIGHT_WANTS)에 넘기는 짧은 말
export const WHO: Opt<WhoId>[] = [
  { id: "solo", label: "혼자", say: "혼자 여행" },
  { id: "couple", label: "연인·부부", say: "둘이 여행" },
  { id: "family", label: "아이와 가족", say: "아이와 가족 여행" },
  { id: "friends", label: "친구", say: "친구들과 여행" },
  { id: "parents", label: "부모님과", say: "부모님과 여행" },
];

export const BUDGETS: Opt<BudgetId>[] = [
  { id: "b1", label: "알뜰하게", say: "알뜰한 예산" },
  { id: "b2", label: "적당하게", say: "적당한 예산" },
  { id: "b3", label: "여유 있게", say: "여유 있는 예산" },
  { id: "b4", label: "고급스럽게", say: "고급 숙소 선호" },
];

export const PACES: Opt<PaceId>[] = [
  { id: "slow", label: "적게 걷고 여유롭게", say: "적게 걷는 여유로운 일정" },
  { id: "mid", label: "핵심 명소만 적당히", say: "핵심 명소만 적당히" },
  { id: "full", label: "알차게 많이 걷기", say: "많이 걷는 알찬 일정" },
];

export const TASTES: Opt<TasteId>[] = [
  { id: "food", label: "맛집 탐방" },
  { id: "onsen", label: "온천 · 휴식" },
  { id: "alley", label: "골목 · 쇼핑" },
  { id: "nature", label: "자연 풍경" },
  { id: "history", label: "역사 · 문화" },
  { id: "night", label: "야경 · 나이트" },
];

export const STAYS: Opt<StayId>[] = [
  { id: "luxury", label: "고급 호텔·리조트", say: "고급 호텔·리조트", icon: "bell" },
  { id: "value", label: "깔끔한 가성비·비즈니스 호텔", say: "깔끔한 가성비 호텔", icon: "coin" },
  { id: "ryokan", label: "료칸·온천 숙소", say: "료칸·온천", icon: "steam" },
  { id: "mood", label: "감성 숙소", say: "감성 숙소", icon: "star" },
  { id: "house", label: "독채·레지던스", say: "독채·레지던스", icon: "key" },
  { id: "guesthouse", label: "게스트하우스·민박", say: "게스트하우스·민박", icon: "bunk" },
];

export const CRITERIA: Opt<CriterionId>[] = [
  { id: "location", label: "역·관광지와 가까운 위치", say: "역·관광지와 가까운 위치" },
  { id: "clean", label: "깨끗한 객실·높은 평점", say: "깨끗하고 평점 높은 곳" },
  { id: "price", label: "최저가·가성비", say: "가성비" },
  { id: "cancel", label: "무료 취소 가능", say: "무료 취소" },
  { id: "breakfast", label: "조식 포함", say: "조식" },
  { id: "bath", label: "대욕장·수영장", say: "대욕장·수영장" },
];

export const FLIGHT_PREFS: Opt<FlightPrefId>[] = [
  { id: "cheap", label: "최저가 우선", say: "가장 싼 항공권 우선" },
  { id: "direct", label: "직항만", say: "직항" },
  { id: "morning", label: "오전 출발", say: "오전 출발" },
  { id: "bag", label: "위탁 수하물 포함", say: "위탁 수하물 포함" },
  { id: "major", label: "대형 항공사", say: "대형 항공사" },
  { id: "business", label: "비즈니스석 선호", say: "비즈니스석 선호" },
];

export type TasteProfile = {
  who: WhoId[];
  budget: BudgetId | "";
  pace: PaceId | "";
  tastes: TasteId[];
  stays: StayId[];
  criteria: CriterionId[]; // 중요한 순서
  flight: FlightPrefId[];
};

// 저장 상태: done(끝까지 답함) · skipped(나중에 하기). 둘 다 다시 묻지 않는다
export type TasteStatus = "done" | "skipped";
export type TasteSaved = { profile: TasteProfile; status: TasteStatus };

export const TASTE_KEY = "tb-taste-v1";
export const EMPTY_PROFILE: TasteProfile = { who: [], budget: "", pace: "", tastes: [], stays: [], criteria: [], flight: [] };

const ids = <T extends string>(list: Opt<T>[]) => list.map((o) => o.id);
const only = <T extends string>(v: unknown, ok: readonly T[]): T[] => (Array.isArray(v) ? [...new Set(v.filter((x): x is T => ok.includes(x as T)))] : []);
const one = <T extends string>(v: unknown, ok: readonly T[]): T | "" => (ok.includes(v as T) ? (v as T) : "");

// 앞선 설문 판의 숙소 유형 → 지금 6가지
const OLD_STAY: Record<string, StayId> = { resort: "luxury", business: "value", boutique: "mood", minbak: "guesthouse" };

// 저장된 값을 믿지 않고 아는 값만 남긴다. 앞선 판(사진·순서·항공만, 또는 음식까지 있던 판)의 저장값도 읽힌다
export function cleanProfile(raw: unknown): TasteProfile | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const stays = Array.isArray(r.stays) ? r.stays.map((s) => (typeof s === "string" && OLD_STAY[s]) || s) : [];
  return {
    who: only(r.who, ids(WHO)),
    budget: one(r.budget, ids(BUDGETS)),
    pace: one(r.pace, ids(PACES)),
    tastes: only(r.tastes, ids(TASTES)),
    stays: only(stays, ids(STAYS)),
    criteria: only(r.criteria, ids(CRITERIA)),
    flight: only(r.flight, ids(FLIGHT_PREFS)),
  };
}

// localStorage 값 → 저장 상태. 상태가 없는 앞선 판 값은 끝까지 답한 것으로 본다
export function readSaved(raw: string | null): TasteSaved | null {
  if (!raw) return null;
  try {
    const j = JSON.parse(raw) as Record<string, unknown>;
    const profile = cleanProfile(j.profile ?? j);
    if (!profile) return null;
    return { profile, status: j.status === "skipped" ? "skipped" : "done" };
  } catch {
    return null;
  }
}

export const hasAnswers = (p: TasteProfile | null) => !!p && (p.who.length + p.tastes.length + p.stays.length + p.criteria.length + p.flight.length > 0 || !!p.budget || !!p.pace);

const sayOf = <T extends string>(list: Opt<T>[], id: T) => {
  const o = list.find((x) => x.id === id);
  return o ? (o.say ?? o.label).replace(/\s*·\s*/g, "·") : "";
};
const join = (xs: string[], sep = ", ") => xs.filter(Boolean).join(sep);

// 평소 취향 글. 숙소는 동행·예산·이동량·숙소 유형·순서·좋아하는 여행, 항공은 항공 조건·예산
export function profileTaste(p: TasteProfile | null, kind: "stay" | "flight"): string {
  if (!p) return "";
  const budget = p.budget ? sayOf(BUDGETS, p.budget) : "";
  if (kind === "flight") return join([...p.flight.map((id) => sayOf(FLIGHT_PREFS, id)), budget]);
  return join(
    [
      join([...p.who.map((id) => sayOf(WHO, id)), budget, p.pace ? sayOf(PACES, p.pace) : ""]),
      p.stays.length ? `숙소 ${join(p.stays.map((id) => sayOf(STAYS, id)))}` : "",
      p.criteria.length ? `중요한 순서 ${p.criteria.map((id, i) => `${i + 1}.${sayOf(CRITERIA, id)}`).join(" ")}` : "",
      p.tastes.length ? `좋아하는 여행 ${p.tastes.map((id) => sayOf(TASTES, id)).join("·")}` : "",
    ],
    " / ",
  );
}

// 지금 대화·검색에서 말한 조건이 앞에 오고 우선이다. 평소 취향은 뒤에 '참고'로 붙인다
export function withProfile(taste: string, p: TasteProfile | null, kind: "stay" | "flight"): string {
  const extra = profileTaste(p, kind);
  const now = taste.trim();
  if (!extra) return now;
  return (now ? `${now} (이번 조건이 우선) / 평소 취향: ${extra}` : `평소 취향: ${extra}`).slice(0, 300);
}

// 규칙 점수의 무게. 순서는 앞일수록, 예산·숙소 유형은 가격과 평점 중 어디를 더 볼지 정한다
const BOOST = [1, 0.7, 0.45, 0.3, 0.2, 0.15];
const BUDGET_W: Record<BudgetId, { rating: number; price: number }> = { b1: { rating: 0, price: 2 }, b2: { rating: 0, price: 0.6 }, b3: { rating: 0.6, price: -0.4 }, b4: { rating: 1.2, price: -0.9 } };
export function criteriaWeights(p: TasteProfile | null): { rating: number; price: number } {
  const w = { rating: 2, price: 1.2 };
  if (!p) return w;
  const c = p.criteria.indexOf("clean");
  const pr = p.criteria.indexOf("price");
  if (c >= 0) w.rating += BOOST[c] * 1.5;
  if (pr >= 0) w.price += BOOST[pr] * 3;
  if (p.budget) {
    w.rating += BUDGET_W[p.budget].rating;
    w.price += BUDGET_W[p.budget].price;
  }
  if (p.stays.some((s) => s === "value" || s === "guesthouse")) w.price += 0.6;
  if (p.stays.includes("luxury")) w.rating += 0.4;
  w.price = Math.max(0.2, w.price);
  return w;
}

// 마이 탭 요약 (줄마다 한 묶음)
export function profileLines(p: TasteProfile | null): string[] {
  if (!p) return [];
  const lb = <T extends string>(list: Opt<T>[], xs: T[]) => xs.map((id) => list.find((o) => o.id === id)?.label ?? "");
  return [
    join([...lb(WHO, p.who), p.budget ? `예산 ${lb(BUDGETS, [p.budget])[0]}` : "", p.pace ? lb(PACES, [p.pace])[0] : ""]),
    join(lb(TASTES, p.tastes)),
    join(lb(STAYS, p.stays)),
    p.criteria.length ? `중요한 순서: ${lb(CRITERIA, p.criteria).join(" > ")}` : "",
    join(lb(FLIGHT_PREFS, p.flight)),
  ].filter(Boolean);
}

// 처음 들어올 때 묻는 여행 취향 설문. 이 기기에만 저장하고, 숙소·항공 'AI가 고른 3곳'에 반영한다
// 화면: 1 여행 스타일 → 2 좋아하는 여행(사진) → 3 숙소 → 4 음식 → 완료

type Opt<T extends string> = { id: T; label: string; say?: string; icon?: string };

export type WhoId = "solo" | "couple" | "family" | "friends" | "parents";
export type BudgetId = "b1" | "b2" | "b3" | "b4";
export type SplurgeId = "stay" | "food" | "activity" | "shopping";
export type TasteId = "food" | "onsen" | "alley" | "nature" | "history" | "night";
export type StayId = "luxury" | "boutique" | "resort" | "ryokan" | "value" | "business" | "guesthouse" | "minbak" | "house";
export type CriterionId = "location" | "clean" | "price" | "breakfast" | "bath";
export type FlightPrefId = "direct" | "morning" | "bag" | "major" | "miles";
export type FoodId = "local" | "street" | "izakaya" | "cafe" | "fine" | "korean" | "bakery";
export type AvoidId = "none" | "seafood" | "pork" | "spicy" | "veg" | "halal" | "gluten";

// say: AI와 규칙 점수(lib/trip.ts의 STAY_WANTS·FLIGHT_WANTS)에 넘기는 짧은 말
export const WHO: Opt<WhoId>[] = [
  { id: "solo", label: "혼자", say: "혼자 여행" },
  { id: "couple", label: "연인·부부", say: "둘이 여행" },
  { id: "family", label: "아이와 가족", say: "아이와 가족 여행" },
  { id: "friends", label: "친구", say: "친구들과 여행" },
  { id: "parents", label: "부모님과", say: "부모님과 여행" },
];

export const BUDGETS: Opt<BudgetId>[] = [
  { id: "b1", label: "₩ 알뜰하게", say: "알뜰한 예산" },
  { id: "b2", label: "₩₩ 적당하게", say: "적당한 예산" },
  { id: "b3", label: "₩₩₩ 여유 있게", say: "여유 있는 예산" },
  { id: "b4", label: "₩₩₩₩ 고급스럽게", say: "고급 숙소 선호" },
];

export const SPLURGE: Opt<SplurgeId>[] = [
  { id: "stay", label: "숙소", say: "숙소에는 돈을 더 씀" },
  { id: "food", label: "맛집" },
  { id: "activity", label: "체험·투어" },
  { id: "shopping", label: "쇼핑" },
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
  { id: "luxury", label: "고급 호텔", say: "고급 호텔", icon: "bell" },
  { id: "boutique", label: "부티크·디자인 호텔", say: "부티크 호텔", icon: "star" },
  { id: "resort", label: "리조트", say: "리조트", icon: "palm" },
  { id: "ryokan", label: "료칸·온천 숙소", say: "료칸·온천", icon: "steam" },
  { id: "value", label: "가성비 호텔", say: "가성비 호텔", icon: "coin" },
  { id: "business", label: "비즈니스 호텔", say: "비즈니스 호텔", icon: "case" },
  { id: "guesthouse", label: "게스트하우스", say: "게스트하우스", icon: "bunk" },
  { id: "minbak", label: "한인 민박", say: "한인 민박", icon: "home" },
  { id: "house", label: "집 한 채 통째로", say: "독채·집 전체", icon: "key" },
];

export const CRITERIA: Opt<CriterionId>[] = [
  { id: "location", label: "역·관광지와 가까운 위치", say: "역·관광지와 가까운 위치" },
  { id: "clean", label: "깨끗한 객실 · 높은 평점", say: "깨끗하고 평점 높은 곳" },
  { id: "price", label: "최저가 · 가성비", say: "가성비" },
  { id: "breakfast", label: "조식 포함", say: "조식" },
  { id: "bath", label: "대욕장 · 수영장", say: "대욕장·수영장" },
];

export const FLIGHT_PREFS: Opt<FlightPrefId>[] = [
  { id: "direct", label: "직항만", say: "직항" },
  { id: "morning", label: "오전 출발", say: "오전 출발" },
  { id: "bag", label: "위탁 수하물 포함", say: "위탁 수하물 포함" },
  { id: "major", label: "대형 항공사", say: "대형 항공사" },
  { id: "miles", label: "마일리지 적립", say: "마일리지 적립" },
];

export const FOODS: Opt<FoodId>[] = [
  { id: "local", label: "현지 맛집·노포", icon: "bowl" },
  { id: "street", label: "길거리 음식·시장", icon: "skewer" },
  { id: "izakaya", label: "이자카야·술집", icon: "cup" },
  { id: "cafe", label: "카페·디저트", icon: "coffee" },
  { id: "fine", label: "파인다이닝", icon: "dish" },
  { id: "bakery", label: "빵집", icon: "bread" },
  { id: "korean", label: "가끔은 한식", icon: "spoon" },
];

export const AVOIDS: Opt<AvoidId>[] = [
  { id: "none", label: "없어요" },
  { id: "seafood", label: "해산물" },
  { id: "pork", label: "돼지고기" },
  { id: "spicy", label: "매운 음식" },
  { id: "veg", label: "채식" },
  { id: "halal", label: "할랄" },
  { id: "gluten", label: "글루텐" },
];

// 기타를 고르고 직접 적은 말
export type NoteKey = "splurge" | "stay" | "food" | "avoid";

export type TasteProfile = {
  who: WhoId[];
  budget: BudgetId | "";
  splurge: SplurgeId[];
  tastes: TasteId[];
  stays: StayId[];
  criteria: CriterionId[]; // 중요한 순서
  flight: FlightPrefId[];
  foods: FoodId[];
  avoid: AvoidId[];
  notes: Partial<Record<NoteKey, string>>;
};

export const TASTE_KEY = "tb-taste-v1";
export const EMPTY_PROFILE: TasteProfile = { who: [], budget: "", splurge: [], tastes: [], stays: [], criteria: [], flight: [], foods: [], avoid: [], notes: {} };
export const NOTE_MAX = 40;

const ids = <T extends string>(list: Opt<T>[]) => list.map((o) => o.id);
const only = <T extends string>(v: unknown, ok: readonly T[]): T[] => (Array.isArray(v) ? [...new Set(v.filter((x): x is T => ok.includes(x as T)))] : []);
const note = (v: unknown) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, NOTE_MAX) : "");

// 저장된 값을 믿지 않고 아는 값만 남긴다. 예전(사진·순서·항공만 있던) 저장값도 그대로 읽힌다
export function cleanProfile(raw: unknown): TasteProfile | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const n = (r.notes && typeof r.notes === "object" ? r.notes : {}) as Record<string, unknown>;
  const notes: TasteProfile["notes"] = {};
  for (const k of ["splurge", "stay", "food", "avoid"] as NoteKey[]) if (note(n[k])) notes[k] = note(n[k]);
  const budget = only([r.budget], ids(BUDGETS))[0] ?? "";
  return {
    who: only(r.who, ids(WHO)),
    budget,
    splurge: only(r.splurge, ids(SPLURGE)),
    tastes: only(r.tastes, ids(TASTES)),
    stays: only(r.stays, ids(STAYS)),
    criteria: only(r.criteria, ids(CRITERIA)),
    flight: only(r.flight, ids(FLIGHT_PREFS)),
    foods: only(r.foods, ids(FOODS)),
    avoid: only(r.avoid, ids(AVOIDS)),
    notes,
  };
}

const sayOf = <T extends string>(list: Opt<T>[], id: T) => {
  const o = list.find((x) => x.id === id);
  return o ? (o.say ?? o.label).replace(/\s*·\s*/g, "·") : "";
};
const join = (xs: string[], sep = ", ") => xs.filter(Boolean).join(sep);

// 검색 때 적은 취향 글 뒤에 붙일 말. 숙소는 누구와·예산·숙소 스타일·순서·좋아하는 여행, 항공은 항공 선호·예산
export function profileTaste(p: TasteProfile | null, kind: "stay" | "flight"): string {
  if (!p) return "";
  const budget = p.budget ? sayOf(BUDGETS, p.budget) : "";
  if (kind === "flight") return join([...p.flight.map((id) => sayOf(FLIGHT_PREFS, id)), budget === "알뜰한 예산" ? "싼 항공권" : ""]);
  const parts = [
    join(p.who.map((id) => sayOf(WHO, id))),
    budget,
    p.splurge.includes("stay") ? sayOf(SPLURGE, "stay") : "",
    p.stays.length || p.notes.stay ? `숙소 ${join([...p.stays.map((id) => sayOf(STAYS, id)), p.notes.stay ?? ""])}` : "",
    p.criteria.length ? `중요한 순서 ${p.criteria.map((id, i) => `${i + 1}.${sayOf(CRITERIA, id)}`).join(" ")}` : "",
    p.tastes.length ? `좋아하는 여행 ${p.tastes.map((id) => sayOf(TASTES, id)).join("·")}` : "",
  ];
  return join(parts, " / ");
}

export function withProfile(taste: string, p: TasteProfile | null, kind: "stay" | "flight"): string {
  const extra = profileTaste(p, kind);
  return [taste.trim(), extra].filter(Boolean).join(" / ").slice(0, 300);
}

// 규칙 점수의 무게. 순서는 앞일수록, 예산·숙소 스타일은 가격과 평점 중 어디를 더 볼지 정한다
const BOOST = [1, 0.7, 0.45, 0.3, 0.2];
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
  if (p.stays.some((s) => s === "luxury" || s === "resort")) w.rating += 0.4;
  w.price = Math.max(0.2, w.price);
  return w;
}

// 마이 탭에 보여 줄 요약 (줄마다 한 묶음)
export function profileLines(p: TasteProfile | null): string[] {
  if (!p) return [];
  const lb = <T extends string>(list: Opt<T>[], xs: T[]) => xs.map((id) => list.find((o) => o.id === id)?.label ?? "");
  return [
    join([...lb(WHO, p.who), p.budget ? `예산 ${(BUDGETS.find((b) => b.id === p.budget)?.label ?? "").replace(/^₩+ /, "")}` : ""]),
    join([...lb(STAYS, p.stays), p.notes.stay ?? ""]),
    p.criteria.length ? `중요한 순서: ${lb(CRITERIA, p.criteria).join(" > ")}` : "",
    join(lb(TASTES, p.tastes)),
    join([...lb(FOODS, p.foods), p.notes.food ?? ""]),
    p.avoid.length && !p.avoid.includes("none") ? `못 먹는 것: ${join([...lb(AVOIDS, p.avoid), p.notes.avoid ?? ""])}` : "",
    join(lb(FLIGHT_PREFS, p.flight)),
  ].filter(Boolean);
}

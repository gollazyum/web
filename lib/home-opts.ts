// 홈 입력 시트의 '빠른 조건' 칩. 우리 데이터로 걸러지는 것만 둔다 (2026-11-20 확인).
// - 숙소 무료 취소·조식·평점 4.5+: 결과 필터로 바로 거른다 (HotelOption.freeCancel/amenities/rating)
// - 숙소 온천·대욕장, 중심가 가까운 곳: 걸러지는 데이터가 일부 숙소에만 있어 AI 추천 취향으로 넘긴다 (목록은 그대로)
// - 항공 직항·오전 출발·대한항공·아시아나: 결과 필터로 거른다 (stops, departTime, airlines)
// - 위탁 수하물: 받는 데이터가 없어 두지 않는다
// 고른 칩은 결과 주소에 opt=…로 남겨 새로 고침·공유해도 같은 조건으로 열린다
import type { FlightOption } from "./flights";
import { EMPTY_FLIGHT_FILTER, type FlightFilter } from "./flight-filters";
import { EMPTY_FILTER, type StayFilter } from "./stay-filters";

export type StayOpt = "cancel" | "breakfast" | "rating45" | "bath" | "center";
export type FlightOpt = "direct" | "am" | "kr";

export const STAY_OPTS: { id: StayOpt; label: string }[] = [
  { id: "cancel", label: "무료 취소" },
  { id: "center", label: "중심가 가까운 곳" },
  { id: "breakfast", label: "조식 있음" },
  { id: "bath", label: "온천·대욕장" },
  { id: "rating45", label: "평점 4.5+" },
];

export const FLIGHT_OPTS: { id: FlightOpt; label: string }[] = [
  { id: "direct", label: "직항만" },
  { id: "am", label: "오전 출발" },
  { id: "kr", label: "대한항공·아시아나" },
];

// AI 추천에 취향으로 넘기는 칩 (목록을 거르지 않는다)
const STAY_TASTE: Partial<Record<StayOpt, string>> = { bath: "온천·대욕장", center: "중심가 가까운 곳" };

const STAY_IDS = new Set<string>(STAY_OPTS.map((o) => o.id));
const FLIGHT_IDS = new Set<string>(FLIGHT_OPTS.map((o) => o.id));

export function readOpts(search: string): string[] {
  const raw = new URLSearchParams(search).get("opt") ?? "";
  return [...new Set(raw.split(",").filter((x) => STAY_IDS.has(x) || FLIGHT_IDS.has(x)))];
}

// 결과 주소 뒤에 붙이는 조각 ("&opt=cancel,rating45"). 칩이 없으면 빈 문자열
export const optsParam = (opts: string[]) => (opts.length ? `&opt=${opts.join(",")}` : "");

export function stayFilterOf(opts: string[]): StayFilter {
  return { ...EMPTY_FILTER, freeCancel: opts.includes("cancel"), breakfast: opts.includes("breakfast"), minRating: opts.includes("rating45") ? 4.5 : 0 };
}

export function stayTasteOf(opts: string[]): string {
  return opts.map((o) => STAY_TASTE[o as StayOpt]).filter(Boolean).join(", ");
}

const KR_CARRIER = /대한항공|아시아나|korean air|asiana/i;

// 받은 항공편 목록에 실제로 있는 항공사 이름으로 채운다 (없으면 그 칩은 걸지 않는다)
export function flightFilterOf(opts: string[], list: FlightOption[]): FlightFilter {
  const kr = opts.includes("kr") ? [...new Set(list.flatMap((o) => o.airlines).filter((a) => KR_CARRIER.test(a)))] : [];
  return { ...EMPTY_FLIGHT_FILTER, stops: opts.includes("direct") ? ["0"] : [], times: opts.includes("am") ? ["am"] : [], airlines: kr };
}

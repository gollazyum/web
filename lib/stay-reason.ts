// AI 대화(/chat) 숙소 3곳의 이유·비교표에 쓰는 사실 (2026-11-28 초록 요청 2·3·4번).
// - 역 거리: 비교표 '역까지' 칸과 이유 첫 문장이 같은 값·같은 글자를 쓴다 (stationText)
// - 예산: "N박, X원 안에서"는 숙박 총액. 확인한 총액이 예산 이하일 때만 '조건에 맞는' 곳, 확인 전은 '예산 안일 가능성', 넘으면 '예산보다 N원 높아요'
// - 시설: 이유 문장과 따로 짧은 태그로. 아동이 없는 검색이면 어린이 시설은 빼고 보여 준다
import type { HotelOption } from "./hotels";
import { distText, nearby } from "./landmarks";
import { won } from "./trip";

const STATION = /역(\s*앞)?$|역\s|역\(|station/i;
const STATION_KM = 1.5; // 직선거리로 쓸 역은 이 안만 ('가깝다'고 보기 어려운 역은 쓰지 않는다)

// 가장 가까운 역 한 곳. 검색 결과에 온 역 소요 시간이 먼저, 없으면 대표 역까지 직선거리. 둘 다 없으면 null
export function stationOf(h: Pick<HotelOption, "near" | "gps">): { name: string; text: string } | null {
  if (h.near && STATION.test(h.near.name)) return { name: h.near.name, text: `${h.near.how} ${h.near.mins}분` };
  const s = nearby(h.gps, 6).find((n) => !n.airport && /역/.test(n.name) && n.km <= STATION_KM);
  return s ? { name: s.name, text: `직선 ${distText(s.km)}` } : null;
}

// 비교표 칸과 이유 문장이 같이 쓰는 한 줄: "난바역까지 직선 300m", "난바역까지 도보 5분"
export function stationText(h: Pick<HotelOption, "near" | "gps">): string {
  const s = stationOf(h);
  return s ? `${s.name}까지 ${s.text}` : "";
}

export const wantsStation = (taste: string) => /역|가까|도보|걸어/.test(taste);

export type BudgetFit = { kind: "fit" | "maybe" | "over"; diff: number };
type Priced = { value: number | null; verified: boolean; none: boolean };

// 예산과 숙박 총액. 예산이 없으면 null
// fit: 예약처에서 확인한 총액 ≤ 예산 / maybe: 확인 전(예상 총액이 예산 안이거나 모름) / over: 총액이 예산보다 높음 (확인 전 예상 총액이 넘어도 over)
export function budgetFit(p: Priced, budget: number): BudgetFit | null {
  if (!budget) return null;
  if (p.none) return { kind: "over", diff: 0 };
  if (p.value === null) return { kind: "maybe", diff: 0 };
  if (p.value <= budget) return { kind: p.verified ? "fit" : "maybe", diff: 0 };
  return { kind: "over", diff: p.value - budget };
}

export function budgetText(f: BudgetFit, nights: number): string {
  if (f.kind === "fit") return `${nights}박 총액이 예산 안이에요`;
  if (f.kind === "maybe") return "예산 안일 가능성이 있어요";
  return f.diff > 0 ? `예산보다 ${won(f.diff)} 높아요` : "예약 가능한 예약처를 찾지 못했어요";
}

// 이유 첫 문장: 질문 조건(역 거리, 예산)만. 해당 조건이 없으면 빈 문자열
export function conditionLine(h: HotelOption, taste: string, fit: BudgetFit | null, nights: number): string {
  const parts: string[] = [];
  if (wantsStation(taste)) {
    const s = stationText(h);
    if (s) parts.push(s);
  }
  if (fit) parts.push(budgetText(fit, nights));
  return parts.join(" · ");
}

// 어린이 시설: 아동이 없는 검색이면 태그·이유·AI 입력에서 뺀다
export const KID_AMENITY = /어린이|키즈|아동|유아|아이|베이비|놀이|가족/;

// 시설 태그 (이유 문장과 따로). 앞쪽이 먼저, 최대 3개. 와이파이처럼 거의 모든 숙소에 있는 것은 넣지 않는다
const TAGS: [RegExp, string][] = [
  [/온천|노천탕/, "온천"],
  [/대욕장/, "대욕장"],
  [/조식/, "조식"],
  [/수영장/, "수영장"],
  [/사우나|스파/, "사우나·스파"],
  [/피트니스/, "피트니스"],
  [/주차/, "주차"],
  [/공항 셔틀|셔틀|픽업/, "공항 셔틀"],
  [/장애인|휠체어|배리어/, "장애인 편의시설"],
  [/어린이|키즈|유아|베이비|놀이/, "어린이 시설"],
];
export function facilityTags(amenities: string[], kids: number, max = 3): string[] {
  const ams = amenities.map((a) => a.normalize("NFC"));
  const out: string[] = [];
  for (const [re, label] of TAGS) {
    if (out.length >= max) break;
    if (!kids && KID_AMENITY.test(label)) continue;
    if (ams.some((a) => re.test(a)) && !out.includes(label)) out.push(label);
  }
  return out;
}

// AI가 준 태그를 숙소 편의시설로 확인되는 것만 남긴다 (짧게, 중복 없이, 인원 구성에 맞게)
export function checkTags(tags: unknown, amenities: string, kids: number, max = 3): string[] {
  if (!Array.isArray(tags)) return [];
  const ams = amenities.normalize("NFC");
  const out: string[] = [];
  for (const t of tags) {
    if (typeof t !== "string") continue;
    const x = t.normalize("NFC").replace(/\s+/g, " ").trim().slice(0, 12);
    if (!x || out.includes(x) || (!kids && KID_AMENITY.test(x)) || /와이파이|wi-?fi/i.test(x)) continue;
    // 태그 낱말 하나라도 편의시설 글에 있어야 한다 ("장애인 편의시설" → "장애인")
    if (!x.split(/[\s·]/).some((w) => w.length >= 2 && ams.includes(w))) continue;
    out.push(x);
    if (out.length >= max) break;
  }
  return out;
}

// AI 이유를 거른다: 역 거리·이동 시간(첫 문장이 따로 쓴다), 아동이 없는데 어린이 시설 이야기면 비운다 (화면이 사실 기반 이유로 채운다)
const DISTANCE = /\d+(\.\d+)?\s*(m|km|미터|킬로)(?![a-z])|직선|역까지|도보\s*\d|걸어서\s*\d|\d+\s*분\s*(거리|이면)/i;
export function partyReason(reason: string, kids: number): string {
  if (!reason) return "";
  if (DISTANCE.test(reason)) return "";
  if (!kids && KID_AMENITY.test(reason)) return "";
  return reason;
}

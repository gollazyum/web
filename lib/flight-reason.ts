// 항공 추천 이유 검증 (2026-11-28 초록 요청 5·6번).
// - '가장 짧은/가장 싼' 같은 최상급은 화면 목록(이번 검색 응답 전체)으로 맞는지 본 뒤에만 남긴다
// - 이유에 적힌 비행시간·금액이 그 항공편 값과 다르면 이유를 쓰지 않고 사실 한 줄(예: "직항 · 2시간 20분")로 바꾼다
// - 시간 표기는 카드와 같은 "2시간 20분" (lib/flight-legs.ts durText)
import type { FlightOption } from "./flights";
import { durText } from "./flight-legs";

// 이번 검색 응답에서 가장 낮은 총액 (가격 흐름·꼬리표·필터와 같은 값). 목록이 비면 null
export function flightLow(list: Pick<FlightOption, "price">[]): number {
  return Math.min(...list.map((o) => o.price));
}

const SHORTEST = /가장\s*(짧|빠른\s*비행|빨리\s*도착)|최단/;
const CHEAPEST = /가장\s*(싼|저렴|낮은\s*(가격|금액|총액))|최저/;
const EARLIEST = /가장\s*(이른|일찍|먼저\s*출발)/;

// 이유에 적힌 비행시간(분). "140분", "2시간 20분", "2시간"
function minutesIn(text: string): number[] {
  const out: number[] = [];
  const re = /(\d+)\s*시간(?:\s*(\d+)\s*분)?|(\d+)\s*분/g;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    // 경유 대기("대기 1시간 10분")는 비행시간이 아니다
    const before = text.slice(Math.max(0, m.index - 4), m.index);
    if (/대기|기다/.test(before)) continue;
    out.push(m[3] ? Number(m[3]) : Number(m[1]) * 60 + Number(m[2] ?? 0));
  }
  return out;
}

const pricesIn = (text: string) => [...text.matchAll(/(\d{1,3}(?:,\d{3})+|\d{4,})\s*원/g)].map((m) => Number(m[1].replace(/,/g, "")));

// 맞으면 시간 표기만 카드 형식으로 바꿔 돌려주고, 틀리면 빈 문자열 (화면이 사실 한 줄로 채운다)
export function checkFlightReason(reason: string, o: FlightOption, list: FlightOption[]): string {
  const r = reason.normalize("NFC").trim();
  if (!r || !list.length) return r;
  if (SHORTEST.test(r) && o.minutes !== Math.min(...list.map((x) => x.minutes).filter((m) => m > 0))) return "";
  if (CHEAPEST.test(r) && o.price !== flightLow(list)) return "";
  if (EARLIEST.test(r) && o.departTime !== [...list.map((x) => x.departTime)].sort()[0]) return "";
  if (minutesIn(r).some((m) => m !== o.minutes)) return "";
  if (pricesIn(r).some((p) => p !== o.price)) return "";
  // "140분" → "2시간 20분" (카드와 같은 표기)
  return r.replace(/(\d+)\s*분/g, (all, n: string, at: number) => {
    const v = Number(n);
    const before = r.slice(Math.max(0, at - 4), at);
    return v >= 60 && !/시간\s*$/.test(before) ? durText(v) : all;
  });
}

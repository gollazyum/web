import type { FlightOption, FlightSegment } from "./flights";

// 항공 카드·상세에 쓰는 작은 계산들 (화면 없이 테스트할 수 있게 여기에 둔다)

const WEEK = ["일", "월", "화", "수", "목", "금", "토"];

// "2026-12-12 09:00" → "12월 12일 (토)"
export function legDate(time: string): string {
  const d = time.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return "";
  const w = WEEK[new Date(`${d}T00:00:00Z`).getUTCDay()];
  return `${Number(d.slice(5, 7))}월 ${Number(d.slice(8, 10))}일 (${w})`;
}

// 출발 날짜 대비 도착 날짜가 며칠 뒤인지 (다음 날 도착이면 1). 알 수 없으면 0
export function dayShift(depart: string, arrive: string): number {
  const a = Date.parse(`${depart.slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${arrive.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.max(0, Math.round((b - a) / 864e5));
}

export const durText = (m: number) => (m > 0 ? `${Math.floor(m / 60)}시간${m % 60 ? ` ${m % 60}분` : ""}` : "");

export const stopText = (o: Pick<FlightOption, "stops">) => (o.stops.length ? `경유 ${o.stops.length}회` : "직항");

// 2명 이상일 때 1인 평균 (원 단위 반올림). 1명이면 null
export const perPerson = (total: number, people: number) => (people >= 2 && total > 0 ? Math.round(total / people) : null);

// 구간 사이 대기: i번째 구간 도착 공항에서 기다리는 시간. layovers 길이가 맞지 않으면 시각 차이로 계산한다
export function waits(o: Pick<FlightOption, "segments" | "layovers">): { at: FlightSegment; mins: number }[] {
  const out: { at: FlightSegment; mins: number }[] = [];
  for (let i = 0; i < o.segments.length - 1; i++) {
    const at = o.segments[i];
    let mins = o.layovers.length === o.segments.length - 1 ? o.layovers[i] : 0;
    if (!mins) {
      const a = Date.parse(at.arriveTime.replace(" ", "T") + ":00Z");
      const b = Date.parse(o.segments[i + 1].departTime.replace(" ", "T") + ":00Z");
      if (!Number.isNaN(a) && !Number.isNaN(b) && b > a) mins = Math.round((b - a) / 60000);
    }
    out.push({ at, mins });
  }
  return out;
}

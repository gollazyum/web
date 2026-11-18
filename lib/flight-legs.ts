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

// 대기 시간 글: 90 → "1시간 30분", 45 → "45분"
export const waitText = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}시간${m % 60 ? ` ${m % 60}분` : ""}` : `${m}분`);

export const LONG_WAIT = 6 * 60; // 이보다 길면 주황으로 알린다
export const TOO_LONG_WAIT = 12 * 60; // 이보다 긴 대기가 있으면 AI 추천 후보에서 뺀다

// 가장 긴 대기(분). 직항이면 0
export const maxWait = (o: Pick<FlightOption, "segments" | "layovers">) => Math.max(0, ...waits(o).map((w) => w.mins));

const at0 = (t: string) => Date.parse(t.replace(" ", "T") + ":00Z");

// 대기 중 0~5시가 2시간 이상 겹치면 공항에서 밤을 보내는 것으로 본다
export function overnight(arrive: string, mins: number): boolean {
  const a = at0(arrive);
  if (Number.isNaN(a) || mins <= 0) return false;
  const b = a + mins * 60000;
  let night = 0;
  for (let d = Math.floor(a / 864e5) * 864e5; d < b; d += 864e5) night += Math.max(0, Math.min(b, d + 5 * 3600000) - Math.max(a, d));
  return night >= 2 * 3600000;
}

// 카드에 한 줄씩: "싱가포르(SIN)에서 2시간 10분 대기". long: 6시간 넘음, night: 공항에서 밤을 보냄
export function waitLines(o: Pick<FlightOption, "segments" | "layovers">, cityOf: (code: string) => string = (c) => c): { text: string; long: boolean; night: boolean }[] {
  return waits(o)
    .filter((w) => w.mins > 0)
    .map((w) => {
      const code = w.at.toId;
      const name = cityOf(code);
      return { text: `${name && name !== code ? name : w.at.toName || code}(${code})에서 ${waitText(w.mins)} 대기`, long: w.mins > LONG_WAIT, night: overnight(w.at.arriveTime, w.mins) };
    });
}

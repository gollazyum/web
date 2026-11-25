// 찜한 숙소 가격 다시 확인 (가벼운 가격 알림).
// 찜·알림 탭을 열 때 하루 한 번, 최근 찜한 숙소 몇 곳만 예약처 가격을 다시 받아 담을 때 금액과 견준다.
// 서버에서 따로 지켜보지 않고, 결과는 이 기기(localStorage)에만 남긴다.
import type { StayQuery } from "./trip";

export const WATCH_KEY = "tb-watch-v1";
export const WATCH_MAX = 5; // 한 번에 다시 확인하는 숙소 수 (가격 조회 비용)
export const WATCH_EVERY_MS = 20 * 60 * 60 * 1000; // 하루 한 번쯤 (아침·저녁 어느 때 열어도 다음 날 다시 확인)
export const WATCH_MIN_DIFF = 1000;

type Q = Pick<StayQuery, "place" | "checkIn" | "checkOut" | "adults">;
export type WatchBase = { price: number | null; verified: boolean };
export type WatchLine = { token: string; name: string; q: Q; now: number | null; diff: number | null };
export type WatchState = { at: number; lines: WatchLine[] };

// 다시 확인할 숙소: 체크인이 오늘 이후인 것 중 최근에 찜한 순서로 최대 WATCH_MAX곳
export function pickWatch<T extends { hotel: { token: string }; query: Q }>(saved: T[], today: string): T[] {
  return saved.filter((s) => s.query.checkIn >= today).slice(0, WATCH_MAX);
}

export function isDue(state: WatchState | null, now: number): boolean {
  return !state || now - state.at >= WATCH_EVERY_MS;
}

// 지금 1위 총액(세금 포함)과 담을 때 금액의 차이. 담을 때 금액이 예상 총액이었으면 기준이 달라 견주지 않는다
export function watchDiff(base: WatchBase | undefined, now: number | null): number | null {
  if (now === null || !base || base.price === null || !base.verified) return null;
  const d = now - base.price;
  return Math.abs(d) >= WATCH_MIN_DIFF ? d : null;
}

const sameQ = (a: Q, b: Q) => a.checkIn === b.checkIn && a.checkOut === b.checkOut && a.adults === b.adults;

// 내려간 숙소만 (아직 찜해 둔 것만, 많이 내려간 순)
export function dropsOf<T extends { hotel: { token: string }; query: Q }>(state: WatchState | null, saved: T[]): WatchLine[] {
  if (!state) return [];
  return state.lines
    .filter((l) => l.diff !== null && l.diff < 0 && saved.some((s) => s.hotel.token === l.token && sameQ(s.query, l.q)))
    .sort((a, b) => (a.diff ?? 0) - (b.diff ?? 0));
}

export function readWatch(raw: string | null): WatchState | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as WatchState;
    return typeof v?.at === "number" && Array.isArray(v.lines) ? v : null;
  } catch {
    return null;
  }
}

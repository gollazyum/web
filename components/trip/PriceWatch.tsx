"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { today as localToday } from "@/lib/dates";
import { isDue, pickWatch, readWatch, WATCH_KEY, watchDiff, type WatchLine, type WatchState } from "@/lib/price-watch";
import { won, type StayQuery } from "@/lib/trip";
import type { SavedBase, SavedLike } from "./saved-price";
import { baseOf, priceChange } from "./saved-price";
import { getVerified, usePriceVersion } from "./prices";
import { recheck } from "./TripRecheck";

// 찜한 숙소 가격 다시 확인 결과를 화면 어디서나 (홈·탭 점·내 여행) 같이 본다
const subs = new Set<() => void>();
let cache: { raw: string | null; v: WatchState | null } = { raw: null, v: null };
function read(): WatchState | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(WATCH_KEY);
  } catch {
    return null;
  }
  if (raw !== cache.raw) cache = { raw, v: readWatch(raw) };
  return cache.v;
}
function write(v: WatchState) {
  try {
    localStorage.setItem(WATCH_KEY, JSON.stringify(v));
  } catch {
    // 저장소를 못 쓰면 이 화면에서만 보여 준다
    cache = { raw: "mem", v };
  }
  subs.forEach((f) => f());
}
// 다시 확인하는 동안에는 위 요약·아래 카드 모두 '최신 가격 확인 중...'만 보이고, 끝난 뒤에만 오르내림을 같은 기준으로 보인다
let running = false;
function setRunning(on: boolean) {
  running = on;
  subs.forEach((f) => f());
}
export function useWatchBusy(): boolean {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => running,
    () => false,
  );
}

export function useWatch(): WatchState | null {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    read,
    () => null,
  );
}

// ---- '찜한 뒤 내려갔어요' 판단은 여기 하나로 ----
// 찜 카드 한 줄(StayRow), 내 여행 맨 위 요약, 홈 알림, 탭 점이 모두 이 값만 쓴다 (2026-11-26: 카드엔 '내려갔어요'인데 요약엔 '아직 없어요'가 뜨던 모순 수정).
// 최신 확인 총액 = 이 탭에서 받은 예약처 1위 총액(세금 포함)과 하루 한 번 다시 확인한 값 중 더 최근 것.
// 비교: 담을 때 금액 - 최신 확인 총액 > 0 (담을 때도 확인 총액이었을 때만, 1,000원 미만 흔들림 제외 — priceChange)
type Q = Pick<StayQuery, "checkIn" | "checkOut" | "adults">;
const sameQ = (a: Q, b: Q) => a.checkIn === b.checkIn && a.checkOut === b.checkOut && a.adults === b.adults;

export function latestConfirmed(token: string, q: Q, state: WatchState | null): { value: number; at: number } | null {
  const v = getVerified(token, q);
  const here = v && v.total !== null ? { value: v.total, at: v.at } : null;
  const line = state?.lines.find((l) => l.token === token && sameQ(l.q, q));
  const watched = line && line.now !== null ? { value: line.now, at: state!.at } : null;
  if (here && watched) return here.at >= watched.at ? here : watched;
  return here ?? watched;
}

// 지금 - 담을 때 (원). 음수면 내려감. 견줄 수 없으면 null
export function savedDiff(token: string, q: Q, base: SavedBase | undefined, state: WatchState | null): number | null {
  const now = latestConfirmed(token, q, state);
  if (!now) return null;
  return priceChange(base, { value: now.value, verified: true, none: false });
}

export type Drop = WatchLine & { now: number; diff: number };
export function dropsFrom(saved: SavedLike[], state: WatchState | null): Drop[] {
  const seen = new Set<string>();
  const out: Drop[] = [];
  for (const s of saved) {
    const k = `${s.hotel.token}:${s.query.checkIn}:${s.query.checkOut}:${s.query.adults}`;
    if (seen.has(k)) continue;
    seen.add(k);
    const diff = savedDiff(s.hotel.token, s.query, baseOf(s), state);
    const now = latestConfirmed(s.hotel.token, s.query, state);
    if (diff === null || diff >= 0 || !now) continue;
    out.push({ token: s.hotel.token, name: s.hotel.name, q: { place: s.query.place, checkIn: s.query.checkIn, checkOut: s.query.checkOut, adults: s.query.adults }, now: now.value, diff });
  }
  return out.sort((a, b) => a.diff - b.diff);
}

export function useDrops(saved: SavedLike[]): Drop[] {
  const state = useWatch();
  usePriceVersion(); // 이 탭에서 새 확인 총액이 오면 다시 센다
  return dropsFrom(saved, state);
}

async function runWatch(saved: SavedLike[]) {
  const list = pickWatch(saved, localToday());
  if (!list.length) return;
  setRunning(true);
  try {
    await runLines(list);
  } finally {
    setRunning(false);
  }
}

async function runLines(list: SavedLike[]) {
  const lines = await Promise.all(
    list.map(async (s): Promise<WatchLine> => {
      const rows = await recheck(s.hotel.token, s.hotel.name, s.query);
      const now = rows?.length ? rows[0].cost : null;
      const q = { place: s.query.place, checkIn: s.query.checkIn, checkOut: s.query.checkOut, adults: s.query.adults };
      return { token: s.hotel.token, name: s.hotel.name, q, now, diff: watchDiff(baseOf(s), now) };
    }),
  );
  write({ at: Date.now(), lines });
}

const ago = (at: number) => {
  const m = Math.round((Date.now() - at) / 60000);
  if (m < 1) return "방금";
  if (m < 60) return `${m}분 전`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h}시간 전` : `${Math.round(h / 24)}일 전`;
};

// 내 여행 탭 맨 위: 열 때 하루 한 번 자동으로 다시 확인하고, 내려간 숙소를 모아 보여 준다
export function PriceWatchBox<T extends SavedLike>({ saved, onOpen }: { saved: T[]; onOpen: (s: T) => void }) {
  const state = useWatch();
  usePriceVersion(); // 아래 찜 카드와 같은 시점에 같은 값으로 다시 센다
  const [busy, setBusy] = useState(false);
  const started = useRef(false);
  const go = async () => {
    setBusy(true);
    try {
      await runWatch(saved);
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    if (started.current || !saved.length) return;
    started.current = true;
    if (isDue(read(), Date.now()) && pickWatch(saved, localToday()).length) void go();
  }, [saved]); // eslint-disable-line react-hooks/exhaustive-deps

  const busyAny = useWatchBusy() || busy;
  const drops = busyAny ? [] : dropsFrom(saved, state);
  if (!busyAny && !pickWatch(saved, localToday()).length && !drops.length) return null;
  const find = (l: WatchLine) => saved.find((s) => s.hotel.token === l.token && s.query.checkIn === l.q.checkIn && s.query.checkOut === l.q.checkOut && s.query.adults === l.q.adults);
  return (
    <section className={`tb-watch${drops.length ? " down" : ""}`} aria-label="찜한 숙소 가격 변화">
      <div className="tb-watch-head">
        <strong>{busyAny ? "최신 가격 확인 중..." : drops.length ? `찜한 뒤 가격이 내려간 숙소가 ${drops.length}곳 있어요` : state ? "찜한 뒤 내려간 숙소는 아직 없어요" : "찜한 숙소 가격 변화"}</strong>
        <small>{busyAny ? "예약처 가격을 받고 있어요" : state ? `${ago(state.at)} 확인 · 최근 찜한 숙소 최대 5곳, 하루 한 번` : "최근 찜한 숙소 최대 5곳을 하루 한 번 확인해요"}</small>
      </div>
      {drops.length > 0 && (
        <ul className="tb-watch-list">
          {drops.map((l) => {
            const s = find(l);
            return (
              <li key={`${l.token}:${l.q.checkIn}`}>
                <button type="button" onClick={() => s && onOpen(s)} disabled={!s}>
                  <span>
                    <strong>{l.name}</strong>
                    <small>
                      {l.q.place} · {l.q.checkIn.slice(5).replace("-", ".")}–{l.q.checkOut.slice(5).replace("-", ".")}
                    </small>
                  </span>
                  <span className="tb-watch-price">
                    <b>{won(l.now)}</b>
                    <em>{won(Math.abs(l.diff))}↓</em>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {!busyAny && state && (
        <button type="button" className="tb-link" onClick={go}>
          지금 다시 확인
        </button>
      )}
    </section>
  );
}

// 홈: 찜한 숙소가 내려갔으면 맨 위에 짧게 (새 조회는 하지 않고 저장된 결과만)
export function HomeDrops({ saved, onMore }: { saved: SavedLike[]; onMore: () => void }) {
  const drops = useDrops(saved);
  if (!drops.length) return null;
  return (
    <section className="tb-sec">
      <h2>찜한 숙소 가격이 내려갔어요</h2>
      <div className="tb-snaps">
        {drops.slice(0, 2).map((l) => (
          <button key={`${l.token}:${l.q.checkIn}`} type="button" className="tb-snap" onClick={onMore}>
            <span className="tb-snap-text">
              <strong>{l.name}</strong>
              <small>
                {l.q.place} · {l.q.checkIn.slice(5).replace("-", ".")}–{l.q.checkOut.slice(5).replace("-", ".")}
              </small>
            </span>
            <span className="tb-snap-price">
              <b className="tb-drop-now">{won(l.now)}</b>
              <small className="tb-drop">담을 때보다 {won(Math.abs(l.diff))}↓</small>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

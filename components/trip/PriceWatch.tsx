"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { today as localToday } from "@/lib/dates";
import { dropsOf, isDue, pickWatch, readWatch, WATCH_KEY, watchDiff, type WatchLine, type WatchState } from "@/lib/price-watch";
import { won } from "@/lib/trip";
import type { SavedLike } from "./saved-price";
import { baseOf } from "./saved-price";
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

export function useDrops(saved: SavedLike[]): WatchLine[] {
  return dropsOf(useWatch(), saved);
}

async function runWatch(saved: SavedLike[]) {
  const list = pickWatch(saved, localToday());
  if (!list.length) return;
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

  if (!pickWatch(saved, localToday()).length) return null;
  const drops = dropsOf(state, saved);
  const find = (l: WatchLine) => saved.find((s) => s.hotel.token === l.token && s.query.checkIn === l.q.checkIn && s.query.checkOut === l.q.checkOut && s.query.adults === l.q.adults);
  return (
    <section className={`tb-watch${drops.length ? " down" : ""}`} aria-label="찜한 숙소 가격 변화">
      <div className="tb-watch-head">
        <strong>{busy ? "찜한 숙소 가격을 다시 확인하는 중" : drops.length ? `찜한 뒤 내려간 숙소 ${drops.length}곳` : state ? "찜한 뒤 내려간 숙소는 아직 없어요" : "찜한 숙소 가격 변화"}</strong>
        <small>{busy ? "예약처 가격을 받고 있어요" : state ? `${ago(state.at)} 확인 · 최근 찜한 숙소 최대 5곳, 하루 한 번` : "최근 찜한 숙소 최대 5곳을 하루 한 번 확인해요"}</small>
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
                    <b>{l.now !== null ? won(l.now) : ""}</b>
                    <em>{won(Math.abs(l.diff ?? 0))}↓</em>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {!busy && state && (
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
              <b className="tb-drop-now">{l.now !== null ? won(l.now) : ""}</b>
              <small className="tb-drop">찜할 때보다 {won(Math.abs(l.diff ?? 0))}↓</small>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

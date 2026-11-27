"use client";

import { checkedText } from "@/lib/checked-at";
import { won, type StayQuery } from "@/lib/trip";
import { startRegister, useWatches, vendorKo } from "./BookingWatch";
import { isTracked, latestConfirmed, useTracked, useWatch } from "./PriceWatch";
import { usePriceVersion } from "./prices";
import { baseOf, MIN_DIFF, type SavedLike } from "./saved-price";

// 홈 '내 가격 지킴이' 한 섹션 (2026-11-27 PR 2/3).
// 예전에는 '아직 내려간 예약은 없어요'(예약 등록) 배너와 '찜한 숙소 가격이 내려갔어요'가 따로 떠서 서로 맞지 않아 보였다.
// 예약 등록 숙소 + 찜한 숙소를 한 표로 합치고, 내려간 줄을 맨 위에 둔다. 금액은 공용 가격 저장소·등록 목록에 이미 있는 값만 쓴다 (유료 검색 0회)

const DAY = 86_400_000;
const md = (iso: string) => `${Number(iso.slice(5, 7))}.${Number(iso.slice(8, 10))}`;
const dday = (iso: string | null) => {
  if (!iso) return null;
  const today = new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10);
  const n = Math.round((Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY);
  return n >= 0 ? n : null;
};

type Row = {
  id: string;
  name: string;
  sub: string;
  base: number | null;
  now: number | null;
  at: number | string | null;
  cancel: { date: string; d: number } | null;
  diff: number | null; // 지금 - 기준 (음수면 내려감)
  open: () => void;
};

const MAX_ROWS = 6;

type Props = {
  saved: SavedLike[];
  onOpenSaved: (s: SavedLike) => void;
  onGo: (token: string, q: StayQuery) => void;
  onTrips: () => void;
  onSearch: () => void; // 빈 상태: 위 검색 칸으로
};

export function HomeGuard({ saved, onOpenSaved, onGo, onTrips, onSearch }: Props) {
  const [watches] = useWatches();
  const state = useWatch();
  const tracked = useTracked(); // 찜은 가격 추적을 켠 숙소만
  usePriceVersion();

  const rows: Row[] = [];
  for (const w of (watches ?? []).filter((x) => x.status === "active")) {
    const q: StayQuery = { place: w.place, checkIn: w.checkIn, checkOut: w.checkOut, adults: w.adults, budget: 0, taste: "" };
    const diff = w.latest !== null ? w.latest - w.bookedPrice : null;
    const d = dday(w.freeCancelUntil);
    rows.push({
      id: `w:${w.id}`,
      name: w.name,
      sub: [w.place, `${md(w.checkIn)}–${md(w.checkOut)}`, `성인 ${w.adults}`, w.bookedVendor ? vendorKo(w.bookedVendor) : "예약"].filter(Boolean).join(" · "),
      base: w.bookedPrice,
      now: w.latest,
      at: w.checkedAt,
      cancel: w.freeCancelUntil && d !== null ? { date: w.freeCancelUntil.slice(0, 10), d } : null,
      diff: diff !== null && Math.abs(diff) >= MIN_DIFF ? diff : null,
      open: () => onGo(w.token, q),
    });
  }
  const seen = new Set<string>();
  for (const s of saved) {
    const k = `${s.hotel.token}:${s.query.checkIn}:${s.query.checkOut}:${s.query.adults}`;
    if (seen.has(k) || !isTracked(saved, s, tracked)) continue;
    seen.add(k);
    const base = baseOf(s);
    const now = latestConfirmed(s.hotel.token, s.query, state);
    const diff = base.verified && base.price !== null && now ? now.value - base.price : null;
    rows.push({
      id: `s:${k}`,
      name: s.hotel.name,
      sub: [s.query.place, `${md(s.query.checkIn)}–${md(s.query.checkOut)}`, `성인 ${s.query.adults}`, "찜"].filter(Boolean).join(" · "),
      base: base.price,
      now: now?.value ?? null,
      at: now?.at ?? null,
      cancel: null,
      diff: diff !== null && Math.abs(diff) >= MIN_DIFF ? diff : null,
      open: () => onOpenSaved(s),
    });
  }
  // 내려간 줄(많이 내려간 순) → 나머지
  rows.sort((a, b) => (a.diff !== null && a.diff < 0 ? a.diff : 0) - (b.diff !== null && b.diff < 0 ? b.diff : 0));

  if (watches === null && !saved.length) return null;
  return (
    <section className="tb-sec tb-guard" aria-labelledby="tb-guard-h">
      <div className="tb-guard-head">
        <h2 id="tb-guard-h">내 가격 지킴이</h2>
        {rows.length > 0 && (
          <button type="button" className="tb-link" onClick={onTrips}>
            전체 보기 →
          </button>
        )}
      </div>
      {rows.length === 0 ? (
        <div className="tb-guard-empty">
          <p>예약한 숙소를 등록하거나 찜한 숙소의 가격 추적을 켜면 체크인 전까지 가격을 지켜봐 드려요</p>
          <div>
            <button
              type="button"
              className="tb-btn"
              onClick={() => {
                startRegister(); // 내 여행에서 등록 창이 바로 열린다
                onTrips();
              }}
            >
              예약한 숙소 등록하기
            </button>
            <button type="button" className="tb-btn ghost" onClick={onSearch}>
              숙소 검색해서 찜하기
            </button>
          </div>
        </div>
      ) : (
        <ul className="tb-guard-list">
          <li className="tb-guard-th" aria-hidden>
            <span>숙소</span>
            <span>기준 총액</span>
            <span>지금 최저 총액</span>
            <span>무료 취소</span>
            <span />
          </li>
          {rows.slice(0, MAX_ROWS).map((r) => {
            const down = r.diff !== null && r.diff < 0;
            return (
              <li key={r.id}>
                <button type="button" className="tb-guard-row" onClick={r.open}>
                  <span className="tb-guard-name">
                    <strong>{r.name}</strong>
                    <small>{r.sub}</small>
                  </span>
                  <span className="tb-guard-base">
                    <small className="tb-only-m">기준 </small>
                    {r.base !== null ? won(r.base) : "—"}
                  </span>
                  <span className={`tb-guard-now${down ? " down" : ""}`}>
                    <b>{r.now !== null ? won(r.now) : "확인 전"}</b>
                    {r.at ? <small>{checkedText(r.at)}</small> : null}
                  </span>
                  <span className="tb-guard-fc">{r.cancel ? `${md(r.cancel.date)}까지 · D-${r.cancel.d}` : <small>—</small>}</span>
                  <span className={`tb-guard-chip${down ? " down" : ""}`}>{down ? `${won(Math.abs(r.diff!))} ↓ 지금 확인` : "지켜보는 중"}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

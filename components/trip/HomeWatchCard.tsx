"use client";

import { hotelHref } from "@/lib/hotel-link";
import { won, type StayQuery } from "@/lib/trip";
import { useWatches, vendorKo } from "./BookingWatch";
import { PriceTrendChart, type TrendPoint } from "./PriceTrendChart";

// 홈 히어로 오른쪽 '가격 지킴이' 카드 (2026-11-27 PR 2/3).
// 이 기기에서 지켜보는 예약이 있으면 그 숙소의 실제 값(예약한 총액 → 최근 확인한 최저 총액)을 보여 주고,
// 없으면 '예시 화면'이라고 밝힌 예시 카드를 보여 준다. 홈에 들어올 때 유료 검색은 0회 (등록 목록만 읽는다)

const DAY = 86_400_000;
const md = (iso: string) => `${Number(iso.slice(5, 7))}.${Number(iso.slice(8, 10))}`;
const nightsOf = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY);
const daysLeft = (iso: string | null) => {
  if (!iso) return null;
  const today = new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10);
  const n = Math.round((Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY);
  return n >= 0 ? n : null;
};

// 예시 화면 (지어낸 숙소라는 것을 카드 위에 밝힌다)
const EX = {
  name: "신주쿠 역 앞 호텔 (예시)",
  dates: "12.18–12.20 · 2박",
  booked: 342000,
  now: 298000,
  vendor: "아고다",
  cancelDays: 18,
  points: [342000, 351000, 338000, 331000, 336000, 318000, 309000, 298000],
};

type Props = {
  onGo: (href: string) => void; // 앱 안에서 이동 (숙소 상세)
  onTrips: () => void; // 예시: 가격 지킴이 안내 (/trips)
  onExampleCity: () => void; // 예시: 도쿄 기본 날짜 검색
};

export function HomeWatchCard({ onGo, onTrips, onExampleCity }: Props) {
  const [list] = useWatches();
  const active = (list ?? []).filter((w) => w.status === "active" && w.latest !== null);
  // 내려간 예약을 먼저, 그다음 가장 최근에 확인한 예약
  const w = [...active].sort((a, b) => (a.latest! - a.bookedPrice) - (b.latest! - b.bookedPrice))[0];

  if (w) {
    const q: StayQuery = { place: w.place, checkIn: w.checkIn, checkOut: w.checkOut, adults: w.adults, budget: 0, taste: "" };
    const href = hotelHref(w.token, q);
    const now = w.latest!;
    const diff = w.bookedPrice - now;
    const left = daysLeft(w.freeCancelUntil);
    const checked = Date.parse(w.checkedAt ?? "") || Date.now();
    const points: TrendPoint[] = [
      { t: checked - DAY, v: w.bookedPrice }, // 날짜별 기록은 없어 예약가 → 최근 확인가 두 점만 (지어내지 않는다)
      { t: checked, v: now },
    ];
    return (
      <aside className="tb-wcard" aria-label="가격 지킴이: 지켜보는 예약">
        <p className="tb-wcard-top">
          <span>가격 지킴이</span>
          <em>
            <i aria-hidden /> 지켜보는 중
          </em>
        </p>
        <strong className="tb-wcard-name">{w.name}</strong>
        <small className="tb-wcard-sub">
          {md(w.checkIn)}–{md(w.checkOut)} · {nightsOf(w.checkIn, w.checkOut)}박
        </small>
        <div className="tb-wcard-nums">
          <span>
            <small>예약한 총액</small>
            <s>{won(w.bookedPrice)}</s>
          </span>
          <span>
            <small>지금 최저 총액</small>
            <b>{won(now)}</b>
          </span>
        </div>
        <PriceTrendChart points={points} base={w.bookedPrice} startLabel="예약" endLabel="최근 확인" label={`예약한 총액 ${won(w.bookedPrice)}, 최근 확인한 최저 총액 ${won(now)}`} />
        {diff > 0 ? (
          <div className="tb-wcard-save">
            <span>
              {won(diff)} 아낄 수 있어요{left !== null ? ` · 취소 기한까지 ${left}일` : ""}
            </span>
            <button type="button" onClick={() => onGo(href)}>
              다시 예약하기
            </button>
          </div>
        ) : (
          <p className="tb-wcard-wait">아직 예약한 총액보다 낮은 곳은 없어요. 체크인 전까지 계속 지켜봐요</p>
        )}
        <button type="button" className="tb-wcard-foot" onClick={() => onGo(href)}>
          지금 최저{w.latestVendor ? `: ${vendorKo(w.latestVendor)}` : ""} {won(now)} · 예약처 비교 →
        </button>
      </aside>
    );
  }

  const start = Date.UTC(2026, 10, 19);
  const points = EX.points.map((v, i) => ({ t: start + i * DAY, v }));
  return (
    <aside className="tb-wcard" aria-label="가격 지킴이 예시 화면">
      <p className="tb-wcard-top">
        <span>가격 지킴이 · 예시 화면</span>
        <em>
          <i aria-hidden /> 지켜보는 중
        </em>
      </p>
      <strong className="tb-wcard-name">{EX.name}</strong>
      <small className="tb-wcard-sub">{EX.dates}</small>
      <div className="tb-wcard-nums">
        <span>
          <small>예약한 총액</small>
          <s>{won(EX.booked)}</s>
        </span>
        <span>
          <small>지금 최저 총액</small>
          <b>{won(EX.now)}</b>
        </span>
      </div>
      <PriceTrendChart points={points} base={EX.booked} startLabel="11.19 예약" endLabel="오늘" label={`예시: 예약한 총액 ${won(EX.booked)}에서 지금 ${won(EX.now)}으로 내려간 추이`} />
      <div className="tb-wcard-save">
        <span>
          {won(EX.booked - EX.now)} 아낄 수 있어요 · 취소 기한까지 {EX.cancelDays}일
        </span>
        <button type="button" onClick={onTrips}>
          이렇게 지켜보기
        </button>
      </div>
      <button type="button" className="tb-wcard-foot" onClick={onExampleCity}>
        지금 최저: {EX.vendor} {won(EX.now)} · 예약처 비교 →
      </button>
    </aside>
  );
}

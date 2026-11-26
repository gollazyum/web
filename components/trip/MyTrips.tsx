"use client";

import { today as localToday } from "@/lib/dates";
import { daysUntil, groupTrips, type Trip, type TripItem } from "@/lib/trips";
import { guestText, nightsOf } from "@/lib/trip";
import { StayRow } from "./StayList";
import { IconBed } from "./icons";
import { TripActions } from "./TripRecheck";

const md = (iso: string) => `${Number(iso.slice(5, 7))}월 ${Number(iso.slice(8, 10))}일`;

type Props<T extends TripItem> = {
  saved: T[];
  onOpen: (s: T) => void;
  onSave: (s: T) => void;
  onHome: () => void;
  onFlight: (t: Trip) => void; // 같은 날짜로 항공편 검색 칸 채우기
  onMoreStays: (t: Trip) => void; // 같은 조건으로 숙소 더 보기
};

// 내 여행 탭: 담아 둔 숙소를 여행(도시 + 날짜)으로 묶어 숙소 목록과 같은 1px 구분선 줄로 보여 준다. 모두 이 기기에만 저장된다
// ('빠진 건 없나요?' 체크는 2026-11-26 북유럽 정리 때 뺐다)
export function MyTrips<T extends TripItem>({ saved, onOpen, onSave, onHome, onMoreStays }: Props<T>) {
  const today = localToday();
  const trips = groupTrips(saved, today);

  if (!trips.length)
    return (
      <>
        <h2 className="tb-h2">찜한 숙소</h2>
        <div className="tb-empty tb-empty-trip">
          <TripCardsArt />
          <strong>아직 찜한 숙소가 없어요</strong>
          <p>마음에 드는 숙소의 ♡를 누르면 여행별로 여기에 모이고, 가격이 내려가면 맨 위에 알려 드려요.</p>
          <button type="button" className="tb-cta small" onClick={onHome}>
            숙소 찾으러 가기
          </button>
        </div>
      </>
    );

  return (
    <>
      <h2 className="tb-h2">찜한 숙소</h2>
      {trips.map((t, i) => {
        const d = daysUntil(t.checkIn, today);
        const showPastHead = t.past && (i === 0 || !trips[i - 1].past);
        return (
          <div key={t.key} className="tb-trip-wrap">
            {showPastHead && <h3 className="tb-trip-past">지난 여행</h3>}
            <section className={`tb-trip${t.past ? " past" : ""}`} aria-label={`${t.city} 여행`}>
              <header className="tb-trip-head">
                <div>
                  <strong>{t.city}</strong>
                  <span>
                    {md(t.checkIn)} – {md(t.checkOut)} · {nightsOf({ checkIn: t.checkIn, checkOut: t.checkOut })}박 · {guestText(t.items[0]?.query ?? t)}
                  </span>
                </div>
                {!t.past && <em className="tb-dday">{d > 0 ? `D-${d}` : d === 0 ? "오늘 출발" : "여행 중"}</em>}
              </header>

              <h4 className="tb-trip-sub">
                <IconBed size={16} /> 찜한 숙소 {t.items.length}곳
              </h4>
              <div className="tb-rlist flat">
                {t.items.map((s) => (
                  <div key={s.hotel.token}>
                    <StayRow h={s.hotel} query={s.query} saved onSave={() => onSave(s)} onOpen={() => onOpen(s)} />
                    {(s.query.checkIn !== t.checkIn || s.query.checkOut !== t.checkOut || s.query.place !== t.city) && (
                      <p className="tb-saved-q">
                        {s.query.place} · {md(s.query.checkIn)}–{md(s.query.checkOut)} · {guestText(s.query)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
              {!t.past && (
                <button type="button" className="tb-link tb-trip-more" onClick={() => onMoreStays(t)}>
                  이 날짜로 숙소 더 보기
                </button>
              )}
              {!t.past && <TripActions items={t.items} place={t.items[0]?.query.place ?? t.city} checkIn={t.checkIn} checkOut={t.checkOut} adults={t.adults} />}

            </section>
          </div>
        );
      })}
    </>
  );
}

// 빈 화면 그림: 겹쳐 놓은 여행 사진 카드 두 장 + ♡ (캐릭터 없이 앱 색으로만)
function TripCardsArt() {
  return (
    <svg className="tb-empty-art" width="168" height="112" viewBox="0 0 168 112" aria-hidden>
      <g transform="rotate(-8 60 60)">
        <rect x="22" y="20" width="92" height="70" rx="12" fill="#fff" stroke="var(--tb-line)" />
        <rect x="30" y="28" width="76" height="38" rx="7" fill="var(--tb-soft2)" />
        <path d="M30 60 l20 -16 l14 10 l12 -8 l30 20 v0 a7 7 0 0 1 -7 0 h-62 a7 7 0 0 1 -7 -6z" fill="var(--tb-line)" />
        <rect x="30" y="73" width="44" height="6" rx="3" fill="var(--tb-soft2)" />
      </g>
      <g transform="rotate(6 108 56)">
        <rect x="60" y="14" width="96" height="74" rx="12" fill="#fff" stroke="var(--tb-line)" />
        <rect x="68" y="22" width="80" height="40" rx="7" fill="var(--tb-accent-soft)" />
        <circle cx="130" cy="33" r="6" fill="#fff" />
        <path d="M68 56 l22 -18 l16 12 l14 -9 l28 19 v2 a6 6 0 0 1 -6 0 h-68 a6 6 0 0 1 -6 -6z" fill="var(--tb-accent)" opacity="0.35" />
        <rect x="68" y="70" width="52" height="6" rx="3" fill="var(--tb-soft2)" />
      </g>
      <circle cx="146" cy="88" r="16" fill="var(--tb-accent)" />
      <path d="M146 96 l-7 -7 a4.4 4.4 0 0 1 7 -5.4 a4.4 4.4 0 0 1 7 5.4z" fill="#fff" />
    </svg>
  );
}

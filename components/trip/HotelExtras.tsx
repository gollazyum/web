"use client";

import { useEffect, useMemo, useState } from "react";
import type { HotelInfo, HotelOption } from "@/lib/hotels";
import { hotelHref, savePreview } from "@/lib/hotel-link";
import { isShownAmenity } from "@/lib/hotelText";
import { pickSimilar, SIM_MAX, SIM_MIN } from "@/lib/similar-hotels";
import { nightsOf, won, type StayQuery } from "@/lib/trip";
import { shownPrice } from "./prices";

const ratingWord = (r: number) => (r >= 4.5 ? "최고" : r >= 4.2 ? "아주 좋음" : r >= 3.8 ? "좋음" : "보통");

// 후기 평점 · 체크인/체크아웃 · 전체 편의시설 (숙소 응답에 온 값만, 없으면 그 줄을 숨긴다)
export function HotelFacts({ hotel, info }: { hotel: HotelOption; info: HotelInfo | null }) {
  const [all, setAll] = useState(false);
  const amen = useMemo(() => {
    const list = [...new Set([...(info?.amenitiesAll ?? []), ...hotel.amenities])].filter(isShownAmenity);
    return list;
  }, [info, hotel.amenities]);
  const cin = info?.checkInTime ?? null;
  const cout = info?.checkOutTime ?? null;
  if (!hotel.rating && !cin && !cout && !amen.length) return null;
  const shown = all ? amen : amen.slice(0, 12);
  return (
    <section className="tb-detail-sec tb-hf">
      {hotel.rating ? (
        <div className="tb-hf-score">
          <b className="tb-num">{hotel.rating.toFixed(1)}</b>
          <span>
            <strong>{ratingWord(hotel.rating)}</strong>
            {hotel.reviews ? <small className="tb-num">후기 {hotel.reviews.toLocaleString("ko-KR")}개</small> : null}
          </span>
        </div>
      ) : null}
      {(cin || cout) && (
        <dl className="tb-hf-times">
          <div>
            <dt>체크인</dt>
            <dd className="tb-num">{cin ?? "예약처에서 확인"}</dd>
          </div>
          <div>
            <dt>체크아웃</dt>
            <dd className="tb-num">{cout ?? "예약처에서 확인"}</dd>
          </div>
        </dl>
      )}
      {amen.length > 0 && (
        <>
          <h3>편의시설 {amen.length}가지</h3>
          <ul className="tb-hf-amen">
            {shown.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
          {amen.length > 12 && (
            <button type="button" className="tb-link" onClick={() => setAll((x) => !x)} aria-expanded={all}>
              {all ? "접기" : `편의시설 ${amen.length}가지 모두 보기`}
            </button>
          )}
        </>
      )}
    </section>
  );
}

type Sim = { token: string; name: string; image: string | null; stars: number | null; rating: number | null; reviews: number | null; gps: [number, number] | null; price: number | null; verified: boolean; hotel?: HotelOption };

// 비슷한 후보 숙소 3~5곳: 같은 탭의 검색 목록(가격 포함) → 없으면 검색에 나온 적 있는 숙소 목록(가격 없이). 유료 호출 0회
export function SimilarHotels({ hotel, query, pool }: { hotel: HotelOption; query: StayQuery; pool?: HotelOption[] }) {
  const nights = nightsOf(query);
  const mine = shownPrice(hotel, query);
  const local = useMemo<Sim[]>(() => {
    if (!pool?.length) return [];
    const cands = pool.map((h) => {
      const p = shownPrice(h, query);
      return { token: h.token, name: h.name, image: h.image || null, stars: h.stars, rating: h.rating, reviews: h.reviews, gps: h.gps, price: p.none ? null : p.value, verified: p.verified, hotel: h };
    });
    return pickSimilar({ token: hotel.token, gps: hotel.gps, stars: hotel.stars, rating: hotel.rating, reviews: hotel.reviews, price: mine.none ? null : mine.value }, cands, SIM_MAX);
  }, [pool, hotel.token, hotel.gps, hotel.stars]); // eslint-disable-line react-hooks/exhaustive-deps
  const [remote, setRemote] = useState<Sim[] | null>(null);
  useEffect(() => {
    if (local.length >= SIM_MIN) return;
    const ctl = new AbortController();
    fetch(`/api/hotels/similar?token=${encodeURIComponent(hotel.token)}`, { signal: ctl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { hotels?: Omit<Sim, "verified">[] } | null) => setRemote((j?.hotels ?? []).map((h) => ({ ...h, price: null, verified: false }))))
      .catch(() => undefined);
    return () => ctl.abort();
  }, [hotel.token, local.length]);
  const list = local.length >= SIM_MIN ? local : [...local, ...(remote ?? []).filter((r) => !local.some((l) => l.token === r.token))].slice(0, SIM_MAX);
  if (list.length < SIM_MIN) return null;
  return (
    <section className="tb-hp-sim" aria-labelledby="tb-sim-h">
      <h2 id="tb-sim-h">비슷한 후보 숙소</h2>
      <p className="tb-note">가까운 거리·비슷한 등급과 평점으로 골랐어요{local.length >= SIM_MIN ? "" : " (가격은 숙소를 열면 확인해요)"}.</p>
      <div className="tb-sim-row">
        {list.map((s) => (
          <a
            key={s.token}
            className="tb-sim-card"
            href={hotelHref(s.token, query)}
            onClick={() => {
              if (s.hotel) savePreview(s.hotel, s.verified ? s.price : null);
            }}
          >
            <span className="tb-sim-ph" aria-hidden>
              {s.image ? <img src={s.image} alt="" loading="lazy" onError={(e) => (e.currentTarget.style.visibility = "hidden")} /> : null}
            </span>
            <strong>{s.name}</strong>
            <small>{[s.stars ? `${s.stars}성급` : "", s.rating ? `★ ${s.rating.toFixed(1)}` : "", s.reviews ? `후기 ${s.reviews.toLocaleString("ko-KR")}` : ""].filter(Boolean).join(" · ")}</small>
            {s.price !== null && (
              <span className="tb-sim-price tb-num">
                {!s.verified && <em className="tb-est">예상</em>} <b>{won(s.price)}</b> <small>· {nights}박</small>
              </span>
            )}
          </a>
        ))}
      </div>
    </section>
  );
}

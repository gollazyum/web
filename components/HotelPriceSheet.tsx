"use client";

import { useState } from "react";
import { MochiStars, ratingTier } from "./MochiMarks";
import { bookingLink, firstSites, roboPick, roboReason, type HotelOption, type HotelQuery, type HotelSource } from "@/lib/hotels";
import { cardAmenities, hotelNameKo } from "@/lib/hotelText";
import { useSheet } from "@/lib/useSheet";

// 휴대폰 호텔 결과: 카드를 누르면 아래에서 올라오는 '예약 사이트별 가격' 시트.
// 사진(옆으로 넘기기), 로보티 한 줄 요약, 사이트별 총액, 맨 아래 고정된 최저 총액 예약 버튼

export type PriceState = { kind: "loading" } | { kind: "ok"; sources: HotelSource[] } | { kind: "error"; message: string };

const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;

// 카드의 큰 숫자: 세금 포함 총액, 없으면 1박 × 박 수
export function totalOf(h: HotelOption, nights: number): number | null {
  return h.total ?? (h.perNight !== null ? h.perNight * nights : null);
}

// 두 곳 이상 비교될 때만 가장 싼 곳을 고른다. 총액이 둘 이상 있으면 총액끼리, 아니면 1박가끼리 비교
export function lowestCost(sources: HotelSource[]) {
  const totals = sources.filter((s) => s.total !== null).length > 1;
  const cost = (s: HotelSource) => (totals ? s.total : s.perNight);
  const costs = sources.map(cost).filter((v): v is number => v !== null);
  return costs.length > 1 ? { cost, value: Math.min(...costs), totals } : null;
}

// 로보티 한 줄 요약. 받아 온 목록의 숫자(총액·등급·후기·특가·편의시설)로만 만든다.
// 역까지 거리처럼 데이터에 없는 건 말하지 않는다
export function roboSummary(h: HotelOption, all: HotelOption[], nights: number, picked: boolean): string {
  const total = totalOf(h, nights);
  const facts: string[] = [];
  if (total !== null) {
    const cheaper = (list: HotelOption[]) => list.filter((o) => (totalOf(o, nights) ?? Infinity) < total).length;
    const same = h.stars ? all.filter((o) => o.stars === h.stars) : [];
    if (all.length > 1 && cheaper(all) === 0) facts.push(`이 검색 ${all.length}곳 중 세금 포함 총액이 가장 저렴해요`);
    else if (same.length > 1 && cheaper(same) === 0) facts.push(`이 검색의 ${h.stars}성급 ${same.length}곳 중 세금 포함 총액이 가장 저렴해요`);
    else if (all.length >= 5 && cheaper(all) < all.length / 4) facts.push(`이 검색 ${all.length}곳 중 총액이 ${cheaper(all) + 1}번째로 낮아요`);
  }
  if (h.rating !== null && h.rating >= 4.5 && (h.reviews ?? 0) >= 50) facts.push(`후기 ${h.rating.toFixed(1)}점(${(h.reviews ?? 0).toLocaleString("ko-KR")}개)으로 평가가 아주 좋아요`);
  else if (h.rating !== null && all.filter((o) => (o.rating ?? 0) > h.rating!).length < 3 && all.length >= 5)
    facts.push(`후기 점수가 이 검색 상위권(${h.rating.toFixed(1)}점)이에요`);
  const pct = h.deal.match(/(\d+)\s*%/)?.[1];
  if (pct) facts.push(`평소보다 ${pct}% 저렴하게 나온 가격이에요`);
  if (h.amenities.some((a) => /조식/.test(a))) facts.push("조식 관련 표시가 있어요");
  const lead = picked ? "로보티가 추천한 곳이에요. " : "";
  if (!facts.length) return `${lead}${h.stars ? `${h.stars}성급 ` : ""}${h.kind}이에요. 사이트마다 총액이 달라서 아래에서 가장 싼 곳을 확인해 보세요.`;
  const [a, b] = facts;
  return `${lead}${b ? `${and(a)}, ${b}` : a}.`;
}

// "저렴해요" → "저렴하고"처럼 두 문장을 한 줄로 잇는다
function and(s: string): string {
  return s.replace(/이에요$/, "이고").replace(/해요$/, "하고").replace(/아요$/, "고").replace(/어요$/, "고");
}

type Props = {
  hotel: HotelOption;
  query: HotelQuery;
  nights: number;
  prices: PriceState | null;
  summary: string;
  onClose: () => void;
};

export function HotelPriceSheet({ hotel, query, nights, prices, summary, onClose }: Props) {
  useSheet(true, onClose);
  const sources = prices?.kind === "ok" ? prices.sources : hotel.sources;
  const best = lowestCost(sources);
  // 줄 세우기: 총액(없으면 1박가) 낮은 순
  const rows = [...sources].sort((a, b) => (a.total ?? a.perNight ?? Infinity) - (b.total ?? b.perNight ?? Infinity));
  const top = rows.find((s) => s.total !== null) ?? rows[0];
  const linkOf = (s: HotelSource) => bookingLink(s, hotel.name, query);
  const pick = roboPick(sources);
  const why = pick ? roboReason(sources, hotel.deal, hotel.token) : "";
  const [allSites, setAllSites] = useState(false);
  const first = firstSites(rows, pick);
  const hidden = rows.length - first.size;
  const images = hotel.images.length ? hotel.images : hotel.image ? [hotel.image] : [];
  const tier = hotel.rating !== null ? ratingTier(hotel.rating) : null;

  return (
    <>
      <div className="sheet-dim price-dim" aria-hidden="true" onClick={onClose} />
      <div className="price-sheet" role="dialog" aria-modal="true" aria-label={`${hotel.name} 예약 사이트별 가격`}>
        <div className="ps-head">
          <span className="ps-grab" aria-hidden="true" />
          <button type="button" className="filters-close" aria-label="닫기" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="ps-scroll">
          {images.length > 0 && (
            <div className="ps-photos">
              {images.map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={src + i} src={src.replace(/=w\d+-h\d+[^/]*$/, "=w640-h480-k-no")} alt={`${hotel.name} 사진 ${i + 1}`} loading={i ? "lazy" : undefined} />
              ))}
            </div>
          )}
          <h2>{hotelNameKo(hotel.name)}</h2>
          <p className="ps-meta">
            {hotel.stars ? (
              <>
                <MochiStars count={hotel.stars} /> {hotel.stars}성급 {hotel.kind}
              </>
            ) : (
              hotel.kind
            )}
            {hotel.rating !== null && (
              <>
                {" · "}
                <b className={`ps-rating${hotel.rating >= 3.5 ? "" : " ok"}`}>{hotel.rating.toFixed(1)}</b> {tier?.word}
                {hotel.reviews ? ` · 후기 ${hotel.reviews.toLocaleString("ko-KR")}개` : ""}
              </>
            )}
          </p>
          {hotel.gps && (
            <a className="ps-map" href={`https://www.google.com/maps/search/?api=1&query=${hotel.gps[0]},${hotel.gps[1]}`} target="_blank" rel="noopener noreferrer">
              지도 보기 ↗
            </a>
          )}

          <p className="ps-robo">
            <span aria-hidden="true">🤖</span> <b>로보티 요약</b> {summary}
          </p>

          <h3>
            예약 사이트별 {best?.totals === false ? "1박 요금" : "총액"} <small>({nights}박 · 세금 포함)</small>
            {prices?.kind === "loading" && <span className="dots"> 더 불러오는 중</span>}
          </h3>
          {rows.length > 0 && (
            <ul className="ps-sources">
              {rows.filter((s) => allSites || first.has(s.name)).map((s) => {
                const link = linkOf(s);
                const isBest = best !== null && best.cost(s) === best.value;
                return (
                  <li key={s.name} className={isBest ? "best" : undefined}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {s.logo ? <img src={s.logo} alt="" /> : <i />}
                    <span className="ps-site">
                      {s.name}
                      {s.official && <em> 공식</em>}
                      {s.name === pick && <em className="hotel-pick"> 로보티 추천</em>}
                      {isBest && <em className="best-badge">최저가</em>}
                      {s.name === pick && <small className="pick-why">{why}</small>}
                    </span>
                    <span className="ps-cost">
                      <b>{s.total !== null ? won(s.total) : s.perNight !== null ? won(s.perNight) : "-"}</b>
                      <small>{s.total !== null ? (s.perNight !== null ? `1박 ${won(s.perNight)}` : "") : "1박"}</small>
                    </span>
                    {link ? (
                      <a href={link} target="_blank" rel="noopener noreferrer sponsored" aria-label={`${s.name}에서 예약`}>
                        예약 ↗
                      </a>
                    ) : (
                      <span />
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {hidden > 0 && !allSites && (
            <button type="button" className="more-sites" onClick={() => setAllSites(true)}>
              외 {hidden}개 사이트 가격 더 보기 ∨
            </button>
          )}
          {prices?.kind === "ok" && !sources.length && <p className="flight-note">이 호텔은 지금 예약 사이트 가격을 찾지 못했어요.</p>}
          {prices?.kind === "error" && <p className="flight-note">{prices.message}</p>}
          {cardAmenities(hotel.amenities).length > 0 && (
            <ul className="hcard-amen ps-amen">
              {cardAmenities(hotel.amenities).slice(0, 10).map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          )}
          <p className="flight-note">
            Google 호텔 검색 기준, 검색 시점 가격이에요. 최종 금액은 예약 사이트 결제 화면에서 꼭 확인해 주세요. 아고다 링크는 제휴 링크라 예약 시 로보티가
            수수료를 받을 수 있어요.
          </p>
        </div>
        {top && linkOf(top) && (
          <div className="ps-foot">
            <span>
              <small>최저 {top.total !== null ? "총액" : "1박"}</small>
              <b>{won((top.total ?? top.perNight) as number)}</b>
            </span>
            <a href={linkOf(top)} target="_blank" rel="noopener noreferrer sponsored">
              {top.name}에서 예약 ↗
            </a>
          </div>
        )}
      </div>
    </>
  );
}

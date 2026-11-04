"use client";

import { useEffect, useRef, useState } from "react";
import { MochiStars, ratingTier } from "./MochiMarks";
import { agodaAffiliateOn } from "@/lib/affiliate";
import { allowedSellers, hotelSellerKey, linkRel, sellerSearchUrl, withRo } from "@/lib/hotel-sellers";
import { agodaSearchUrl, bookingLink, firstSites, isAgoda, lowestOffer, roboReason, type HotelOption, type HotelQuery, type HotelSource, type ReviewTopic } from "@/lib/hotels";
import { cardAmenities, hotelNameKo, stayLimitLabel, stayLimits } from "@/lib/hotelText";
import { useSheet } from "@/lib/useSheet";
import { resized } from "@/lib/hotel-photo";

// 휴대폰 호텔 결과: 카드를 누르면 아래에서 올라오는 '예약 사이트별 가격' 시트.
// 사진(옆으로 넘기기), Gollazyum AI 한 줄 요약, 사이트별 총액(허용 목록 판매처만), 맨 아래 고정된 최저 총액 예약 버튼

export type PriceState = { kind: "loading" } | { kind: "ok"; sources: HotelSource[]; topics?: ReviewTopic[] | null } | { kind: "error"; message: string };

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
  const lead = picked ? "Gollazyum AI가 붙은 곳이에요. " : "";
  if (!facts.length) return `${lead}${h.stars ? `${h.stars}성급 ` : ""}${h.kind}이에요. 사이트마다 총액이 달라서 아래에서 가장 싼 곳을 확인해 보세요.`;
  const [a, b] = facts;
  return `${lead}${b ? `${and(a)}, ${b}` : a}.`;
}

// 시트 위 '로보티 요약': 이 호텔의 후기·등급과 지금 불러온 사이트별 최저가로 만든다.
// 사이트 가격이 없으면 목록 기준 요약(fallback)을 쓴다
function sheetSummary(h: HotelOption, sources: HotelSource[], fallback: string): string {
  const best = lowestCost(sources);
  const site = best ? sources.find((s) => best.cost(s) === best.value) : null;
  const price = site?.perNight ?? null;
  if (!site || price === null) return fallback;
  const kind = h.stars ? `${h.stars}성급 숙소` : "숙소";
  const head =
    h.rating !== null && h.reviews ? `후기 ${h.reviews.toLocaleString("ko-KR")}개(${h.rating.toFixed(1)}점)로 검증된 ${kind}예요! ` : h.stars ? `${kind}예요! ` : "";
  return `${head}현재 ${site.name}에서 1박 평균 ${won(price)}으로 가장 저렴해요.`;
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
  onRetry: () => void;
  onClose: () => void;
};

// 카드에는 가격이 있는데 사이트별 가격이 0곳일 때 쓰는 요약 (가장 싼 곳을 가리키는 말은 하지 않는다)
export const EMPTY_SUMMARY = "이 날짜엔 예약 사이트별 가격이 아직 없어요. 카드 금액은 참고용이라, 아고다나 트립닷컴에서 같은 날짜로 확인해 보세요.";

// 결과 위 검색창(날짜)을 펼친다. 시트를 닫은 뒤 맨 위로 올라가 '변경'을 누른 것과 같게
function openDateEditor() {
  window.scrollTo({ top: 0, behavior: "smooth" });
  const btn = document.querySelector<HTMLButtonElement>(".results-summary");
  if (btn && btn.getAttribute("aria-expanded") !== "true") btn.click();
}

const TOAST_MS = 1600;

export function HotelPriceSheet({ hotel, query, nights, prices, summary, onRetry, onClose }: Props) {
  useSheet(true, onClose);
  // 한국 사용자용 허용 목록 안의 판매처만. 최저가·배지·하단 버튼 모두 이 목록 기준이다
  const sources = allowedSellers(prices?.kind === "ok" ? prices.sources : hotel.sources);
  const best = lowestCost(sources);
  // 줄 세우기: 총액(없으면 1박가) 낮은 순
  const rows = [...sources].sort((a, b) => (a.total ?? a.perNight ?? Infinity) - (b.total ?? b.perNight ?? Infinity));
  const top = lowestOffer(rows);
  const linkOf = (s: HotelSource) => bookingLink(s, hotel.name, query);
  const relOf = (s: HotelSource) => linkRel(hotelSellerKey(s.name, s.official, s.link));
  // Gollazyum AI 표시는 실제 최저가 줄 한 곳에만 (두 곳 이상 가격이 있을 때)
  const pick = best && top ? top.name : null;
  const why = pick ? roboReason(sources, pick) : "";
  const affiliate = agodaAffiliateOn();
  const [allSites, setAllSites] = useState(false);
  const first = firstSites(rows, pick);
  const hidden = rows.length - first.size;
  const images = hotel.images.length ? hotel.images : hotel.image ? [hotel.image] : [];
  const tier = hotel.rating !== null ? ratingTier(hotel.rating) : null;
  const agodaRow = rows.find((s) => isAgoda(s.name)) ?? null;
  const agodaTop = !!top && isAgoda(top.name);
  const empty = prices?.kind === "ok" && rows.length === 0;
  // 카드에 가격이 있는데 시트의 사이트별 가격이 0곳 (참고 가격만 있음)
  const cardPrice = hotel.perNight !== null || hotel.total !== null;
  // '다시 확인'을 누른 뒤에도 0곳이면 문구를 바꾼다
  const [retried, setRetried] = useState(false);
  const retry = () => {
    setRetried(true);
    onRetry();
  };
  const tripUrl = sellerSearchUrl("trip", hotel.name, query);
  const agodaUrl = agodaRow ? bookingLink(agodaRow, hotel.name, query) : agodaSearchUrl(hotel.name, query);

  // 예약/이동 버튼을 누르면 잠깐 안내 토스트
  const [toast, setToast] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  const going = (name: string) => () => {
    setToast(withRo(name));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(""), TOAST_MS);
  };
  const footName = (s: HotelSource) => (s.official ? "공식 사이트" : s.name);
  const gpsLink = hotel.gps && (
    <a className="ps-map" href={`https://www.google.com/maps/search/?api=1&query=${hotel.gps[0]},${hotel.gps[1]}`} target="_blank" rel="noopener noreferrer">
      지도 보기 ↗
    </a>
  );

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
          {/* 375×667에서도 사이트별 가격이 먼저 보이게: 이름·등급 → 가격 줄 → AI 요약 → 사진 순서 */}
          <h2>{hotelNameKo(hotel.name)}</h2>
          {stayLimits(hotel.name).length > 0 && (
            <p className="hcard-limit">
              {stayLimits(hotel.name).map((kind) => (
                <span key={kind}>⚠ {stayLimitLabel(kind)}</span>
              ))}
            </p>
          )}
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
                <b className={`ps-rating${tier?.band === "low" ? " low" : tier?.band === "ok" ? " ok" : ""}`}>{hotel.rating.toFixed(1)}/5</b> {tier?.word}
                {hotel.reviews ? ` · 후기 ${hotel.reviews.toLocaleString("ko-KR")}개` : ""}
              </>
            )}
          </p>

          <h3>
            예약 사이트별 {best?.totals === false ? "1박 요금" : "총액"} <small>({nights}박 · 세금 포함)</small>
            {prices?.kind === "loading" && <span className="dots"> 더 불러오는 중</span>}
          </h3>
          <p className="ps-terms">객실·취소·조식 조건은 사이트마다 달라요</p>
          {affiliate && agodaRow && <p className="ps-aff">아고다 링크는 제휴 링크라 예약 시 Gollazyum이 수수료를 받을 수 있어요.</p>}
          {rows.length > 0 && (
            <ul className="ps-sources">
              {rows.filter((s) => allSites || first.has(s.name)).map((s) => {
                const link = linkOf(s);
                const isBest = best !== null && best.cost(s) === best.value;
                const agoda = isAgoda(s.name);
                return (
                  <li key={s.name} className={`${isBest ? "best" : ""}${agoda ? " is-agoda" : ""}`.trim() || undefined}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {s.logo ? <img src={s.logo} alt="" /> : <i />}
                    <span className="ps-site">
                      {s.name}
                      {s.official && <em> 공식</em>}
                      {agoda && affiliate && <em className="ps-aff-tag">제휴</em>}
                      {s.name === pick && <em className="hotel-pick"> Gollazyum AI</em>}
                      {isBest && <em className="best-badge">{best?.totals ? "총액이 가장 낮아요" : "1박 요금이 가장 낮아요"}</em>}
                      {s.name === pick && why && <small className="pick-why">{why}</small>}
                    </span>
                    <span className="ps-cost">
                      <b>{s.total !== null ? won(s.total) : s.perNight !== null ? won(s.perNight) : "-"}</b>
                      <small>{s.total !== null ? (s.perNight !== null ? `1박 ${won(s.perNight)}` : "") : "1박"}</small>
                    </span>
                    {link ? (
                      <a href={link} target="_blank" rel={relOf(s)} aria-label={`${s.name}에서 예약, 새 탭에서 열려요`} onClick={going(s.name)}>
                        {agoda ? "아고다 ↗" : "예약 ↗"}
                      </a>
                    ) : (
                      <span />
                    )}
                    {agoda && link && <small className="ps-go-note">아고다 사이트로 바로 가요 · 새 탭</small>}
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
          {/* 가격이 한 곳만 나오면 아고다에서 이 도시 숙소를 더 볼 수 있게 */}
          {sources.length === 1 && !isAgoda(sources[0].name) && (
            <a className="more-sites" href={agodaSearchUrl(query.q, query)} target="_blank" rel={linkRel("agoda")} onClick={going("Agoda")}>
              아고다에서 더 많은 숙소 보러가기 ↗
            </a>
          )}
          {empty && (
            <div className="ps-empty" role="status">
              <p>
                {retried && prices?.kind === "ok"
                  ? "다시 확인해도 아직 없어요"
                  : cardPrice
                    ? "이 날짜엔 사이트별 가격을 아직 못 받았어요 · 카드 금액은 참고 가격이에요"
                    : "이 날짜엔 사이트별 가격을 아직 못 받았어요"}
              </p>
              <div className="ps-empty-btns">
                <a className="ps-empty-btn" href={tripUrl} target="_blank" rel={linkRel("trip")} onClick={going("Trip.com")}>
                  Trip.com에서 보기 ↗
                </a>
                <button
                  type="button"
                  className="ps-empty-btn"
                  onClick={() => {
                    onClose();
                    setTimeout(openDateEditor, 60);
                  }}
                >
                  📅 날짜 바꾸기
                </button>
                <button type="button" className="ps-empty-btn" onClick={retry}>
                  다시 확인
                </button>
              </div>
            </div>
          )}
          {prices?.kind === "error" && <p className="flight-note">{prices.message}</p>}

          <p className="ps-robo">
            <span aria-hidden="true">🤖</span> <b>Gollazyum AI 요약:</b> {empty ? EMPTY_SUMMARY : sheetSummary(hotel, sources, summary)}
          </p>
          {gpsLink}
          {images.length > 0 && (
            <div className="ps-photos">
              {images.map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={src + i} src={resized(src, 640, 480)} alt={`${hotel.name} 사진 ${i + 1}`} loading="lazy" />
              ))}
            </div>
          )}
          {cardAmenities(hotel.amenities).length > 0 && (
            <ul className="hcard-amen ps-amen">
              {cardAmenities(hotel.amenities).slice(0, 10).map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          )}
          <p className="flight-note">검색 시점 가격이에요. 최종 금액은 예약 사이트 결제 화면에서 꼭 확인해 주세요.</p>
        </div>
        {!(top && linkOf(top)) && prices?.kind !== "loading" && (
          <div className="ps-foot">
            <div className="ps-foot-btns">
              <a className="ps-main" href={agodaUrl} target="_blank" rel={linkRel("agoda")} onClick={going("Agoda")}>
                Agoda에서 이 숙소 보기 ↗
              </a>
            </div>
          </div>
        )}
        {top && linkOf(top) && (
          <div className={`ps-foot${agodaTop ? "" : " has-alt"}`}>
            <span className="ps-foot-price">
              <small>최저 {top.total !== null ? "총액" : "1박"}</small>
              <b>{won((top.total ?? top.perNight) as number)}</b>
            </span>
            <div className="ps-foot-btns">
              <a className="ps-main" href={linkOf(top)} target="_blank" rel={relOf(top)} onClick={going(top.name)}>
                {agodaTop ? "Agoda에서 예약 ↗" : `${footName(top)}에서 예약 ↗`}
              </a>
              {!agodaTop && (
                <a
                  className="ps-alt"
                  href={agodaUrl}
                  target="_blank"
                  rel={linkRel("agoda")}
                  onClick={going("Agoda")}
                >
                  Agoda에서 보기 ↗
                </a>
              )}
            </div>
          </div>
        )}
        {toast && (
          <p className="toast ps-toast" role="status">
            <span>{toast} 이동해요</span>
            <span> · 최종 금액은 결제 화면에서 확인해 주세요</span>
          </p>
        )}
      </div>
    </>
  );
}

"use client";

import { useMemo, useState } from "react";
import type { HotelOption } from "@/lib/hotels";
import { inBand, PRICE_BANDS } from "@/lib/price-bands";
import { nightsOf, won, type StayQuery } from "@/lib/trip";
import { shownCost, shownPrice, useLazyPrice, usePriceVersion } from "./prices";
import { IconBack, IconHeart, IconSort, IconSpark } from "./icons";

export type StayPick = { token: string; reason: string };

type Props = {
  query: StayQuery;
  options: HotelOption[];
  picks: StayPick[];
  aiPending: boolean;
  saved: Set<string>;
  onSave: (h: HotelOption) => void;
  onOpen: (h: HotelOption) => void; // 예약처별 총액 시트
  onBack: () => void;
  active?: string; // PC 패널에 열려 있는 숙소
  bare?: boolean; // 바텀시트 안: 위쪽 검색 줄 대신 제목만
};

// 결과 위 빠른 조건 (아고다·트립닷컴처럼 자주 쓰는 것부터). 받은 목록에 해당 숙소가 있을 때만 보인다
const FILTERS: { label: string; test: (h: HotelOption) => boolean }[] = [
  { label: "무료 취소", test: (h) => h.amenities.some((a) => /무료 취소/.test(a)) },
  { label: "조식", test: (h) => h.amenities.some((a) => /조식|아침/.test(a)) },
  { label: "평점 4.0+", test: (h) => (h.rating ?? 0) >= 4 },
  { label: "온천·대욕장", test: (h) => h.amenities.some((a) => /온천|대욕장|사우나/.test(a)) },
  { label: "수영장", test: (h) => h.amenities.some((a) => /수영장/.test(a)) },
];

type Sort = "ai" | "price" | "rating";
const SORTS: { id: Sort; label: string }[] = [
  { id: "ai", label: "AI 추천순" },
  { id: "price", label: "낮은 가격순" },
  { id: "rating", label: "평점순" },
];

const md = (iso: string) => `${Number(iso.slice(5, 7))}월 ${Number(iso.slice(8, 10))}일`;

// 평점(5점 만점) 한 단어
const ratingWord = (r: number) => (r >= 4.5 ? "최고" : r >= 4.2 ? "아주 좋음" : r >= 3.8 ? "좋음" : "보통");

// v7 05: 숙소 결과 목록. AI가 먼저 본 3곳에 이유를 한 줄씩, 지도는 두지 않는다
export function StayList({ query, options, picks, aiPending, saved, onSave, onOpen, onBack, active, bare }: Props) {
  const nights = nightsOf(query);
  const [sort, setSort] = useState<Sort>("ai");
  const [on, setOn] = useState<Set<string>>(new Set());
  const [band, setBand] = useState<string | null>(null); // 가격대 (하나만)
  const [bandOpen, setBandOpen] = useState(false);
  const reasons = useMemo(() => new Map(picks.map((p) => [p.token, p.reason])), [picks]);
  const filters = FILTERS.filter((f) => options.some(f.test));
  const pv = usePriceVersion(); // 예약처 시트·미리 조회로 맞춘 금액이 오면 다시 계산
  const cost = (h: HotelOption) => shownCost(h, query);
  const cheapest = useMemo(() => options.reduce<HotelOption | null>((m, h) => (cost(h) < (m ? cost(m) : Infinity) ? h : m), null), [options, pv]); // eslint-disable-line react-hooks/exhaustive-deps

  // 가격대: 다른 조건을 건 목록 기준으로 몇 곳인지 세고, 0곳인 가격대는 숨긴다
  const base = useMemo(() => options.filter((h) => filters.every((f) => !on.has(f.label) || f.test(h))), [options, on]); // eslint-disable-line react-hooks/exhaustive-deps
  const bands = useMemo(() => PRICE_BANDS.map((b) => ({ ...b, n: base.filter((h) => inBand(cost(h), nights, b)).length })).filter((b) => b.n > 0 || b.id === band), [base, pv, nights, band]); // eslint-disable-line react-hooks/exhaustive-deps
  const bandNow = PRICE_BANDS.find((b) => b.id === band);

  const shown = useMemo(() => {
    let list = bandNow ? base.filter((h) => inBand(cost(h), nights, bandNow)) : base;
    if (sort === "price") list = [...list].sort((a, b) => cost(a) - cost(b));
    else if (sort === "rating") list = [...list].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    else {
      const rank = (h: HotelOption) => {
        const i = picks.findIndex((p) => p.token === h.token);
        return i < 0 ? 99 : i;
      };
      list = [...list].sort((a, b) => rank(a) - rank(b));
    }
    // 비교할 수 있는 예약처가 0곳으로 확인된 숙소는 맨 아래로
    return [...list].sort((a, b) => Number(shownPrice(a, query).none) - Number(shownPrice(b, query).none));
  }, [base, bandNow, sort, picks, pv]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (l: string) =>
    setOn((s) => {
      const n = new Set(s);
      if (n.has(l)) n.delete(l);
      else n.add(l);
      return n;
    });

  return (
    <div className="tb-results">
      {bare ? (
        <h2 className="tb-list-title">
          {query.place} 전체 {options.length}곳
        </h2>
      ) : (
      <div className="tb-results-top">
        <button type="button" className="tb-ib" onClick={onBack} aria-label="검색으로 돌아가기">
          <IconBack size={20} />
        </button>
        <button type="button" className="tb-qpill" onClick={onBack}>
          <strong>{query.place}</strong>
          <span>
            {md(query.checkIn)} – {md(query.checkOut)} · 성인 {query.adults}
          </span>
        </button>
      </div>
      )}
      <div className="tb-chiprow">
        {SORTS.map((s) => (
          <button key={s.id} type="button" className="tb-chip" aria-pressed={sort === s.id} onClick={() => setSort(s.id)}>
            {s.id === "ai" ? <IconSpark size={16} /> : s.id === "price" ? <IconSort size={16} /> : null}
            {s.label}
          </button>
        ))}
        {filters.slice(0, 3).map((f) => (
          <button key={f.label} type="button" className="tb-chip" aria-pressed={on.has(f.label)} onClick={() => toggle(f.label)}>
            {f.label}
          </button>
        ))}
        {(bands.length > 0 || bandNow) && (
          <button type="button" className="tb-chip" aria-pressed={!!bandNow} aria-expanded={bandOpen} onClick={() => setBandOpen((o) => !o)}>
            {bandNow ? bandNow.label : "가격대"}
            <i className={`tb-caret${bandOpen ? " up" : ""}`} aria-hidden />
          </button>
        )}
        {filters.slice(3).map((f) => (
          <button key={f.label} type="button" className="tb-chip" aria-pressed={on.has(f.label)} onClick={() => toggle(f.label)}>
            {f.label}
          </button>
        ))}
      </div>
      {bandOpen && (
        <div className="tb-chiprow tb-bandrow" role="group" aria-label="가격대">
          {bands.map((b) => (
            <button
              key={b.id}
              type="button"
              className="tb-chip"
              aria-pressed={band === b.id}
              onClick={() => {
                setBand(band === b.id ? null : b.id);
                setBandOpen(false);
              }}
            >
              {b.label} <small>{b.n}곳</small>
            </button>
          ))}
          {bandNow && (
            <button
              type="button"
              className="tb-chip"
              onClick={() => {
                setBand(null);
                setBandOpen(false);
              }}
            >
              전체 가격
            </button>
          )}
        </div>
      )}
      <p className="tb-results-note">
        숙소 {shown.length}곳 · {aiPending ? "AI가 취향에 맞는 곳을 살펴보는 중이에요" : `AI 추천 ${Math.min(3, picks.length)}곳을 먼저 보여드려요`} · {nights}박 총액
      </p>
      <div className="tb-rlist">
        {shown.map((h) => (
          <StayRow
            key={h.token}
            h={h}
            query={query}
            reason={reasons.get(h.token)}
            cheapest={cheapest?.token === h.token}
            saved={saved.has(h.token)}
            active={active === h.token}
            onSave={() => onSave(h)}
            onOpen={() => onOpen(h)}
          />
        ))}
        {!shown.length && <p className="tb-note">조건에 맞는 숙소가 없어요. 위의 조건을 하나 풀어 보세요.</p>}
      </div>
    </div>
  );
}

export function StayRow({ h, query, reason, cheapest, saved, active, onSave, onOpen }: { h: HotelOption; query: StayQuery; reason?: string; cheapest?: boolean; saved: boolean; active?: boolean; onSave?: () => void; onOpen: () => void }) {
  usePriceVersion();
  const nights = nightsOf(query);
  const t = shownPrice(h, query);
  const ref = useLazyPrice<HTMLElement>(h, query, !!reason); // AI 추천 카드만, 화면에 보이면 예약처 가격을 받는다
  return (
    <article ref={ref} className={`tb-srow${active ? " on" : ""}`}>
      <div className="tb-srow-img">
        {h.image ? <img src={h.image} alt="" loading="lazy" onError={(e) => (e.currentTarget.style.visibility = "hidden")} /> : null}
        {reason ? <em className="tb-tag ac">AI 추천</em> : cheapest && !t.none ? <em className="tb-tag red">최저가</em> : null}
        {onSave && (
          <button type="button" className={`tb-love${saved ? " on" : ""}`} aria-pressed={saved} aria-label={saved ? "내 여행에서 빼기" : "내 여행에 담기"} onClick={onSave}>
            <IconHeart size={18} on={saved} />
          </button>
        )}
      </div>
      <button type="button" className="tb-srow-body" onClick={onOpen}>
        <strong className="tb-srow-name">{h.name}</strong>
        {h.stars ? (
          <span className="tb-stars" aria-label={`${h.stars}성급`}>
            {"★".repeat(Math.min(5, Math.round(h.stars)))}
          </span>
        ) : null}
        <span className="tb-srow-meta">{[h.kind, ...h.amenities.slice(0, 2)].filter(Boolean).join(" · ")}</span>
        {h.rating ? (
          <span className="tb-score">
            <b>{h.rating.toFixed(1)}</b>
            <strong>{ratingWord(h.rating)}</strong>
            {h.reviews ? <span>리뷰 {h.reviews.toLocaleString("ko-KR")}</span> : null}
          </span>
        ) : null}
        {reason && (
          <span className="tb-why">
            <IconSpark size={15} /> {reason}
          </span>
        )}
        <PriceBlock p={t} nights={nights} />
      </button>
    </article>
  );
}

// 카드 금액 영역: 금액 · 보조 문구 · 비교 유도 문구. 시트 1위 총액과 맞춘 뒤에는 '세금 포함', 그 전에는 '예상 총액'
export function PriceBlock({ p, nights }: { p: ReturnType<typeof shownPrice>; nights: number }) {
  if (p.none)
    return (
      <span className="tb-srow-price none">
        <strong>비교 가능한 예약처 없음</strong>
      </span>
    );
  return (
    <span className="tb-srow-price">
      <strong>{p.value !== null ? won(p.value) : "가격 확인"}</strong>
      <small>
        {nights}박 · {p.verified ? "세금 포함" : "예상 총액(세금 포함)"}
      </small>
      <em className="tb-cmp">{p.count ? `예약처 ${p.count}곳 비교` : "예약처 가격 비교"} &gt;</em>
    </span>
  );
}

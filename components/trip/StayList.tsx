"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { HotelOption } from "@/lib/hotels";
import { isShownAmenity } from "@/lib/hotelText";
import { sellerDef } from "@/lib/hotel-sellers";
import { rankNotes, stayFactLine, type RankNote } from "@/lib/stay-facts";
import { activeCount, applyFilter, countFilters, EMPTY_FILTER, type StayFilter } from "@/lib/stay-filters";
import { isPlainReason, nightsOf, won, type StayQuery } from "@/lib/trip";
import { shownPrice, useLazyPrice, usePriceVersion, verifiedCost } from "./prices";
import { changeText, priceChange, savedBaseFor } from "./saved-price";
import { FilterBar, FilterPanel, SORTS, type Sort } from "./StayFilters";
import { IconBack, IconHeart, IconSpark } from "./icons";

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
  more?: "more" | "loading" | "error" | "end"; // 목록 끝에서 더 불러오기
  onMore?: () => void;
  onStars?: (stars: number[]) => void; // 고른 성급이 바뀌면 그 성급만 다시 찾는다
};

const md = (iso: string) => `${Number(iso.slice(5, 7))}월 ${Number(iso.slice(8, 10))}일`;

// 평점(5점 만점) 한 단어
const ratingWord = (r: number) => (r >= 4.5 ? "최고" : r >= 4.2 ? "아주 좋음" : r >= 3.8 ? "좋음" : "보통");

// v7 05: 숙소 결과 목록. AI가 먼저 본 3곳에 이유를 한 줄씩, 지도는 두지 않는다.
// 필터: 휴대폰·좁은 PC는 위쪽 3버튼(조건 검색/요금/정렬 기준), 넓은 PC(1280px 이상)는 같은 항목을 왼쪽에 늘 보이게
export function StayList({ query, options, picks, aiPending, saved, onSave, onOpen, onBack, active, bare, more = "end", onMore, onStars }: Props) {
  // 목록 끝이 화면에 가까워지면 다음 쪽을 부른다 (필터로 목록이 짧아져도 같은 기준)
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = endRef.current;
    if (!el || more !== "more" || !onMore) return;
    const io = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && onMore(), { rootMargin: "600px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [more, onMore, options.length]);
  const nights = nightsOf(query);
  const side = !bare;
  const [sort, setSort] = useState<Sort>("ai");
  const [f, setF] = useState<StayFilter>(EMPTY_FILTER);
  const starKey = [...f.stars].sort().join(",");
  useEffect(() => {
    onStars?.(starKey ? starKey.split(",").map(Number) : []);
  }, [starKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const reasons = useMemo(() => new Map(picks.map((p) => [p.token, p.reason])), [picks]);
  const pv = usePriceVersion(); // 예약처 시트·미리 조회로 맞춘 금액이 오면 다시 계산
  // 정렬·요금 필터·'최저가' 배지는 예약처에서 확인한 금액만 쓴다 (확인 전 예상 금액은 쓰지 않는다)
  const cost = (h: HotelOption) => verifiedCost(h, query);
  const cheapest = useMemo(() => {
    const vals = options.map(cost).filter(Number.isFinite);
    if (!vals.length) return null;
    const min = Math.min(...vals);
    const hits = options.filter((h) => cost(h) === min);
    return hits.length === 1 ? hits[0].token : null;
  }, [options, pv]); // eslint-disable-line react-hooks/exhaustive-deps
  const counts = useMemo(() => countFilters(options, cost, nights), [options, pv, nights]); // eslint-disable-line react-hooks/exhaustive-deps
  // AI 3곳: 왜 1·2·3위인지 + 확인하지 못한 조건 (받은 데이터끼리만 견준다)
  const notes = useMemo(() => {
    const top = picks.slice(0, 3).map((p) => options.find((o) => o.token === p.token)).filter((h): h is HotelOption => !!h);
    const ns = rankNotes(top, query.taste ?? "", top.map((h) => shownPrice(h, query)));
    return new Map(top.map((h, i) => [h.token, ns[i]]));
  }, [picks, options, pv, query]); // eslint-disable-line react-hooks/exhaustive-deps

  // 한 번 보여 준 카드 순서는 바꾸지 않는다 (P0-2). 순서는 아래 때에만 새로 정한다:
  // 새 검색, 정렬·필터를 바꿀 때, 더 불러온 숙소가 붙을 때(뒤에만 붙는다), '추천순으로 보기'를 누를 때.
  // AI 추천이 늦게 와도 카드에 배지·이유만 붙고 자리는 그대로다. 예약처 가격이 와도 자리는 그대로다
  const searchKey = `${query.place}|${query.checkIn}|${query.checkOut}|${query.adults}|${query.taste ?? ""}`;
  const [rankPicks, setRankPicks] = useState<{ key: string; tokens: string[] }>({ key: searchKey, tokens: picks.map((p) => p.token) });
  const frozenTokens = rankPicks.key === searchKey ? rankPicks.tokens : picks.map((p) => p.token);
  useEffect(() => {
    if (rankPicks.key !== searchKey) setRankPicks({ key: searchKey, tokens: picks.map((p) => p.token) });
  }, [searchKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const top3 = (t: string[]) => t.slice(0, 3).join(",");
  const reorderable = sort === "ai" && !aiPending && picks.length > 0 && top3(picks.map((p) => p.token)) !== top3(frozenTokens);
  const prevOrder = useRef<{ key: string; order: string[] }>({ key: "", order: [] });

  const shown = useMemo(() => {
    let list = applyFilter(options, f, cost, nights);
    // 확인한 금액끼리만 줄 세우고, 확인 전인 숙소는 원래 순서대로 그 뒤에 둔다
    const byCost = (dir: 1 | -1) => (a: HotelOption, b: HotelOption) => {
      const x = cost(a);
      const y = cost(b);
      if (Number.isFinite(x) && Number.isFinite(y)) return (x - y) * dir;
      return Number(!Number.isFinite(x)) - Number(!Number.isFinite(y));
    };
    if (sort === "price") list = [...list].sort(byCost(1));
    else if (sort === "priceDesc") list = [...list].sort(byCost(-1));
    else if (sort === "stars") list = [...list].sort((a, b) => (b.stars ?? 0) - (a.stars ?? 0));
    else if (sort === "rating") list = [...list].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    else {
      const rank = (h: HotelOption) => {
        const i = frozenTokens.indexOf(h.token);
        return i < 0 ? 99 : i;
      };
      list = [...list].sort((a, b) => rank(a) - rank(b));
    }
    // 예약처가 0곳으로 확인된 숙소는 맨 뒤로
    list = [...list].sort((a, b) => Number(shownPrice(a, query).none) - Number(shownPrice(b, query).none));
    // 같은 정렬·필터 안에서는 이미 보여 준 순서를 지킨다 (가격 확인으로 0곳이 된 숙소도 지금 자리에 둔다).
    // 새로 붙은 숙소만 뒤에 이어 붙인다
    const key = `${searchKey}|${sort}|${JSON.stringify(f)}|${frozenTokens.slice(0, 3).join(",")}`;
    const prev = prevOrder.current;
    if (prev.key === key) {
      const pos = new Map(prev.order.map((t, i) => [t, i]));
      list = [...list].sort((a, b) => (pos.get(a.token) ?? 1e6) - (pos.get(b.token) ?? 1e6));
    }
    prevOrder.current = { key, order: list.map((h) => h.token) };
    return list;
  }, [options, f, sort, frozenTokens.join(","), searchKey, pv]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="tb-results">
      <div className={bare ? "tb-results-head bare" : "tb-results-head"}>
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
      <div className={side ? "tb-fbar-wrap has-side" : "tb-fbar-wrap"}>
        <FilterBar c={counts} f={f} set={setF} sort={sort} setSort={setSort} />
      </div>
      </div>
      <div className={side ? "tb-results-body" : undefined}>
        {side && (
          <aside className="tb-filters" aria-label="정렬과 필터">
            <section>
              <h3>정렬 기준</h3>
              {SORTS.map((s) => (
                <button key={s.id} type="button" className="tb-fopt radio" aria-pressed={sort === s.id} onClick={() => setSort(s.id)}>
                  <span>{s.label}</span>
                  <i aria-hidden />
                </button>
              ))}
            </section>
            <FilterPanel c={counts} f={f} set={setF} />
            {activeCount(f) > 0 && (
              <button type="button" className="tb-freset" onClick={() => setF(EMPTY_FILTER)}>
                필터 모두 해제
              </button>
            )}
          </aside>
        )}
        <div className={side ? "tb-results-main" : undefined}>
          <p className="tb-results-note">
            숙소 {shown.length}곳 · {aiPending ? "AI가 취향에 맞는 곳을 살펴보는 중이에요" : `AI 추천 ${Math.min(3, picks.length)}곳에 표시했어요`} · {nights}박 총액
          </p>
          {reorderable && (
            <button type="button" className="tb-reorder" onClick={() => setRankPicks({ key: searchKey, tokens: picks.map((p) => p.token) })}>
              추천순으로 보기
            </button>
          )}
          <div className="tb-rlist">
            {shown.map((h) => (
              <StayRow
                key={h.token}
                h={h}
                query={query}
                reason={reasons.get(h.token)}
                note={notes.get(h.token)}
                cheapest={cheapest === h.token}
                saved={saved.has(h.token)}
                active={active === h.token}
                onSave={() => onSave(h)}
                onOpen={() => onOpen(h)}
              />
            ))}
            <div ref={endRef} className="tb-more" aria-live="polite">
              {more === "loading" ? (
                <>
                  <div className="tb-srow skel" />
                  <p>숙소를 더 불러오고 있어요…</p>
                </>
              ) : more === "error" ? (
                <button type="button" className="tb-btn" onClick={onMore}>
                  숙소 더 불러오기
                </button>
              ) : more === "end" && options.length > 0 ? (
                <p>받아 온 숙소를 모두 보여 드렸어요</p>
              ) : null}
            </div>
            {!shown.length && more !== "loading" && (
              <div className="tb-note">
                조건에 맞는 숙소가 없어요.{" "}
                <button type="button" className="tb-link" onClick={() => setF(EMPTY_FILTER)}>
                  필터 해제하기
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function StayRow({ h, query, reason, note, cheapest, saved, active, onSave, onOpen }: { h: HotelOption; query: StayQuery; reason?: string; note?: RankNote; cheapest?: boolean; saved: boolean; active?: boolean; onSave?: () => void; onOpen: () => void }) {
  usePriceVersion();
  const nights = nightsOf(query);
  const t = shownPrice(h, query);
  const ref = useLazyPrice<HTMLElement>(h, query, true); // 화면에 잠깐 머문 카드부터 예약처 가격을 받아 금액을 맞춘다
  const diff = saved ? priceChange(savedBaseFor(h.token, query), t) : null; // 담아 둔 숙소면 담을 때 금액과 견준다
  return (
    <article ref={ref} className={`tb-srow${active ? " on" : ""}`} aria-current={active ? "true" : undefined}>
      <div className="tb-srow-img">
        <PhotoStrip images={h.images.length ? h.images : h.image ? [h.image] : []} name={h.name} onOpen={onOpen} />
        {reason ? <em className="tb-tag ac">AI 추천</em> : null}
        {cheapest && t.verified ? <em className={`tb-tag low${reason ? " second" : ""}`}>최저가</em> : null}
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
        <span className="tb-srow-meta">{[h.kind, ...h.amenities.filter((a) => isShownAmenity(a) && !/와이파이/.test(a)).slice(0, 2)].filter(Boolean).join(" · ")}</span>
        {h.rating ? (
          <span className="tb-score">
            <b>{h.rating.toFixed(1)}</b>
            <strong>{ratingWord(h.rating)}</strong>
            {h.reviews ? <span>리뷰 {h.reviews.toLocaleString("ko-KR")}</span> : null}
          </span>
        ) : null}
        {stayFactLine(h) && <span className="tb-fact">{stayFactLine(h)}</span>}
        {reason && !isPlainReason(reason) && (
          <span className="tb-why">
            <IconSpark size={15} /> {reason}
          </span>
        )}
        {note && <RankLines note={note} />}
        <PriceBlock p={t} nights={nights} />
        {diff !== null && <PriceChange diff={diff} />}
      </button>
    </article>
  );
}

// 카드 위쪽 큰 사진. 휴대폰은 손가락으로 옆으로 넘기고, PC는 마우스를 올리면 나오는 화살표로 넘긴다
// 숙소 상세(big)는 사진 한 장씩, 화살표를 늘 보이고 '1/8'을 함께 보여 준다
export function PhotoStrip({ images, name, onOpen, max = 5, big }: { images: string[]; name: string; onOpen?: () => void; max?: number; big?: boolean }) {
  const list = images.slice(0, max);
  const ref = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState(0);
  const go = (d: number) => {
    const el = ref.current;
    if (el) el.scrollTo({ left: el.clientWidth * Math.max(0, Math.min(list.length - 1, at + d)), behavior: "smooth" });
  };
  if (!list.length) return null;
  return (
    <>
      <div
        ref={ref}
        className={`tb-srow-photos${big ? " big" : ""}`}
        onScroll={(e) => {
          const el = e.currentTarget;
          setAt(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
        }}
        onClick={onOpen}
        aria-label={`${name} 사진 ${list.length}장`}
      >
        {list.map((src, i) => (
          <img key={src + i} src={src} alt="" loading="lazy" onError={(e) => (e.currentTarget.style.visibility = "hidden")} />
        ))}
      </div>
      {list.length > 1 && (
        <>
          {big ? (
            <em className="tb-ph-count">
              {at + 1}/{list.length}
            </em>
          ) : (
            <span className="tb-dots" aria-hidden>
              {list.map((_, i) => (
                <i key={i} className={i === at ? "on" : undefined} />
              ))}
            </span>
          )}
          {at > 0 && (
            <button type="button" className="tb-ph-nav prev" aria-label="이전 사진" onClick={() => go(-1)}>
              <IconBack size={16} />
            </button>
          )}
          {at < list.length - 1 && (
            <button type="button" className="tb-ph-nav next" aria-label="다음 사진" onClick={() => go(1)}>
              <IconBack size={16} />
            </button>
          )}
        </>
      )}
    </>
  );
}

// AI 3곳 카드: 순위 이유 한 줄 + 확인하지 못한 조건 한 줄 (없으면 숨김)
export function RankLines({ note }: { note: RankNote }) {
  return (
    <>
      <span className="tb-rank">{note.why}</span>
      {note.unknown.length > 0 && <span className="tb-unk">확인하지 못한 조건: {note.unknown.join(", ")}</span>}
    </>
  );
}

// 담을 때보다 내려갔/올랐어요 한 줄
export function PriceChange({ diff }: { diff: number }) {
  return <span className={`tb-pchg${diff < 0 ? " down" : " up"}`}>{changeText(diff)}</span>;
}

// 카드 금액 영역 (P0-3).
// 확인 전: 회색·한 단계 얇은 금액 + '예상' 꼬리표, 아래 줄 'N박 · 예약처 확인 전 금액' (받는 중이면 '예약처 가격을 확인하는 중')
// 확인 후: 예약처 시트 1위 총액과 같은 금액 + '확인한 최저가 · 아고다' 칩
export function PriceBlock({ p, nights }: { p: ReturnType<typeof shownPrice>; nights: number }) {
  if (p.none)
    return (
      <span className="tb-srow-price none">
        <strong>확인한 예약처 가격 없음</strong>
      </span>
    );
  const est = !p.verified;
  const perNight = nights > 1 && p.value !== null ? <small className="tb-per-night">(1박 약 {won(Math.round(p.value / nights / 100) * 100)})</small> : null;
  if (est)
    return (
      <span className="tb-srow-price est">
        <span className="tb-price-line">
          {p.value !== null && <em className="tb-est">예상</em>}
          <strong>{p.value !== null ? won(p.value) : "가격 확인"}</strong>
        </span>
        <small>{nights}박 · 예약처 확인 전 금액</small>
        {p.checking ? (
          <em className="tb-checking" role="status">
            <i aria-hidden /> 예약처 가격을 확인하는 중
          </em>
        ) : (
          <em className="tb-cmp">예약처별 가격 보기 &gt;</em>
        )}
      </span>
    );
  return (
    <span className="tb-srow-price">
      {p.seller && <em className="tb-seller-chip">확인한 최저가 · {sellerDef(p.seller).ko}</em>}
      <strong>{p.value !== null ? won(p.value) : "가격 확인"}</strong>
      <small>{nights}박 · 세금 포함</small>
      {perNight}
      <em className="tb-cmp">{p.count ? `예약처 ${p.count}곳 가격 보기` : "예약처별 가격 보기"} &gt;</em>
    </span>
  );
}

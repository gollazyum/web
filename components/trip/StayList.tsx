"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { HotelOption } from "@/lib/hotels";
import { isShownAmenity } from "@/lib/hotelText";
import { sellerDef } from "@/lib/hotel-sellers";
import { rankNotes, stayFactLine, type RankNote } from "@/lib/stay-facts";
import { checkInput, priceState, type Checkpoints } from "@/lib/checkpoints";
import { CheckLine } from "./CheckBox";
import { useCheckpoints } from "./useCheckpoints";
import { activeCount, applyFilter, countFilters, EMPTY_FILTER, hasFreeCancel, type StayFilter } from "@/lib/stay-filters";
import { guestText, isPlainReason, nightsOf, won, type StayQuery } from "@/lib/trip";
import { SIMILAR_EVENT, takeSimilar } from "./similar";
import { shownPrice, useLazyPrice, usePriceVersion, verifiedCost } from "./prices";
import { changeText, priceChange, savedBaseFor } from "./saved-price";
import { AiSortInfo } from "./AiSortInfo";
import { AiOffNote } from "./AiOffNote";
import { SortInfo } from "./SortInfo";
import { FilterBar, FilterPanel, SORTS, type Sort } from "./StayFilters";
import { IconBack, IconHeart, IconSpark } from "./icons";

export type StayPick = { token: string; reason: string };

type Props = {
  notice?: string; // 검색 칸 아래 한 줄 (예: 주소의 날짜를 고친 이유)
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
  aiOff?: boolean; // AI가 두 번 다 실패: 확인한 가격 기준 3곳 (AI 칩·이유 없이)
  onAiRetry?: () => void;
  initFilter?: StayFilter; // 홈 입력 시트에서 고른 빠른 조건 (처음 한 번만)
};

const md = (iso: string) => `${Number(iso.slice(5, 7))}월 ${Number(iso.slice(8, 10))}일`;

// 평점(5점 만점) 한 단어
const ratingWord = (r: number) => (r >= 4.5 ? "최고" : r >= 4.2 ? "아주 좋음" : r >= 3.8 ? "좋음" : "보통");

// v7 05: 숙소 결과 목록. AI가 먼저 본 3곳에 이유를 한 줄씩, 지도는 두지 않는다.
// 필터: 휴대폰·좁은 PC는 위쪽 3버튼(조건 검색/요금/정렬 기준), 넓은 PC(1280px 이상)는 같은 항목을 왼쪽에 늘 보이게
export function StayList({ query, options, picks, aiPending, saved, onSave, onOpen, onBack, active, bare, more = "end", onMore, onStars, notice, aiOff, onAiRetry, initFilter }: Props) {
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
  const [f, setF] = useState<StayFilter>(initFilter ?? EMPTY_FILTER);
  const starKey = [...f.stars].sort().join(",");
  // 시트의 '비슷한 숙소 보기': 같은 성급만 남기고 목록 맨 위로 (성급을 모르면 조건 없이 목록만)
  useEffect(() => {
    const take = () => {
      const n = takeSimilar();
      if (n === null) return;
      setF({ ...EMPTY_FILTER, stars: n ? [n] : [] });
      window.scrollTo({ top: 0 });
    };
    take();
    window.addEventListener(SIMILAR_EVENT, take);
    return () => window.removeEventListener(SIMILAR_EVENT, take);
  }, []);
  useEffect(() => {
    onStars?.(starKey ? starKey.split(",").map(Number) : []);
  }, [starKey]); // eslint-disable-line react-hooks/exhaustive-deps
  // AI 응답 전에는 어떤 카드에도 'AI 추천'·순위·이유를 달지 않는다 (임시로 달았다 옮겨 가며 화면이 흔들리지 않게)
  const aiPicks = aiPending ? [] : picks;
  // AI가 실패해 가격 기준으로 둔 3곳에는 'AI 추천' 칩·이유를 달지 않는다
  const reasons = useMemo(() => new Map(aiOff ? [] : aiPicks.map((p) => [p.token, p.reason])), [aiPicks, aiOff]);
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
    if (aiOff) return new Map<string, RankNote>();
    const top = aiPicks.slice(0, 3).map((p) => options.find((o) => o.token === p.token)).filter((h): h is HotelOption => !!h);
    const ns = rankNotes(top, query.taste ?? "", top.map((h) => shownPrice(h, query)));
    return new Map(top.map((h, i) => [h.token, ns[i]]));
  }, [aiPicks, aiOff, options, pv, query]); // eslint-disable-line react-hooks/exhaustive-deps
  const top3 = useMemo(() => aiPicks.slice(0, 3).map((p) => options.find((o) => o.token === p.token)).filter((h): h is HotelOption => !!h), [aiPicks, options]);
  // 솔직 체크포인트: 위 3곳만. AI가 실패한 화면이면 규칙으로만 만든다
  const checks = useCheckpoints(
    top3.map((h) => { const p = shownPrice(h, query); return { h, input: checkInput(h, query, { fc: p.fc, price: priceState(p) }) }; }),
    query,
    !aiPending,
    aiOff,
  );

  // 한 번 보여 준 카드 순서는 바꾸지 않는다 (P0-2). '관련도순'은 검색 결과가 온 순서 그대로라 AI 추천이 늦게 와도 자리가 그대로다.
  // 순서는 새 검색, 정렬·필터를 바꿀 때, 더 불러온 숙소가 붙을 때(뒤에만 붙는다)에만 바뀐다. 예약처 가격이 와도 자리는 그대로다
  const searchKey = `${query.place}|${query.checkIn}|${query.checkOut}|${guestText(query)}|${(query.childAges ?? []).join(".")}|${query.taste ?? ""}`;
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
    // 예약처가 0곳으로 확인된 숙소는 맨 뒤로
    list = [...list].sort((a, b) => Number(shownPrice(a, query).none) - Number(shownPrice(b, query).none));
    // 같은 정렬·필터 안에서는 이미 보여 준 순서를 지킨다 (가격 확인으로 0곳이 된 숙소도 지금 자리에 둔다).
    // 새로 붙은 숙소만 뒤에 이어 붙인다
    const key = `${searchKey}|${sort}|${JSON.stringify(f)}`;
    const prev = prevOrder.current;
    if (prev.key === key) {
      const pos = new Map(prev.order.map((t, i) => [t, i]));
      list = [...list].sort((a, b) => (pos.get(a.token) ?? 1e6) - (pos.get(b.token) ?? 1e6));
    }
    prevOrder.current = { key, order: list.map((h) => h.token) };
    return list;
  }, [options, f, sort, searchKey, pv]); // eslint-disable-line react-hooks/exhaustive-deps

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
              {md(query.checkIn)} – {md(query.checkOut)} · {guestText(query)}
            </span>
          </button>
        </div>
      )}
      {notice && (
        <p className="tb-fixnote" role="status">
          {notice}
        </p>
      )}
      <div className={side ? "tb-fbar-wrap has-side" : "tb-fbar-wrap"}>
        <FilterBar c={counts} f={f} set={setF} sort={sort} setSort={setSort} nights={nights} />
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
              <SortInfo kind="stay" />
            </section>
            <FilterPanel c={counts} f={f} set={setF} nights={nights} />
            {activeCount(f) > 0 && (
              <button type="button" className="tb-freset" onClick={() => setF(EMPTY_FILTER)}>
                필터 모두 해제
              </button>
            )}
          </aside>
        )}
        <div className={side ? "tb-results-main" : undefined}>
          {!bare && aiOff && !aiPending && <AiOffNote onRetry={onAiRetry} />}
          {!bare && <AiTop3 hotels={top3} reasons={reasons} pending={aiPending} off={aiOff} query={query} onOpen={onOpen} />}
          <p className="tb-results-note">
            숙소 {shown.length}곳 · <span className="tb-pc-only">{aiPending ? "AI가 취향에 맞는 곳을 살펴보는 중이에요" : aiOff ? `확인한 낮은 가격 ${Math.min(3, picks.length)}곳을 위에 모았어요` : `AI 추천 ${Math.min(3, picks.length)}곳에 표시했어요`} · </span>
            {nights}박 총액
          </p>
          <span className="tb-pc-only">
            {!aiOff && <AiSortInfo kind="stay" />}
          </span>
          <div className="tb-rlist">
            {shown.map((h) => (
              <StayRow
                key={h.token}
                h={h}
                query={query}
                reason={reasons.get(h.token)}
                note={notes.get(h.token)}
                check={checks.get(h.token)}
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

// '평소보다 N% 저렴'(또는 '일반적인 가격 대비 N% 저렴')이 검색 결과에 같이 온 숙소만 배지로 (없으면 만들지 않는다)
const dealPct = (h: HotelOption) => h.deal.match(/(?:평소보다|가격 대비) (\d+)% 저렴/)?.[1] ?? null;

// 휴대폰: 결과 맨 위 높이 고정 'AI 추천 3곳' 가로 띠. AI 응답 전에는 같은 높이의 회색 자리만 (화면이 밀리지 않게)
function AiTop3({ hotels, reasons, pending, off, query, onOpen }: { hotels: HotelOption[]; reasons: Map<string, string>; pending: boolean; off?: boolean; query: StayQuery; onOpen: (h: HotelOption) => void }) {
  usePriceVersion();
  const nights = nightsOf(query);
  if (!pending && !hotels.length) return null;
  return (
    <section className="tb-top3" aria-label={off ? "확인한 낮은 가격 3곳" : "AI 추천 3곳"} aria-busy={pending}>
      <div className="tb-top3-head">
        <h2>{off ? "확인한 낮은 가격 3곳" : "AI 추천 3곳"}</h2>
        {!off && <AiSortInfo kind="stay" />}
      </div>
      <div className="tb-top3-row">
        {pending
          ? [0, 1, 2].map((i) => <div key={i} className="tb-top3-card skel" aria-hidden />)
          : hotels.map((h, i) => {
              const p = shownPrice(h, query);
              const why = reasons.get(h.token);
              return (
                <button key={h.token} type="button" className="tb-top3-card" onClick={() => onOpen(h)}>
                  <span className="tb-top3-rank">{i + 1}위</span>
                  <strong>{h.name}</strong>
                  <span className="tb-top3-price">
                    {p.none ? (
                      <small>예약처 가격 없음</small>
                    ) : p.value !== null ? (
                      <>
                        {!p.verified && <em className="tb-est">예상</em>}
                        <b>{won(p.value)}</b>
                        <small> · {nights}박</small>
                      </>
                    ) : (
                      <small>예약 사이트에서 확인</small>
                    )}
                  </span>
                  {why && !isPlainReason(why) && <span className="tb-top3-why">{why}</span>}
                </button>
              );
            })}
      </div>
    </section>
  );
}

export function StayRow({ h, query, reason, note, check, cheapest, saved, active, onSave, onOpen }: { h: HotelOption; query: StayQuery; reason?: string; note?: RankNote; check?: Checkpoints; cheapest?: boolean; saved: boolean; active?: boolean; onSave?: () => void; onOpen: () => void }) {
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
        {cheapest && t.verified ? <em className={`tb-tag low${reason ? " second" : ""}`}>확인한 가격 중 최저</em> : null}
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
        {stayFactLine(h, t.fc) && <span className="tb-fact">{stayFactLine(h, t.fc)}</span>}
        {dealPct(h) && <em className="tb-deal">평소보다 {dealPct(h)}%↓</em>}
        {reason && !isPlainReason(reason) && (
          <span className="tb-why">
            <IconSpark size={15} /> {reason}
          </span>
        )}
        {note && <RankLines note={note} />}
        <CheckLine c={check} fc={hasFreeCancel(h) || !!t.fc} />
        <PriceBlock p={t} nights={nights} />
        {diff !== null && <PriceChange diff={diff} />}
      </button>
    </article>
  );
}

// 카드 위쪽 큰 사진. 휴대폰은 손가락으로 옆으로 넘기고, PC는 마우스를 올리면 나오는 화살표로 넘긴다
// 숙소 상세(big)는 사진 한 장씩, 화살표를 늘 보이고 '1/8'을 함께 보여 준다
// 사진이 없거나 모두 못 받으면 깨진 그림 대신 빈 자리에 '사진 없음'을 작게
export function NoPhoto({ onOpen }: { onOpen?: () => void }) {
  return (
    <div className="tb-nophoto" onClick={onOpen} aria-hidden>
      <small>사진 없음</small>
    </div>
  );
}

export function PhotoStrip({ images, name, onOpen, max = 5, big }: { images: string[]; name: string; onOpen?: () => void; max?: number; big?: boolean }) {
  const [bad, setBad] = useState<string[]>([]); // 받지 못한 사진은 빼고 넘긴다
  const list = images.slice(0, max).filter((src) => !bad.includes(src));
  const ref = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState(0);
  const drop = (src: string) => setBad((b) => (b.includes(src) ? b : [...b, src]));
  const go = (d: number) => {
    const el = ref.current;
    if (el) el.scrollTo({ left: el.clientWidth * Math.max(0, Math.min(list.length - 1, at + d)), behavior: "smooth" });
  };
  if (!list.length) return <NoPhoto onOpen={onOpen} />;
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
          <img
            key={src + i}
            src={src}
            alt=""
            loading="lazy"
            onError={() => drop(src)}
            // 화면이 열리기 전에 이미 실패한 사진도 뺀다
            ref={(el) => {
              if (el && el.complete && !el.naturalWidth && el.currentSrc) drop(src);
            }}
          />
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

// 모바일: '예상' 금액과 예약처에서 확인한 금액이 다르면 차분한 주황 바탕으로 작게 알린다 (PC는 회색 '검색 때' 줄)
export function EstNote({ est, cost, at }: { est: number | null; cost: number; at: number }) {
  if (est === null || Math.abs(est - cost) < 100) return null;
  const d = new Date(at || Date.now());
  const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return (
    <small className="tb-estnote">
      예상보다 {won(Math.abs(cost - est))} {cost > est ? "높아요" : "낮아요"} · {hm} 확인
    </small>
  );
}

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
      {p.was !== undefined && <small className="tb-was tb-pc-only">검색 때 {won(p.was)} → 다시 확인한 금액</small>}
      {p.was !== undefined && p.value !== null && <EstNote est={p.was} cost={p.value} at={p.at ?? 0} />}
      <em className="tb-cmp">{p.count ? `예약처 ${p.count}곳 가격 보기` : "예약처별 가격 보기"} &gt;</em>
    </span>
  );
}

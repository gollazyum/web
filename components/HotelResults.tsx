"use client";

import { useEffect, useMemo, useState } from "react";
import { HotelAdvisor } from "./HotelAdvisor";
import { HotelSearch } from "./HotelSearch";
import { MochiStar, MochiStars, RatingMochi, ratingTier } from "./MochiMarks";
import { PriceRange } from "./PriceRange";
import { ResultsMessage, ResultsShell } from "./ResultsShell";
import { ScanProgress } from "./ScanProgress";
import { SortMenu } from "./SortMenu";
import { errorCode } from "@/lib/apiError";
import { daysBetween, shortLabel, today } from "@/lib/dates";
import { agodaSearchUrl, isAgoda, type HotelOption, type HotelPrices, type HotelQuery, type HotelResults, type HotelSource } from "@/lib/hotels";

// 호텔 결과 페이지 (/hotels?q=…). 로보티가 훑는 연출 뒤에 필터·정렬이 있는 호텔 카드 목록을 보여 준다.
// 필터와 정렬은 받아 온 목록 안에서만 하므로 SerpApi를 더 부르지 않는다
const SCAN_MS = 4500;

type State = { kind: "loading" } | { kind: "ok"; data: HotelResults } | { kind: "error"; message: string };
type Sort = "recommended" | "price" | "rating" | "reviews";

const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;

async function failMessage(res: Response): Promise<string> {
  if (res.status === 429) return "검색이 너무 잦아서 잠깐 쉬고 있어요. 잠시 뒤에 다시 찾아 주세요.";
  if (res.status === 503) return "실시간 호텔 가격 기능을 준비하고 있어요. 아고다에서 먼저 찾아보세요.";
  return `지금은 호텔 가격을 불러오지 못했어요. 잠시 뒤에 다시 찾아 주세요. (오류 ${await errorCode(res)})`;
}

async function postHotels(body: HotelQuery & { token?: string; page?: string }): Promise<Response> {
  return fetch("/api/hotels", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}


export function HotelResultsView({ query }: { query: HotelQuery | null }) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (!query) return;
    if (query.checkIn < today()) return setState({ kind: "error", message: "체크인 날짜가 이미 지났어요. 위에서 날짜를 다시 골라 주세요." });
    let cancelled = false;
    postHotels(query)
      .then(async (res) => {
        const next: State = res.ok ? { kind: "ok", data: (await res.json()) as HotelResults } : { kind: "error", message: await failMessage(res) };
        if (!cancelled) setState(next);
      })
      .catch(() => !cancelled && setState({ kind: "error", message: "연결이 불안정해요. 잠시 뒤에 다시 찾아 주세요." }));
    return () => {
      cancelled = true;
    };
  }, [query]);

  return (
    <ResultsShell
      search={<HotelSearch initial={query ?? undefined} compact />}
      summary={query && { title: query.q, sub: `${shortLabel(query.checkIn)} ~ ${shortLabel(query.checkOut)} · 성인 ${query.adults}명` }}
    >
      {!query ? (
        <ResultsMessage>찾을 도시나 호텔, 날짜를 위에서 넣고 다시 검색해 주세요.</ResultsMessage>
      ) : !revealed ? (
        <div className="results-loading">
          <ScanProgress
            ms={SCAN_MS}
            morphTo="hotel"
            ready={state.kind !== "loading"}
            onDone={() => setRevealed(true)}
            stage={{
              title: `${query.q} 호텔을 훑고 있어요`,
              sub: `${shortLabel(query.checkIn)} 체크인 · ${daysBetween(query.checkIn, query.checkOut)}박 · 성인 ${query.adults}명`,
            }}
            steps={[
              { text: "도시·날짜·인원 조건 읽는 중...", at: 0 },
              { text: "예약 사이트별 실시간 호텔 가격 모으는 중...", at: 0.2 },
              { text: "호텔마다 가격 정리하는 중...", at: 0.75 },
            ]}
          />
        </div>
      ) : state.kind === "ok" ? (
        <HotelBoard data={state.data} query={query} />
      ) : (
        <ResultsMessage
          action={
            <a className="results-out" href={agodaSearchUrl(query.q, query)} target="_blank" rel="noopener noreferrer sponsored">
              아고다에서 바로 찾아보기 ↗
            </a>
          }
        >
          {state.kind === "error" ? state.message : ""}
        </ResultsMessage>
      )}
    </ResultsShell>
  );
}

function HotelBoard({ data: first, query }: { data: HotelResults; query: HotelQuery }) {
  const nights = daysBetween(query.checkIn, query.checkOut);
  const [data, setData] = useState(first);
  const [more, setMore] = useState<"idle" | "loading" | "error">("idle");
  const prices = data.options.map((o) => o.perNight ?? 0);
  const floor = Math.floor(Math.min(...prices) / 10000) * 10000;
  const ceil = Math.ceil(Math.max(...prices, 0) / 10000) * 10000;

  // null이면 전체 범위. 더 불러온 호텔로 범위가 넓어져도 그대로 다 보이게
  const [userRange, setRange] = useState<[number, number] | null>(null);
  const range = userRange ?? [floor, ceil];
  const [minRating, setMinRating] = useState(0);
  const [stars, setStars] = useState<Set<number>>(new Set());
  const [amenities, setAmenities] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<Sort>("recommended");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [advisorOpen, setAdvisorOpen] = useState(false);
  const [flash, setFlash] = useState("");

  // 이 검색 결과에 자주 나오는 편의시설만 필터로 보여 준다
  const amenityList = useMemo(() => {
    const count = new Map<string, number>();
    for (const o of data.options) for (const a of o.amenities) count.set(a, (count.get(a) ?? 0) + 1);
    return [...count.entries()]
      .filter(([, n]) => n >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12);
  }, [data]);
  const starList = useMemo(() => [...new Set(data.options.map((o) => o.stars).filter((s): s is number => !!s))].sort((a, b) => b - a), [data]);

  const shown = useMemo(() => {
    const list = data.options.filter((o) => {
      const p = o.perNight ?? 0;
      if (p < range[0] || p > range[1]) return false;
      if (minRating && (o.rating ?? 0) < minRating) return false;
      if (stars.size && !stars.has(o.stars ?? 0)) return false;
      for (const a of amenities) if (!o.amenities.includes(a)) return false;
      return true;
    });
    if (sort === "price") list.sort((a, b) => (a.perNight ?? 0) - (b.perNight ?? 0));
    if (sort === "rating") list.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    if (sort === "reviews") list.sort((a, b) => (b.reviews ?? 0) - (a.reviews ?? 0));
    return list;
  }, [data, range[0], range[1], minRating, stars, amenities, sort]);

  // 도우미가 추천한 호텔 카드로 이동해 잠깐 반짝인다. 필터에 가려져 있으면 필터를 푼다
  function focusHotel(token: string) {
    if (!shown.some((h) => h.token === token)) reset();
    setAdvisorOpen(false);
    setFlash(token);
    setTimeout(() => document.getElementById(`hotel-${token}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 60);
    setTimeout(() => setFlash((f) => (f === token ? "" : f)), 2200);
  }

  async function loadMore() {
    if (!data.next || more === "loading") return;
    setMore("loading");
    try {
      const res = await postHotels({ ...query, page: data.next });
      if (!res.ok) return setMore("error");
      const page = (await res.json()) as HotelResults;
      const seen = new Set(data.options.map((o) => o.token));
      setData({ options: [...data.options, ...page.options.filter((o) => !seen.has(o.token))], next: page.next });
      setMore("idle");
    } catch {
      setMore("error");
    }
  }

  if (!data.options.length) {
    return (
      <ResultsMessage
        action={
          <a className="results-out" href={agodaSearchUrl(query.q, query)} target="_blank" rel="noopener noreferrer sponsored">
            아고다에서 바로 찾아보기 ↗
          </a>
        }
      >
        이 조건으로 찾은 호텔이 없어요. 도시 이름이나 날짜를 바꿔 보세요.
      </ResultsMessage>
    );
  }

  const active = (userRange ? 1 : 0) + (minRating ? 1 : 0) + stars.size + amenities.size;
  const reset = () => {
    setRange(null);
    setMinRating(0);
    setStars(new Set());
    setAmenities(new Set());
  };
  const toggle = <T,>(set: Set<T>, v: T) => {
    const next = new Set(set);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    return next;
  };

  return (
    <div className="results-grid with-advisor">
      <aside className={`filters${filtersOpen ? " open" : ""}`} aria-label="필터">
        <div className="filters-head">
          <strong>필터</strong>
          {active > 0 && (
            <button type="button" className="link-btn" onClick={reset}>
              초기화
            </button>
          )}
          <button type="button" className="filters-close" onClick={() => setFiltersOpen(false)} aria-label="필터 닫기">
            ✕
          </button>
        </div>

        {ceil > floor && (
          <section>
            <h4>1박 예산</h4>
            <PriceRange min={floor} max={ceil} step={10000} value={range} onChange={setRange} format={won} />
          </section>
        )}

        <section>
          <h4>후기 점수</h4>
          <div className="chip-row">
            {[4.5, 4, 3.5, 3].map((r) => (
              <button key={r} type="button" className={`chip${minRating === r ? " on" : ""}`} onClick={() => setMinRating(minRating === r ? 0 : r)}>
                {r.toFixed(1)} 이상
              </button>
            ))}
          </div>
        </section>

        {starList.length > 0 && (
          <section>
            <h4>호텔 등급</h4>
            <div className="chip-row">
              {starList.map((s) => (
                <button key={s} type="button" className={`chip star-chip${stars.has(s) ? " on" : ""}`} onClick={() => setStars(toggle(stars, s))}>
                  <MochiStar size={15} />
                  {s}
                </button>
              ))}
            </div>
          </section>
        )}

        {amenityList.length > 0 && <AmenityFilter list={amenityList} picked={amenities} onToggle={(a) => setAmenities(toggle(amenities, a))} />}

        <button type="button" className="filters-apply" onClick={() => setFiltersOpen(false)}>
          {shown.length}곳 보기
        </button>
      </aside>

      <section className="results-main">
        <div className="results-bar">
          <p>
            <strong>호텔 {shown.length}곳</strong>
            {shown.length !== data.options.length && <span> / 전체 {data.options.length}곳</span>}
            <span className="results-bar-sub"> · {shortLabel(query.checkIn)} 체크인 · {nights}박 · 성인 {query.adults}명</span>
          </p>
          <div className="results-tools">
            <button type="button" className="filters-toggle" onClick={() => setFiltersOpen(true)}>
              필터{active > 0 ? ` ${active}` : ""}
            </button>
            <SortMenu
              value={sort}
              onChange={setSort}
              options={[
                { id: "recommended", label: "추천순" },
                { id: "price", label: "낮은 가격순" },
                { id: "rating", label: "후기 점수 높은순" },
                { id: "reviews", label: "후기 많은순" },
              ]}
            />
          </div>
        </div>

        {shown.length ? (
          <ul className="hcards">
            {shown.map((h) => (
              <HotelCard key={h.token} hotel={h} query={query} nights={nights} flash={flash === h.token} />
            ))}
          </ul>
        ) : (
          <div className="results-none">
            조건에 맞는 호텔이 없어요.{" "}
            <button type="button" className="link-btn" onClick={reset}>
              필터 초기화
            </button>
          </div>
        )}

        {data.next && (
          <button type="button" className="more-btn" onClick={loadMore} disabled={more === "loading"}>
            {more === "loading" ? "호텔 더 찾는 중..." : more === "error" ? "다시 시도하기" : "호텔 더 보기"}
          </button>
        )}

        <p className="flight-note">
          Google 호텔 검색 기준, 검색 시점 가격이에요. 총액은 세금·봉사료를 포함한 금액이며, 최종 금액은 예약 사이트 결제 화면에서 꼭 확인해 주세요.
          아고다 링크는 제휴 링크라 예약 시 로보티가 수수료를 받을 수 있어요.
        </p>
      </section>

      <HotelAdvisor hotels={data.options} query={query} open={advisorOpen} onClose={() => setAdvisorOpen(false)} onPick={focusHotel} />
      {!advisorOpen && (
        <button type="button" className="advisor-fab" onClick={() => setAdvisorOpen(true)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/lowboti-mark.svg" alt="" />
          AI 추천
        </button>
      )}
    </div>
  );
}

function AmenityFilter({ list, picked, onToggle }: { list: [string, number][]; picked: Set<string>; onToggle: (a: string) => void }) {
  const [all, setAll] = useState(false);
  const visible = all ? list : list.slice(0, 5);
  return (
    <section>
      <h4>편의시설</h4>
      <div className="check-list">
        {visible.map(([a, n]) => (
          <label key={a}>
            <input type="checkbox" checked={picked.has(a)} onChange={() => onToggle(a)} />
            <span>{a}</span>
            <em>{n}</em>
          </label>
        ))}
      </div>
      {list.length > 5 && (
        <button type="button" className="link-btn" onClick={() => setAll(!all)}>
          {all ? "접기" : "모두 표시"}
        </button>
      )}
    </section>
  );
}

// Google 사진 주소는 크기를 바꿔 받을 수 있어 카드 크기에 맞게 키운다
function bigger(src: string): string {
  return /googleusercontent\.com/.test(src) ? src.replace(/=w\d+-h\d+[^/]*$/, "=w640-h480-k-no") : src;
}

function Gallery({ images }: { images: string[] }) {
  const [i, setI] = useState(0);
  const [failed, setFailed] = useState<Set<number>>(new Set());
  if (!images.length) return <div className="hcard-photo empty" />;
  const src = failed.has(i) ? images[i] : bigger(images[i]);
  const go = (d: number) => (e: React.MouseEvent) => {
    e.stopPropagation();
    setI((i + d + images.length) % images.length);
  };
  return (
    <div className="hcard-photo">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" loading="lazy" onError={() => !failed.has(i) && setFailed(new Set(failed).add(i))} />
      {images.length > 1 && (
        <>
          <button type="button" className="photo-nav prev" onClick={go(-1)} aria-label="이전 사진">
            ‹
          </button>
          <button type="button" className="photo-nav next" onClick={go(1)} aria-label="다음 사진">
            ›
          </button>
          <span className="photo-dots" aria-hidden="true">
            {images.map((_, k) => (
              <i key={k} className={k === i ? "on" : undefined} />
            ))}
          </span>
        </>
      )}
    </div>
  );
}

function HotelCard({ hotel, query, nights, flash }: { hotel: HotelOption; query: HotelQuery; nights: number; flash: boolean }) {
  const [open, setOpen] = useState(false);
  const [prices, setPrices] = useState<{ kind: "loading" } | { kind: "ok"; sources: HotelSource[] } | { kind: "error"; message: string } | null>(null);

  async function select() {
    setOpen(!open);
    if (open || prices) return;
    setPrices({ kind: "loading" });
    try {
      const res = await postHotels({ ...query, token: hotel.token });
      if (!res.ok) return setPrices({ kind: "error", message: await failMessage(res) });
      const data = (await res.json()) as HotelPrices;
      setPrices({ kind: "ok", sources: data.sources.length ? data.sources : hotel.sources });
    } catch {
      setPrices({ kind: "error", message: "연결이 불안정해요. 잠시 뒤에 다시 눌러 주세요." });
    }
  }

  const total = hotel.total ?? (hotel.perNight !== null ? hotel.perNight * nights : null);
  const sources = prices?.kind === "ok" ? prices.sources : hotel.sources;
  const tier = hotel.rating ? ratingTier(hotel.rating) : null;
  return (
    <li id={`hotel-${hotel.token}`} className={`hcard${open ? " open" : ""}${flash ? " flash" : ""}`}>
      <Gallery images={hotel.images.length ? hotel.images : hotel.image ? [hotel.image] : []} />
      <div className="hcard-body">
        <h3 title={hotel.name}>{hotel.name}</h3>
        <p className="hcard-meta">
          {hotel.stars ? (
            <>
              <MochiStars count={hotel.stars} /> {hotel.stars}성급 {hotel.kind}
            </>
          ) : (
            hotel.kind
          )}
          {hotel.gps && (
            <>
              {" · "}
              <a href={`https://www.google.com/maps/search/?api=1&query=${hotel.gps[0]},${hotel.gps[1]}`} target="_blank" rel="noopener noreferrer">
                지도 보기
              </a>
            </>
          )}
        </p>
        {hotel.amenities.length > 0 && (
          <ul className="hcard-amen">
            {hotel.amenities.slice(0, 4).map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        )}
        {hotel.deal && <p className="hcard-deal">{hotel.deal}</p>}
        {hotel.rating !== null && (
          <div className="hcard-rating">
            <RatingMochi rating={hotel.rating} />
            <p>
              {tier?.word && <span style={{ color: tier.color }}>{tier.word}</span>}
              {hotel.reviews ? <em>후기 {hotel.reviews.toLocaleString("ko-KR")}개</em> : null}
            </p>
          </div>
        )}
      </div>
      <div className="hcard-price">
        {hotel.perNight !== null && <span>1박 평균 {won(hotel.perNight)}</span>}
        {total !== null && <strong>총 {won(total)}</strong>}
        <em>{hotel.total !== null ? "세금·수수료 포함" : `${nights}박 기준 예상`}</em>
        <button type="button" onClick={select} aria-expanded={open}>
          {open ? "접기" : "선택"}
        </button>
      </div>
      {open && (
        <div className="hcard-sources">
          <p>
            예약 사이트별 가격
            {prices?.kind === "loading" && <span className="dots"> 더 불러오는 중</span>}
          </p>
          {sources.length > 0 && (
            <ul className="hotel-sources">
              {sources.map((s) => {
                const link = isAgoda(s.name) ? agodaSearchUrl(hotel.name, query) : s.link;
                return (
                  <li key={s.name} className={isAgoda(s.name) ? "pick" : undefined}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {s.logo ? <img src={s.logo} alt="" /> : <i />}
                    <span>
                      {s.name}
                      {s.official && <em> 공식</em>}
                      {isAgoda(s.name) && <em className="hotel-pick"> 로보티 추천</em>}
                    </span>
                    <b>
                      {s.perNight !== null ? won(s.perNight) : "-"}
                      {s.total !== null && <small> · 총 {won(s.total)}</small>}
                    </b>
                    {link ? (
                      <a href={link} target="_blank" rel="noopener noreferrer sponsored">
                        예약하기 ↗
                      </a>
                    ) : (
                      <span />
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {prices?.kind === "ok" && !sources.length && <p className="flight-note">이 호텔은 지금 예약 사이트 가격을 찾지 못했어요.</p>}
          {prices?.kind === "error" && <p className="flight-note">{prices.message}</p>}
          {!sources.some((s) => isAgoda(s.name)) && (
            <a className="results-out small" href={agodaSearchUrl(hotel.name, query)} target="_blank" rel="noopener noreferrer sponsored">
              아고다에서 이 호텔 찾기 ↗
            </a>
          )}
        </div>
      )}
    </li>
  );
}

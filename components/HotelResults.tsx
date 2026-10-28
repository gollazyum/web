"use client";

import { useEffect, useMemo, useState } from "react";
import { HotelAdvisor } from "./HotelAdvisor";
import { HotelPriceSheet, lowestCost, roboSummary, totalOf, type PriceState } from "./HotelPriceSheet";
import { HotelSearch } from "./HotelSearch";
import { MochiStar, MochiStars, RatingMochi, ratingTier } from "./MochiMarks";
import { PriceRange } from "./PriceRange";
import { ResultsMessage, ResultsShell } from "./ResultsShell";
import { ScanProgress } from "./ScanProgress";
import { SortMenu } from "./SortMenu";
import { errorCode } from "@/lib/apiError";
import { daysBetween, shortLabel, today } from "@/lib/dates";
import { agodaSearchUrl, hotelsPath, isAgoda, type HotelOption, type HotelPrices, type HotelQuery, type HotelResults } from "@/lib/hotels";
import { isPhone, useSheet } from "@/lib/useSheet";

// 호텔 결과 페이지 (/hotels?q=…). 로보티가 훑는 연출 뒤에 필터·정렬이 있는 호텔 카드 목록을 보여 준다.
// 필터와 정렬은 받아 온 목록 안에서만 하므로 SerpApi를 더 부르지 않는다
const SCAN_MS = 4500;
const MAX_COMPARE = 3;

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
        <ResultsMessage title="호텔 가격 비교">
          도시나 호텔 이름과 날짜를 위에서 넣어 주세요. 로보티가 아고다·트립닷컴·부킹닷컴 같은 예약 사이트와 호텔 공식 사이트의 실시간 가격을
          모아 세금 포함 총액으로 비교해 드려요. 고민되면 오른쪽의 로보티에게 예산이나 원하는 조건을 물어보세요.
        </ResultsMessage>
      ) : !revealed ? (
        <>
        <HotelSkeletons />
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
            waitLines={[
              "🔍 예약 사이트마다 가격을 하나씩 확인하고 있어요",
              "🏨 같은 방이라도 사이트마다 값이 달라서 꼼꼼히 보는 중이에요",
              "💸 세금 포함 총액으로 맞춰 보고 있어요. 거의 다 왔어요!",
            ]}
          />
        </div>
        </>
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

  // 예산은 카드의 큰 숫자와 같은 '총액' 기준이 기본. '1박'으로 바꿔 볼 수 있다
  const [unit, setUnit] = useState<"total" | "night">("total");
  const cost = (o: HotelOption) => (unit === "total" ? totalOf(o, nights) : o.perNight) ?? 0;
  const prices = data.options.map(cost);
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

  // 휴대폰: 카드를 누르면 아래에서 올라오는 예약 사이트별 가격 시트
  const [sheetToken, setSheetToken] = useState("");
  const [priceMap, setPriceMap] = useState<Record<string, PriceState>>({});
  // 휴대폰에서 시트로 연 필터·도우미는 뒤로가기로 닫히고 뒤 페이지 스크롤을 잠근다
  const [phoneSheet, setPhoneSheet] = useState(false);
  useSheet(filtersOpen && phoneSheet, () => setFiltersOpen(false));
  useSheet(advisorOpen && phoneSheet, () => setAdvisorOpen(false));

  // 비교 담기 (최대 3곳). 같은 검색 안에서는 새로고침해도 남는다
  const storeKey = `lowboti:compare:${hotelsPath(query)}`;
  const [compared, setCompared] = useState<string[]>([]);
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(storeKey) ?? "[]");
      if (Array.isArray(saved)) setCompared(saved.filter((t): t is string => typeof t === "string").slice(0, MAX_COMPARE));
    } catch {
      // 저장소를 못 쓰는 브라우저면 이번 화면에서만 기억한다
    }
  }, [storeKey]);
  const [toast, setToast] = useState("");
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  // 로보티가 답에서 고른 호텔 (카드에 '로보티 추천' 배지)
  const [picks, setPicks] = useState<Set<string>>(new Set());
  const [ask, setAsk] = useState<{ text: string; id: number } | null>(null);

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
      const p = cost(o);
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
    // cost는 unit·nights로만 바뀐다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, unit, range[0], range[1], minRating, stars, amenities, sort]);

  // 이 검색에서 총액이 가장 낮은 한 곳 ('이 검색 최저가' 배지)
  const lowestToken = useMemo(() => {
    if (data.options.length < 2) return "";
    return data.options.reduce((a, b) => ((totalOf(b, nights) ?? Infinity) < (totalOf(a, nights) ?? Infinity) ? b : a)).token;
  }, [data, nights]);

  // 도우미가 추천한 호텔 카드로 이동해 잠깐 반짝인다. 필터에 가려져 있으면 필터를 푼다
  function focusHotel(token: string) {
    if (!shown.some((h) => h.token === token)) reset();
    setAdvisorOpen(false);
    setFlash(token);
    setTimeout(() => document.getElementById(`hotel-${token}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 60);
    setTimeout(() => setFlash((f) => (f === token ? "" : f)), 2200);
  }

  async function loadPrices(hotel: HotelOption) {
    if (priceMap[hotel.token]) return;
    const put = (v: PriceState) => setPriceMap((m) => ({ ...m, [hotel.token]: v }));
    put({ kind: "loading" });
    try {
      const res = await postHotels({ ...query, token: hotel.token });
      if (!res.ok) return put({ kind: "error", message: await failMessage(res) });
      const prices = (await res.json()) as HotelPrices;
      put({ kind: "ok", sources: prices.sources.length ? prices.sources : hotel.sources });
    } catch {
      put({ kind: "error", message: "연결이 불안정해요. 잠시 뒤에 다시 눌러 주세요." });
    }
  }

  function openSheet(hotel: HotelOption) {
    setSheetToken(hotel.token);
    loadPrices(hotel);
  }

  function toggleCompare(hotel: HotelOption) {
    const on = compared.includes(hotel.token);
    if (!on && compared.length >= MAX_COMPARE) return setToast(`최대 ${MAX_COMPARE}곳까지 비교할 수 있어요`);
    const next = on ? compared.filter((t) => t !== hotel.token) : [...compared, hotel.token];
    setCompared(next);
    try {
      sessionStorage.setItem(storeKey, JSON.stringify(next));
    } catch {
      // 저장 못 해도 화면 상태는 그대로
    }
  }

  function openAdvisor() {
    setPhoneSheet(isPhone());
    setAdvisorOpen(true);
    const list = compared.map((t) => data.options.find((o) => o.token === t)).filter((o): o is HotelOption => !!o);
    if (!list.length) return;
    const names = list.map((h) => h.name).join(", ");
    setAsk({
      id: Date.now(),
      text:
        list.length === 1
          ? `${names}을(를) 비슷한 가격대의 다른 곳과 비교해서 괜찮은지 알려 주세요.`
          : `${names} ${list.length}곳을 비교해서 어디가 나은지 이유와 함께 추천해 주세요.`,
    });
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
  const sheetHotel = data.options.find((o) => o.token === sheetToken) ?? null;
  const comparedHotels = compared.map((t) => data.options.find((o) => o.token === t)).filter((o): o is HotelOption => !!o);
  // 'n곳 비교하기'는 담은 호텔이 이번 목록에 있을 때만
  const compareCount = comparedHotels.length;

  return (
    <div className="results-grid with-advisor">
      {filtersOpen && phoneSheet && <div className="sheet-dim" aria-hidden="true" onClick={() => setFiltersOpen(false)} />}
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
            <div className="budget-head">
              <h4>예산</h4>
              <div className="unit-toggle" role="group" aria-label="예산 기준">
                {(
                  [
                    ["total", `총액 (${nights}박)`],
                    ["night", "1박"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={unit === id}
                    onClick={() => {
                      setUnit(id);
                      setRange(null);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
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
            <button
              type="button"
              className="filters-toggle"
              onClick={() => {
                setPhoneSheet(isPhone());
                setFiltersOpen(true);
              }}
            >
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
        <p className="results-hint">
          큰 숫자는 <b>{nights}박 총액</b>(세금·수수료 포함)이에요. 카드를 누르면 사이트별 가격이 나와요.
        </p>

        {shown.length ? (
          <ul className="hcards">
            {shown.map((h) => (
              <HotelCard
                key={h.token}
                hotel={h}
                query={query}
                nights={nights}
                flash={flash === h.token}
                badge={badgeFor(h, picks, lowestToken)}
                prices={priceMap[h.token] ?? null}
                onPrices={() => loadPrices(h)}
                onSheet={() => openSheet(h)}
                compared={compared.includes(h.token)}
                compareFull={compared.length >= MAX_COMPARE}
                onCompare={() => toggleCompare(h)}
              />
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

      {advisorOpen && phoneSheet && <div className="sheet-dim" aria-hidden="true" onClick={() => setAdvisorOpen(false)} />}
      <HotelAdvisor
        hotels={data.options}
        query={query}
        open={advisorOpen}
        onClose={() => setAdvisorOpen(false)}
        onPick={focusHotel}
        ask={ask}
        compare={advisorOpen ? comparedHotels : []}
        nights={nights}
        onRecommend={(tokens) => setPicks((prev) => (tokens.every((t) => prev.has(t)) ? prev : new Set([...prev, ...tokens])))}
      />
      {!advisorOpen && !sheetHotel && !filtersOpen && (
        <button type="button" className={`advisor-fab${compareCount ? " comparing" : ""}`} onClick={openAdvisor}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/lowboti-mark.svg" alt="" />
          {compareCount ? `${compareCount}곳 비교하기` : "AI 추천"}
        </button>
      )}

      {sheetHotel && (
        <HotelPriceSheet
          hotel={sheetHotel}
          query={query}
          nights={nights}
          prices={priceMap[sheetHotel.token] ?? null}
          summary={roboSummary(sheetHotel, data.options, nights, picks.has(sheetHotel.token))}
          onClose={() => setSheetToken("")}
        />
      )}
      {toast && (
        <p className="toast" role="status">
          {toast}
        </p>
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

// 휴대폰 컴팩트 카드(96px)용 작은 사진 묶음. Google 사진이 아니면 원래 주소 하나만
function srcSet(src: string): string | undefined {
  if (!/googleusercontent\.com/.test(src)) return undefined;
  const at = (w: number, h: number) => src.replace(/=w\d+-h\d+[^/]*$/, `=w${w}-h${h}-k-no`);
  return `${at(192, 240)} 192w, ${at(288, 360)} 288w, ${at(640, 480)} 640w`;
}

function Gallery({ images, name, badge }: { images: string[]; name: string; badge?: React.ReactNode }) {
  const [i, setI] = useState(0);
  const [failed, setFailed] = useState<Set<number>>(new Set());
  if (!images.length) return <div className="hcard-photo empty">{badge}</div>;
  const src = failed.has(i) ? images[i] : bigger(images[i]);
  const go = (d: number) => (e: React.MouseEvent) => {
    e.stopPropagation();
    setI((i + d + images.length) % images.length);
  };
  return (
    <div className="hcard-photo">
      {badge}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        srcSet={failed.has(i) ? undefined : srcSet(images[i])}
        sizes="(max-width: 640px) 96px, 240px"
        alt={`${name} 사진 ${i + 1}`}
        loading="lazy"
        onError={() => !failed.has(i) && setFailed(new Set(failed).add(i))}
      />
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

// 휴대폰 카드 사진 위 배지 하나. 우선순위: 로보티 추천 > 이 검색 최저가 > 평소보다 n%↓
type Badge = { kind: "robo" | "lowest" | "deal"; text: string } | null;
function badgeFor(h: HotelOption, picks: Set<string>, lowestToken: string): Badge {
  if (picks.has(h.token)) return { kind: "robo", text: "로보티 추천" };
  if (h.token === lowestToken) return { kind: "lowest", text: "이 검색 최저가" };
  const pct = h.deal.match(/(\d+)\s*%/)?.[1];
  if (pct) return { kind: "deal", text: `평소보다 ${pct}%↓` };
  return null;
}

type CardProps = {
  hotel: HotelOption;
  query: HotelQuery;
  nights: number;
  flash: boolean;
  badge: Badge;
  prices: PriceState | null;
  onPrices: () => void;
  onSheet: () => void;
  compared: boolean;
  compareFull: boolean;
  onCompare: () => void;
};

function HotelCard({ hotel, query, nights, flash, badge, prices, onPrices, onSheet, compared, compareFull, onCompare }: CardProps) {
  const [open, setOpen] = useState(false);

  // PC는 카드 안에 펼치고, 휴대폰은 아래에서 올라오는 시트로 연다
  function select() {
    if (isPhone()) return onSheet();
    setOpen(!open);
    if (!open) onPrices();
  }

  const total = totalOf(hotel, nights);
  const sources = prices?.kind === "ok" ? prices.sources : hotel.sources;
  const lowest = lowestCost(sources);
  const tier = hotel.rating ? ratingTier(hotel.rating) : null;
  const blocked = !compared && compareFull;
  return (
    <li id={`hotel-${hotel.token}`} className={`hcard${open ? " open" : ""}${flash ? " flash" : ""}${compared ? " is-compared" : ""}`}>
      <Gallery
        name={hotel.name}
        images={hotel.images.length ? hotel.images : hotel.image ? [hotel.image] : []}
        badge={badge && <span className={`hcard-badge is-${badge.kind}`}>{badge.text}</span>}
      />
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
            <span className="hcard-map">
              {" · "}
              <a href={`https://www.google.com/maps/search/?api=1&query=${hotel.gps[0]},${hotel.gps[1]}`} target="_blank" rel="noopener noreferrer">
                지도 보기
              </a>
            </span>
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
        {hotel.rating !== null ? (
          <div className="hcard-rating">
            <RatingMochi rating={hotel.rating} />
            <p>
              {tier?.word && <span style={{ color: tier.color }}>{tier.word}</span>}
              {hotel.reviews ? <em>후기 {hotel.reviews.toLocaleString("ko-KR")}개</em> : null}
            </p>
          </div>
        ) : (
          <p className="hcard-norating m-only">후기 없음</p>
        )}
      </div>
      <div className="hcard-price">
        {hotel.perNight !== null && <span>1박 평균 {won(hotel.perNight)}</span>}
        {total !== null && (
          <strong>
            <i className="pc-only">총 </i>
            {won(total)}
          </strong>
        )}
        <em>
          {hotel.total !== null ? (
            <>
              <i className="m-only">총액 · </i>세금·수수료 포함
            </>
          ) : (
            `${nights}박 기준 예상`
          )}
        </em>
        <button type="button" onClick={select} aria-expanded={open} aria-haspopup="dialog" aria-label={`${hotel.name} 예약 사이트별 가격 보기`}>
          {open ? "접기" : "선택"}
        </button>
      </div>
      <button
        type="button"
        className="hcard-compare"
        aria-pressed={compared}
        aria-disabled={blocked}
        aria-label={`${hotel.name} 비교 담기`}
        onClick={(e) => {
          e.stopPropagation();
          onCompare();
        }}
      >
        {compared ? "비교함" : "비교 담기"}
      </button>
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
                    {s.logo ? <img src={s.logo} alt={s.name} /> : <i />}
                    <span>
                      {s.name}
                      {s.official && <em> 공식</em>}
                      {isAgoda(s.name) && <em className="hotel-pick"> 로보티 추천</em>}
                      {lowest && lowest.value !== null && lowest.cost(s) === lowest.value && <em className="best-badge">최저가</em>}
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

// 결과를 기다리는 동안 휴대폰에 보여 주는 안내 줄과 카드 모양 자리 6장
function HotelSkeletons() {
  return (
    <div className="hcard-skeletons">
      <div className="skeleton-banner" role="status">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/lowboti-mark.svg" alt="" />
        <p>
          <strong>🔍 로보티가 실시간 최저가와 숨은 경로를 비교하고 있어요...</strong>
          <span>예약 사이트별 숨은 총액까지 계산하는 중 · 약 5~10초</span>
        </p>
      </div>
      <ul className="hcards" aria-hidden="true">
        {Array.from({ length: 6 }, (_, i) => (
          <li key={i} className="hcard is-skeleton">
            <div className="hcard-photo sk" />
            <div className="hcard-body">
              <div className="sk" style={{ height: 16, width: "85%" }} />
              <div className="sk" style={{ height: 12, width: "55%" }} />
              <div className="sk" style={{ height: 20, width: "40%" }} />
            </div>
            <div className="hcard-price">
              <div className="sk" style={{ height: 20, width: 96 }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

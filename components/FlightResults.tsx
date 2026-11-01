"use client";

import { useEffect, useMemo, useState } from "react";
import { FlightAdvisor } from "./FlightAdvisor";
import { FlightSearch } from "./FlightSearch";
import { PriceRange } from "./PriceRange";
import { ResultsMessage, ResultsShell } from "./ResultsShell";
import { ScanProgress } from "./ScanProgress";
import { SortMenu } from "./SortMenu";
import { airportsFor } from "@/lib/airports";
import { errorCode } from "@/lib/apiError";
import { shortLabel, today } from "@/lib/dates";
import { tripUrl, type FlightOption, type FlightQuery, type FlightResults } from "@/lib/flights";
import { isPhone, useSheet } from "@/lib/useSheet";

// 항공권 결과 페이지 (/flights?from=…). 로보티가 훑는 연출 뒤에 필터·정렬이 있는 항공편 목록을 보여 준다.
// 예약은 Trip.com 한국 사이트 검색 결과로 넘긴다
const SCAN_MS = 4500;

type State = { kind: "loading" } | { kind: "ok"; data: FlightResults; request: FlightQuery } | { kind: "error"; message: string };
// 오는 편 (왕복 카드의 '상세 보기'를 누를 때 불러온다)
type ReturnState = { kind: "loading" } | { kind: "ok"; options: FlightOption[] } | { kind: "error" };
type Sort = "price" | "duration" | "early";

const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;
const hhmm = (t: string) => t.slice(11, 16);

function duration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h}시간${m ? ` ${m}분` : ""}` : `${m}분`;
}

// 도착이 다음 날 이후면 "+1"
function dayShift(from: string, to: string): number {
  if (!from || !to) return 0;
  return Math.round((Date.parse(to.slice(0, 10)) - Date.parse(from.slice(0, 10))) / 86_400_000);
}

const levelText: Record<string, string> = { low: "평소보다 싼 편", typical: "평소 수준", high: "평소보다 비싼 편" };

const STOPS = [
  { id: 0, label: "직항" },
  { id: 1, label: "1회 경유" },
  { id: 2, label: "2회 이상" },
];
const TIMES = [
  { id: "dawn", label: "새벽", sub: "00–06시", from: 0, to: 6 },
  { id: "morning", label: "오전", sub: "06–12시", from: 6, to: 12 },
  { id: "afternoon", label: "오후", sub: "12–18시", from: 12, to: 18 },
  { id: "evening", label: "저녁", sub: "18–24시", from: 18, to: 24 },
];

export function FlightResultsView({ query }: { query: FlightQuery | null }) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (!query) return;
    if (query.depart < today()) return setState({ kind: "error", message: "가는 날이 이미 지났어요. 위에서 날짜를 다시 입력해 주세요." });
    let cancelled = false;
    (async () => {
      try {
        const request = { ...query, from: await airportsFor(query.from), to: await airportsFor(query.to) };
        const res = await fetch("/api/flights", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(request),
        });
        const next: State = res.ok
          ? { kind: "ok", data: (await res.json()) as FlightResults, request }
          : {
              kind: "error",
              message:
                res.status === 429
                  ? "검색이 너무 잦아서 잠깐 쉬고 있어요. 트립닷컴에서 바로 확인해 보세요."
                  : res.status === 503
                    ? "항공권 가격 기능을 준비하고 있어요. 트립닷컴에서 바로 확인해 보세요."
                    : `지금은 사이트 안에서 가격을 불러오지 못했어요. 트립닷컴에서 바로 확인해 보세요. (오류 ${await errorCode(res)})`,
            };
        if (!cancelled) setState(next);
      } catch {
        if (!cancelled) setState({ kind: "error", message: "연결이 불안정해요. 트립닷컴에서 바로 확인해 보세요." });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [query]);

  const link = query ? tripUrl(query.from, query.to, query.depart, query.ret, query.adults) : "";
  return (
    <ResultsShell
      search={<FlightSearch initial={query ?? undefined} compact />}
      summary={
        query && {
          title: `${query.from} → ${query.to}${query.ret ? " 왕복" : " 편도"}`,
          sub: `${shortLabel(query.depart)}${query.ret ? ` ~ ${shortLabel(query.ret)}` : ""} · 성인 ${query.adults}명`,
        }
      }
    >
      {!query ? (
        <ResultsMessage title="Flights 항공권 운임">
          출발지·도착지와 날짜를 위에서 입력해 주세요. Gollazyum이 검색할 때마다 Google 항공편 운임을 새로 받아 싼 순서로 보여 드리고, 직항·경유와
          시간대로 걸러 볼 수 있어요. 마음에 드는 항공편은 트립닷컴에서 바로 예약할 수 있어요.
        </ResultsMessage>
      ) : !revealed ? (
        <div className="results-loading">
          <ScanProgress
            ms={SCAN_MS}
            morphTo="flight"
            ready={state.kind !== "loading"}
            onDone={() => setRevealed(true)}
            stage={{
              title: `${query.from} → ${query.to} 항공권을 훑고 있어요`,
              sub: `${shortLabel(query.depart)}${query.ret ? ` ~ ${shortLabel(query.ret)} 왕복` : " 편도"} · 성인 ${query.adults}명`,
            }}
            steps={[
              { text: "출발지·도착지·날짜 조건 읽는 중...", at: 0 },
              { text: "항공사와 예약 사이트 가격을 새로 받는 중...", at: 0.2 },
              { text: "싼 순서로 정리하는 중...", at: 0.75 },
            ]}
            waitLines={[
              "🔍 항공사마다 운임을 하나씩 확인하고 있어요. 10초쯤 걸려요",
              "✈️ 직항이랑 경유편 가격을 나란히 놓고 보는 중이에요",
              "💸 세금·유류할증료까지 포함한 총액으로 맞춰 보고 있어요",
              "🧳 거의 다 왔어요! 싼 순서로 줄 세우는 중이에요",
            ]}
          />
        </div>
      ) : state.kind === "ok" ? (
        <FlightBoard data={state.data} query={query} request={state.request} link={link} />
      ) : (
        <ResultsMessage
          action={
            <a className="results-out" href={link} target="_blank" rel="noopener noreferrer">
              트립닷컴에서 항공권 보기 ↗
            </a>
          }
        >
          {state.kind === "error" ? state.message : ""}
        </ResultsMessage>
      )}
    </ResultsShell>
  );
}

function FlightBoard({ data, query, request, link }: { data: FlightResults; query: FlightQuery; request: FlightQuery; link: string }) {
  const priceMin = Math.floor(Math.min(...data.options.map((o) => o.price)) / 10000) * 10000;
  const priceMax = Math.ceil(Math.max(...data.options.map((o) => o.price), 0) / 10000) * 10000;
  const airlines = useMemo(() => {
    const count = new Map<string, number>();
    for (const o of data.options) for (const a of o.airlines) count.set(a, (count.get(a) ?? 0) + 1);
    return [...count.entries()].sort((a, b) => b[1] - a[1]);
  }, [data]);

  const [range, setRange] = useState<[number, number]>([priceMin, priceMax]);
  const [stops, setStops] = useState<Set<number>>(new Set());
  const [times, setTimes] = useState<Set<string>>(new Set());
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<Sort>("price");
  const [filtersOpen, setFiltersOpen] = useState(false);
  // 휴대폰 전용 로보티 항공권 도우미 (P1-7). 시트는 뒤로가기로 닫히고 뒤 페이지 스크롤을 잠근다
  const [advisorOpen, setAdvisorOpen] = useState(false);
  const [phoneSheet, setPhoneSheet] = useState(false);
  const [flash, setFlash] = useState(-1);
  useSheet(filtersOpen && phoneSheet, () => setFiltersOpen(false));
  useSheet(advisorOpen && phoneSheet, () => setAdvisorOpen(false));

  const shown = useMemo(() => {
    const list = data.options.filter((o) => {
      if (o.price < range[0] || o.price > range[1]) return false;
      if (stops.size && !stops.has(Math.min(o.stops.length, 2))) return false;
      if (times.size) {
        const h = Number(hhmm(o.departTime).slice(0, 2));
        if (!TIMES.some((t) => times.has(t.id) && h >= t.from && h < t.to)) return false;
      }
      if (picked.size && !o.airlines.some((a) => picked.has(a))) return false;
      return true;
    });
    if (sort === "price") list.sort((a, b) => a.price - b.price);
    if (sort === "duration") list.sort((a, b) => a.minutes - b.minutes);
    if (sort === "early") list.sort((a, b) => a.departTime.localeCompare(b.departTime));
    return list;
  }, [data, range, stops, times, picked, sort]);

  if (!data.options.length) {
    return (
      <ResultsMessage
        action={
          <a className="results-out" href={link} target="_blank" rel="noopener noreferrer">
            트립닷컴에서 항공권 보기 ↗
          </a>
        }
      >
        이 날짜에는 찾은 항공편이 없어요. 날짜를 바꾸거나 트립닷컴에서 더 넓게 찾아보세요.
      </ResultsMessage>
    );
  }

  const active = (range[0] > priceMin || range[1] < priceMax ? 1 : 0) + stops.size + times.size + picked.size;
  const reset = () => {
    setRange([priceMin, priceMax]);
    setStops(new Set());
    setTimes(new Set());
    setPicked(new Set());
  };
  const toggle = <T,>(set: Set<T>, v: T) => {
    const next = new Set(set);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    return next;
  };
  // 도우미가 고른 항공편 카드로 이동해 잠깐 반짝인다. 필터에 가려져 있으면 필터를 푼다
  function focusFlight(index: number) {
    const target = data.options[index];
    if (!target) return;
    if (!shown.includes(target)) reset();
    setAdvisorOpen(false);
    setFlash(index);
    setTimeout(() => document.getElementById(`flight-${index}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 60);
    setTimeout(() => setFlash((f) => (f === index ? -1 : f)), 2200);
  }
  const cheapestByStops = (n: number) => {
    const p = data.options.filter((o) => Math.min(o.stops.length, 2) === n).map((o) => o.price);
    return p.length ? Math.min(...p) : null;
  };

  return (
    <div className="results-grid">
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

        <section>
          <h4>경유</h4>
          <div className="check-list">
            {STOPS.map((s) => {
              const p = cheapestByStops(s.id);
              return (
                <label key={s.id} className={p === null ? "off" : undefined}>
                  <input type="checkbox" checked={stops.has(s.id)} disabled={p === null} onChange={() => setStops(toggle(stops, s.id))} />
                  <span>{s.label}</span>
                  <em>{p !== null ? `${won(p)}~` : "없음"}</em>
                </label>
              );
            })}
          </div>
        </section>

        {priceMax > priceMin && (
          <section>
            <h4>가격{query.ret ? " (왕복 총액)" : ""}</h4>
            <PriceRange min={priceMin} max={priceMax} step={10000} value={range} onChange={setRange} format={won} />
          </section>
        )}

        <section>
          <h4>출발 시간</h4>
          <div className="time-grid">
            {TIMES.map((t) => (
              <button key={t.id} type="button" className={`chip${times.has(t.id) ? " on" : ""}`} onClick={() => setTimes(toggle(times, t.id))}>
                {t.label}
                <small>{t.sub}</small>
              </button>
            ))}
          </div>
        </section>

        {airlines.length > 1 && (
          <section>
            <h4>항공사</h4>
            <div className="check-list">
              {airlines.map(([a, n]) => (
                <label key={a}>
                  <input type="checkbox" checked={picked.has(a)} onChange={() => setPicked(toggle(picked, a))} />
                  <span>{a}</span>
                  <em>{n}</em>
                </label>
              ))}
            </div>
          </section>
        )}

        <button type="button" className="filters-apply" onClick={() => setFiltersOpen(false)}>
          {shown.length}개 보기
        </button>
      </aside>

      <section className="results-main">
        <div className="results-bar">
          <p>
            <strong>항공편 {shown.length}개</strong>
            {shown.length !== data.options.length && <span> / 전체 {data.options.length}개</span>}
            <span className="results-bar-sub">
              {" "}
              · {shortLabel(query.depart)}
              {query.ret ? ` ~ ${shortLabel(query.ret)} 왕복` : " 편도"} · 성인 {query.adults}명
            </span>
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
                { id: "price", label: "낮은 가격순" },
                { id: "duration", label: "짧은 비행순" },
                { id: "early", label: "빠른 출발순" },
              ]}
            />
          </div>
        </div>

        {(data.lowest !== null || data.level || data.typical) && (
          <div className="insight">
            {data.lowest !== null && (
              <strong>
                최저 {won(data.lowest)}
                {query.ret ? " (왕복)" : ""}
              </strong>
            )}
            {data.level && levelText[data.level] && <span className={`flight-level ${data.level}`}>{levelText[data.level]}</span>}
            {data.typical && (
              <span className="flight-typical">
                이 노선 평소 가격 {won(data.typical[0])} ~ {won(data.typical[1])}
              </span>
            )}
          </div>
        )}

        {shown.length ? (
          <ul className="fcards">
            {shown.map((o, i) => {
              const index = data.options.indexOf(o);
              return (
                <FlightCard
                  key={`${o.departTime}-${o.airlines.join()}-${o.price}-${i}`}
                  id={`flight-${index}`}
                  flash={flash === index}
                  option={o}
                  link={link}
                  roundTrip={!!query.ret}
                  request={request}
                />
              );
            })}
          </ul>
        ) : (
          <div className="results-none">
            조건에 맞는 항공편이 없어요.{" "}
            <button type="button" className="link-btn" onClick={reset}>
              필터 초기화
            </button>
          </div>
        )}

        <p className="flight-note">
          Google 항공편 검색 기준, 검색 시점 가격이에요{query.ret ? " (왕복 총액, 가는 편 기준으로 표시)" : ""}. 실제 금액과 좌석은 예약 사이트에서 꼭
          확인해 주세요.
        </p>
        <a className="results-out" href={link} target="_blank" rel="noopener noreferrer">
          트립닷컴에서 전체 결과 보기 ↗
        </a>
      </section>

      {advisorOpen && phoneSheet && <div className="sheet-dim" aria-hidden="true" onClick={() => setAdvisorOpen(false)} />}
      <FlightAdvisor flights={data.options} query={query} open={advisorOpen} onClose={() => setAdvisorOpen(false)} onPick={focusFlight} />
      {!advisorOpen && !filtersOpen && (
        <button
          type="button"
          className="advisor-fab flight-fab"
          onClick={() => {
            setPhoneSheet(isPhone());
            setAdvisorOpen(true);
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/gollazyum-mark.svg" alt="" />
          <span className="fab-label">Gollazyum AI</span>
        </button>
      )}
    </div>
  );
}

type FlightCardProps = { id: string; flash: boolean; option: FlightOption; link: string; roundTrip: boolean; request: FlightQuery };

function FlightCard({ id, flash, option: o, link, roundTrip, request }: FlightCardProps) {
  const [open, setOpen] = useState(false);
  const [back, setBack] = useState<ReturnState | null>(null);

  // 처음 펼칠 때 한 번만 부른다 (SerpApi 호출 1번). 서버가 같은 조건을 30분 저장해 두므로 다시 펼쳐도 새로 쓰지 않는다
  useEffect(() => {
    if (!open || !roundTrip || !o.token || back) return;
    setBack({ kind: "loading" });
    fetch("/api/flights", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...request, token: o.token }) })
      .then(async (res) => (res.ok ? setBack({ kind: "ok", options: ((await res.json()) as FlightResults).options }) : setBack({ kind: "error" })))
      .catch(() => setBack({ kind: "error" }));
  }, [open, roundTrip, o.token, request, back]);
  const shift = dayShift(o.departTime, o.arriveTime);
  const flightNos = o.segments.map((s) => s.flightNo).filter(Boolean);
  return (
    <li id={id} className={`fcard${open ? " open" : ""}${flash ? " flash" : ""}`}>
      <div className="fcard-top">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {o.logo ? <img src={o.logo} alt={o.airlines.join(", ")} className="fcard-logo" /> : <span className="fcard-logo" />}
        <div className="fcard-route">
          <div className="fcard-end">
            <strong>{hhmm(o.departTime)}</strong>
            <span>{o.fromId}</span>
          </div>
          <div className="fcard-line">
            <span>{duration(o.minutes)}</span>
            <i>
              {o.stops.map((s) => (
                <b key={s} />
              ))}
            </i>
            <span className={o.stops.length ? "stops" : "direct"}>{o.stops.length ? `${o.stops.length}회 경유 ${o.stops.join(", ")}` : "직항"}</span>
          </div>
          <div className="fcard-end">
            <strong>
              {hhmm(o.arriveTime)}
              {shift > 0 && <sup>+{shift}</sup>}
            </strong>
            <span>{o.toId}</span>
          </div>
        </div>
        <div className="fcard-buy">
          <strong>{won(o.price)}</strong>
          <em>{roundTrip ? "왕복 총액" : "편도"}</em>
          <a href={link} target="_blank" rel="noopener noreferrer">
            예약하기
          </a>
        </div>
      </div>
      <div className="fcard-foot">
        <span>
          {o.airlines.join(" · ")}
          {flightNos.length > 0 && ` · ${flightNos.join(", ")}`}
        </span>
        {o.segments.length > 0 && (
          <button type="button" className="link-btn" onClick={() => setOpen(!open)} aria-expanded={open}>
            {open ? "접기" : "상세 보기"}
          </button>
        )}
      </div>
      {open && roundTrip && <h4 className="fcard-legs-title">가는 편</h4>}
      {open && (
        <ol className="fcard-legs">
          {o.segments.map((s, i) => (
            <li key={i}>
              <div>
                <strong>
                  {hhmm(s.departTime)} {s.fromId}
                </strong>
                <span>{s.fromName}</span>
              </div>
              <p>
                {s.airline} {s.flightNo} · {duration(s.minutes)}
                {s.plane && ` · ${s.plane}`}
              </p>
              <div>
                <strong>
                  {hhmm(s.arriveTime)} {s.toId}
                </strong>
                <span>{s.toName}</span>
              </div>
              {i < o.segments.length - 1 && <em className="fcard-layover">{s.toId}에서 {duration(o.layovers[i] ?? 0)} 경유 대기</em>}
            </li>
          ))}
        </ol>
      )}
      {open && roundTrip && <ReturnLegs state={back} price={o.price} />}
    </li>
  );
}

// 오는 편 선택지. 고르는 오는 편에 따라 왕복 총액이 달라서 각 줄에 총액을 같이 적는다
function ReturnLegs({ state, price }: { state: ReturnState | null; price: number }) {
  if (!state) return <p className="flight-note">오는 편 정보는 예약 사이트에서 확인해 주세요.</p>;
  return (
    <>
      <h4 className="fcard-legs-title">
        오는 편{state.kind === "loading" && <span className="dots"> 불러오는 중</span>}
      </h4>
      {state.kind === "error" && <p className="flight-note">오는 편을 불러오지 못했어요. 예약하기에서 확인해 주세요.</p>}
      {state.kind === "ok" && !state.options.length && <p className="flight-note">이 가는 편에 맞는 오는 편을 찾지 못했어요.</p>}
      {state.kind === "ok" && state.options.length > 0 && (
        <ul className="fcard-returns">
          {state.options.slice(0, 3).map((r, i) => {
            const shift = dayShift(r.departTime, r.arriveTime);
            const nos = r.segments.map((s) => s.flightNo).filter(Boolean);
            return (
              <li key={i}>
                <div>
                  <strong>
                    {hhmm(r.departTime)} {r.fromId} → {hhmm(r.arriveTime)}
                    {shift > 0 && <sup>+{shift}</sup>} {r.toId}
                  </strong>
                  <span>
                    {duration(r.minutes)} · {r.stops.length ? `${r.stops.length}회 경유 ${r.stops.join(", ")}` : "직항"}
                  </span>
                </div>
                <p>
                  <span>
                    {r.airlines.join(" · ")}
                    {nos.length > 0 && ` · ${nos.join(", ")}`}
                  </span>
                  <b>{r.price === price ? "이 가격 그대로" : `왕복 ${won(r.price)}`}</b>
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

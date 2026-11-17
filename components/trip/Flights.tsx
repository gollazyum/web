"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { tripUrl, type FlightOption } from "@/lib/flights";
import { hhmm, hourOf, won, type FlightQuery } from "@/lib/trip";
import { dayShift, durText, legDate, perPerson, stopText, waits } from "@/lib/flight-legs";
import { searchFlightReturns } from "./api";
import { IconBack, IconOut } from "./icons";
import { Sheet } from "./Sheet";

export type FlightData = { query: FlightQuery; options: FlightOption[]; picks: { n: number; reason: string }[] };

export function flightLink(q: FlightQuery) {
  return tripUrl(q.from, q.to, q.depart, q.ret, q.adults);
}

// 오는 편 후보: 가는 편 토큰마다 한 번만 찾고, 같은 카드·상세가 함께 쓴다
type RetState = { status: "loading" } | { status: "done"; list: FlightOption[] } | { status: "fail" };
const RET = new Map<string, RetState>();
const retSubs = new Set<() => void>();
const retEmit = () => retSubs.forEach((f) => f());
function loadReturns(q: FlightQuery, token: string) {
  if (RET.has(token)) return;
  RET.set(token, { status: "loading" });
  retEmit();
  searchFlightReturns(q, token).then((r) => {
    RET.set(token, r.ok ? { status: "done", list: r.data.options } : { status: "fail" });
    retEmit();
  });
}
function useReturns(token?: string): RetState | undefined {
  return useSyncExternalStore(
    (f) => {
      retSubs.add(f);
      return () => void retSubs.delete(f);
    },
    () => (token ? RET.get(token) : undefined),
    () => undefined,
  );
}

// 한 방향 줄: 날짜 · 출발 → 도착 (+1일) · 공항 · 시간 · 직항/경유 · 항공사
function Leg({ label, o }: { label: string; o: FlightOption }) {
  const shift = dayShift(o.departTime, o.arriveTime);
  return (
    <span className="tb-leg">
      <span className="tb-leg-head">
        <b>{label}</b>
        {legDate(o.departTime)}
        <span className="tb-leg-air">{o.airlines.join(" · ")}</span>
      </span>
      <span className="tb-ftimes">
        <span>
          <strong>{hhmm(o.departTime)}</strong>
          <span>{o.fromId}</span>
        </span>
        <span className="tb-fline">
          <span>{durText(o.minutes)}</span>
          <i aria-hidden />
          <span>{o.stops.length ? `경유 ${o.stops.length}회 (${o.stops.join(", ")})` : "직항"}</span>
        </span>
        <span>
          <strong>
            {hhmm(o.arriveTime)}
            {shift > 0 && <em className="tb-plus1">+{shift}일</em>}
          </strong>
          <span>{o.toId}</span>
        </span>
      </span>
    </span>
  );
}

function PriceLines({ o, q }: { o: FlightOption; q: FlightQuery }) {
  const avg = perPerson(o.price, q.adults);
  return (
    <span className="tb-fprice">
      <small>
        {q.adults}명 {q.ret ? "왕복" : "편도"} 총액
      </small>
      <strong>{won(o.price)}</strong>
      {avg !== null && <small>1인 평균 {won(avg)}</small>}
    </span>
  );
}

// v4 10번 카드 → P0-4: 왕복은 '가는 편 / 오는 편' 두 줄. 누르면 상세 시트
export function FlightCard({ o, q, reason, rank, tag }: { o: FlightOption; q: FlightQuery; reason?: string; rank?: number; tag?: string }) {
  const [open, setOpen] = useState(false);
  const ret = useReturns(q.ret ? o.token : undefined);
  const back = ret?.status === "done" ? ret.list[0] : undefined;
  return (
    <div className={`tb-fcard${reason ? " ai" : ""}`}>
      {(reason || tag) && (
        <div className="tb-fcard-band">
          {rank ? <b>{rank}</b> : null}
          {reason || tag}
        </div>
      )}
      <button type="button" className="tb-fcard-body" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-label={`${o.airlines.join(", ")} ${hhmm(o.departTime)} 출발 항공편 상세 보기`}>
        <Leg label={q.ret ? "가는 편" : "편도"} o={o} />
        {q.ret &&
          (back ? (
            <Leg label="오는 편" o={back} />
          ) : (
            <span className="tb-leg tb-leg-none">
              <span className="tb-leg-head">
                <b>오는 편</b>
                {legDate(`${q.ret} `)}
              </span>
              <span className="tb-leg-msg">{ret?.status === "loading" ? "오는 편을 찾는 중이에요" : "오는 편은 트립닷컴에서 확인해 주세요"}</span>
            </span>
          ))}
        <span className="tb-fcard-foot">
          <span className="tb-fmore">상세 보기</span>
          <PriceLines o={back ?? o} q={q} />
        </span>
      </button>
      <a className="tb-fbook" href={flightLink(q)} target="_blank" rel="noopener noreferrer">
        트립닷컴에서 이 날짜 보기 <IconOut />
      </a>
      <FlightDetail open={open} o={o} q={q} onClose={() => setOpen(false)} />
    </div>
  );
}

// 구간별 편명·공항·시간, 경유 공항과 대기 시간
function Segments({ o }: { o: FlightOption }) {
  const w = waits(o);
  return (
    <ol className="tb-segs">
      {o.segments.map((s, i) => (
        <li key={i}>
          <div className="tb-seg-no">
            {[s.airline, s.flightNo].filter(Boolean).join(" ")}
            {s.plane && <span> · {s.plane}</span>}
          </div>
          <div className="tb-seg-row">
            <strong>{hhmm(s.departTime)}</strong>
            <span>
              {s.fromName || s.fromId} ({s.fromId})
            </span>
          </div>
          <div className="tb-seg-dur">{durText(s.minutes)}</div>
          <div className="tb-seg-row">
            <strong>
              {hhmm(s.arriveTime)}
              {dayShift(s.departTime, s.arriveTime) > 0 && <em className="tb-plus1">+{dayShift(s.departTime, s.arriveTime)}일</em>}
            </strong>
            <span>
              {s.toName || s.toId} ({s.toId})
            </span>
          </div>
          {w[i] && (
            <div className="tb-seg-wait">
              {w[i].at.toName || w[i].at.toId} ({w[i].at.toId})에서 {w[i].mins ? `${durText(w[i].mins)} 기다려요` : "갈아타요"}
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}

function LegDetail({ label, o }: { label: string; o: FlightOption }) {
  return (
    <section className="tb-fd-leg">
      <h3>
        {label} <span>{legDate(o.departTime)} · {durText(o.minutes)} · {stopText(o)}</span>
      </h3>
      <Segments o={o} />
    </section>
  );
}

export function FlightDetail({ open, o, q, onClose }: { open: boolean; o: FlightOption; q: FlightQuery; onClose: () => void }) {
  const ret = useReturns(q.ret ? o.token : undefined);
  useEffect(() => {
    if (open && q.ret && o.token) loadReturns(q, o.token);
  }, [open, q, o.token]);
  const backs = ret?.status === "done" ? ret.list.slice(0, 3) : [];
  return (
    <Sheet open={open} onClose={onClose} label="항공편 상세" tall>
      <div className="tb-fd">
        <h2 className="tb-fd-title">
          {o.fromId} → {o.toId} {q.ret ? "왕복" : "편도"}
        </h2>
        <LegDetail label={q.ret ? "가는 편" : "편도"} o={o} />
        {q.ret && (
          <section className="tb-fd-leg">
            <h3>
              오는 편 <span>{legDate(`${q.ret} `)}</span>
            </h3>
            {ret?.status === "loading" && <p className="tb-checking">오는 편을 찾는 중이에요</p>}
            {(!o.token || ret?.status === "fail" || (ret?.status === "done" && !backs.length)) && <p className="tb-fd-note">오는 편은 트립닷컴에서 확인해 주세요</p>}
            {backs.map((b, i) => (
              <div key={i} className="tb-fd-back">
                <div className="tb-fd-back-top">
                  <span>
                    {i === 0 ? "가장 낮은 조합" : `후보 ${i + 1}`} · {b.airlines.join(" · ")}
                  </span>
                  <PriceLines o={b} q={q} />
                </div>
                <Segments o={b} />
              </div>
            ))}
          </section>
        )}
        <section className="tb-fd-leg">
          <h3>수하물</h3>
          <p className="tb-fd-note">수하물 정보는 아직 없어요. 예약 전에 항공사나 예약 사이트에서 확인해 주세요.</p>
        </section>
      </div>
      <div className="tb-save-bar">
        <div className="tb-book-bar tb-fd-bar">
          <PriceLines o={backs[0] ?? o} q={q} />
          <a className="tb-book-bar-go" href={flightLink(q)} target="_blank" rel="noopener noreferrer">
            트립닷컴에서 보기 <IconOut />
          </a>
        </div>
      </div>
    </Sheet>
  );
}

type Sort = "ai" | "price" | "early" | "short";
const SORTS: { id: Sort; label: string }[] = [
  { id: "ai", label: "AI 추천순" },
  { id: "price", label: "낮은 가격순" },
  { id: "early", label: "이른 출발순" },
  { id: "short", label: "짧은 비행순" },
];
const md = (iso: string) => `${Number(iso.slice(5, 7))}월 ${Number(iso.slice(8, 10))}일`;
const cityOf = (label: string) => label.replace(/\s*\([A-Z]{3}\)\s*$/, "");

// 항공권 결과 목록 (v7 05와 같은 틀). AI가 먼저 본 3편이 맨 위
export function FlightBrowser({ data, aiPending, onBack, bare }: { data: FlightData; aiPending?: boolean; onBack: () => void; bare?: boolean }) {
  const { query: q, options, picks } = data;
  const [direct, setDirect] = useState(false);
  const [morning, setMorning] = useState(false);
  const [sort, setSort] = useState<Sort>("ai");
  const reason = useMemo(() => new Map(picks.map((p, i) => [options[p.n - 1], { reason: p.reason, rank: i + 1 }])), [picks, options]);
  const shown = useMemo(() => {
    const list = options.filter((o) => (!direct || !o.stops.length) && (!morning || (hourOf(o.departTime) >= 6 && hourOf(o.departTime) < 12)));
    if (sort === "early") return [...list].sort((a, b) => a.departTime.localeCompare(b.departTime));
    if (sort === "short") return [...list].sort((a, b) => a.minutes - b.minutes);
    if (sort === "ai") return [...list].sort((a, b) => (reason.get(a)?.rank ?? 99) - (reason.get(b)?.rank ?? 99) || a.price - b.price);
    return [...list].sort((a, b) => a.price - b.price);
  }, [options, direct, morning, sort, reason]);
  const low = Math.min(...options.map((o) => o.price));

  return (
    <div className="tb-results">
      {bare ? (
        <h2 className="tb-list-title">
          {cityOf(q.toLabel || q.to)} 항공편 전체 {options.length}편
        </h2>
      ) : (
      <div className="tb-results-top">
        <button type="button" className="tb-ib" onClick={onBack} aria-label="검색으로 돌아가기">
          <IconBack size={20} />
        </button>
        <button type="button" className="tb-qpill" onClick={onBack}>
          <strong>
            {q.fromLabel || q.from} → {q.toLabel || q.to}
          </strong>
          <span>
            {md(q.depart)}
            {q.ret ? ` – ${md(q.ret)} 왕복` : " 편도"} · 성인 {q.adults}
          </span>
        </button>
      </div>
      )}
      <div className="tb-chiprow">
        {SORTS.map((s) => (
          <button key={s.id} type="button" className="tb-chip" aria-pressed={sort === s.id} onClick={() => setSort(s.id)}>
            {s.label}
          </button>
        ))}
        <button type="button" className="tb-chip" aria-pressed={direct} onClick={() => setDirect((v) => !v)}>
          직항만
        </button>
        <button type="button" className="tb-chip" aria-pressed={morning} onClick={() => setMorning((v) => !v)}>
          오전 출발
        </button>
      </div>
      <p className="tb-results-note">
        항공편 {shown.length}편 · {aiPending ? "AI가 조건에 맞는 편을 살펴보는 중이에요" : `AI 추천 ${Math.min(3, picks.length)}편을 먼저 보여드려요`} · {q.adults}명 {q.ret ? "왕복" : "편도"} 총액
      </p>
      <div className="tb-rlist pad">
        {shown.map((o, i) => {
          const r = reason.get(o);
          return <FlightCard key={`${o.departTime}-${o.airlines.join()}-${o.price}-${i}`} o={o} q={q} reason={r?.reason} rank={r?.rank} tag={!r && o.price === low ? "찾은 항공편 중 가장 낮아요" : undefined} />;
        })}
        {!shown.length && <p className="tb-note">조건에 맞는 항공편이 없어요. 위의 조건을 하나 풀어 보세요.</p>}
        {q.ret && <p className="tb-note">왕복 총액이에요. 카드를 누르면 오는 편 후보와 경유·편명을 볼 수 있어요.</p>}
      </div>
    </div>
  );
}

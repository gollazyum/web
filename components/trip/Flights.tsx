"use client";

import { useMemo, useState } from "react";
import { tripUrl, type FlightOption } from "@/lib/flights";
import { hhmm, hourOf, won, type FlightQuery } from "@/lib/trip";
import { IconBack, IconOut } from "./icons";

export type FlightData = { query: FlightQuery; options: FlightOption[]; picks: { n: number; reason: string }[] };

const dur = (m: number) => (m ? `${Math.floor(m / 60)}시간${m % 60 ? ` ${m % 60}분` : ""}` : "");

export function flightLink(q: FlightQuery) {
  return tripUrl(q.from, q.to, q.depart, q.ret, q.adults);
}

// v4 10번 카드: 큰 시간 → 시간, 항공사, 인원 전체 총액
export function FlightCard({ o, q, reason, rank, tag }: { o: FlightOption; q: FlightQuery; reason?: string; rank?: number; tag?: string }) {
  return (
    <div className={`tb-fcard${reason ? " ai" : ""}`}>
      {(reason || tag) && (
        <div className="tb-fcard-band">
          {rank ? <b>{rank}</b> : null}
          {reason || tag}
        </div>
      )}
      <div className="tb-ftimes">
        <div>
          <strong>{hhmm(o.departTime)}</strong>
          <span>{o.fromId}</span>
        </div>
        <div className="tb-fline">
          <span>{dur(o.minutes)}</span>
          <i aria-hidden />
          <span>{o.stops.length ? `경유 ${o.stops.length}회 (${o.stops.join(", ")})` : "직항"}</span>
        </div>
        <div>
          <strong>{hhmm(o.arriveTime)}</strong>
          <span>{o.toId}</span>
        </div>
      </div>
      <div className="tb-fcard-foot">
        <span className="tb-fair">{o.airlines.join(" · ")}</span>
        <span className="tb-fprice">
          <small>
            {q.adults}명 {q.ret ? "왕복" : "편도"} 총액
          </small>
          <strong>{won(o.price)}</strong>
        </span>
      </div>
      <a className="tb-fbook" href={flightLink(q)} target="_blank" rel="noopener noreferrer">
        트립닷컴에서 이 날짜 보기 <IconOut />
      </a>
    </div>
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
        {q.ret && <p className="tb-note">왕복 총액이에요. 오는 편 시간은 예약 사이트에서 정해요.</p>}
      </div>
    </div>
  );
}

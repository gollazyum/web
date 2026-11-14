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
      <div className="tb-ffoot">
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

type Sort = "price" | "early" | "short";

// 찾은 항공편 전체. 휴대폰은 전체 화면 시트, PC는 오른쪽 패널
export function FlightBrowser({ data, onClose }: { data: FlightData; onClose?: () => void }) {
  const { query: q, options } = data;
  const [direct, setDirect] = useState(false);
  const [morning, setMorning] = useState(false);
  const [sort, setSort] = useState<Sort>("price");
  const shown = useMemo(() => {
    const list = options.filter((o) => (!direct || !o.stops.length) && (!morning || (hourOf(o.departTime) >= 6 && hourOf(o.departTime) < 12)));
    if (sort === "early") return [...list].sort((a, b) => a.departTime.localeCompare(b.departTime));
    if (sort === "short") return [...list].sort((a, b) => a.minutes - b.minutes);
    return [...list].sort((a, b) => a.price - b.price);
  }, [options, direct, morning, sort]);
  const low = Math.min(...options.map((o) => o.price));

  return (
    <div className="tb-browser">
      <div className="tb-browser-top">
        {onClose && (
          <button type="button" className="tb-round" onClick={onClose} aria-label="대화로 돌아가기">
            <IconBack size={20} />
          </button>
        )}
        <div className="tb-browser-title">
          <strong>
            {q.fromLabel || q.from} → {q.toLabel || q.to} · {shown.length}편
          </strong>
          <span>
            {q.depart.slice(5).replace("-", "/")}
            {q.ret ? `–${q.ret.slice(5).replace("-", "/")} 왕복` : " 편도"} · {q.adults}명 총액(세금 포함)
          </span>
        </div>
      </div>
      <div className="tb-chips scroll">
        <button type="button" className="tb-chip" aria-pressed={direct} onClick={() => setDirect((v) => !v)}>
          직항만
        </button>
        <button type="button" className="tb-chip" aria-pressed={morning} onClick={() => setMorning((v) => !v)}>
          오전 출발
        </button>
        <select className="tb-chip tb-sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="정렬">
          <option value="price">총액 낮은 순</option>
          <option value="early">출발 이른 순</option>
          <option value="short">짧은 비행 순</option>
        </select>
      </div>
      <div className="tb-hlist">
        {shown.map((o, i) => (
          <FlightCard key={`${o.departTime}-${o.airlines.join()}-${o.price}-${i}`} o={o} q={q} tag={o.price === low ? "총액이 가장 낮아요" : undefined} />
        ))}
        {!shown.length && <p className="tb-note">조건에 맞는 항공편이 없어요. 위의 조건을 하나 풀어 보세요.</p>}
        {q.ret && <p className="tb-note">왕복 총액이에요. 오는 편 시간은 예약 사이트에서 정해요.</p>}
      </div>
    </div>
  );
}

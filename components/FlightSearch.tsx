"use client";

import { useState } from "react";
import { AirportInput } from "./AirportInput";
import { ScanProgress } from "./ScanProgress";
import { codeFromText, loadAirports } from "@/lib/airports";
import { errorCode } from "@/lib/apiError";
import { aviasalesUrl, type FlightResults } from "@/lib/flights";

// 로보티 디자인 항공권 검색창. 사이트 안에서 실시간 가격을 보여 주고,
// 예약은 제휴 번호(marker)가 붙은 Aviasales 결과로 넘긴다
const SCAN_MS = 5000;

type Result =
  | { kind: "loading" }
  | { kind: "ok"; data: FlightResults; link: string }
  | { kind: "fallback"; message: string; link: string };

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// 도시 코드(SEL)는 그 도시 공항들(ICN,GMP)로 바꿔서 서버에 보낸다
async function airportsFor(code: string): Promise<string> {
  try {
    const d = await loadAirports();
    const metro = d.metros.find((m) => m[0] === code);
    if (metro) return metro[4].slice(0, 4).join(",");
  } catch {
    // 목록을 못 받으면 코드 그대로 보낸다
  }
  return code;
}

const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;

function hhmm(t: string): string {
  return t.slice(11, 16);
}

function duration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h}시간${m ? ` ${m}분` : ""}` : `${m}분`;
}

const levelText: Record<string, string> = { low: "평소보다 싼 편", typical: "평소 수준", high: "평소보다 비싼 편" };

export function FlightSearch() {
  const [origin, setOrigin] = useState({ text: "서울 모든 공항 (SEL)", code: "SEL" as string | null });
  const [destination, setDestination] = useState({ text: "", code: null as string | null });
  const [depart, setDepart] = useState("");
  const [ret, setRet] = useState("");
  const [adults, setAdults] = useState(1);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const from = origin.code ?? codeFromText(origin.text);
    const dest = destination.code ?? codeFromText(destination.text);
    if (!from) return setError("목록에서 출발지를 고르거나 공항 코드 세 글자(예: ICN)를 넣어 주세요.");
    if (!dest) return setError("목록에서 도착지를 고르거나 공항 코드 세 글자(예: NRT)를 넣어 주세요.");
    if (dest === from) return setError("출발지와 도착지가 같아요.");
    if (!depart) return setError("가는 날을 골라 주세요.");
    if (ret && ret < depart) return setError("오는 날은 가는 날 이후로 골라 주세요.");
    setError("");

    const link = aviasalesUrl(from, dest, depart, ret, adults);
    setResult({ kind: "loading" });
    try {
      const res = await fetch("/api/flights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: await airportsFor(from), to: await airportsFor(dest), depart, ret, adults }),
      });
      if (res.ok) return setResult({ kind: "ok", data: (await res.json()) as FlightResults, link });
      const message =
        res.status === 429
          ? "검색이 너무 잦아서 잠깐 쉬고 있어요. 아래에서 바로 확인해 보세요."
          : res.status === 503
            ? "실시간 가격 기능을 준비하고 있어요. 아래에서 바로 확인해 보세요."
            : `지금은 사이트 안에서 가격을 불러오지 못했어요. 아래에서 바로 확인해 보세요. (오류 ${await errorCode(res)})`;
      setResult({ kind: "fallback", message, link });
    } catch {
      setResult({ kind: "fallback", message: "연결이 불안정해요. 아래에서 바로 확인해 보세요.", link });
    }
  }

  return (
    <>
      <form onSubmit={onSubmit} className="search-card flight-card">
        <AirportInput
          label="출발"
          placeholder="어디에서 출발하세요?"
          text={origin.text}
          onChange={(text, code) => setOrigin({ text, code })}
        />
        <AirportInput
          label="도착"
          placeholder="도시나 공항 이름"
          text={destination.text}
          onChange={(text, code) => setDestination({ text, code })}
        />
        <label className="field">
          <span>가는 날</span>
          <span className="date-wrap">
            <input type="date" className={depart ? undefined : "empty"} min={today()} value={depart} onChange={(e) => setDepart(e.target.value)} required />
            {!depart && <em className="date-empty">날짜 선택</em>}
          </span>
        </label>
        <label className="field">
          <span>오는 날 · 편도는 비우기</span>
          <span className="date-wrap">
            <input type="date" className={ret ? undefined : "empty"} min={depart || today()} value={ret} onChange={(e) => setRet(e.target.value)} />
            {!ret && <em className="date-empty">날짜 선택</em>}
          </span>
        </label>
        <label className="field field-small">
          <span>성인</span>
          <select value={adults} onChange={(e) => setAdults(Number(e.target.value))}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
              <option key={n} value={n}>
                {n}명
              </option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={result?.kind === "loading"}>
          항공권 찾기
        </button>
      </form>
      {error && (
        <div className="search-result" role="status">
          <span>{error}</span>
        </div>
      )}
      {!error && result && (
        <div className="search-result ok" role="status">
          {result.kind === "loading" && (
            <ScanProgress
              ms={SCAN_MS}
              morphTo="flight"
              steps={[
                { text: "출발지·도착지·날짜 조건 읽는 중...", at: 0 },
                { text: "항공사와 예약 사이트 실시간 가격 모으는 중...", at: 0.2 },
                { text: "싼 순서로 정리하는 중...", at: 0.8 },
              ]}
            />
          )}
          {result.kind === "ok" && <FlightList data={result.data} link={result.link} roundTrip={!!ret} />}
          {result.kind === "fallback" && (
            <div className="flight-fallback">
              <span>{result.message}</span>
              <a className="flight-more" href={result.link} target="_blank" rel="noopener noreferrer sponsored">
                Aviasales에서 항공권 보기
              </a>
            </div>
          )}
        </div>
      )}
    </>
  );
}

function FlightList({ data, link, roundTrip }: { data: FlightResults; link: string; roundTrip: boolean }) {
  if (!data.options.length) {
    return (
      <div className="flight-fallback">
        <span>이 날짜에는 찾은 항공편이 없어요. 날짜를 바꾸거나 아래에서 더 넓게 찾아보세요.</span>
        <a className="flight-more" href={link} target="_blank" rel="noopener noreferrer sponsored">
          Aviasales에서 항공권 보기
        </a>
      </div>
    );
  }
  return (
    <div className="flight-results">
      <div className="flight-summary">
        {data.lowest !== null && (
          <strong>
            최저 {won(data.lowest)}
            {roundTrip ? " (왕복)" : ""}
          </strong>
        )}
        {data.level && levelText[data.level] && <span className={`flight-level ${data.level}`}>{levelText[data.level]}</span>}
        {data.typical && (
          <span className="flight-typical">
            평소 {won(data.typical[0])} ~ {won(data.typical[1])}
          </span>
        )}
      </div>
      <ul className="flight-list">
        {data.options.map((o, i) => (
          <li key={i} className="flight-row">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {o.logo ? <img src={o.logo} alt="" className="flight-logo" /> : <span className="flight-logo" />}
            <div className="flight-main">
              <strong>
                {hhmm(o.departTime)} → {hhmm(o.arriveTime)}
              </strong>
              <span>
                {o.fromId}–{o.toId} · {duration(o.minutes)} · {o.stops.length ? `${o.stops.length}회 경유 (${o.stops.join(", ")})` : "직항"}
              </span>
              <span className="flight-airline">{o.airlines.join(" · ")}</span>
            </div>
            <div className="flight-buy">
              <strong>{won(o.price)}</strong>
              <a href={link} target="_blank" rel="noopener noreferrer sponsored">
                예약하기
              </a>
            </div>
          </li>
        ))}
      </ul>
      <p className="flight-note">
        Google 항공편 검색 기준, 검색 시점 가격이에요{roundTrip ? " (왕복 총액)" : ""}. 실제 금액과 좌석은 예약 사이트에서 꼭 확인해 주세요.
      </p>
      <a className="flight-more" href={link} target="_blank" rel="noopener noreferrer sponsored">
        Aviasales에서 전체 결과 보기
      </a>
    </div>
  );
}

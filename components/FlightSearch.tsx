"use client";

import { useState } from "react";
import { AirportInput } from "./AirportInput";
import { codeFromText } from "@/lib/airports";

// 로보티 디자인 항공권 검색창. 검색하면 제휴 번호(marker)가 붙은 Aviasales 결과를 새 탭으로 연다
const MARKER = "795762";

// 2026-11-03 → 0311 (Aviasales 주소의 일월 형식)
function ddmm(date: string): string {
  const [, m, d] = date.split("-");
  return d + m;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function FlightSearch() {
  const [origin, setOrigin] = useState({ text: "서울 모든 공항 (SEL)", code: "SEL" as string | null });
  const [destination, setDestination] = useState({ text: "", code: null as string | null });
  const [depart, setDepart] = useState("");
  const [ret, setRet] = useState("");
  const [adults, setAdults] = useState(1);
  const [error, setError] = useState("");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const from = origin.code ?? codeFromText(origin.text);
    const dest = destination.code ?? codeFromText(destination.text);
    if (!from) return setError("목록에서 출발지를 고르거나 공항 코드 세 글자(예: ICN)를 넣어 주세요.");
    if (!dest) return setError("목록에서 도착지를 고르거나 공항 코드 세 글자(예: NRT)를 넣어 주세요.");
    if (dest === from) return setError("출발지와 도착지가 같아요.");
    if (!depart) return setError("가는 날을 골라 주세요.");
    if (ret && ret < depart) return setError("오는 날은 가는 날 이후로 골라 주세요.");
    setError("");

    // 예: SEL0311TYO07111 → 서울 11/3 출발, 도쿄, 11/7 귀국, 성인 1명
    const path = `${from}${ddmm(depart)}${dest}${ret ? ddmm(ret) : ""}${adults}`;
    const url = `https://www.aviasales.com/search/${path}?marker=${MARKER}&locale=ko&currency=krw`;
    window.open(url, "_blank", "noopener,noreferrer");
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
        <button type="submit">항공권 찾기</button>
      </form>
      {error && (
        <div className="search-result" role="status">
          <span>{error}</span>
        </div>
      )}
    </>
  );
}

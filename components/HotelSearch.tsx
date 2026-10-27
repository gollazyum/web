"use client";

import { useState } from "react";
import { DateRangePicker } from "./DateRangePicker";
import { PlaceInput } from "./PlaceInput";
import { ScanProgress } from "./ScanProgress";
import { errorCode } from "@/lib/apiError";
import { routes } from "@/lib/agoda";
import { addDays, daysBetween, shortLabel } from "@/lib/dates";
import { agodaSearchUrl, isAgoda, type HotelOption, type HotelPrices, type HotelQuery, type HotelResults, type HotelSource } from "@/lib/hotels";

// 도시·호텔 이름과 날짜로 찾으면 호텔마다 예약 사이트별 실시간 가격을 보여 준다.
// 아고다 가격은 로보티 제휴 링크로 보낸다
const SCAN_MS = 5000;

type Result = { kind: "loading" } | { kind: "ok"; data: HotelResults; query: HotelQuery } | { kind: "fallback"; message: string };

const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;

async function failMessage(res: Response): Promise<string> {
  if (res.status === 429) return "검색이 너무 잦아서 잠깐 쉬고 있어요. 잠시 뒤에 다시 찾아 주세요.";
  if (res.status === 503) return `실시간 호텔 가격 기능을 준비하고 있어요. 아고다 링크 ${routes.length}개 경로로 먼저 비교해 보세요.`;
  return `지금은 호텔 가격을 불러오지 못했어요. 잠시 뒤에 다시 찾아 주세요. (오류 ${await errorCode(res)})`;
}

async function postHotels(body: HotelQuery & { token?: string }): Promise<Response> {
  return fetch("/api/hotels", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

function sourceLink(s: HotelSource, hotel: string, query: HotelQuery): string {
  return isAgoda(s.name) ? agodaSearchUrl(hotel, query) : s.link;
}

export function HotelSearch() {
  const [q, setQ] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [adults, setAdults] = useState(2);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return setError("도시나 호텔 이름을 넣어 주세요. 예: 도쿄 신주쿠, 다낭 해변 호텔");
    if (!checkIn) return setError("체크인 날짜를 골라 주세요.");
    const out = checkOut && checkOut > checkIn ? checkOut : addDays(checkIn, 1);
    setCheckOut(out);
    setError("");

    const query = { q: q.trim(), checkIn, checkOut: out, adults };
    setResult({ kind: "loading" });
    try {
      const res = await postHotels(query);
      if (res.ok) return setResult({ kind: "ok", data: (await res.json()) as HotelResults, query });
      setResult({ kind: "fallback", message: await failMessage(res) });
    } catch {
      setResult({ kind: "fallback", message: "연결이 불안정해요. 잠시 뒤에 다시 찾아 주세요." });
    }
  }

  return (
    <>
      <form onSubmit={onSubmit} className="search-card hotel-card">
        <PlaceInput value={q} onChange={setQ} />
        <DateRangePicker
          start={checkIn}
          end={checkOut}
          onChange={(a, b) => {
            setCheckIn(a);
            setCheckOut(b);
          }}
          labels={["체크인", "체크아웃"]}
          prompts={["체크인 날짜를 골라 주세요", "체크아웃 날짜를 골라 주세요"]}
          endPlaceholder="1박이면 비우기"
          minGap={1}
          unit={(n) => `${n}박`}
        />
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
          호텔 가격 비교
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
              morphTo="hotel"
              steps={[
                { text: "도시·날짜·인원 조건 읽는 중...", at: 0 },
                { text: "예약 사이트별 실시간 호텔 가격 모으는 중...", at: 0.2 },
                { text: "호텔마다 가격 정리하는 중...", at: 0.8 },
              ]}
            />
          )}
          {result.kind === "ok" && <HotelList data={result.data} query={result.query} />}
          {result.kind === "fallback" && <span>{result.message}</span>}
        </div>
      )}
    </>
  );
}

function HotelList({ data, query }: { data: HotelResults; query: HotelQuery }) {
  if (!data.options.length) return <span>이 조건으로 찾은 호텔이 없어요. 도시 이름을 바꾸거나 날짜를 바꿔 보세요.</span>;
  const n = daysBetween(query.checkIn, query.checkOut);
  return (
    <div className="hotel-results">
      <div className="flight-summary">
        <strong>호텔 {data.options.length}곳</strong>
        <span className="flight-typical">
          {shortLabel(query.checkIn)} 체크인 · {n}박 · 성인 {query.adults}명 · 1박 요금 기준
        </span>
      </div>
      <ul className="hotel-list">
        {data.options.map((h) => (
          <HotelRow key={h.token} hotel={h} query={query} />
        ))}
      </ul>
      <p className="flight-note">
        Google 호텔 검색 기준, 검색 시점 가격이에요. 세금·봉사료 포함 여부와 최종 금액은 예약 사이트 결제 화면에서 꼭 확인해 주세요.
        아고다 링크는 제휴 링크라 예약 시 로보티가 수수료를 받을 수 있어요.
      </p>
    </div>
  );
}

function HotelRow({ hotel, query }: { hotel: HotelOption; query: HotelQuery }) {
  const [prices, setPrices] = useState<{ kind: "loading" } | { kind: "ok"; sources: HotelSource[] } | { kind: "error"; message: string } | null>(null);

  async function compare() {
    if (prices?.kind === "loading") return;
    if (prices?.kind === "ok") return setPrices(null); // 다시 누르면 접기
    setPrices({ kind: "loading" });
    try {
      const res = await postHotels({ ...query, token: hotel.token });
      if (!res.ok) return setPrices({ kind: "error", message: await failMessage(res) });
      const data = (await res.json()) as HotelPrices;
      setPrices({ kind: "ok", sources: data.sources });
    } catch {
      setPrices({ kind: "error", message: "연결이 불안정해요. 잠시 뒤에 다시 눌러 주세요." });
    }
  }

  const sources = prices?.kind === "ok" ? prices.sources : hotel.sources;
  return (
    <li className="hotel-row">
      <div className="hotel-top">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {hotel.image ? <img src={hotel.image} alt="" className="hotel-img" loading="lazy" /> : <span className="hotel-img" />}
        <div className="flight-main">
          <strong title={hotel.name}>{hotel.name}</strong>
          <span>
            {hotel.stars ? `${hotel.stars}성급` : "숙소"}
            {hotel.rating ? ` · ★ ${hotel.rating.toFixed(1)}` : ""}
            {hotel.reviews ? ` (${hotel.reviews.toLocaleString("ko-KR")})` : ""}
          </span>
        </div>
        <div className="flight-buy">
          {hotel.perNight !== null && <strong>{won(hotel.perNight)}~</strong>}
          <button type="button" onClick={compare} disabled={prices?.kind === "loading"}>
            {prices?.kind === "loading" ? "불러오는 중..." : prices?.kind === "ok" ? "접기" : "사이트별 가격"}
          </button>
        </div>
      </div>
      {sources.length > 0 && (
        <ul className="hotel-sources">
          {sources.map((s) => {
            const link = sourceLink(s, hotel.name, query);
            return (
              <li key={s.name}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {s.logo ? <img src={s.logo} alt="" /> : <i />}
                <span>
                  {s.name}
                  {s.official && <em> 공식</em>}
                  {isAgoda(s.name) && <em className="hotel-pick"> 로보티 추천</em>}
                </span>
                <b>{s.perNight !== null ? won(s.perNight) : "-"}</b>
                {link ? (
                  <a href={link} target="_blank" rel="noopener noreferrer sponsored">
                    보기 ↗
                  </a>
                ) : (
                  <span />
                )}
              </li>
            );
          })}
        </ul>
      )}
      {prices?.kind === "error" && <p className="flight-note">{prices.message}</p>}
    </li>
  );
}

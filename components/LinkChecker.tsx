"use client";

import { useState } from "react";
import { detectSite, site, supportedSites } from "@/lib/site";

type Result =
  | { kind: "ok"; siteName: string; nights: number | null }
  | { kind: "unknown" }
  | { kind: "invalid" }
  | { kind: "dates" };

function nightsBetween(checkIn: string, checkOut: string): number | null {
  if (!checkIn || !checkOut) return null;
  const ms = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  return Math.round(ms / 86_400_000);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

const tabs = [
  { id: "stay", label: "숙소", img: "hotel", live: true },
  { id: "flight", label: "항공권", img: "flight", live: false },
  { id: "shop", label: "쇼핑·유심", img: "shop", live: false },
];

export function LinkChecker() {
  const [url, setUrl] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [adults, setAdults] = useState(2);
  const [rooms, setRooms] = useState(1);
  const [result, setResult] = useState<Result | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^https?:\/\//i.test(url.trim())) {
      setResult({ kind: "invalid" });
      return;
    }
    const nights = nightsBetween(checkIn, checkOut);
    if (nights !== null && nights <= 0) {
      setResult({ kind: "dates" });
      return;
    }
    const siteName = detectSite(url);
    setResult(siteName ? { kind: "ok", siteName, nights } : { kind: "unknown" });
  }

  return (
    <div className="search">
      <div className="search-tabs" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={t.live}
            disabled={!t.live}
            className={`search-tab${t.live ? " active" : ""}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/brand/family/${t.img}.svg`} alt="" />
            {t.label}
            {!t.live && <span className="soon">곧 오픈</span>}
          </button>
        ))}
      </div>
      <form onSubmit={onSubmit} className="search-card">
        <label className="field field-url">
          <span>호텔 링크</span>
          <input
            type="url"
            inputMode="url"
            placeholder="보고 있던 호텔 페이지 주소를 붙여넣으세요"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
          />
        </label>
        <label className="field">
          <span>체크인</span>
          <input type="date" min={today()} value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
        </label>
        <label className="field">
          <span>체크아웃</span>
          <input type="date" min={checkIn || today()} value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
        </label>
        <label className="field field-small">
          <span>성인</span>
          <select value={adults} onChange={(e) => setAdults(Number(e.target.value))}>
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n}명
              </option>
            ))}
          </select>
        </label>
        <label className="field field-small">
          <span>객실</span>
          <select value={rooms} onChange={(e) => setRooms(Number(e.target.value))}>
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>
                {n}개
              </option>
            ))}
          </select>
        </label>
        <button type="submit">최저가 찾기</button>
      </form>

      {result && (
        <div className={`search-result${result.kind === "ok" ? " ok" : ""}`} role="status">
          {result.kind === "ok" && (
            <>
              <div className="result-head">
                <strong>{result.siteName} 호텔 링크를 확인했습니다.</strong>
                <span>
                  {result.nights ? `${result.nights}박 · ` : ""}성인 {adults}명 · 객실 {rooms}개
                </span>
              </div>
              <ul className="result-sites">
                {supportedSites.map((s) => (
                  <li key={s.name}>
                    <span>{s.name}</span>
                    <span className="muted">가격 연동 준비 중</span>
                  </li>
                ))}
              </ul>
              <p className="result-note">
                실시간 가격 비교는 예약 사이트 제휴 연동이 끝나는 대로 열립니다.
                {site.instagramUrl && (
                  <>
                    {" "}
                    <a href={site.instagramUrl} target="_blank" rel="noopener noreferrer">
                      오픈 소식 받기
                    </a>
                  </>
                )}
              </p>
            </>
          )}
          {result.kind === "unknown" && (
            <span>아직 지원하지 않는 사이트입니다. {supportedSites.map((s) => s.name).join(", ")}의 호텔 링크를 넣어 주세요.</span>
          )}
          {result.kind === "invalid" && <span>https:// 로 시작하는 호텔 페이지 주소를 넣어 주세요.</span>}
          {result.kind === "dates" && <span>체크아웃 날짜는 체크인 다음 날 이후로 선택해 주세요.</span>}
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";

// 로보티 디자인 항공권 검색창. 검색하면 제휴 번호(marker)가 붙은 Aviasales 결과를 새 탭으로 연다
const MARKER = "795762";

const origins = [
  { code: "SEL", name: "서울 (인천·김포)" },
  { code: "PUS", name: "부산 (김해)" },
  { code: "CJU", name: "제주" },
  { code: "TAE", name: "대구" },
  { code: "CJJ", name: "청주" },
  { code: "MWX", name: "무안" },
];

const destinations = [
  { code: "TYO", name: "도쿄" },
  { code: "OSA", name: "오사카" },
  { code: "FUK", name: "후쿠오카" },
  { code: "SPK", name: "삿포로" },
  { code: "OKA", name: "오키나와" },
  { code: "NGO", name: "나고야" },
  { code: "BKK", name: "방콕" },
  { code: "DAD", name: "다낭" },
  { code: "SGN", name: "호치민" },
  { code: "HAN", name: "하노이" },
  { code: "CXR", name: "나트랑" },
  { code: "PQC", name: "푸꾸옥" },
  { code: "CEB", name: "세부" },
  { code: "MNL", name: "마닐라" },
  { code: "TPE", name: "타이베이" },
  { code: "HKG", name: "홍콩" },
  { code: "MFM", name: "마카오" },
  { code: "SHA", name: "상하이" },
  { code: "BJS", name: "베이징" },
  { code: "SIN", name: "싱가포르" },
  { code: "KUL", name: "쿠알라룸푸르" },
  { code: "DPS", name: "발리" },
  { code: "GUM", name: "괌" },
  { code: "SPN", name: "사이판" },
  { code: "HNL", name: "호놀룰루" },
  { code: "SYD", name: "시드니" },
  { code: "LAX", name: "로스앤젤레스" },
  { code: "NYC", name: "뉴욕" },
  { code: "PAR", name: "파리" },
  { code: "LON", name: "런던" },
  { code: "ROM", name: "로마" },
  { code: "BCN", name: "바르셀로나" },
  { code: "IST", name: "이스탄불" },
  { code: "DXB", name: "두바이" },
];

// "도쿄 (TYO)", "도쿄", "tyo" 모두 공항 코드로 바꾼다
function toCode(input: string): string | null {
  const text = input.trim();
  const inParens = text.match(/\(([A-Za-z]{3})\)\s*$/);
  if (inParens) return inParens[1].toUpperCase();
  if (/^[A-Za-z]{3}$/.test(text)) return text.toUpperCase();
  return destinations.find((d) => d.name === text)?.code ?? null;
}

// 2026-11-03 → 0311 (Aviasales 주소의 일월 형식)
function ddmm(date: string): string {
  const [, m, d] = date.split("-");
  return d + m;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function FlightSearch() {
  const [origin, setOrigin] = useState("SEL");
  const [destination, setDestination] = useState("");
  const [depart, setDepart] = useState("");
  const [ret, setRet] = useState("");
  const [adults, setAdults] = useState(1);
  const [error, setError] = useState("");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const dest = toCode(destination);
    if (!dest) return setError("목록에서 도착지를 고르거나 공항 코드 세 글자(예: NRT)를 넣어 주세요.");
    if (dest === origin) return setError("출발지와 도착지가 같아요.");
    if (!depart) return setError("가는 날을 골라 주세요.");
    if (ret && ret < depart) return setError("오는 날은 가는 날 이후로 골라 주세요.");
    setError("");

    // 예: SEL0311TYO07111 → 서울 11/3 출발, 도쿄, 11/7 귀국, 성인 1명
    const path = `${origin}${ddmm(depart)}${dest}${ret ? ddmm(ret) : ""}${adults}`;
    const url = `https://www.aviasales.com/search/${path}?marker=${MARKER}&locale=ko&currency=krw`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <>
      <form onSubmit={onSubmit} className="search-card flight-card">
        <label className="field">
          <span>출발</span>
          <select value={origin} onChange={(e) => setOrigin(e.target.value)}>
            {origins.map((o) => (
              <option key={o.code} value={o.code}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>도착</span>
          <input
            list="flight-destinations"
            placeholder="어디로 떠나세요?"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            required
          />
          <datalist id="flight-destinations">
            {destinations.map((d) => (
              <option key={d.code} value={`${d.name} (${d.code})`} />
            ))}
          </datalist>
        </label>
        <label className="field">
          <span>가는 날</span>
          <input type="date" min={today()} value={depart} onChange={(e) => setDepart(e.target.value)} required />
        </label>
        <label className="field">
          <span>오는 날 · 편도는 비우기</span>
          <input type="date" min={depart || today()} value={ret} onChange={(e) => setRet(e.target.value)} />
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

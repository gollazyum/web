"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DateRangePicker } from "./DateRangePicker";
import { PlaceInput } from "./PlaceInput";
import { addDays } from "@/lib/dates";
import { hotelsPath, type HotelQuery } from "@/lib/hotels";

// 숙소 검색창. 찾기를 누르면 결과 페이지(/hotels?…)로 넘어가고, 그 페이지 위쪽에서도 그대로 다시 쓴다
type Props = { initial?: HotelQuery; compact?: boolean };

export function HotelSearch({ initial, compact }: Props) {
  const router = useRouter();
  const [q, setQ] = useState(initial?.q ?? "");
  const [checkIn, setCheckIn] = useState(initial?.checkIn ?? "");
  const [checkOut, setCheckOut] = useState(initial?.checkOut ?? "");
  const [adults, setAdults] = useState(initial?.adults ?? 2);
  const [error, setError] = useState("");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return setError("도시나 호텔 이름을 넣어 주세요. 예: 도쿄 신주쿠, 다낭 해변 호텔");
    if (!checkIn) return setError("체크인 날짜를 골라 주세요.");
    const out = checkOut && checkOut > checkIn ? checkOut : addDays(checkIn, 1);
    setCheckOut(out);
    setError("");
    router.push(hotelsPath({ q: q.trim(), checkIn, checkOut: out, adults }));
  }

  return (
    <>
      <form onSubmit={onSubmit} className={`search-card hotel-card${compact ? " compact" : ""}`}>
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
        <button type="submit">{compact ? "다시 검색" : "호텔 가격 비교"}</button>
      </form>
      {error && (
        <div className="search-result" role="status">
          <span>{error}</span>
        </div>
      )}
    </>
  );
}

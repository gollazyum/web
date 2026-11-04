"use client";

import { useRouter } from "next/navigation";
import { addDays, today } from "@/lib/dates";
import { hotelsPath } from "@/lib/hotels";

// 첫 화면 검색창 아래 '인기 여행지' 칩. 2026-11-04에 숙소 결과가 나오는 것을 확인한 도시만 둔다
const PLACES = ["도쿄", "오사카", "후쿠오카", "다낭", "방콕"];

// 누르면 그 도시로 숙소 검색 (2주 뒤 체크인, 2박, 성인 2명). 날짜는 누를 때 손님 기기의 오늘 날짜로 계산한다
export function PopularPlaces() {
  const router = useRouter();
  function go(q: string) {
    const checkIn = addDays(today(), 14);
    router.push(hotelsPath({ q, checkIn, checkOut: addDays(checkIn, 2), adults: 2 }));
  }
  return (
    <div className="hot-places" role="group" aria-label="인기 여행지">
      <span className="hot-places-label">인기 여행지</span>
      {PLACES.map((p) => (
        <button key={p} type="button" className="hot-chip" onClick={() => go(p)}>
          {p}
        </button>
      ))}
    </div>
  );
}

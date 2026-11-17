"use client";

import { addDays, today } from "@/lib/dates";
import { stayHref } from "@/lib/trip-url";

const PLACES = ["오사카", "후쿠오카", "도쿄", "다낭"];

// 404의 인기 여행지 4곳: 누르는 순간 기본 날짜(3주 뒤 2박, 성인 2)로 숙소 검색을 연다
export function NotFoundPlaces() {
  const go = (place: string) => {
    const t = today();
    window.location.href = stayHref({ place, checkIn: addDays(t, 21), checkOut: addDays(t, 23), adults: 2, budget: 0, taste: "" });
  };
  return (
    <div className="nf-places">
      <p>인기 여행지</p>
      <div>
        {PLACES.map((p) => (
          <button key={p} type="button" onClick={() => go(p)}>
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}

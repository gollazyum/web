"use client";

import { useEffect, useState } from "react";
import { HOME_TAB_CHANGED, PLACE_EVENT, type TabId } from "@/components/LinkChecker";

// 첫 화면 검색창 아래 '인기 여행지' 칩. 2026-11-04에 숙소 결과가 나오는 것을 확인한 도시만 둔다
const PLACES = ["도쿄", "오사카", "후쿠오카", "다낭", "방콕"];

// 누르면 바로 결과로 가지 않고, 숙소 탭에 도시를 넣은 뒤 날짜부터 묻는다 (LinkChecker가 PLACE_EVENT를 받는다).
// 휴대폰(640px 이하)에서는 숙소 탭일 때만 보인다. PC는 예전처럼 탭과 상관없이 보인다
export function PopularPlaces() {
  const [tab, setTab] = useState<TabId>("shop");
  useEffect(() => {
    const on = (e: Event) => setTab((e as CustomEvent<TabId>).detail);
    window.addEventListener(HOME_TAB_CHANGED, on);
    return () => window.removeEventListener(HOME_TAB_CHANGED, on);
  }, []);
  return (
    <div className={`hot-places${tab === "stay" ? "" : " m-off"}`} role="group" aria-label="인기 여행지">
      <span className="hot-places-label">인기 여행지</span>
      {PLACES.map((p) => (
        <button key={p} type="button" className="hot-chip" onClick={() => window.dispatchEvent(new CustomEvent(PLACE_EVENT, { detail: p }))}>
          {p}
        </button>
      ))}
    </div>
  );
}

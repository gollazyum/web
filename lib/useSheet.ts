"use client";

import { useEffect, useRef } from "react";

// 바텀시트·전체 화면 레이어 공통 동작.
// 1) 열려 있는 동안 휴대폰 '뒤로가기'를 누르면 페이지를 떠나지 않고 시트만 닫는다 (history에 한 칸 쌓아 둔다)
// 2) 뒤 페이지가 같이 스크롤되지 않게 잠근다 (iOS Safari는 딤 영역에 touch-action: none도 같이 건다)
let locks = 0;

export function useSheet(open: boolean, close: () => void) {
  const closeRef = useRef(close);
  closeRef.current = close;

  useEffect(() => {
    if (!open) return;
    const id = Math.random().toString(36).slice(2);
    // Next.js 라우터 상태(__NA 등)를 그대로 두고 표시만 더한다. 주소는 바뀌지 않는다
    window.history.pushState({ ...window.history.state, lowbotiSheet: id }, "");
    let popped = false;
    const onPop = () => {
      // 위에 겹친 다른 시트가 닫힌 경우엔 이 시트는 그대로 둔다
      if (window.history.state?.lowbotiSheet === id) return;
      popped = true;
      closeRef.current();
    };
    window.addEventListener("popstate", onPop);

    locks++;
    document.documentElement.classList.add("sheet-lock");

    return () => {
      window.removeEventListener("popstate", onPop);
      if (--locks === 0) document.documentElement.classList.remove("sheet-lock");
      // 닫기 버튼 등으로 닫았으면 쌓아 둔 한 칸을 되돌린다. 다른 페이지로 넘어간 뒤라면 건드리지 않는다
      if (!popped && window.history.state?.lowbotiSheet === id) window.history.back();
    };
  }, [open]);
}

// 휴대폰 폭(640px 이하)인지. 누르는 순간에만 확인하므로 화면 크기 상태를 따로 들고 있지 않는다
export function isPhone(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 640px)").matches;
}

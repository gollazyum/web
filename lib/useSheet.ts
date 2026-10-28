"use client";

import { useEffect, useRef, useState } from "react";

// 바텀시트·전체 화면 레이어 공통 동작.
// 1) 열려 있는 동안 휴대폰 '뒤로가기'를 누르면 페이지를 떠나지 않고 시트만 닫는다 (history에 한 칸 쌓아 둔다)
// 2) 뒤 페이지가 같이 스크롤되지 않게 잠근다 (iOS Safari는 딤 영역에 touch-action: none도 같이 건다)
let locks = 0;
// 닫으면서 history.back()을 부른 뒤 아직 되돌아오지 않았을 때. 그 사이 새 시트가 칸을 쌓으면 back이 새 칸을 지워 버린다
let pendingBack: Promise<void> | null = null;

function goBack() {
  pendingBack = new Promise((resolve) => {
    const done = () => {
      window.removeEventListener("popstate", done);
      pendingBack = null;
      resolve();
    };
    window.addEventListener("popstate", done);
  });
  window.history.back();
}

export function useSheet(open: boolean, close: () => void) {
  const closeRef = useRef(close);
  closeRef.current = close;

  useEffect(() => {
    if (!open) return;
    const id = Math.random().toString(36).slice(2);
    let popped = false;
    let pushed = false;
    let cancelled = false;
    const onPop = () => {
      // 위에 겹친 다른 시트가 닫힌 경우엔 이 시트는 그대로 둔다
      if (window.history.state?.lowbotiSheet === id) return;
      popped = true;
      closeRef.current();
    };
    const push = () => {
      if (cancelled) return;
      // Next.js 라우터 상태(__NA 등)를 그대로 두고 표시만 더한다. 주소는 바뀌지 않는다
      window.history.pushState({ ...window.history.state, lowbotiSheet: id }, "");
      window.addEventListener("popstate", onPop);
      pushed = true;
    };
    if (pendingBack) pendingBack.then(push);
    else push();

    locks++;
    document.documentElement.classList.add("sheet-lock");

    return () => {
      cancelled = true;
      window.removeEventListener("popstate", onPop);
      if (--locks === 0) document.documentElement.classList.remove("sheet-lock");
      // 닫기 버튼 등으로 닫았으면 쌓아 둔 한 칸을 되돌린다. 다른 페이지로 넘어간 뒤라면 건드리지 않는다
      if (pushed && !popped && window.history.state?.lowbotiSheet === id) goBack();
    };
  }, [open]);
}

// 휴대폰 폭(640px 이하)인지. 누르는 순간에만 확인하므로 화면 크기 상태를 따로 들고 있지 않는다
export function isPhone(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 640px)").matches;
}

// 휴대폰에서 입력칸을 누르면 그 칸을 전체 화면 검색 레이어로 펼친다 (자동완성이 키보드에 가리지 않게).
// 같은 input을 그대로 키우므로 포커스와 키보드가 유지된다. 높이는 키보드를 뺀 보이는 영역(visualViewport)에 맞춘다
export function useSearchLayer() {
  const [layer, setLayer] = useState(false);
  const [box, setBox] = useState<{ top: number; height: number } | null>(null);
  const openedAt = useRef(0);
  useSheet(layer, () => setLayer(false));

  useEffect(() => {
    if (!layer) return;
    const vv = window.visualViewport;
    const fit = () => setBox(vv ? { top: vv.offsetTop, height: vv.height } : { top: 0, height: window.innerHeight });
    fit();
    vv?.addEventListener("resize", fit);
    vv?.addEventListener("scroll", fit);
    document.documentElement.classList.add("layer-open");
    return () => {
      vv?.removeEventListener("resize", fit);
      vv?.removeEventListener("scroll", fit);
      document.documentElement.classList.remove("layer-open");
      setBox(null);
    };
  }, [layer]);

  return {
    layer,
    open: () => {
      if (!isPhone() || layer) return;
      openedAt.current = Date.now();
      setLayer(true);
    },
    close: () => setLayer(false),
    // 입력칸을 누른 그 탭이 펼쳐진 레이어의 ← 버튼에 그대로 떨어지는 것(유령 클릭)을 막는다
    backReady: () => Date.now() - openedAt.current > 400,
    style: layer && box ? ({ top: box.top, height: box.height } as React.CSSProperties) : undefined,
  };
}

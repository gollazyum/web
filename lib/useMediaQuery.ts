"use client";

import { useSyncExternalStore } from "react";

// 화면 폭 조건이 맞는지. 서버 렌더와 첫 화면에서는 false (모바일 화면 그대로)
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

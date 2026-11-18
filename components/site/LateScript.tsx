"use client";

import { useEffect } from "react";

// 첫 화면 속도에 끼지 않게, 사람이 화면을 처음 만질 때 또는 페이지 로드 6초 뒤 브라우저가 한가할 때 한 번만 붙인다
export function LateScript({ id, src, data }: { id: string; src: string; data?: Record<string, string> }) {
  useEffect(() => {
    let done = false;
    const events = ["pointerdown", "keydown", "touchstart", "scroll"] as const;
    const add = () => {
      if (done) return;
      done = true;
      events.forEach((e) => window.removeEventListener(e, add));
      if (document.getElementById(id)) return;
      const s = document.createElement("script");
      s.id = id;
      s.src = src;
      s.async = true;
      Object.entries(data ?? {}).forEach(([k, v]) => s.setAttribute(`data-${k}`, v));
      document.body.appendChild(s);
    };
    events.forEach((e) => window.addEventListener(e, add, { once: true, passive: true }));
    const idle = (fn: () => void) => (typeof window.requestIdleCallback === "function" ? window.requestIdleCallback(fn, { timeout: 3000 }) : setTimeout(fn, 0));
    const t = window.setTimeout(() => idle(add), 6000);
    return () => {
      window.clearTimeout(t);
      events.forEach((e) => window.removeEventListener(e, add));
    };
  }, [id, src, data]);
  return null;
}

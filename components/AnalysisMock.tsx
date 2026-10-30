"use client";

import { useEffect, useRef, useState } from "react";

const rows = [
  { name: "호텔 공식 사이트", w: 92, price: 286000 },
  { name: "아고다", w: 80, price: 248000, best: true },
  { name: "트립닷컴", w: 88, price: 271000 },
];
const SAVE = 38000;

const won = (n: number) => `₩${n.toLocaleString("ko-KR")}`;

// 화면에 들어오면 막대가 차오르고 아낄 금액이 올라간다
export function AnalysisMock() {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  // 첫 HTML(검색봇)에는 최종 금액을 넣고, 화면에 들어오면 0부터 올린다
  const [save, setSave] = useState(SAVE);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!shown) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setSave(SAVE);
      return;
    }
    setSave(0);
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 1200);
      setSave(Math.round(SAVE * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [shown]);

  return (
    <div ref={ref} className={`summary-mock${shown ? " shown" : ""}`} aria-hidden="true">
      <div className="summary-line">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/family/main.svg" alt="Gollazyum" />
        <span>
          <strong>아고다</strong>가 가장 싸요. 최고가보다 <strong className="save">{won(save)}</strong> 아낄 수 있어요.
        </span>
      </div>
      <span className="total-tag">세금·봉사료 포함 총액</span>
      {rows.map((r, i) => (
        <div key={r.name} className={`bar-row${r.best ? " best" : ""}`}>
          <span>
            {r.name}
            {r.best && <em className="best-badge">Smart Deal</em>}
          </span>
          <div className="bar">
            <i style={{ width: shown ? `${r.w}%` : 0, transitionDelay: `${i * 120}ms` }} />
          </div>
          <b>{won(r.price)}</b>
        </div>
      ))}
    </div>
  );
}

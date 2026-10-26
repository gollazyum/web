"use client";

import { useEffect, useRef, useState } from "react";

// 결과가 나오기 전 1.6초 동안 모찌가 돋보기로 훑으며 단계를 하나씩 끝낸다
export const SCAN_MS = 1600;
const MORPH_AT = 800; // 흰 모찌가 카테고리 모찌로 변신하는 순간

// 브랜드 키트와 같은 도형·색
const SHAPES = {
  mochi: "M12 70 C9 44 27 17 51 17 C76 17 92 41 90 67 C89 85 77 91 50 91 C24 91 13 86 12 70Z",
  house:
    "M20 86 C17 76 17 66 19 58 L9 58 Q4 58 8 53 L45 20 Q51 15 57 20 L94 53 Q98 58 93 58 L83 58 C85 66 85 76 82 86 Q80 92 72 92 H30 Q22 92 20 86Z",
  jet: "M14 58 L0 62 Q-7 64 -5 70 Q-3 74 3 73 L13 72 C15 86 26 91 50 91 C76 91 88 85 89 72 L99 73 Q105 74 107 70 Q109 64 102 62 L88 58 C86 38 74 22 60 18 L57 7 Q56 2 51 2 Q46 2 45 7 L42 18 C28 22 16 38 14 58Z",
};
const LOOKS = {
  main: { shape: SHAPES.mochi, body: "#FFFFFF", line: "#D6E2F5", width: 2, feat: "#1D4ED8", pct: "#FFFFFF", smile: "#10B981", face: "translate(-1 0)" },
  hotel: { shape: SHAPES.house, body: "#1D4ED8", line: "#1D4ED8", width: 6, feat: "#FFFFFF", pct: "#1D4ED8", smile: "#34D399", face: "translate(51 68) scale(0.92) translate(-52 -58)" },
  flight: { shape: SHAPES.jet, body: "#0EA5E9", line: "#0EA5E9", width: 6, feat: "#FFFFFF", pct: "#0EA5E9", smile: "#FDE047", face: "translate(-1 0)" },
};

function Mochi({ look }: { look: keyof typeof LOOKS }) {
  const l = LOOKS[look];
  return (
    <svg viewBox="-12 -6 124 104" aria-hidden="true">
      <path d={l.shape} fill={l.body} stroke={l.line} strokeWidth={l.width} strokeLinejoin="round" />
      <g transform={l.face}>
        <circle cx="42" cy="51" r="6.2" fill={l.feat} />
        <path d="M70.5 56.5 L76.5 62.5" stroke={l.feat} strokeWidth="5.6" strokeLinecap="round" />
        <circle cx="63" cy="49" r="10.5" fill={l.feat} />
        <path d="M66.4 44.6 L59.6 53.4" stroke={l.pct} strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="60.1" cy="46" r="1.85" fill={l.pct} />
        <circle cx="65.9" cy="52" r="1.85" fill={l.pct} />
        <path d="M37 66 Q48 76 59 66" stroke={l.smile} strokeWidth="6" fill="none" strokeLinecap="round" />
      </g>
    </svg>
  );
}

type Props = { steps: { text: string; at: number }[]; morphTo?: "hotel" | "flight" };

export function ScanProgress({ steps, morphTo }: Props) {
  const [now, setNow] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  // 휴대폰에서는 스캔 칸이 화면 아래에 걸쳐 안 보일 수 있어 화면 안으로 끌어온다
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.bottom > window.innerHeight || r.top < 0) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  useEffect(() => {
    const start = performance.now();
    let frame = 0;
    const tick = (t: number) => {
      const elapsed = t - start;
      setNow(elapsed);
      if (elapsed < SCAN_MS) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  const pct = Math.min(100, Math.round((now / SCAN_MS) * 100));
  const morphed = morphTo && now >= MORPH_AT;

  return (
    <div className="scan" ref={boxRef}>
      <div className="scan-bot" aria-hidden="true">
        <div className={`scan-rig${morphed ? " morphed" : ""}`}>
          <Mochi look={morphed ? morphTo : "main"} />
        </div>
        <span className="scan-beam" />
      </div>
      <div className="scan-body">
        <ol className="scan-steps">
          {steps.map((s, i) => {
            const end = steps[i + 1]?.at ?? SCAN_MS;
            const state = now >= end ? "done" : now >= s.at ? "doing" : "todo";
            return (
              <li key={s.text} className={state}>
                <i>{state === "done" ? "✓" : ""}</i>
                {s.text}
              </li>
            );
          })}
        </ol>
        <div className="scan-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <span style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}

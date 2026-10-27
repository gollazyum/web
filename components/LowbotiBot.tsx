"use client";

import { useEffect, useId, useRef } from "react";

// 최종 브랜드 키트 얼굴(알약 눈 + 돋보기 눈동자)을 움직일 수 있게 부위별로 나눠 그린다.
// 움직임은 globals.css의 lb-* 클래스가 맡는다. 부모에 lb-st-scan, lb-st-zoom, lb-st-sad, lb-st-ask, lb-st-sleep을 붙이면 상태가 바뀐다.
const BLUE = "#1D4ED8";
const SKY = "#0EA5E9";
const ORANGE = "#F97316";

const MOCHI = "M12 70 C9 44 27 17 51 17 C76 17 92 41 90 67 C89 85 77 91 50 91 C24 91 13 86 12 70Z";
const HOUSE =
  "M20 86 C17 76 17 66 19 58 L9 58 Q4 58 8 53 L45 20 Q51 15 57 20 L94 53 Q98 58 93 58 L83 58 C85 66 85 76 82 86 Q80 92 72 92 H30 Q22 92 20 86Z";
const JET =
  "M14 58 L0 62 Q-7 64 -5 70 Q-3 74 3 73 L13 72 C15 86 26 91 50 91 C76 91 88 85 89 72 L99 73 Q105 74 107 70 Q109 64 102 62 L88 58 C86 38 74 22 60 18 L57 7 Q56 2 51 2 Q46 2 45 7 L42 18 C28 22 16 38 14 58Z";

const BODIES = {
  main: { shape: MOCHI, color: "#FFFFFF", line: "#D6E2F5", lineWidth: 2, face: [51, 58, 1], white: true, handle: false },
  hotel: { shape: HOUSE, color: BLUE, line: BLUE, lineWidth: 6, face: [51, 68, 0.92], white: false, handle: false },
  flight: { shape: JET, color: SKY, line: SKY, lineWidth: 6, face: [51, 58, 1], white: false, handle: false },
  shop: { shape: MOCHI, color: ORANGE, line: ORANGE, lineWidth: 0, face: [51, 58, 1], white: false, handle: true },
} as const;

export type BotKind = keyof typeof BODIES;

// 최종 얼굴 비율 (키트의 "fin")
const P = { ew: 9, eh: 10.5, pw: 7.5, ph: 8, rsw: 4.4, r: 8.4, hsw: 6.4, hl: 4.5, glow: 1.2, dy: 1.5 };

type Props = {
  kind?: BotKind;
  // false면 반짝이·물음표·z 자리 없이 캐릭터만 꽉 차게 그린다
  fx?: boolean;
  className?: string;
};

export function LowbotiBot({ kind = "main", fx = true, className = "" }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const id = "lb" + useId().replace(/[^a-zA-Z0-9]/g, "");
  const b = BODIES[kind];
  const feat = b.white ? BLUE : "#FFFFFF";
  const fxColor = b.white ? BLUE : "#FDE047";
  const ex = 42, ey = 51 + P.dy, lx = 63, ly = 49 + P.dy, k = Math.SQRT1_2;
  const hx = lx + (P.r + P.rsw / 2 - 0.5) * k, hy = ly + (P.r + P.rsw / 2 - 0.5) * k;
  const [cx, cy, s] = b.face;

  // 3~6초마다 한 번씩, 가끔은 두 번 깜빡인다
  useEffect(() => {
    const el = rootRef.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let t: ReturnType<typeof setTimeout>;
    const next = () => {
      t = setTimeout(() => {
        el.classList.remove("lb-blinking", "twice");
        void el.offsetWidth;
        el.classList.add("lb-blinking");
        if (Math.random() < 0.3) el.classList.add("twice");
        next();
      }, 3000 + Math.random() * 3000);
    };
    next();
    return () => clearTimeout(t);
  }, []);

  return (
    <div ref={rootRef} className={`lb ${className}`}>
      <svg viewBox={fx ? "-14 -18 128 116" : "-12 -2 124 98"} aria-hidden="true">
        <defs>
          <filter id={id} x="-150%" y="-150%" width="400%" height="400%">
            <feGaussianBlur stdDeviation={P.glow} result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <clipPath id={`${id}c`}>
            <circle cx={lx} cy={ly} r={P.r - P.rsw / 2} />
          </clipPath>
        </defs>
        {b.handle && <path d="M34 24 V14 A17 12 0 0 1 68 14 V24" stroke={b.color} strokeWidth="5.5" fill="none" strokeLinecap="round" />}
        <path
          className="lb-body"
          d={b.shape}
          fill={b.color}
          stroke={b.lineWidth ? b.line : undefined}
          strokeWidth={b.lineWidth || undefined}
          strokeLinejoin="round"
        />
        <g transform={`translate(${cx} ${cy}) scale(${s}) translate(-52 -58)`}>
          <g className="lb-eyes">
            <rect
              className="lb-eye"
              x={ex - P.ew / 2}
              y={ey - P.eh / 2}
              width={P.ew}
              height={P.eh}
              rx={Math.min(P.ew, P.eh) / 2}
              fill={feat}
              filter={`url(#${id})`}
            />
            <g className="lb-lens">
              <path
                d={`M${hx.toFixed(2)} ${hy.toFixed(2)} L${(hx + P.hl * k).toFixed(2)} ${(hy + P.hl * k).toFixed(2)}`}
                stroke={feat}
                strokeWidth={P.hsw}
                strokeLinecap="round"
              />
              <circle cx={lx} cy={ly} r={P.r} fill="none" stroke={feat} strokeWidth={P.rsw} />
              <g clipPath={`url(#${id}c)`}>
                <path
                  className="lb-fx lb-shine"
                  d={`M${lx - 7} ${ly + 12} L${lx - 2} ${ly + 12} L${lx + 5} ${ly - 12} L${lx} ${ly - 12}Z`}
                  fill={b.white ? "#60A5FA" : "#fff"}
                />
              </g>
              <g className="lb-pmove">
                <rect
                  className="lb-pupil"
                  x={lx - P.pw / 2}
                  y={ly - P.ph / 2}
                  width={P.pw}
                  height={P.ph}
                  rx={Math.min(P.pw, P.ph) / 2}
                  fill={feat}
                  filter={`url(#${id})`}
                />
              </g>
            </g>
          </g>
        </g>
        {fx && (
          <>
            <g transform="translate(88 18)">
              <path className="lb-fx lb-spark" d="M0 -9 Q1.3 -1.3 9 0 Q1.3 1.3 0 9 Q-1.3 1.3 -9 0 Q-1.3 -1.3 0 -9Z" fill={fxColor} />
            </g>
            <text className="lb-fx lb-q" x="84" y="20" fontSize="20" fontWeight="800" fill={b.white ? BLUE : "#94A3B8"}>
              ?
            </text>
            <text className="lb-fx lb-z" x="80" y="22" fontSize="14" fontWeight="800" fill="#93C5FD">
              z
            </text>
            <text className="lb-fx lb-z lb-z2" x="88" y="12" fontSize="11" fontWeight="800" fill="#93C5FD">
              z
            </text>
          </>
        )}
      </svg>
    </div>
  );
}

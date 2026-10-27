"use client";

import { useEffect, useRef, useState } from "react";
import { LowbotiBot } from "./LowbotiBot";

// 결과가 나오기 전 잠깐 로보티가 돋보기로 쓱쓱 훑으며 단계를 하나씩 끝낸다.
// 처음엔 연출을 충분히 보여 주고, 같은 방문에서 다시 찾을 땐 짧게
export const SCAN_FIRST_MS = 2100;
export const SCAN_REPEAT_MS = 1600;
const MORPH_AT = 0.5; // 흰 로보티가 카테고리 로보티로 변신하는 순간 (전체 시간 대비)
const FOUND_AT = 0.69; // 다 찾으면 렌즈가 커지며 반짝

// at: 단계가 시작되는 때 (전체 시간 대비 0~1)
type Props = { ms: number; steps: { text: string; at: number }[]; morphTo?: "hotel" | "flight" };

export function ScanProgress({ ms, steps, morphTo }: Props) {
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
      if (elapsed < ms) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [ms]);

  const pct = Math.min(100, Math.round((now / ms) * 100));
  const morphed = morphTo && now >= MORPH_AT * ms;
  const found = now >= FOUND_AT * ms;

  return (
    <div className="scan" ref={boxRef}>
      <div className={`scan-bot ${found ? "lb-st-zoom" : "lb-st-scan"}`} aria-hidden="true">
        <div className="lb-breathe">
          <div className={`scan-rig${morphed ? " morphed" : ""}`}>
            <LowbotiBot kind={morphed ? morphTo : "main"} />
          </div>
        </div>
        <span className="scan-beam" />
      </div>
      <div className="scan-body">
        <ol className="scan-steps">
          {steps.map((s, i) => {
            const end = (steps[i + 1]?.at ?? 1) * ms;
            const state = now >= end ? "done" : now >= s.at * ms ? "doing" : "todo";
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

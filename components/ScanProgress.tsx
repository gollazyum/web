"use client";

import { useEffect, useState } from "react";

// 결과가 나오기 전 1.3초 동안 모찌가 돋보기로 훑으며 단계를 하나씩 끝낸다
export const SCAN_MS = 1300;

export function ScanProgress({ steps }: { steps: { text: string; at: number }[] }) {
  const [now, setNow] = useState(0);

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

  return (
    <div className="scan">
      <div className="scan-bot" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/family/main.svg" alt="" />
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

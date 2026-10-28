"use client";

import { useEffect, useRef, useState } from "react";
import { LowbotiBot } from "./LowbotiBot";

// 결과가 나오기 전 잠깐 로보티가 돋보기로 쓱쓱 훑으며 단계를 하나씩 끝낸다.
// 처음엔 연출을 충분히 보여 주고, 같은 방문에서 다시 찾을 땐 짧게
export const SCAN_FIRST_MS = 2100;
export const SCAN_REPEAT_MS = 1600;
const MORPH_AT = 0.5; // 흰 로보티가 카테고리 로보티로 변신하는 순간 (전체 시간 대비)
const FOUND_AT = 0.69; // 다 찾으면 렌즈가 커지며 반짝

const HOLD_AT = 0.93; // 결과를 기다리는 동안 여기서 멈춰 기다린다
const FINISH_RATE = 2.5; // 결과가 오면 남은 연출을 이만큼 빨리 감는다
const WAIT_LINE_MS = 2600; // 기다리는 동안 로보티 한마디를 바꾸는 간격

// at: 단계가 시작되는 때 (전체 시간 대비 0~1)
// onDone을 주면 결과(ready)가 올 때까지 끝 단계 앞에서 기다렸다가, 오면 남은 연출을 빨리 마치고 onDone을 부른다.
// stage는 결과 페이지에서 쓰는 큰 화면 모양
// waitLines를 주면 결과를 기다리며 멈춰 있는 동안 로보티 한마디를 돌아가며 보여 준다
type Props = {
  ms: number;
  steps: { text: string; at: number }[];
  morphTo?: "hotel" | "flight";
  ready?: boolean;
  onDone?: () => void;
  stage?: { title: string; sub: string };
  waitLines?: string[];
};

export function ScanProgress({ ms, steps, morphTo, ready = false, onDone, stage, waitLines }: Props) {
  const [now, setNow] = useState(0);
  const [line, setLine] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);

  // 휴대폰에서는 스캔 칸이 화면 아래에 걸쳐 안 보일 수 있어 화면 안으로 끌어온다
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.bottom > window.innerHeight || r.top < 0) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  const readyRef = useRef(ready);
  readyRef.current = ready;
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const waits = !!onDone;

  useEffect(() => {
    let last = performance.now();
    let elapsed = 0;
    let frame = 0;
    const tick = (t: number) => {
      const dt = t - last;
      last = t;
      if (!waits) elapsed += dt;
      else if (readyRef.current) elapsed += dt * FINISH_RATE;
      else elapsed = Math.min(elapsed + dt, HOLD_AT * ms);
      setNow(Math.min(elapsed, ms));
      if (elapsed < ms) frame = requestAnimationFrame(tick);
      else doneRef.current?.();
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [ms, waits]);

  // 멈춤 지점에 닿은 뒤 결과가 아직이면 한마디를 띄우고 차례로 바꾼다
  const holding = waits && !ready && now >= HOLD_AT * ms;
  const lineCount = waitLines?.length ?? 0;
  useEffect(() => {
    if (!holding || !lineCount) return;
    setLine((l) => (l < 0 ? 0 : l));
    const t = setInterval(() => setLine((l) => (l + 1) % lineCount), WAIT_LINE_MS);
    return () => clearInterval(t);
  }, [holding, lineCount]);

  const pct = Math.min(100, Math.round((now / ms) * 100));
  const morphed = morphTo && now >= MORPH_AT * ms;
  const found = now >= FOUND_AT * ms;

  return (
    <div className={`scan${stage ? " scan-stage" : ""}`} ref={boxRef}>
      <div className={`scan-bot ${found ? "lb-st-zoom" : "lb-st-scan"}`} aria-hidden="true">
        <div className="lb-breathe">
          <div className={`scan-rig${morphed ? " morphed" : ""}`}>
            <LowbotiBot kind={morphed ? morphTo : "main"} />
          </div>
        </div>
        <span className="scan-beam" />
      </div>
      <div className="scan-body">
        {stage && (
          <div className="scan-title">
            <strong>{stage.title}</strong>
            <span>{stage.sub}</span>
          </div>
        )}
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
        {waitLines && line >= 0 && !ready && (
          <p key={line} className="scan-wait" role="status">
            {waitLines[line]}
          </p>
        )}
      </div>
    </div>
  );
}

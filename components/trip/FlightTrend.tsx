"use client";

import { useState } from "react";
import { won } from "@/lib/trip";

// 항공 결과 위 '가격 흐름' 카드. 검색 응답에 가격 정보(수준·평소 가격대·흐름)가 실제로 온 노선에서만 보인다.
// 새 검색은 하지 않는다 (이미 받은 응답만 쓴다)
export type FlightInsights = { level: string | null; typical: [number, number] | null; history?: [number, number][] | null };

const LEVEL: Record<string, string> = {
  low: "평소 가격대보다 낮은 편이에요",
  typical: "평소 수준이에요",
  high: "평소 가격대보다 높은 편이에요",
};

const md = (sec: number) => {
  const d = new Date(sec * 1000 + 9 * 3_600_000);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
};
const man = (n: number) => `${(Math.round(n / 1000) / 10).toLocaleString("ko-KR")}만`;

export function hasInsights(i: FlightInsights | undefined): i is FlightInsights {
  return !!i && (!!(i.level && LEVEL[i.level]) || !!i.typical || (i.history?.length ?? 0) >= 2);
}

export function FlightTrend({ insights, low, pax, round }: { insights: FlightInsights | undefined; low: number; pax: number; round: boolean }) {
  const [hover, setHover] = useState<number | null>(null);
  if (!hasInsights(insights)) return null;
  const { level, typical } = insights;
  // 선 끝점은 이번 검색의 가장 낮은 총액(목록에 실제로 있는 값). 지난 12시간 안의 예전 점은 이번 값으로 바꾼다
  const nowSec = Math.floor(Date.now() / 1000);
  const past = (insights.history ?? []).filter((p) => p[0] < nowSec - 12 * 3600);
  const hist: [number, number][] | null = past.length >= 1 ? [...past, [nowSec, low]] : null;
  const word = level ? LEVEL[level] : null;

  // 차트 (가로 320 x 세로 96, 왼쪽에 금액 눈금 자리)
  const W = 320;
  const H = 96;
  const L = 36;
  const T = 8;
  const B = 18;
  let chart: React.ReactNode = null;
  if (hist) {
    const prices = hist.map((p) => p[1]);
    const lo = Math.min(...prices, ...(typical ? [typical[0]] : []));
    const hi = Math.max(...prices, ...(typical ? [typical[1]] : []));
    const span = Math.max(1, hi - lo);
    const x = (i: number) => L + (i / (hist.length - 1)) * (W - L - 4);
    const y = (v: number) => T + (1 - (v - lo) / span) * (H - T - B);
    const d = hist.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p[1]).toFixed(1)}`).join(" ");
    const h = hover !== null ? hist[hover] : null;
    chart = (
      <div className="tb-ftrend-chart">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`최근 ${hist.length}개 시점 가격 흐름, 가장 낮을 때 ${won(Math.min(...prices))}, 가장 높을 때 ${won(Math.max(...prices))}`}
          onPointerMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            const px = ((e.clientX - r.left) / r.width) * W;
            setHover(Math.max(0, Math.min(hist.length - 1, Math.round(((px - L) / (W - L - 4)) * (hist.length - 1)))));
          }}
          onPointerLeave={() => setHover(null)}
        >
          {typical && <rect x={L} width={W - L - 4} y={y(typical[1])} height={Math.max(2, y(typical[0]) - y(typical[1]))} className="band" />}
          <line x1={L} x2={W - 4} y1={H - B} y2={H - B} className="axis" />
          <text x={L - 4} y={y(hi) + 4} className="tick" textAnchor="end">
            {man(hi)}
          </text>
          <text x={L - 4} y={y(lo) + 4} className="tick" textAnchor="end">
            {man(lo)}
          </text>
          <text x={L} y={H - 4} className="tick">
            {md(hist[0][0])}
          </text>
          <text x={W - 4} y={H - 4} className="tick" textAnchor="end">
            {md(hist[hist.length - 1][0])}
          </text>
          <path d={d} className="line" />
          <circle cx={x(hist.length - 1)} cy={y(hist[hist.length - 1][1])} r={4} className="dot" />
          {h && hover !== null && (
            <>
              <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} className="cross" />
              <circle cx={x(hover)} cy={y(h[1])} r={4} className="dot" />
            </>
          )}
        </svg>
        <p className="tb-ftrend-tip" aria-live="polite">
          {h ? (
            <>
              {md(h[0])} · <b>{won(h[1])}</b>
            </>
          ) : (
            <>선을 누르거나 손가락을 대면 날짜별 가격이 보여요</>
          )}
        </p>
      </div>
    );
  }

  return (
    <section className="tb-ftrend" aria-label="가격 흐름">
      <div className="tb-ftrend-head">
        <h2>가격 흐름</h2>
        {word && <em className={`tb-ftrend-badge ${level}`}>{word}</em>}
      </div>
      <p className="tb-ftrend-sub">
        지금 찾은 가장 낮은 {round ? "왕복" : "편도"} 총액 <b>{won(low)}</b>
        {typical ? (
          <>
            {" "}
            · 평소 가격대 {won(typical[0])}–{won(typical[1])}
          </>
        ) : null}
        <small> ({pax}명 기준)</small>
      </p>
      {chart}
      <p className="tb-note">과거 추세 기반 참고용 추정 정보예요. 앞으로 오르거나 내린다는 뜻은 아니에요.</p>
    </section>
  );
}

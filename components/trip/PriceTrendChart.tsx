// 가격 추이 선 그래프 (SVG, 외부 라이브러리 없음). 홈 히어로 카드·숙소 상세 '담을 때부터 지금까지'에서 같이 쓴다.
// - base: 기준 금액(예약한 총액·찜할 때 총액) → 점선 가로줄
// - points: 시간 순 금액. 네이비 실선, 마지막 점이 기준보다 낮으면 초록 점
// - 가로축 양 끝 글자: startLabel ~ endLabel
export type TrendPoint = { t: number; v: number };

type Props = {
  points: TrendPoint[];
  base?: number | null;
  startLabel: string;
  endLabel: string;
  height?: number;
  label: string; // 화면 읽기 도구용 설명 (예: "예약한 총액 342,000원에서 지금 298,000원으로 내려간 추이")
};

const W = 320;

export function PriceTrendChart({ points, base, startLabel, endLabel, height = 96, label }: Props) {
  if (points.length < 2) return null;
  const H = height;
  const padX = 6;
  const padTop = 10;
  const padBottom = 10;
  const vals = [...points.map((p) => p.v), ...(base ? [base] : [])];
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  if (hi === lo) {
    hi += 1;
    lo -= 1;
  }
  const t0 = points[0].t;
  const t1 = points[points.length - 1].t;
  const x = (t: number) => padX + ((t - t0) / Math.max(1, t1 - t0)) * (W - padX * 2);
  const y = (v: number) => padTop + (1 - (v - lo) / (hi - lo)) * (H - padTop - padBottom);
  const d = points.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)} ${y(p.v).toFixed(1)}`).join(" ");
  const last = points[points.length - 1];
  const down = base ? last.v < base : last.v < points[0].v;
  return (
    <figure className="tb-trend">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" role="img" aria-label={label}>
        {base ? <line x1={padX} x2={W - padX} y1={y(base)} y2={y(base)} className="tb-trend-base" vectorEffect="non-scaling-stroke" /> : null}
        <path d={d} className="tb-trend-line" fill="none" vectorEffect="non-scaling-stroke" />
      </svg>
      {/* 끝 점은 SVG 밖에 그려 가로로 늘어나도 동그랗게 */}
      <i
        className={`tb-trend-dot${down ? " down" : ""}`}
        style={{ left: `${(x(last.t) / W) * 100}%`, top: `${y(last.v)}px` }}
        aria-hidden
      />
      <figcaption>
        <span>{startLabel}</span>
        <span>{endLabel}</span>
      </figcaption>
    </figure>
  );
}

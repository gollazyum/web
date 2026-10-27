"use client";

// 두 손잡이 가격 범위. 같은 자리에 겹친 range 입력 두 개로 최소·최대를 고른다
type Props = {
  min: number;
  max: number;
  step: number;
  value: [number, number];
  onChange: (v: [number, number]) => void;
  format: (n: number) => string;
};

export function PriceRange({ min, max, step, value, onChange, format }: Props) {
  const [lo, hi] = value;
  const pct = (n: number) => ((n - min) / (max - min || 1)) * 100;
  return (
    <div className="price-range">
      <div className="price-range-values">
        <span>
          <small>최소</small>
          {format(lo)}
        </span>
        <span>
          <small>최대</small>
          {format(hi)}
          {hi === max ? "+" : ""}
        </span>
      </div>
      <div className="price-range-track">
        <i style={{ left: `${pct(lo)}%`, right: `${100 - pct(hi)}%` }} />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={lo}
          aria-label="최소 가격"
          onChange={(e) => onChange([Math.min(Number(e.target.value), hi - step), hi])}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={hi}
          aria-label="최대 가격"
          onChange={(e) => onChange([lo, Math.max(Number(e.target.value), lo + step)])}
        />
      </div>
    </div>
  );
}

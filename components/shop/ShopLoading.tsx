"use client";

import { useEffect, useState } from "react";

// 불러오는 동안: 검색어, 단계 문구, 스켈레톤 줄. 낭독기가 읽도록 role="status"
export function ShopLoading({ query, steps, rows = 4 }: { query: string; steps: string[]; rows?: number }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (steps.length < 2) return;
    const t = setInterval(() => setI((n) => Math.min(n + 1, steps.length - 1)), 1600);
    return () => clearInterval(t);
  }, [steps.length]);
  return (
    <div className="pd-loading">
      <p className="pd-loading-text" role="status" aria-live="polite">
        <span className="pd-loading-q">“{query}”</span>
        <span>{steps[i]}</span>
      </p>
      <ul className="pd-skeleton" aria-hidden="true">
        {Array.from({ length: rows }, (_, k) => (
          <li key={k}>
            <i className="pd-sk-box" />
            <span>
              <i className="pd-sk-line" />
              <i className="pd-sk-line short" />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

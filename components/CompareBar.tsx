"use client";

import type { CompareItem } from "@/lib/lowbotiStore";
import { hotelNameKo } from "@/lib/hotelText";

// 호텔 결과 화면 아래에 떠 있는 비교함 바. 담은 호텔 사진(최대 3곳)과 빼기(×),
// 2곳 이상이면 '로보티에게 n곳 비교 맡기기'. 다른 날짜에 담은 호텔은 '날짜가 달라요'를 붙이고 비교할 때 지금 날짜로 가격을 다시 받는다
type Item = CompareItem & { otherDates: boolean };

export function CompareBar({ items, onRemove, onCompare }: { items: Item[]; onRemove: (token: string) => void; onCompare: () => void }) {
  if (!items.length) return null;
  const ready = items.length >= 2;
  return (
    <div className="compare-bar" role="region" aria-label="비교함">
      <ul className="compare-bar-list">
        {items.map((h) => (
          <li key={h.token} title={hotelNameKo(h.name)}>
            {h.thumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={h.thumbnail} alt="" />
            ) : (
              <span className="compare-bar-noimg" aria-hidden="true" />
            )}
            <span className="compare-bar-name">{hotelNameKo(h.name)}</span>
            {h.otherDates && <em className="compare-bar-dates">날짜가 달라요</em>}
            <button type="button" className="compare-bar-x" onClick={() => onRemove(h.token)} aria-label={`${hotelNameKo(h.name)} 비교함에서 빼기`}>
              ×
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="compare-bar-go" onClick={onCompare} disabled={!ready}>
        {ready ? `로보티에게 ${items.length}곳 비교 맡기기 ✨` : "1곳 더 담으면 비교할 수 있어요"}
      </button>
    </div>
  );
}

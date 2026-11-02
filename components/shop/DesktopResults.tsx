"use client";

import { useMemo, useState } from "react";
import { SHOP_RESULTS_COPY as COPY } from "@/lib/brand-mode";
import {
  PRICE_BANDS,
  filterItems,
  itemKey,
  lowestItem,
  priceBandCounts,
  sellerOptions,
  sortItems,
  type PriceBand,
  type SortKey,
} from "@/lib/shop-results";
import { detailHref, won, type SearchItem } from "@/lib/shopping";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "default", label: COPY.sortDefault },
  { key: "low", label: COPY.sortLow },
  { key: "high", label: COPY.sortHigh },
];

const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

// 쇼핑 검색 결과 PC(1024px 이상) 화면: 2줄 헤더, 정렬 탭, 필터 칩, 세로형 카드 그리드
export function DesktopResults({ query, items, sample }: { query: string; items: SearchItem[]; sample: boolean }) {
  const [sort, setSort] = useState<SortKey>("default");
  const [bands, setBands] = useState<PriceBand[]>([]);
  const [sellers, setSellers] = useState<string[]>([]);

  const counts = useMemo(() => priceBandCounts(items), [items]);
  const sellerChips = useMemo(() => sellerOptions(items), [items]);
  const lowest = useMemo(() => lowestItem(items), [items]);
  const shown = useMemo(() => sortItems(filterItems(items, bands, sellers), sort), [items, bands, sellers, sort]);

  const filtered = bands.length > 0 || sellers.length > 0;
  const reset = () => {
    setBands([]);
    setSellers([]);
  };

  return (
    <div className="srd">
      <header className="srd-head">
        <h1 className="srd-title">
          “{query}” 상품 {shown.length}개{filtered && <span className="srd-total"> (전체 {items.length}개 중)</span>}
          {sample && <span className="pd-sample">개발용 예시 데이터</span>}
        </h1>
        <p className="srd-guide">{COPY.guide}</p>
      </header>

      <div className="srd-sort" role="tablist" aria-label="정렬">
        {SORTS.map((s) => (
          <button
            key={s.key}
            type="button"
            role="tab"
            aria-selected={sort === s.key}
            className={`srd-sort-tab${sort === s.key ? " on" : ""}`}
            onClick={() => setSort(s.key)}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="srd-filters">
        <div className="srd-chip-row" role="group" aria-label="가격대">
          <span className="srd-chip-label">가격대</span>
          {PRICE_BANDS.map((b) => (
            <button
              key={b.key}
              type="button"
              aria-pressed={bands.includes(b.key)}
              className={`srd-chip${bands.includes(b.key) ? " on" : ""}`}
              onClick={() => setBands((v) => toggle(v, b.key))}
            >
              {b.label} ({counts[b.key]})
            </button>
          ))}
        </div>
        {sellerChips.length > 0 && (
          <div className="srd-chip-row" role="group" aria-label="판매처">
            <span className="srd-chip-label">판매처</span>
            {sellerChips.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={sellers.includes(s)}
                className={`srd-chip${sellers.includes(s) ? " on" : ""}`}
                onClick={() => setSellers((v) => toggle(v, s))}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {shown.length === 0 ? (
        <div className="srd-empty">
          <p>{COPY.emptyFiltered}</p>
          <button type="button" className="srd-reset" onClick={reset}>
            {COPY.resetFilters}
          </button>
        </div>
      ) : (
        <ul className="srd-grid">
          {shown.map((item) => (
            <li key={itemKey(item)}>
              <a className="srd-card" href={detailHref(query, item)}>
                <span className="srd-thumb">
                  {item.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.image} alt="" referrerPolicy="no-referrer" loading="lazy" />
                  ) : (
                    <span aria-hidden="true">🛍️</span>
                  )}
                  {lowest === item && <span className="srd-badge">{COPY.lowestBadge}</span>}
                </span>
                <strong className="srd-name">{item.title}</strong>
                {item.price !== null && <b className="srd-price">{won(item.price)}</b>}
                {item.seller && <span className="srd-seller">{item.seller}</span>}
                <StoreCount count={item.storeCount} />
                <span className="srd-cta">{COPY.cardCta}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// 판매처 수 데이터가 있을 때만 보여 준다. 지금은 받는 데이터가 없어 그려지지 않는다
export function StoreCount({ count }: { count?: number | null }) {
  if (typeof count !== "number" || !Number.isFinite(count) || count < 1) return null;
  return <span className="srd-stores">{COPY.storeCount(Math.floor(count))}</span>;
}

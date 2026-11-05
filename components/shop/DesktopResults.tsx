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
import { splitMain } from "@/lib/shop-match";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "default", label: COPY.sortDefault },
  { key: "low", label: COPY.sortLow },
  { key: "high", label: COPY.sortHigh },
];

const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

// 쇼핑 검색 결과 PC(1024px 이상) 화면: 2줄 헤더, 정렬 탭, 필터 칩, 세로형 카드 그리드
export function DesktopResults({ query, items, sample, recentKey = "" }: { query: string; items: SearchItem[]; sample: boolean; recentKey?: string }) {
  const [sort, setSort] = useState<SortKey>("default");
  const [bands, setBands] = useState<PriceBand[]>([]);
  const [sellers, setSellers] = useState<string[]>([]);
  // '본품만'은 기본으로 켠다. 끄면 액세서리(케이스·필름 등)가 그리드 아래 '관련 액세서리' 묶음으로 보인다
  const [mainOnly, setMainOnly] = useState(true);

  const { main, accessories } = useMemo(() => splitMain(items), [items]);
  const visible = mainOnly ? main : items;
  const counts = useMemo(() => priceBandCounts(visible), [visible]);
  const sellerChips = useMemo(() => sellerOptions(visible), [visible]);
  // '가장 낮은 가격' 배지는 본품 중에서만 정한다 (케이스 같은 액세서리가 차지하지 않게)
  const lowest = useMemo(() => lowestItem(main), [main]);
  const shown = useMemo(() => sortItems(filterItems(main, bands, sellers), sort), [main, bands, sellers, sort]);
  const shownAcc = useMemo(() => (mainOnly ? [] : sortItems(filterItems(accessories, bands, sellers), sort)), [accessories, mainOnly, bands, sellers, sort]);
  const total = shown.length + shownAcc.length;

  const filtered = total !== items.length;
  const reset = () => {
    setBands([]);
    setSellers([]);
    setMainOnly(false);
  };

  const card = (item: SearchItem) => (
    <li key={itemKey(item)}>
      <a className={`srd-card${recentKey === itemKey(item) ? " sr-recent" : ""}`} href={detailHref(query, item)} data-key={itemKey(item)}>
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
        {item.price !== null && (
          <b className="srd-price">
            {won(item.price)}
            {item.priceFrom && COPY.priceFrom}
          </b>
        )}
        {!item.storeCount && item.seller && <span className="srd-seller">{item.seller}</span>}
        <StoreCount count={item.storeCount} />
        {item.optionCount ? <span className="srd-stores">{COPY.optionCount(item.optionCount)}</span> : null}
        <span className="srd-cta">{COPY.cardCta}</span>
      </a>
    </li>
  );

  return (
    <div className="srd">
      <header className="srd-head">
        <h1 className="srd-title">
          “{query}” 상품 {total}개{filtered && <span className="srd-total"> (전체 {items.length}개 중)</span>}
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
        {accessories.length > 0 && (
          <div className="srd-chip-row" role="group" aria-label="보기">
            <span className="srd-chip-label">보기</span>
            <button type="button" aria-pressed={mainOnly} className={`srd-chip${mainOnly ? " on" : ""}`} onClick={() => setMainOnly((v) => !v)}>
              {COPY.mainOnlyChip}
            </button>
          </div>
        )}
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

      {total === 0 ? (
        <div className="srd-empty">
          <p>{COPY.emptyFiltered}</p>
          <button type="button" className="srd-reset" onClick={reset}>
            {COPY.resetFilters}
          </button>
        </div>
      ) : (
        <>
          {shown.length > 0 && <ul className="srd-grid">{shown.map(card)}</ul>}
          {shownAcc.length > 0 && (
            <section className="srd-acc" aria-labelledby="srd-acc-title">
              <h2 id="srd-acc-title" className="srd-acc-title">
                {COPY.accessoryGroup} {shownAcc.length}개
              </h2>
              <ul className="srd-grid">{shownAcc.map(card)}</ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

// 판매처 수: 같은 상품으로 묶인 카드에 판매처가 2곳 이상일 때만 보여 준다
export function StoreCount({ count }: { count?: number | null }) {
  if (typeof count !== "number" || !Number.isFinite(count) || count < 1) return null;
  return <span className="srd-stores">{COPY.storeCount(Math.floor(count))}</span>;
}

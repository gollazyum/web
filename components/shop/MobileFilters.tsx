"use client";

import { useMemo, useState } from "react";
import { SHOP_RESULTS_COPY as COPY } from "@/lib/brand-mode";
import { PRICE_BANDS, priceBandCounts, sellerOptions, type PriceBand, type SortKey } from "@/lib/shop-results";
import type { SearchItem } from "@/lib/shopping";

export type MobileFilter = { sort: SortKey; bands: PriceBand[]; sellers: string[]; main: boolean };
// 기본 정렬은 관련도순(검색 결과 순서). '낮은 가격순'이 기본이면 '에어팟 프로 2'의 첫 10개가 모두 케이스였다
export const DEFAULT_MOBILE_FILTER: MobileFilter = { sort: "default", bands: [], sellers: [], main: false };

const SORTS: { key: SortKey; label: string }[] = [
  { key: "default", label: COPY.sortDefault },
  { key: "low", label: COPY.sortLow },
  { key: "high", label: COPY.sortHigh },
];

type Menu = "sort" | "band" | "seller" | null;
const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

// 모바일(640px 이하) 검색창 아래 정렬·필터 칩 줄. 가로로 스크롤되고, ▾ 칩의 옵션은 칩 줄 아래에 인라인으로 펼친다
export function MobileFilters({ items, value, onChange }: { items: SearchItem[]; value: MobileFilter; onChange: (v: MobileFilter) => void }) {
  const [menu, setMenu] = useState<Menu>(null);
  const counts = useMemo(() => priceBandCounts(items), [items]);
  const sellers = useMemo(() => sellerOptions(items), [items]);
  const set = (patch: Partial<MobileFilter>) => onChange({ ...value, ...patch });
  const open = (m: Exclude<Menu, null>) => setMenu((cur) => (cur === m ? null : m));
  const sortLabel = SORTS.find((s) => s.key === value.sort)?.label ?? COPY.sortDefault;
  const bandLabel = (k: PriceBand) => PRICE_BANDS.find((b) => b.key === k)!.label;

  return (
    <div className="mf">
      <div className="mf-row" role="toolbar" aria-label="정렬과 필터">
        <button type="button" className={`mf-chip${menu === "sort" ? " open" : ""}`} aria-expanded={menu === "sort"} onClick={() => open("sort")}>
          정렬: {sortLabel} ▾
        </button>
        <button
          type="button"
          className={`mf-chip${value.bands.length ? " on" : ""}${menu === "band" ? " open" : ""}`}
          aria-expanded={menu === "band"}
          onClick={() => open("band")}
        >
          가격대{value.bands.length ? ` ${value.bands.length}` : ""} ▾
        </button>
        {sellers.length > 0 && (
          <button
            type="button"
            className={`mf-chip${value.sellers.length ? " on" : ""}${menu === "seller" ? " open" : ""}`}
            aria-expanded={menu === "seller"}
            onClick={() => open("seller")}
          >
            판매처{value.sellers.length ? ` ${value.sellers.length}` : ""} ▾
          </button>
        )}
        <button
          type="button"
          className={`mf-chip${value.main ? " on" : ""}`}
          aria-pressed={value.main}
          aria-label={value.main ? "본품만 끄기" : "본품만"}
          onClick={() => set({ main: !value.main })}
        >
          본품만{value.main && <span className="mf-x" aria-hidden="true">✕</span>}
        </button>
        {value.bands.map((b) => (
          <button key={b} type="button" className="mf-chip on" aria-label={`${bandLabel(b)} 끄기`} onClick={() => set({ bands: value.bands.filter((x) => x !== b) })}>
            {bandLabel(b)}
            <span className="mf-x" aria-hidden="true">✕</span>
          </button>
        ))}
        {value.sellers.map((s) => (
          <button key={s} type="button" className="mf-chip on" aria-label={`${s} 끄기`} onClick={() => set({ sellers: value.sellers.filter((x) => x !== s) })}>
            {s}
            <span className="mf-x" aria-hidden="true">✕</span>
          </button>
        ))}
      </div>

      {menu && (
        <div className="mf-panel" role="group" aria-label={menu === "sort" ? "정렬" : menu === "band" ? "가격대" : "판매처"}>
          {menu === "sort" &&
            SORTS.map((s) => (
              <button
                key={s.key}
                type="button"
                className={`mf-opt${value.sort === s.key ? " on" : ""}`}
                aria-pressed={value.sort === s.key}
                onClick={() => {
                  set({ sort: s.key });
                  setMenu(null);
                }}
              >
                {s.label}
              </button>
            ))}
          {menu === "band" &&
            PRICE_BANDS.map((b) => (
              <button
                key={b.key}
                type="button"
                className={`mf-opt${value.bands.includes(b.key) ? " on" : ""}`}
                aria-pressed={value.bands.includes(b.key)}
                onClick={() => set({ bands: toggle(value.bands, b.key) })}
              >
                {b.label} ({counts[b.key]})
              </button>
            ))}
          {menu === "seller" &&
            sellers.map((s) => (
              <button
                key={s}
                type="button"
                className={`mf-opt${value.sellers.includes(s) ? " on" : ""}`}
                aria-pressed={value.sellers.includes(s)}
                onClick={() => set({ sellers: toggle(value.sellers, s) })}
              >
                {s}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

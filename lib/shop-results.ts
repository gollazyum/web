// 쇼핑 검색 결과 PC 화면의 정렬·필터. 이미 받은 목록만 다루고 API는 다시 부르지 않는다
import type { SearchItem } from "@/lib/shopping";

export type SortKey = "default" | "low" | "high";

export type PriceBand = "under30k" | "30to50k" | "over50k";
export const PRICE_BANDS: { key: PriceBand; label: string }[] = [
  { key: "under30k", label: "3만원 미만" },
  { key: "30to50k", label: "3~5만원" },
  { key: "over50k", label: "5만원 이상" },
];

export const MAX_SELLER_CHIPS = 8;

export function priceBand(price: number | null): PriceBand | null {
  if (price === null || !(price > 0)) return null;
  if (price < 30_000) return "under30k";
  if (price < 50_000) return "30to50k";
  return "over50k";
}

// 가격대별 상품 수 (가격을 모르는 상품은 어느 칸에도 넣지 않는다)
export function priceBandCounts(items: SearchItem[]): Record<PriceBand, number> {
  const counts: Record<PriceBand, number> = { under30k: 0, "30to50k": 0, over50k: 0 };
  for (const it of items) {
    const b = priceBand(it.price);
    if (b) counts[b]++;
  }
  return counts;
}

// 결과에 나온 판매처 이름. 중복을 빼고 처음 나온 순서로 최대 8개
export function sellerOptions(items: SearchItem[], max = MAX_SELLER_CHIPS): string[] {
  const seen: string[] = [];
  for (const it of items) {
    const s = it.seller?.trim();
    if (s && !seen.includes(s)) seen.push(s);
    if (seen.length >= max) break;
  }
  return seen;
}

// 같은 묶음 안에서는 OR, 가격대와 판매처 묶음끼리는 AND
export function filterItems(items: SearchItem[], bands: PriceBand[], sellers: string[]): SearchItem[] {
  return items.filter((it) => {
    if (bands.length) {
      const b = priceBand(it.price);
      if (!b || !bands.includes(b)) return false;
    }
    if (sellers.length && !sellers.includes(it.seller?.trim() ?? "")) return false;
    return true;
  });
}

// 추천순은 받은 순서 그대로. 가격순은 가격을 모르는 상품을 맨 뒤로 보낸다
export function sortItems(items: SearchItem[], sort: SortKey): SearchItem[] {
  if (sort === "default") return items;
  const dir = sort === "low" ? 1 : -1;
  return items
    .map((it, i) => ({ it, i }))
    .sort((a, b) => {
      const pa = a.it.price !== null && a.it.price > 0 ? a.it.price : null;
      const pb = b.it.price !== null && b.it.price > 0 ? b.it.price : null;
      if (pa === null && pb === null) return a.i - b.i;
      if (pa === null) return 1;
      if (pb === null) return -1;
      return (pa - pb) * dir || a.i - b.i;
    })
    .map((x) => x.it);
}

// 검색 결과 전체에서 가격이 가장 낮은 상품 하나 (같으면 먼저 나온 것)
export function lowestItem(items: SearchItem[]): SearchItem | null {
  let best: SearchItem | null = null;
  for (const it of items) if (it.price !== null && it.price > 0 && (!best || it.price < best.price!)) best = it;
  return best;
}

export const itemKey = (it: Pick<SearchItem, "token" | "productId" | "title">) => it.token || it.productId || it.title;

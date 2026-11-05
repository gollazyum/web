// 쇼핑 검색 결과 PC 화면의 정렬·필터. 이미 받은 목록만 다루고 API는 다시 부르지 않는다
import type { SearchItem } from "@/lib/shopping";
import { classifyItems, matchOrder } from "@/lib/shop-match";

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

// 관련도순은 받은 순서 그대로. 가격순은 가격을 모르는 상품을 맨 뒤로 보낸다
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

// ───────── '본품만'과 관련도순 ─────────
// 판별 규칙(검색어 정리, 액세서리 단어, 가격 중앙값 30%)은 lib/shop-match.ts 한 곳에 둔다
export { ACCESSORY_TERMS, MAIN_PRICE_RATIO, medianPrice } from "@/lib/shop-match";

// 관련도순(기본 정렬): 낱말이 모두 맞는 본품 → 일부만 맞는 본품 → 액세서리. 빼는 상품은 없다
export function relevanceOrder<T extends Pick<SearchItem, "title" | "price">>(items: T[], query: string): T[] {
  return matchOrder(items, query);
}

// 본품만 남긴다 (액세서리 단어가 있거나 본품 가격 중앙값의 30%보다 싼 상품을 뺀다)
export function mainOnly<T extends Pick<SearchItem, "title" | "price">>(items: T[], query: string): T[] {
  const info = classifyItems(items, query);
  return items.filter((_, i) => !info[i].accessory);
}

// ───────── 링크 붙여넣기 (아직 지원 전) ─────────
export const LINK_PASTE_HINT = "지금은 상품 이름으로 찾아요 · 링크 붙여넣기는 준비 중이에요";
// 검색어가 스토어 상품 주소처럼 보이는지 (http 주소, www., 주요 스토어 도메인)
export function looksLikeUrl(s: string): boolean {
  const t = s.trim();
  return /^(https?:\/\/|www\.)/i.test(t) || /(^|[\s./])(coupang\.com|coupa\.ng|naver\.com|naver\.me|gmarket\.co\.kr|11st\.co\.kr)(\/|$|\s)/i.test(t);
}

// ───────── 검색어와 상품명의 관련도 ─────────
// 엉뚱한 검색어가 관계없는 상품(예: 홍삼액)에 묶이지 않게, 검색어 낱말이 상품명에 얼마나 들어 있는지 0~1로 잰다.
// 한글 낱말은 영어 상품명으로 오는 경우가 많아 자주 쓰는 브랜드·제품 이름은 영어도 같이 본다
const ALIASES: Record<string, string[]> = {
  에어팟: ["airpods", "airpod"],
  아이폰: ["iphone"],
  아이패드: ["ipad"],
  맥북: ["macbook"],
  애플워치: ["applewatch"],
  애플: ["apple"],
  갤럭시: ["galaxy"],
  삼성: ["samsung"],
  버즈: ["buds"],
  프로: ["pro"],
  맥스: ["max"],
  미니: ["mini"],
  울트라: ["ultra"],
  플러스: ["plus"],
  다이슨: ["dyson"],
  닌텐도: ["nintendo"],
  스위치: ["switch"],
  플레이스테이션: ["playstation", "ps5", "ps4"],
  소니: ["sony"],
  엘지: ["lg"],
  샤오미: ["xiaomi"],
  로지텍: ["logitech"],
  나이키: ["nike"],
  아디다스: ["adidas"],
  캐리어: ["carrier", "luggage", "suitcase"],
  보조배터리: ["powerbank", "보조 배터리"],
  세대: ["gen", "generation"],
};

const norm = (s: string) => s.toLowerCase().replace(/[\s\-_/.,·()[\]{}'"!?:;+]+/g, "");
const bigrams = (s: string) => {
  const out: string[] = [];
  for (let i = 0; i < s.length - 1; i++) out.push(s.slice(i, i + 2));
  return out;
};

function tokenScore(token: string, title: string): number {
  const t = norm(token);
  if (!t) return 1;
  if (title.includes(t)) return 1;
  const alias = Object.entries(ALIASES).find(([ko]) => t.includes(ko));
  if (alias && alias[1].some((en) => title.includes(norm(en)))) return t === alias[0] ? 1 : 0.8;
  // 한 글자 차이(띄어쓰기·오타)는 두 글자 묶음이 겹치는 비율로 본다
  const grams = bigrams(t);
  if (!grams.length) return 0;
  return grams.filter((g) => title.includes(g)).length / grams.length;
}

export function relevance(query: string, title: string): number {
  const tokens = query.split(/\s+/).filter(Boolean);
  if (!tokens.length) return 1;
  const t = norm(title);
  return tokens.reduce((sum, tk) => sum + tokenScore(tk, t), 0) / tokens.length;
}

// 이 값보다 낮으면 관계없는 상품으로 본다
export const MIN_RELEVANCE = 0.34;
// 결과 중 이 값 이상인 상품이 하나도 없으면 "비슷한 상품을 못 찾았어요"
export const STRONG_RELEVANCE = 0.5;

// 관계없는 상품을 빼고, 하나도 제대로 맞지 않으면 빈 목록과 unrelated=true
export function relevantOnly<T extends { title: string }>(items: T[], query: string): { items: T[]; unrelated: boolean } {
  if (!items.length) return { items, unrelated: false };
  const scored = items.map((it) => ({ it, s: relevance(query, it.title) }));
  if (!scored.some((x) => x.s >= STRONG_RELEVANCE)) return { items: [], unrelated: true };
  return { items: scored.filter((x) => x.s >= MIN_RELEVANCE).map((x) => x.it), unrelated: false };
}

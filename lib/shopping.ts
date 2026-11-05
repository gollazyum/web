import { getCoupangLink, type CoupangLink } from "@/lib/coupang-links";
import { relevantOnly } from "@/lib/shop-results";
import { matchOrder } from "@/lib/shop-match";
import { groupItems, groupParts } from "@/lib/shop-group";
import { isSameProduct } from "@/lib/product-match";
import { cleanOutboundUrl, isRedirectorUrl, resolveSellerUrl, sellerInfo, shopSeller, shopSellerSearchUrl, type Seller } from "@/lib/sellers";

// 쇼핑 데이터. SerpApi 결과를 화면용으로 줄인다. (출처는 화면에 표시하지 않는다)
// 1) 검색 목록: google_shopping 결과 → 상품 카드 목록 (판매처별 가격은 아직 부르지 않음)
// 2) 상세: 사용자가 상품을 고르면 그 상품의 immersive_product_page_token(google_immersive_product)으로,
//    토큰이 없거나 결과가 비면 product_id(google_product)로 스토어별 가격을 부른다.
//    둘 다 0건·실패여도 검색 결과에 있던 판매처·가격·링크 1곳은 보여 준다

export type Offer = {
  seller: Seller;
  price: number | null; // 가격을 확인하지 못하면 null
  available: boolean; // 품절이면 false
  link: string; // 판매처로 가는 주소. 쿠팡이면 파트너스 링크(link.coupang.com). 빈 값이면 링크 없는 '가격 참고' 줄
  coupang: CoupangLink | null; // 쿠팡 판매처일 때만
  placeholder?: boolean; // 데이터에 쿠팡이 없어 덧붙인 쿠팡 행 (순위·차액·대표 가격 계산에서 빠짐)
  condition?: Condition; // 상품 상태. 없으면 새 상품
  grade?: string | null; // 중고 등급 (상품명의 "B+", "S급" 등). 모르면 null
  shippingFee?: number | null; // 배송비. 0이면 무료배송, null이면 데이터에 없음 (배송비 확인 필요)
};

// 새 상품 / 중고 / 리퍼
export type Condition = "new" | "used" | "refurb";

export type ShoppingProduct = {
  query: string;
  title: string;
  option: string; // 옵션·요약 (회색 한 줄). 없으면 빈 값
  image: string;
  price: number | null; // 대표 가격 = 1위 판매처 가격. 1위가 없으면 목록에서 보여 준 가격, 그것도 없으면 null
  priceFromList?: boolean; // true면 판매처 확인 전 목록 가격 ("판매처에 따라 달라질 수 있어요")
  originalPrice: number | null; // 정가 (취소선)
  changePct: number | null; // 정가 대비 내린 비율 (8 → ▼8%)
  fetchedAt: string; // 조회 시각 (ISO)
  offers: Offer[]; // 1위 후보를 싼 순서로, 그다음 품절·가격 미확인, 맨 아래 쿠팡 덧붙임 행
  productId?: string; // 찜(★)·공유에 쓰는 상품 ID (검색 결과의 product_id). 없으면 빈 값
  sample?: boolean; // 개발용 예시 데이터
};

export type ShoppingResponse = { product: ShoppingProduct | null };

export type SearchItem = {
  token: string; // 상세 조회용 immersive_product_page_token (없으면 빈 값)
  productId: string; // 상세 조회용 product_id (없으면 빈 값)
  title: string;
  image: string;
  price: number | null;
  seller: string | null; // 검색 결과의 판매처 이름
  used?: boolean; // 중고·리퍼 상품
  storeCount?: number; // 같은 상품으로 묶인 검색 결과의 판매처 수 (2곳 이상일 때만 "판매처 N곳" 표시)
  optionCount?: number; // 같은 상품으로 묶인 색상 수 (2개 이상일 때만 "색상 N개")
  priceFrom?: boolean; // 묶인 상품끼리 가격이 달라 price가 그중 가장 낮은 값이면 true ("N원부터")
  accessory?: boolean; // 케이스·필름 같은 액세서리 (lib/shop-match.ts). '본품만'을 끄면 '관련 액세서리' 묶음에 보인다
};

// 고른 상품을 가리키는 값. 토큰과 product_id 중 있는 것
export type ProductRef = { token: string; pid: string };

// 토큰은 2,000자가 넘기도 한다 (실측 최대 2,139자). 주소·요청 길이 제한은 넉넉히
export const MAX_TOKEN_LENGTH = 4000;

// 상세 화면 주소. product_id가 있으면 짧은 pid만 싣고(서버가 검색 결과에서 토큰을 다시 찾는다), 없으면 토큰
export const detailHref = (query: string, item: Pick<SearchItem, "token" | "productId">) => {
  const p = new URLSearchParams({ q: query });
  if (item.productId) p.set("pid", item.productId);
  else p.set("token", item.token);
  return `/shop/product?${p}`;
};

// unrelated: 검색 결과가 있었지만 검색어와 관계가 약해 모두 뺐다 ("비슷한 상품을 못 찾았어요")
export type SearchResponse = { items: SearchItem[]; sample?: boolean; unrelated?: boolean };

export const MAX_SEARCH_ITEMS = 20;
// 같은 검색과 같은 상품은 6시간 동안 저장해 두고 다시 부르지 않는다 (API와 공유 미리보기가 같은 저장분을 쓴다)
export const SHOP_CACHE_MS = 6 * 60 * 60 * 1000;
export const shoppingSearchParams = (q: string) => ({ engine: "google_shopping", q, gl: "kr", hl: "ko", location: "South Korea" });
// 이 값 이하(0원, 1원 등)는 실제 판매가로 보지 않는다 (목록과 1위 계산에서 뺀다)
export const MAX_FAKE_PRICE = 100;
// 다른 판매처 가운데값의 이 비율보다 싸면 미끼·오류 가격으로 보고 1위 후보에서 뺀다
const OUTLIER_RATIO = 0.3;

const realPrice = (n: number | null | undefined) => (typeof n === "number" && n > MAX_FAKE_PRICE ? n : null);

// 1위 후보: 판매 중이고 가격이 확인된 판매처 (쿠팡 덧붙임 행은 가격이 없어 자동으로 빠진다)
export const rankable = (o: Offer): o is Offer & { price: number } =>
  !o.placeholder && o.available && o.price !== null && o.price > 0;

export const isNew = (o: Offer) => (o.condition ?? "new") === "new";

// 판매처 목록 보기 설정: 중고 포함 여부, 배송비를 더해서 순위를 매길지
export type OfferView = { includeUsed: boolean; withShipping: boolean };
export const DEFAULT_OFFER_VIEW: OfferView = { includeUsed: false, withShipping: false };

// 순위에 쓰는 값: 배송비 포함이면 상품 가격 + 배송비 (배송비를 모르면 상품 가격만)
export const offerCost = (o: Offer & { price: number }, withShipping: boolean) => (withShipping ? o.price + (o.shippingFee ?? 0) : o.price);

// 화면에 보일 판매처와 순위. 새 상품만이면 중고·리퍼는 빼고(hiddenUsed로 개수만), 1위 후보끼리 싼 순서 → 품절·가격 미확인 → 쿠팡 덧붙임 행
export function rankOffers(offers: Offer[], view: OfferView) {
  const visible = offers.filter((o) => o.placeholder || view.includeUsed || isNew(o));
  const hiddenUsed = offers.length - visible.length;
  const ranked = visible
    .filter(rankable)
    .map((o, i) => ({ o, i }))
    .sort((a, b) => offerCost(a.o, view.withShipping) - offerCost(b.o, view.withShipping) || a.i - b.i)
    .map((x) => x.o);
  const rest = visible.filter((o) => !rankable(o) && !o.placeholder);
  const tail = visible.filter((o) => o.placeholder);
  const list = [...ranked.map((offer, i) => ({ offer, rank: i + 1 as number | null })), ...[...rest, ...tail].map((offer) => ({ offer, rank: null }))];
  return { list, top: ranked[0] ?? null, hiddenUsed };
}

// 상세 응답의 판매처 한 줄. 엔진마다 키 이름이 달라 모두 받는다
type SerpStore = {
  name?: string;
  merchant?: string | { name?: string };
  source?: string;
  link?: string;
  direct_link?: string;
  product_link?: string;
  title?: string;
  tag?: string;
  details_and_offers?: unknown;
  extracted_price?: number;
  extracted_original_price?: number;
  extracted_total?: number;
  base_price?: string | number;
  shipping?: string;
  shipping_extracted?: number;
  additional_costs?: string;
  condition?: string;
  second_hand_condition?: string;
};
export type SerpShoppingResult = {
  title?: string;
  source?: string;
  product_link?: string;
  link?: string;
  thumbnail?: string;
  extracted_price?: number;
  extracted_old_price?: number;
  immersive_product_page_token?: string;
  product_id?: string;
  extensions?: string[];
  tag?: string;
  second_hand_condition?: string;
};

const SOLD_OUT = /품절|재고\s*없음|out of stock|sold out|unavailable/i;
const REFURB = /리퍼|refurb|리뉴드|renewed/i;
const USED = /중고|used|pre-?owned|second[\s-]?hand|전시\s*상품|반품\s*상품|개봉\s*상품/i;
// "미개봉", "새상품"은 중고가 아니다
const NOT_USED = /미개봉|새\s*상품|새제품|신품/;

// 상품 상태: 데이터의 상태 값(중고 등)과 상품명을 함께 본다. 확실한 표시가 없으면 새 상품
export function conditionOf(flags: string, title = ""): Condition {
  if (REFURB.test(flags) || REFURB.test(title)) return "refurb";
  if (USED.test(flags)) return "used";
  if (USED.test(title) && !NOT_USED.test(title)) return "used";
  return "new";
}

// 중고 등급: 상품명의 "S급", "A+급", "B+ 등급", 끝에 붙은 "B+" 같은 표시. 없으면 null
export function gradeOf(title: string): string | null {
  const t = ` ${title} `;
  const m = t.match(/[\s(\[]([SABC][+-]?)\s*(급|등급)/i) ?? t.match(/[\s(\[]([SABC][+-]?)(?=[\s)\]])/);
  if (!m) return null;
  const g = m[1].toUpperCase();
  // 끝 글자 하나(예: "C")만 덩그러니 있으면 모델명일 수 있어 + / - 나 '급'이 있을 때만 쓴다
  if (!m[2] && g.length === 1) return null;
  return g;
}

// 배송비: 무료면 0, 금액이 있으면 그 금액, 모르면 null
export function shippingOf(s: Pick<SerpStore, "shipping" | "shipping_extracted" | "additional_costs" | "details_and_offers">): number | null {
  if (typeof s.shipping_extracted === "number" && Number.isFinite(s.shipping_extracted)) return Math.max(0, s.shipping_extracted);
  const text = `${s.shipping ?? ""} ${JSON.stringify(s.details_and_offers ?? "")}`;
  if (/무료\s*배송|배송비\s*무료|free\s*(delivery|shipping)|^\s*무료/i.test(text) || /^무료$/.test((s.shipping ?? "").trim())) return 0;
  const fee = text.match(/배송비[:\s]*₩?\s*([\d,]+)/);
  if (fee) return Number(fee[1].replace(/,/g, ""));
  return null;
}

// '근처, 37 km' 같은 매장 위치 문구는 상품 정보가 아니라 뺀다
const LOCATION = /(근처|nearby)\s*[,·]?\s*\d+(?:[.,]\d+)?\s*km|\b\d+(?:[.,]\d+)?\s*km\s*(거리|떨어진|away)?/gi;
export function stripLocation(s: string): string {
  return s.replace(LOCATION, "").replace(/\s*[,·]\s*$/, "").replace(/^\s*[,·]\s*/, "").replace(/\s{2,}/g, " ").trim();
}

// 검색 결과 상품: shopping_results 와 inline_shopping_results 둘 다 본다
export function shoppingResults(json: Record<string, unknown> | null): SerpShoppingResult[] {
  const pick = (k: string) => (json && Array.isArray(json[k]) ? (json[k] as SerpShoppingResult[]) : []);
  return [...pick("shopping_results"), ...pick("inline_shopping_results")].filter(
    (r) => r && typeof r.title === "string" && r.title.trim(),
  );
}

const productIdOf = (r: SerpShoppingResult) => (r.product_id == null ? "" : String(r.product_id));

// 검색 결과에서 고른 상품 찾기: 토큰이 같거나, product_id가 같은 것
export function findSelected(results: SerpShoppingResult[], ref: ProductRef): SerpShoppingResult | null {
  return (
    (ref.token && results.find((r) => r.immersive_product_page_token === ref.token)) ||
    (ref.pid && results.find((r) => productIdOf(r) === ref.pid)) ||
    null
  );
}

// "₩1,234", "1,234원" 같은 문자열 가격을 숫자로
function toNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v !== "string") return null;
  const digits = v.replace(/[^\d.]/g, "");
  const n = digits ? Number(digits) : NaN;
  return Number.isFinite(n) ? n : null;
}

// 상세 응답에서 판매처 배열 찾기. 엔진마다 위치가 달라 아래를 모두 본다
// product_results.stores (google_immersive_product), sellers_results.online_sellers, offers_results.online_sellers (google_product), stores
export function detailStores(json: Record<string, unknown> | null): SerpStore[] {
  if (!json) return [];
  const at = (o: unknown, k: string): unknown => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined);
  const lists = [
    at(at(json, "product_results"), "stores"),
    at(at(json, "sellers_results"), "online_sellers"),
    at(at(json, "offers_results"), "online_sellers"),
    at(json, "stores"),
  ];
  return lists.flatMap((l) => (Array.isArray(l) ? (l as SerpStore[]) : [])).filter((x) => x && typeof x === "object");
}

// 판매처 한 줄을 공통 모양으로: 이름 name|merchant|source, 가격 extracted_price|base_price|extracted_total, 링크 direct_link|link|product_link
// 가격은 상품 가격(배송비 빼고)이다. 배송비는 따로 shipping에 담는다 ('배송비 포함' 칩에서 더해 본다)
export function storeToRaw(s: SerpStore): RawOffer {
  const merchant = typeof s.merchant === "string" ? s.merchant : s.merchant?.name;
  const details = JSON.stringify(s.details_and_offers ?? "");
  const price = toNumber(s.extracted_price) ?? toNumber(s.base_price) ?? toNumber(s.extracted_total);
  const total = toNumber(s.extracted_total);
  return {
    name: stripLocation(s.name || merchant || s.source || ""),
    link: s.direct_link || s.link || s.product_link || "",
    price,
    original: s.extracted_original_price ?? null,
    soldOut: SOLD_OUT.test(`${s.tag ?? ""} ${details}`),
    flags: `${s.tag ?? ""} ${details} ${s.condition ?? ""} ${s.second_hand_condition ?? ""}`,
    title: s.title ?? "",
    // 배송비 칸이 없어도 총액이 상품 가격보다 크면 그 차이가 배송비다
    shipping: shippingOf(s) ?? (price !== null && total !== null && total > price ? total - price : null),
  };
}

// 결과 한 줄의 판매처 주소: link(판매처 직행)가 있으면 그것, 없으면 product_link
const resultLink = (r: SerpShoppingResult) => r.link || r.product_link || "";

// 검색 목록 화면용
export function shapeSearch(json: Record<string, unknown>, query = ""): SearchResponse {
  const found = shoppingResults(json)
    .filter((r) => r.immersive_product_page_token || productIdOf(r))
    // 0원·1원처럼 가격이 이상한 상품은 목록에서 뺀다
    .filter((r) => !(typeof r.extracted_price === "number" && r.extracted_price <= MAX_FAKE_PRICE));
  // 검색어와 관계가 약한 상품은 빼고(자르기 전에), 하나도 맞지 않으면 "비슷한 상품을 못 찾았어요"
  const { items: kept, unrelated } = query ? relevantOnly(found.map((r) => ({ r, title: r.title! })), query) : { items: found.map((r) => ({ r, title: r.title! })), unrelated: false };
  if (unrelated) return { items: [], unrelated };
  // 같은 상품(색상·옵션만 다른 것, 판매처만 다른 것)은 카드 하나로 묶는다. 카드를 누르면 묶인 판매처가 모두 나온다 (shapeDetail)
  const groups = groupItems(kept.map((x) => x.r), resultView(query), query);
  const cards = groups.map((g) => {
    const r = g.lead;
    const price = g.prices.length ? Math.min(...g.prices) : null;
    return {
      token: r.immersive_product_page_token ?? "",
      productId: productIdOf(r),
      title: r.title!.trim(),
      image: r.thumbnail ?? "",
      price,
      seller: shopSeller(stripLocation(r.source ?? ""), resultLink(r))?.key ?? null,
      ...(isUsedResult(r) ? { used: true } : {}),
      ...(g.sellers.length >= 2 ? { storeCount: g.sellers.length } : {}),
      ...(g.options >= 2 ? { optionCount: g.options } : {}),
      ...(new Set(g.prices).size >= 2 ? { priceFrom: true } : {}),
    };
  });
  // 관련도순: 낱말이 모두 맞는 본품 → 일부만 맞는 본품 → 액세서리(accessory 표시) (자르기 전에)
  return { items: matchOrder(cards, query).slice(0, MAX_SEARCH_ITEMS) };
}

const isUsedResult = (r: SerpShoppingResult) => conditionOf(r.second_hand_condition ?? "", r.title) !== "new";

// 묶기에 쓰는 검색 결과 한 줄의 모양
const resultView = (query: string) => (r: SerpShoppingResult) => ({
  title: r.title ?? "",
  source: stripLocation(r.source ?? ""),
  seller: shopSeller(stripLocation(r.source ?? ""), resultLink(r))?.key ?? null,
  price: realPrice(r.extracted_price),
  used: isUsedResult(r),
});

// 고른 상품과 같은 카드로 묶인 다른 검색 결과
function groupMates(results: SerpShoppingResult[], selected: SerpShoppingResult, query: string): SerpShoppingResult[] {
  const view = resultView(query);
  const keyOf = (r: SerpShoppingResult) => {
    const v = view(r);
    return groupParts(v.title, v.source, query, v.used).key;
  };
  const key = keyOf(selected);
  return results.filter((r) => r !== selected && !(typeof r.extracted_price === "number" && r.extracted_price <= MAX_FAKE_PRICE) && keyOf(r) === key);
}

type RawOffer = {
  name: string;
  link: string;
  price: number | null;
  original: number | null;
  soldOut: boolean;
  flags?: string; // 상태 표시(중고 등)가 들어 있는 글자들
  title?: string; // 그 판매처의 상품명 (중고 등급 찾기용)
  shipping?: number | null;
};

function toOffer(r: RawOffer, query: string, title: string): Offer | null {
  const seller = shopSeller(r.name, r.link);
  if (!seller) return null;
  const resolved = cleanOutboundUrl(resolveSellerUrl(r.link));
  // srsltid·utm_*·gclid 같은 추적·출처 파라미터는 빼고 내보낸다 (데이터 출처가 주소에 드러나지 않게)
  // 쿠팡: 중간 이동을 푼 주소가 쿠팡 상품 상세 주소면 그 주소, 아니면 쿠팡 안 상품명 검색결과 (쿠팡 홈 고정 링크는 쓰지 않는다)
  // 다른 곳은 중간 이동을 푼 판매처 주소. 구글을 거쳐 가는 주소만 남으면(google.com/search?ibp=oshop…, /goto?…)
  // 그 판매처의 검색 페이지로 바꾸고, 검색 페이지를 모르는 판매처는 링크 없이 '가격 참고' 줄로 둔다 (google.com 링크는 내보내지 않는다)
  const coupang = seller.key === "쿠팡" ? getCoupangLink({ title, link: resolved }, query) : null;
  const link = coupang ? coupang.url : isRedirectorUrl(resolved) ? (shopSellerSearchUrl(seller.key, title) ?? "") : resolved;
  const ownTitle = r.title || title;
  const condition = conditionOf(r.flags ?? "", ownTitle);
  return {
    seller,
    price: realPrice(r.price),
    available: !r.soldOut,
    link,
    coupang,
    condition,
    grade: condition === "new" ? null : gradeOf(ownTitle),
    shippingFee: r.shipping ?? null,
  };
}

// 판매처마다 1개만 남긴다 (1위 후보 중 가장 싼 것 → 없으면 처음 것)
function pickBest(offers: { offer: Offer; original: number | null }[]) {
  const best = new Map<string, { offer: Offer; original: number | null }>();
  for (const cur of offers) {
    const prev = best.get(cur.offer.seller.key);
    const better = !prev || (rankable(cur.offer) && (!rankable(prev.offer) || cur.offer.price < prev.offer.price));
    if (better) best.set(cur.offer.seller.key, cur);
  }
  return best;
}

// 검색 결과(searchJson)에서 고른 상품(token)을 찾고, 그 상품의 스토어 목록(detailJson)으로 상세 데이터를 만든다.
// 스토어 목록에 없는 판매처는 검색 결과 중 모델명·용량·색상이 같은 상품만 엄격하게 골라 보탠다.
// 쿠팡이 없으면 맨 아래에 "쿠팡에서 가격 확인" 행을 덧붙인다 (순위·대표 가격 계산에서 빠짐)
export function shapeDetail(
  query: string,
  ref: ProductRef | string,
  searchJson: Record<string, unknown> | null,
  detailJson: Record<string, unknown> | null,
  now: Date = new Date(),
): ShoppingResponse {
  const sel = typeof ref === "string" ? { token: ref, pid: "" } : ref;
  const results = shoppingResults(searchJson);
  const selected = findSelected(results, sel);
  const pr = (detailJson?.product_results ?? null) as { title?: string; thumbnails?: string[] } | null;
  const title = (selected?.title || pr?.title || "").trim();
  if (!title) return { product: null };

  const fromStores = detailStores(detailJson).map(storeToRaw);
  const fromResult = (r: SerpShoppingResult): RawOffer => ({
    name: r.source ?? "",
    link: resultLink(r),
    price: r.extracted_price ?? null,
    original: r.extracted_old_price ?? null,
    soldOut: SOLD_OUT.test(r.tag ?? ""),
    flags: `${r.tag ?? ""} ${r.second_hand_condition ?? ""}`,
    title: r.title ?? "",
    shipping: null,
  });

  const collected: { offer: Offer; original: number | null }[] = [];
  for (const raw of fromStores) {
    const offer = toOffer(raw, query, title);
    if (offer) collected.push({ offer, original: raw.original });
  }
  // 폴백: 고른 상품 자신의 판매처(source)·가격·링크. 상세 조회가 0건·실패여도 이 1곳은 남는다
  if (selected) {
    const own = toOffer(fromResult(selected), query, title);
    if (own) collected.push({ offer: own, original: selected.extracted_old_price ?? null });
    // 목록에서 같은 카드로 묶인 상품(색상만 다르거나 다른 판매처)의 판매처·가격·링크도 넣는다 (판매처마다 가장 싼 1줄)
    for (const r of groupMates(results, selected, query)) {
      const mate = toOffer(fromResult(r), query, title);
      if (mate) collected.push({ offer: mate, original: r.extracted_old_price ?? null });
    }
  }
  const best = pickBest(collected);

  // 폴백: 스토어 목록에 없는 판매처만, 같은 상품이 확실한 검색 결과에서 보탠다
  const extra: { offer: Offer; original: number | null }[] = [];
  for (const r of results) {
    if (r === selected || !isSameProduct(title, r.title!)) continue;
    const offer = toOffer(fromResult(r), query, title);
    // 다른 검색 결과에서 보태는 건 주요 4곳만 (그 밖은 같은 상품인지 확인이 약하다)
    if (offer && offer.seller.major && !best.has(offer.seller.key)) extra.push({ offer, original: r.extracted_old_price ?? null });
  }
  for (const [k, v] of pickBest(extra)) best.set(k, v);

  const list = [...best.values()];
  // 다른 판매처보다 터무니없이 싼 값은 가격 미확인으로 돌린다.
  // 가운데값은 4곳만이 아니라 스토어 목록 전체(KREAM·하이마트 등 포함)와 고른 상품 가격으로 잡는다.
  // 4곳이 2곳뿐이어도 11번가 1,000원 같은 미끼 가격을 걸러 내기 위해서 (기준 가격이 3개 이상일 때만 판단)
  const prices = [
    ...fromStores.filter((r) => !r.soldOut).map((r) => r.price),
    selected?.extracted_price,
    ...extra.map((x) => x.offer.price),
  ]
    .map((n) => realPrice(n))
    .filter((n): n is number => n !== null)
    .sort((a, b) => a - b);
  if (prices.length >= 3) {
    const median = prices[Math.floor(prices.length / 2)];
    for (const x of list) if (x.offer.price !== null && rankable(x.offer) && x.offer.price < median * OUTLIER_RATIO) (x.offer as Offer).price = null;
  }
  const ranked = list.filter((x) => rankable(x.offer)).sort((a, b) => a.offer.price! - b.offer.price!);
  const rest = list.filter((x) => !rankable(x.offer));
  const offers = [...ranked, ...rest].map((x) => x.offer);

  if (!best.has("쿠팡")) {
    const coupang = getCoupangLink({ title }, query);
    offers.push({ seller: sellerInfo("쿠팡"), price: null, available: true, link: coupang.url, coupang, placeholder: true });
  }

  // 대표 가격(1위)은 새 상품끼리만. 새 상품이 하나도 없으면(중고 상품 화면) 전체에서
  const top = ranked.find((x) => isNew(x.offer)) ?? ranked[0] ?? null;
  // 4곳 중 확인된 판매처가 없어도 목록에서 보여 준 가격은 대표 가격으로 남긴다
  const listPrice = top ? null : realPrice(selected?.extracted_price);
  const originalPrice = top && top.original && top.original > top.offer.price! ? top.original : null;

  return {
    product: {
      query,
      title,
      // 검색 결과의 부가 문구("저렴한 가격" 등)는 데이터 쪽 평가라 쓰지 않는다
      option: "",
      image: pr?.thumbnails?.[0] || selected?.thumbnail || "",
      price: top?.offer.price ?? listPrice,
      priceFromList: !top && listPrice !== null,
      originalPrice,
      changePct: top && originalPrice ? Math.round(((originalPrice - top.offer.price!) / originalPrice) * 100) : null,
      fetchedAt: now.toISOString(),
      offers,
      productId: selected ? productIdOf(selected) : sel.pid,
    },
  };
}

// 개발 환경에서만: 걸러 내기 전에 어떤 판매처가 왔는지 콘솔에 찍는다. 키 같은 인증 값은 지운다
export function maskSecrets(s: string): string {
  return s.replace(/([?&](?:api_key|key|token|access_token|auth|signature)=)[^&#\s]*/gi, "$1***");
}

export function rawSellerLog(json: Record<string, unknown> | null, detail?: Record<string, unknown> | null) {
  const rows = shoppingResults(json).map((r) => ({
    title: r.title ?? "",
    price: r.extracted_price ?? null,
    token: r.immersive_product_page_token ?? "",
    source: r.source ?? "",
    link: maskSecrets(r.link ?? ""),
    product_link: maskSecrets(r.product_link ?? ""),
    product_id: productIdOf(r),
    seller: shopSeller(r.source, resultLink(r))?.key ?? "(제외)",
  }));
  const stores = detailStores(detail ?? null).map((s) => {
    const r = storeToRaw(s);
    return { name: r.name, price: r.price, tag: s.tag ?? "", link: maskSecrets(r.link), seller: shopSeller(r.name, r.link)?.key ?? "(제외)" };
  });
  return { rows, stores };
}

// 화면 표시용
export const won = (n: number) => `${Math.round(n).toLocaleString("ko-KR")}원`;

export function fetchedTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Seoul" });
}


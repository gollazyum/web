import { getCoupangLink, type CoupangLink } from "@/lib/coupang-links";
import { normalizeSeller, sellerInfo, type Seller } from "@/lib/sellers";

// 상품 상세 화면용 데이터. SerpApi 쇼핑 결과를 줄여 만든다. (출처는 화면에 표시하지 않는다)

export type Offer = {
  seller: Seller;
  price: number | null; // 가격을 확인하지 못하면 null
  available: boolean; // 품절이면 false
  link: string; // 판매처로 가는 주소. 쿠팡이면 SerpApi 원본 대신 getCoupangLink 결과
  coupang: CoupangLink | null; // 쿠팡 판매처일 때만
};

export type ShoppingProduct = {
  query: string;
  title: string;
  option: string; // 옵션·요약 (회색 한 줄). 없으면 빈 값
  image: string;
  price: number | null; // 대표 가격 = 1위 판매처 가격. 1위가 없으면 null
  originalPrice: number | null; // 정가 (취소선)
  changePct: number | null; // 정가 대비 내린 비율 (8 → ▼8%)
  fetchedAt: string; // 조회 시각 (ISO)
  offers: Offer[]; // 1위 후보(가격 확인·판매 중)를 싼 순서로, 그 뒤에 품절·가격 미확인
  sample?: boolean; // 개발용 예시 데이터
};

export type ShoppingResponse = { product: ShoppingProduct | null };

// 1위 후보: 판매 중이고 가격이 확인된 판매처
export const rankable = (o: Offer): o is Offer & { price: number } => o.available && o.price !== null && o.price > 0;

type SerpStore = {
  name?: string;
  link?: string;
  title?: string;
  tag?: string;
  details_and_offers?: unknown;
  extracted_price?: number;
  extracted_original_price?: number;
  extracted_total?: number;
};
type SerpShoppingResult = {
  title?: string;
  source?: string;
  product_link?: string;
  link?: string;
  thumbnail?: string;
  extracted_price?: number;
  extracted_old_price?: number;
  immersive_product_page_token?: string;
  extensions?: string[];
  tag?: string;
};

const SOLD_OUT = /품절|재고\s*없음|out of stock|sold out|unavailable/i;

export function firstShoppingResult(json: Record<string, unknown>): SerpShoppingResult | null {
  const list = Array.isArray(json.shopping_results) ? (json.shopping_results as SerpShoppingResult[]) : [];
  return list.find((r) => r.title) ?? null;
}

type RawOffer = { name: string; link: string; price: number | null; original: number | null; soldOut: boolean };

// 4곳이 아닌 판매처는 빼고, 판매처마다 1개만 남긴다 (1위 후보 중 가장 싼 것 → 없으면 아무거나 하나)
function toOffers(raw: RawOffer[], query: string, title: string): { offers: Offer[]; originals: Map<string, number | null> } {
  const best = new Map<string, Offer>();
  const originals = new Map<string, number | null>();
  for (const r of raw) {
    const name = normalizeSeller(r.name, r.link);
    if (!name) continue;
    const coupang = name === "쿠팡" ? getCoupangLink({ title }, query) : null;
    // 쿠팡은 SerpApi가 준 원본 주소를 절대 쓰지 않는다
    const link = coupang ? coupang.url : /^https?:\/\//.test(r.link) ? r.link : "";
    const offer: Offer = { seller: sellerInfo(name), price: r.price && r.price > 0 ? r.price : null, available: !r.soldOut, link, coupang };
    const prev = best.get(name);
    const better = !prev || (rankable(offer) && (!rankable(prev) || offer.price < prev.price));
    if (better) {
      best.set(name, offer);
      originals.set(name, r.original);
    }
  }
  const list = [...best.values()];
  const ranked = list.filter(rankable).sort((a, b) => a.price - b.price);
  const rest = list.filter((o) => !rankable(o));
  return { offers: [...ranked, ...rest], originals };
}

// google_shopping 결과(json)와 그 첫 상품의 google_immersive_product 결과(detail)로 화면 데이터를 만든다
export function shapeShopping(
  query: string,
  json: Record<string, unknown>,
  detail: Record<string, unknown> | null,
  now: Date = new Date(),
): ShoppingResponse {
  const first = firstShoppingResult(json);
  if (!first) return { product: null };

  const pr = (detail?.product_results ?? null) as { title?: string; thumbnails?: string[]; stores?: SerpStore[] } | null;
  const title = pr?.title || first.title || query;
  const stores = Array.isArray(pr?.stores) ? pr!.stores! : [];

  const raw: RawOffer[] = stores.length
    ? stores.map((s) => ({
        name: s.name ?? "",
        link: s.link ?? "",
        price: s.extracted_price ?? s.extracted_total ?? null,
        original: s.extracted_original_price ?? null,
        soldOut: SOLD_OUT.test(`${s.tag ?? ""} ${JSON.stringify(s.details_and_offers ?? "")}`),
      }))
    : [
        {
          name: first.source ?? "",
          link: first.product_link ?? first.link ?? "",
          price: first.extracted_price ?? null,
          original: first.extracted_old_price ?? null,
          soldOut: SOLD_OUT.test(first.tag ?? ""),
        },
      ];
  const { offers, originals } = toOffers(raw, query, title);

  const top = offers.find(rankable) ?? null;
  const original = top ? originals.get(top.seller.key) ?? null : null;
  const originalPrice = top && original && original > top.price ? original : null;

  return {
    product: {
      query,
      title,
      option: (first.extensions ?? []).slice(0, 2).join(" · "),
      image: pr?.thumbnails?.[0] || first.thumbnail || "",
      price: top?.price ?? null,
      originalPrice,
      changePct: top && originalPrice ? Math.round(((originalPrice - top.price) / originalPrice) * 100) : null,
      fetchedAt: now.toISOString(),
      offers,
    },
  };
}

// 화면 표시용
export const won = (n: number) => `${Math.round(n).toLocaleString("ko-KR")}원`;

export function fetchedTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Seoul" });
}

// SerpApi 키가 없는 로컬 개발에서만 쓰는 예시 응답. 운영에서는 쓰지 않는다
export const SAMPLE_SHOPPING_JSON = {
  shopping_results: [
    {
      title: "노이즈캔슬링 무선 이어폰 2세대",
      source: "Coupang",
      extracted_price: 289000,
      extensions: ["화이트", "USB-C 케이스"],
      thumbnail: "",
      immersive_product_page_token: "sample",
    },
  ],
};
export const SAMPLE_PRODUCT_JSON = {
  product_results: {
    title: "노이즈캔슬링 무선 이어폰 2세대",
    thumbnails: [],
    stores: [
      { name: "Coupang", link: "https://www.coupang.com/vp/products/0", extracted_price: 289000, extracted_original_price: 314000 },
      { name: "11st", link: "https://www.11st.co.kr/", extracted_price: 296500 },
      { name: "Naver", link: "https://smartstore.naver.com/", extracted_price: 299000 },
      { name: "SSG.COM", link: "https://www.ssg.com/", extracted_price: 279000 },
      { name: "G마켓", link: "https://www.gmarket.co.kr/", extracted_price: 403280 },
      { name: "11번가 공식", link: "https://www.11st.co.kr/", extracted_price: 330000 },
      { name: "스마트스토어 OO몰", link: "https://smartstore.naver.com/x", extracted_price: 271000, tag: "일시품절" },
    ],
  },
};

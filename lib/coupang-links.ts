// 쿠팡 링크 설정.
// 상품 화면의 쿠팡 링크는 상품마다 다르게 만든다 (쿠팡 홈으로만 가는 고정 링크는 쓰지 않는다).
// 쿠팡 파트너스 자동 생성 API(Deeplink)는 운영 초기라 아직 쓰지 않는다.

// 쿠팡 파트너스 홈 링크. 쇼핑 탭(/shop)의 "쿠팡에서 찾아보기" 버튼에만 쓴다. 상품 화면에는 쓰지 않는다
export const COUPANG_HOME = "https://link.coupang.com/a/ijuyP3uVoW";

// 쇼핑 탭 예시 상품용 검색결과 링크. 키는 검색어, 값은 쿠팡 파트너스에서 만든 검색결과 링크.
// 예: { "에어팟": "https://link.coupang.com/a/xxxxxx" }
export const COUPANG_KEYWORD_LINKS: Record<string, string> = {};

// 쿠팡 파트너스 API(최종 승인 후 열림)를 쓸 때만 true. 기본 false
export const COUPANG_API_ENABLED = process.env.COUPANG_API_ENABLED === "true";

// 쿠팡 파트너스 추적 파라미터. 서버 환경변수 COUPANG_PARTNERS_TAG 에 넣는다 (없으면 붙이지 않는다)
// "lptag=AF1234567&subid=gollazyum" 처럼 쿼리 모양이면 그대로, "AF1234567" 처럼 값만 있으면 lptag=값 으로 붙인다
export const COUPANG_PARTNERS_TAG = process.env.COUPANG_PARTNERS_TAG?.trim() ?? "";

// 쇼핑 탭 예시 상품 3개 자리. link가 비어 있으면 COUPANG_KEYWORD_LINKS, 그것도 없으면 COUPANG_HOME을 쓴다.
// 가격은 넣지 않는다 (API 연동 전 고정 가격 표시는 심사 반려 사유)
export type CoupangSample = { name: string; keyword: string; emoji: string; link: string };
export const COUPANG_SAMPLE_PRODUCTS: CoupangSample[] = [
  { name: "여행용 캐리어", keyword: "캐리어", emoji: "🧳", link: "" },
  { name: "휴대용 보조배터리", keyword: "보조배터리", emoji: "🔋", link: "" },
  { name: "트래블 파우치 세트", keyword: "여행 파우치", emoji: "👝", link: "" },
];
export const sampleCoupangHref = (p: CoupangSample) => p.link || COUPANG_KEYWORD_LINKS[p.keyword] || COUPANG_HOME;

// product: 쿠팡 판매처의 실제 상품 주소 / search: 쿠팡 안에서 그 상품명으로 찾은 검색결과
export type CoupangLinkType = "search" | "product";
export type CoupangLink = { url: string; type: CoupangLinkType; name: string };

const COUPANG_HOSTS = ["coupang.com"];
// 쿠팡 상품 상세 주소: www.coupang.com/vp/products/123…, m.coupang.com/vm/products/123…
const PRODUCT_PATH = /^\/v[pm]\/products\/\d+/;

function parse(u: string | null | undefined): URL | null {
  if (!u) return null;
  try {
    const url = new URL(u);
    return url.protocol === "https:" || url.protocol === "http:" ? url : null;
  } catch {
    return null;
  }
}

// 주소가 쿠팡의 실제 상품 상세 주소인지 (쿠팡 홈·검색·기획전 주소는 아니다)
export function isCoupangProductUrl(u: string | null | undefined): boolean {
  const url = parse(u);
  if (!url) return false;
  const host = url.hostname.toLowerCase();
  return COUPANG_HOSTS.some((h) => host === h || host.endsWith("." + h)) && PRODUCT_PATH.test(url.pathname);
}

// 추적 파라미터를 상품 주소 쿼리에 붙인다. tag가 비어 있으면 원본 그대로
export function withPartnersTag(u: string, tag: string = COUPANG_PARTNERS_TAG): string {
  const t = tag.trim().replace(/^[?&]+/, "");
  const url = parse(u);
  if (!t || !url) return u;
  const params = t.includes("=") ? new URLSearchParams(t) : new URLSearchParams({ lptag: t });
  params.forEach((v, k) => url.searchParams.set(k, v));
  return url.toString();
}

export const coupangSearchUrl = (name: string) => `https://www.coupang.com/np/search?q=${encodeURIComponent(name)}`;

type LinkOptions = { partnersTag?: string; apiEnabled?: boolean };

// 상품 하나의 쿠팡 링크.
// 1) link(응답 데이터의 쿠팡 판매처 주소, 중간 이동을 푼 것)가 쿠팡 상품 상세 주소면 그 주소 (추적 파라미터가 설정돼 있을 때만 붙임)
// 2) 아니면 쿠팡 안에서 상품명(없으면 검색어)으로 찾은 검색결과
export function getCoupangLink(
  product: { title?: string | null; link?: string | null } | null | undefined,
  query: string | null | undefined,
  opts: LinkOptions = {},
): CoupangLink {
  const apiEnabled = opts.apiEnabled ?? COUPANG_API_ENABLED;
  const name = (product?.title ?? "").trim() || (query ?? "").trim();

  if (apiEnabled) {
    // TODO(쿠팡 파트너스 API): 최종 승인 후 Deeplink API로 상품 원본 주소를 파트너스 링크로 바꿔
    // { url: 받은 shortenUrl 그대로, type: "product" } 를 돌려준다. 서버에서만 호출하고 키는 환경변수에 둔다.
  }

  if (product?.link && isCoupangProductUrl(product.link)) {
    return { url: withPartnersTag(product.link, opts.partnersTag ?? COUPANG_PARTNERS_TAG), type: "product", name };
  }
  return { url: coupangSearchUrl(name), type: "search", name };
}

// 버튼·행에 쓰는 문구
export const coupangSearchLabel = (name: string) => `쿠팡에서 '${name}' 검색결과 보기 ↗`;
export const coupangLinkLabel = (link: CoupangLink) => (link.type === "product" ? "쿠팡에서 구매하러 가기 ↗" : coupangSearchLabel(link.name));

// 모든 쿠팡 링크에 붙이는 속성 (쿠팡 파트너스 운영정책)
export const COUPANG_LINK_ATTRS = { target: "_blank", rel: "sponsored noopener noreferrer" } as const;

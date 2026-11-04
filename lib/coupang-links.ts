// 쿠팡 링크 설정.
// 화면에 나가는 쿠팡 링크는 모두 쿠팡 파트너스 링크(link.coupang.com)다. 추적 없는 www.coupang.com 주소는 쓰지 않는다 (수수료 0원).
// 상품 화면: 서버가 쿠팡 파트너스 Deeplink API(lib/coupang-deeplink.ts)로 상품·검색 주소를 파트너스 링크로 바꾼다.
// 키가 없거나 실패하면 기본 파트너스 링크(COUPANG_HOME)로 보낸다.

// 기본 쿠팡 파트너스 링크. 쇼핑 탭 버튼과, 상품 화면에서 딥링크를 만들지 못했을 때 쓴다
export const COUPANG_HOME = "https://link.coupang.com/a/ijuyP3uVoW";

// 쇼핑 탭 예시 상품용 검색결과 링크. 키는 검색어, 값은 쿠팡 파트너스에서 만든 검색결과 링크.
// 예: { "에어팟": "https://link.coupang.com/a/xxxxxx" }
export const COUPANG_KEYWORD_LINKS: Record<string, string> = {};

// 쇼핑 탭 예시 상품 3개 자리. link가 비어 있으면 COUPANG_KEYWORD_LINKS, 그것도 없으면 COUPANG_HOME을 쓴다.
// 가격은 넣지 않는다 (API 연동 전 고정 가격 표시는 심사 반려 사유)
export type CoupangSample = { name: string; keyword: string; emoji: string; link: string };
export const COUPANG_SAMPLE_PRODUCTS: CoupangSample[] = [
  { name: "여행용 캐리어", keyword: "캐리어", emoji: "🧳", link: "" },
  { name: "휴대용 보조배터리", keyword: "보조배터리", emoji: "🔋", link: "" },
  { name: "트래블 파우치 세트", keyword: "여행 파우치", emoji: "👝", link: "" },
];
export const sampleCoupangHref = (p: CoupangSample) => p.link || COUPANG_KEYWORD_LINKS[p.keyword] || COUPANG_HOME;

// 파트너스 링크가 가리키는 곳. product: 쿠팡 판매처의 실제 상품 / search: 쿠팡 안 상품명 검색결과 / home: 기본 파트너스 링크
export type CoupangLinkType = "search" | "product" | "home";
// url: 화면 링크 (항상 link.coupang.com). target: 딥링크로 바꿀 쿠팡 원래 주소 (서버만 쓴다)
export type CoupangLink = { url: string; type: CoupangLinkType; name: string; target?: { url: string; type: "search" | "product" } };

export const PARTNERS_HOST = "link.coupang.com";
export function isPartnersLink(u: string | null | undefined): boolean {
  const url = parse(u);
  return !!url && url.protocol === "https:" && url.hostname.toLowerCase() === PARTNERS_HOST;
}

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

export const coupangSearchUrl = (name: string) => `https://www.coupang.com/np/search?q=${encodeURIComponent(name)}`;

// 상품 하나의 쿠팡 링크. 화면 링크(url)는 기본 파트너스 링크로 두고,
// 딥링크로 바꿀 원래 주소(target)를 함께 담는다: link(응답 데이터의 쿠팡 판매처 주소, 중간 이동을 푼 것)가 쿠팡 상품 상세면 그 주소,
// 아니면 쿠팡 안에서 상품명(없으면 검색어)으로 찾은 검색결과. 서버(app/api/shopping)가 딥링크를 만들면 url이 그 링크로 바뀐다
export function getCoupangLink(product: { title?: string | null; link?: string | null } | null | undefined, query: string | null | undefined): CoupangLink {
  const name = (product?.title ?? "").trim() || (query ?? "").trim();
  const target =
    product?.link && isCoupangProductUrl(product.link) ? { url: product.link, type: "product" as const } : { url: coupangSearchUrl(name), type: "search" as const };
  return { url: COUPANG_HOME, type: "home", name, target };
}

// 딥링크 결과를 반영한다. 파트너스 링크(link.coupang.com)일 때만 쓰고, 아니면 기본 파트너스 링크 그대로
export function applyDeeplink(link: CoupangLink, deeplink: string | null | undefined): CoupangLink {
  if (!link.target || !isPartnersLink(deeplink)) return { ...link, url: COUPANG_HOME, type: "home" };
  return { ...link, url: deeplink!, type: link.target.type };
}

// 버튼·행에 쓰는 문구
export const coupangSearchLabel = (name: string) => `쿠팡에서 '${name}' 검색결과 보기 ↗`;
export const COUPANG_HOME_LABEL = "쿠팡에서 찾아보기 ↗";
export const coupangLinkLabel = (link: CoupangLink) =>
  link.type === "product" ? "쿠팡에서 구매하러 가기 ↗" : link.type === "search" ? coupangSearchLabel(link.name) : COUPANG_HOME_LABEL;

// 모든 쿠팡 링크에 붙이는 속성 (쿠팡 파트너스 운영정책)
export const COUPANG_LINK_ATTRS = { target: "_blank", rel: "sponsored noopener noreferrer" } as const;

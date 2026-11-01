// 쿠팡 파트너스 링크 설정. 링크 주소는 쿠팡 파트너스에서 받은 그대로 붙여 넣는다.
// 쿠팡 정책상 링크를 가공하거나 파라미터를 붙이면 안 되므로, 코드도 이 주소를 그대로만 쓴다.

export const COUPANG_HOME = "https://link.coupang.com/a/ijuyP3uVoW";

// 인기 상품 검색결과 링크. 키는 검색어, 값은 쿠팡 파트너스에서 만든 검색결과 링크.
// 예: { "에어팟": "https://link.coupang.com/a/xxxxxx" }
export const COUPANG_KEYWORD_LINKS: Record<string, string> = {};

// 쿠팡 파트너스 API(최종 승인 후 열림)를 쓸 때만 true. 기본 false
export const COUPANG_API_ENABLED = process.env.COUPANG_API_ENABLED === "true";

// 쇼핑 탭 예시 상품 3개 자리. link가 비어 있으면 COUPANG_HOME을 쓴다.
// 가격은 넣지 않는다 (API 연동 전 고정 가격 표시는 심사 반려 사유)
export type CoupangSample = { name: string; keyword: string; emoji: string; link: string };
export const COUPANG_SAMPLE_PRODUCTS: CoupangSample[] = [
  { name: "여행용 캐리어", keyword: "캐리어", emoji: "🧳", link: "" },
  { name: "휴대용 보조배터리", keyword: "보조배터리", emoji: "🔋", link: "" },
  { name: "트래블 파우치 세트", keyword: "여행 파우치", emoji: "👝", link: "" },
];

export type CoupangLinkType = "home" | "search" | "product";
export type CoupangLink = { url: string; type: CoupangLinkType };

type LinkOptions = { home?: string; keywordLinks?: Record<string, string>; apiEnabled?: boolean };

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, "");

// 상품과 검색어로 쓸 쿠팡 링크를 고른다. SerpApi가 준 쿠팡 원본 주소는 쓰지 않고 항상 이 결과를 쓴다.
// 1) 검색어가 COUPANG_KEYWORD_LINKS 키와 같으면 그 검색결과 링크
// 2) 검색어나 상품명에 키가 들어 있으면 (긴 키 먼저) 그 검색결과 링크
// 3) 아니면 쿠팡 홈 링크
export function getCoupangLink(
  product: { title?: string | null } | null | undefined,
  query: string | null | undefined,
  opts: LinkOptions = {},
): CoupangLink {
  const home = opts.home ?? COUPANG_HOME;
  const keywordLinks = opts.keywordLinks ?? COUPANG_KEYWORD_LINKS;
  const apiEnabled = opts.apiEnabled ?? COUPANG_API_ENABLED;

  if (apiEnabled) {
    // TODO(쿠팡 파트너스 API): 최종 승인 후 Deeplink API로 상품 원본 주소를 파트너스 링크로 바꿔
    // { url: 받은 shortenUrl 그대로, type: "product" } 를 돌려준다. 서버에서만 호출하고 키는 환경변수에 둔다.
    // 지금은 아래 검색결과/홈 링크로 넘어간다.
  }

  const entries = Object.entries(keywordLinks).filter(([k, url]) => norm(k) && url);
  const q = norm(query ?? "");
  const exact = entries.find(([k]) => norm(k) === q);
  if (exact) return { url: exact[1], type: "search" };

  const title = norm(product?.title ?? "");
  const partial = entries
    .sort((a, b) => norm(b[0]).length - norm(a[0]).length)
    .find(([k]) => (q && q.includes(norm(k))) || (title && title.includes(norm(k))));
  if (partial) return { url: partial[1], type: "search" };

  return { url: home, type: "home" };
}

// 모든 쿠팡 링크에 붙이는 속성 (쿠팡 파트너스 운영정책)
export const COUPANG_LINK_ATTRS = { target: "_blank", rel: "sponsored noopener noreferrer" } as const;

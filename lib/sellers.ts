// 판매처 정규화. 지금은 쿠팡·네이버·G마켓·11번가 4곳만 보여 준다.
// SerpApi는 같은 판매처를 "Coupang", "쿠팡", "coupang.com"처럼 여러 이름으로 주므로
// 이름 별칭과 링크 도메인으로 표준 한글명 하나로 맞추고, 4곳이 아니면 null(제외).

export type SellerName = "쿠팡" | "네이버" | "G마켓" | "11번가";

export type Seller = {
  key: SellerName;
  initial: string; // 아이콘 안 글자
  color: string; // 아이콘 원 색. 회사 고유 색을 피한 중립 슬레이트 계열
};

type SellerDef = Seller & { aliases: string[]; hosts: string[] };

// 탭 순서도 이 순서를 따른다: 전체 / 쿠팡 / 네이버 / G마켓 / 11번가
const SELLERS: SellerDef[] = [
  { key: "쿠팡", initial: "쿠", color: "#475569", aliases: ["coupang", "쿠팡"], hosts: ["coupang.com"] },
  { key: "네이버", initial: "N", color: "#64748b", aliases: ["naver", "네이버", "스마트스토어", "smartstore"], hosts: ["smartstore.naver.com", "shopping.naver.com", "brand.naver.com"] },
  { key: "G마켓", initial: "G", color: "#52627a", aliases: ["gmarket", "g마켓", "지마켓"], hosts: ["gmarket.co.kr"] },
  { key: "11번가", initial: "11", color: "#6b7a90", aliases: ["11st", "11번가", "11street"], hosts: ["11st.co.kr"] },
];

export const SELLER_ORDER: SellerName[] = SELLERS.map((s) => s.key);

// 소문자로, 공백·점·하이픈을 빼고, .com/.co.kr 같은 끝을 뗀다
function clean(s: string): string {
  return s
    .toLowerCase()
    .replace(/\.(com|co\.kr|kr|net)$/, "")
    .replace(/[\s.\-_·]/g, "");
}

function parseUrl(s: string | null | undefined): URL | null {
  if (!s || !/^https?:\/\//i.test(s)) return null;
  try {
    return new URL(s);
  } catch {
    return null;
  }
}

// 구글 같은 중간 이동 주소(…/url?url=, /aclk?adurl=, ?q=)에서 실제 판매처 주소를 꺼낸다.
// 주소의 쿼리 파라미터만 읽고, 외부로 요청(fetch/HEAD)은 절대 보내지 않는다. 꺼낼 게 없으면 원래 주소
const REDIRECT_PARAMS = ["url", "adurl", "q", "u", "dest", "destination"];
const isRedirector = (host: string) => /(^|\.)google\.[a-z.]+$/.test(host) || /(^|\.)googleadservices\.com$/.test(host) || /(^|\.)doubleclick\.net$/.test(host);

// 스토어 목록의 링크가 "/goto?url=…"처럼 상대 주소로 올 때가 있다. 이건 구글 이동 주소라 앞을 붙여 둔다
// (url 값이 판매처 주소가 아닌 암호화된 값이라 풀 수 없다. 누르면 판매처 페이지로 이동한다)
const absolutize = (s: string | null | undefined) => (s && /^\/goto\?/.test(s) ? `https://www.google.com${s}` : s);

export function resolveSellerUrl(link: string | null | undefined): string {
  let current = parseUrl(absolutize(link));
  if (!current) return "";
  for (let i = 0; i < 3 && isRedirector(current.hostname.toLowerCase()); i++) {
    const inner = REDIRECT_PARAMS.map((k) => parseUrl(current!.searchParams.get(k))).find(Boolean);
    if (!inner) break;
    current = inner;
  }
  return current.toString();
}

export function sellerHost(link: string | null | undefined): string {
  return parseUrl(resolveSellerUrl(link))?.hostname.toLowerCase() ?? "";
}

// 판매처 이름(source)과, 중간 이동을 푼 실제 판매처 주소의 도메인으로만 4곳 중 하나를 고른다.
// 주소 전체 문자열이나 검색어에 글자가 들어 있는지로는 판단하지 않는다. 해당 없으면 null
export function normalizeSeller(source: string | null | undefined, link?: string | null): SellerName | null {
  const c = clean(source ?? "");
  if (c) {
    // 정확히 같은 이름 먼저, 그다음 이름 앞부분이 같은 것 (예: "쿠팡 로켓배송", "네이버 스마트스토어 OO몰")
    const hit =
      SELLERS.find((s) => s.aliases.some((a) => clean(a) === c)) ??
      SELLERS.find((s) => s.aliases.some((a) => c.startsWith(clean(a))));
    if (hit) return hit.key;
  }
  const host = sellerHost(link);
  if (host) {
    const hit = SELLERS.find((s) => s.hosts.some((h) => host === h || host.endsWith("." + h)));
    if (hit) return hit.key;
  }
  return null;
}

export function sellerInfo(name: SellerName): Seller {
  const { aliases: _a, hosts: _h, ...seller } = SELLERS.find((s) => s.key === name)!;
  return seller;
}

export const sellerOrder = (name: SellerName) => SELLER_ORDER.indexOf(name);

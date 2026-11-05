// 쇼핑 판매처 정규화. (숙소 판매처 허용 목록·구글 링크 제거는 lib/hotel-sellers.ts 에만 있고, 쇼핑에는 쓰지 않는다)
// SerpApi는 같은 판매처를 "Coupang", "쿠팡", "coupang.com"처럼 여러 이름으로 주므로
// 주요 4곳(쿠팡·네이버·G마켓·11번가)은 이름 별칭과 링크 도메인으로 표준 한글명 하나로 맞춘다.
// 그 밖의 판매처(KREAM·롯데ON 등)도 이름이 있으면 그대로 보여 준다 (shopSeller).

export type SellerName = "쿠팡" | "네이버" | "G마켓" | "11번가";

export type Seller = {
  key: string; // 화면에 보이는 판매처 이름. 주요 4곳은 SellerName
  initial: string; // 아이콘 안 글자
  color: string; // 아이콘 원 색. 회사 고유 색을 피한 중립 슬레이트 계열
  major?: boolean; // 주요 4곳이면 true (탭이 생긴다)
};

// true로 바꾸면 예전처럼 주요 4곳만 보여 준다
export const SHOP_MAJOR_SELLERS_ONLY = false;

type SellerDef = Seller & { key: SellerName; aliases: string[]; hosts: string[] };

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
  return { ...seller, major: true };
}

const OTHER_COLOR = "#94a3b8";
// 데이터 출처 이름은 판매처로 보여 주지 않는다
const SOURCE_NAME = /^(google|구글|serpapi)/i;

// 화면에 보일 판매처 이름: 앞 www.와 끝 .com/.co.kr 을 뗀다 (lotteon.com → lotteon)
function displayName(source: string): string {
  return source
    .trim()
    .replace(/^www\./i, "")
    .replace(/\.(com|co\.kr|kr|net)$/i, "")
    .slice(0, 30)
    .trim();
}

// 쇼핑 판매처 하나. 주요 4곳이면 표준 이름, 아니면 판매처 이름 그대로. 이름이 없으면 null
export function shopSeller(source: string | null | undefined, link?: string | null): Seller | null {
  const major = normalizeSeller(source, link);
  if (major) return sellerInfo(major);
  if (SHOP_MAJOR_SELLERS_ONLY) return null;
  const name = displayName(source ?? "");
  if (!name || SOURCE_NAME.test(name)) return null;
  return { key: name, initial: [...name][0].toUpperCase(), color: OTHER_COLOR, major: false };
}

// 주요 4곳 순서, 그 밖은 뒤로
export const sellerOrder = (name: string) => {
  const i = SELLER_ORDER.indexOf(name as SellerName);
  return i < 0 ? SELLER_ORDER.length : i;
};

// 쇼핑 판매처의 검색 페이지. 판매처 링크가 구글을 거쳐 가는 주소(google.com/search?ibp=oshop…, /goto?…)뿐일 때
// 그 판매처 안에서 상품명으로 찾은 결과로 보낸다. 목록에 없는 판매처는 null (링크 없는 '가격 참고' 줄이 된다)
type ShopSearchDef = { aliases: string[]; hosts: string[]; url: (q: string) => string };
const SHOP_SEARCH: ShopSearchDef[] = [
  { aliases: ["네이버"], hosts: ["naver.com"], url: (q) => `https://search.shopping.naver.com/search/all?query=${q}` },
  { aliases: ["G마켓", "gmarket", "지마켓"], hosts: ["gmarket.co.kr"], url: (q) => `https://browse.gmarket.co.kr/search?keyword=${q}` },
  { aliases: ["11번가", "11st"], hosts: ["11st.co.kr"], url: (q) => `https://search.11st.co.kr/Search.tmall?kwd=${q}` },
  { aliases: ["옥션", "auction"], hosts: ["auction.co.kr"], url: (q) => `https://www.auction.co.kr/n/search?keyword=${q}` },
  { aliases: ["무신사", "musinsa"], hosts: ["musinsa.com"], url: (q) => `https://www.musinsa.com/search/goods?keyword=${q}` },
  { aliases: ["kream", "크림"], hosts: ["kream.co.kr"], url: (q) => `https://kream.co.kr/search?keyword=${q}` },
  { aliases: ["29cm"], hosts: ["29cm.co.kr"], url: (q) => `https://www.29cm.co.kr/search?keyword=${q}` },
  { aliases: ["롯데온", "lotteon", "롯데on"], hosts: ["lotteon.com"], url: (q) => `https://www.lotteon.com/search/search/search.ecn?render=search&platform=pc&q=${q}` },
  { aliases: ["ssg", "ssgcom", "신세계몰", "이마트몰", "emart"], hosts: ["ssg.com"], url: (q) => `https://www.ssg.com/search.ssg?query=${q}` },
  { aliases: ["하이마트", "롯데하이마트", "himart", "ehimart"], hosts: ["e-himart.co.kr"], url: (q) => `https://www.e-himart.co.kr/app/search/totalSearch?query=${q}` },
  { aliases: ["오늘의집", "ohouse"], hosts: ["ohou.se"], url: (q) => `https://ohou.se/search/index?query=${q}` },
  { aliases: ["컬리", "마켓컬리", "kurly"], hosts: ["kurly.com"], url: (q) => `https://www.kurly.com/search?sword=${q}` },
  { aliases: ["올리브영", "oliveyoung"], hosts: ["oliveyoung.co.kr"], url: (q) => `https://www.oliveyoung.co.kr/store/search/getSearchMain.do?query=${q}` },
  { aliases: ["wconcept", "w컨셉"], hosts: ["wconcept.co.kr"], url: (q) => `https://www.wconcept.co.kr/Search?kwd=${q}` },
  { aliases: ["삼성닷컴", "삼성전자", "samsung"], hosts: ["samsung.com"], url: (q) => `https://www.samsung.com/sec/search/?keyword=${q}` },
  { aliases: ["애플", "apple"], hosts: ["apple.com"], url: (q) => `https://www.apple.com/kr/search/${q}` },
];

export function shopSellerSearchUrl(sellerName: string, title: string): string | null {
  const c = clean(sellerName);
  if (!c) return null;
  const def =
    SHOP_SEARCH.find((d) => d.aliases.some((a) => clean(a) === c)) ??
    SHOP_SEARCH.find((d) => d.aliases.some((a) => clean(a).length >= 3 && c.startsWith(clean(a))));
  return def ? def.url(encodeURIComponent(title.trim())) : null;
}

// 구글·광고를 거쳐 가는 주소인지 (중간 이동을 풀고 나서도 남아 있으면 판매처 주소를 알 수 없다)
export function isRedirectorUrl(link: string | null | undefined): boolean {
  const url = parseUrl(link);
  return !!url && isRedirector(url.hostname.toLowerCase());
}

// 밖으로 나가는 판매처 주소에서 추적·출처 파라미터를 뺀다 (srsltid, gclid, utm_* 등). 데이터 출처가 주소에 드러나지 않게.
// 판매처가 상품을 찾는 데 쓰는 값(상품 번호·옵션)은 그대로 둔다. 주소가 아니면 그대로 돌려준다
const TRACKING_PARAM = /^(utm_[a-z_]+|srsltid|gclid|gclsrc|gbraid|wbraid|dclid|_gl|ved|ei)$/i;
export function cleanOutboundUrl(link: string): string {
  const url = parseUrl(link);
  if (!url) return link;
  const drop = [...url.searchParams.keys()].filter((k) => TRACKING_PARAM.test(k));
  if (!drop.length) return link;
  for (const k of drop) url.searchParams.delete(k);
  return url.toString();
}

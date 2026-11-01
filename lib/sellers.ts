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
  { key: "네이버", initial: "N", color: "#64748b", aliases: ["naver", "네이버", "스마트스토어", "smartstore"], hosts: ["smartstore.naver.com", "shopping.naver.com"] },
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

function hostOf(link: string | null | undefined): string {
  try {
    return link ? new URL(link).hostname.toLowerCase() : "";
  } catch {
    return "";
  }
}

// 판매처 이름(source)과 링크로 4곳 중 하나를 고른다. 해당 없으면 null
export function normalizeSeller(source: string | null | undefined, link?: string | null): SellerName | null {
  const c = clean(source ?? "");
  if (c) {
    // 정확히 같은 이름 먼저, 그다음 이름 앞부분이 같은 것 (예: "쿠팡 로켓배송", "네이버 스마트스토어 OO몰")
    const hit =
      SELLERS.find((s) => s.aliases.some((a) => clean(a) === c)) ??
      SELLERS.find((s) => s.aliases.some((a) => c.startsWith(clean(a))));
    if (hit) return hit.key;
  }
  const host = hostOf(link);
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

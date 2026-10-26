// 아고다 링크 변환 설정. 링크 속 cid 값만 경로별로 바꿔 준다.

// 초록님 제휴 CID(아고다 파트너스 사이트 ID). 비어 있으면 추천 링크 카드는 숨긴다.
export const AFFILIATE_CID = "1978886";

// 아고다 파트너스에서 받은 호텔 프로모코드. 결제 화면에서 직접 입력한다.
export const HOTEL_PROMOCODES = ["lowboti", "lowbotikr"];

export type RouteGroup = "검색·지도" | "카드사" | "항공사";

// 경로 이름과 CID. 확인된 목록만 넣는다.
export const routes: { name: string; group: RouteGroup; cid: string }[] = [
  { name: "구글지도 ①", group: "검색·지도", cid: "1833981" },
  { name: "구글지도 ②", group: "검색·지도", cid: "1917614" },
  { name: "구글지도 ③", group: "검색·지도", cid: "1829968" },
  { name: "구글지도 ④", group: "검색·지도", cid: "1833982" },
  { name: "구글지도 ⑤", group: "검색·지도", cid: "1844160" },
  { name: "구글 검색 ①", group: "검색·지도", cid: "1908612" },
  { name: "구글 검색 ②", group: "검색·지도", cid: "1922868" },
  { name: "구글 검색 ③", group: "검색·지도", cid: "1908617" },
  { name: "구글 검색 ④", group: "검색·지도", cid: "1922847" },
  { name: "구글 검색 ⑤", group: "검색·지도", cid: "1844104" },
  { name: "구글 검색 ⑥", group: "검색·지도", cid: "1922887" },
  { name: "네이버 검색 ①", group: "검색·지도", cid: "1891504" },
  { name: "네이버 검색 ②", group: "검색·지도", cid: "1913764" },
  { name: "현대카드 ①", group: "카드사", cid: "1895693" },
  { name: "현대카드 ②", group: "카드사", cid: "1641446" },
  { name: "국민카드", group: "카드사", cid: "1563295" },
  { name: "삼성카드", group: "카드사", cid: "1783115" },
  { name: "신한(마스터)", group: "카드사", cid: "1917257" },
  { name: "신한카드", group: "카드사", cid: "1760133" },
  { name: "우리카드", group: "카드사", cid: "1654104" },
  { name: "우리(마스터)", group: "카드사", cid: "1932810" },
  { name: "농협카드", group: "카드사", cid: "1827579" },
  { name: "BC카드", group: "카드사", cid: "1748498" },
  { name: "토스카드", group: "카드사", cid: "1917334" },
  { name: "하나카드", group: "카드사", cid: "1729471" },
  { name: "트래블월렛", group: "카드사", cid: "1917349" },
  { name: "카카오페이 ①", group: "카드사", cid: "1942636" },
  { name: "카카오페이 ②", group: "카드사", cid: "1845109" },
  { name: "페이코", group: "카드사", cid: "1845157" },
  { name: "비자카드", group: "카드사", cid: "1889319" },
  { name: "마스터카드", group: "카드사", cid: "1889572" },
  { name: "유니온페이 ①", group: "카드사", cid: "1937708" },
  { name: "유니온페이 ②", group: "카드사", cid: "1801110" },
  { name: "JCB", group: "카드사", cid: "1945988" },
  { name: "대한항공(적립)", group: "항공사", cid: "1904827" },
  { name: "아시아나항공(적립)", group: "항공사", cid: "1806212" },
  { name: "에어서울", group: "항공사", cid: "1800120" },
];

export const groupOrder: RouteGroup[] = ["검색·지도", "카드사", "항공사"];

// 아고다 호텔 페이지 주소인지 확인하고 URL 객체로 돌려준다
export function parseAgodaUrl(input: string): URL | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  if (host !== "agoda.com" && !host.endsWith(".agoda.com")) return null;
  return url;
}

// 같은 호텔·날짜·인원을 유지한 채 cid만 바꾼 주소
export function withCid(url: URL, cid: string): string {
  const next = new URL(url.toString());
  next.searchParams.delete("tag");
  next.searchParams.set("cid", cid);
  return next.toString();
}

// 주소의 /hotel-name/hotel/ 부분으로 호텔 이름을 짐작한다
export function hotelNameFromUrl(url: URL): string | null {
  const parts = url.pathname.split("/").filter(Boolean);
  const i = parts.indexOf("hotel");
  const slug = i > 0 ? parts[i - 1] : null;
  if (!slug || /^[a-z]{2}-[a-z]{2}$/.test(slug)) return null;
  return decodeURIComponent(slug)
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// 링크가 없는 첫 방문자용 샘플. 날짜는 한 달 뒤 1박으로 만든다.
const samples = [{ label: "샘플 호텔로 바로 체험해 보기", propertyId: "88513086" }];

export function sampleLinks(): { label: string; url: string }[] {
  const d = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
  return samples.map((s) => ({
    label: s.label,
    url: `https://www.agoda.com/ko-kr/accom/property?propertyId=${s.propertyId}&checkIn=${d}&los=1&rooms=1&adults=2&childs=0&priceCur=KRW`,
  }));
}

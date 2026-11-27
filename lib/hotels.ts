import { AGODA_CID, agodaAffiliateOn } from "./affiliate";
import { agodaSearch, allowedSellers, hotelSellerKey, isGoogleLink, sellerSearchUrl, type HotelSellerKey } from "./hotel-sellers";
import { stayLimits } from "./hotelText";

// 호텔 검색 결과 모양과 링크. 서버(app/api/hotels)와 화면(HotelSearch)이 같이 쓴다.

export type HotelSource = {
  name: string; // 예약 사이트 이름 (Agoda, Booking.com …)
  logo: string;
  perNight: number | null; // 원, 1박 요금
  total: number | null; // 원, 전체 숙박 총액
  link: string; // 예약 사이트로 가는 주소
  official: boolean; // 호텔 공식 사이트
  freeCancel?: boolean; // 이 예약처 요금이 무료 취소 가능하다고 온 경우만 true
};

// 숙소에서 가까운 역·주요 장소 한 곳 (검색 결과에 온 값만. 없으면 null)
export type NearPlace = { name: string; how: "도보" | "대중교통" | "택시"; mins: number };

export type HotelOption = {
  token: string; // 예약 사이트별 가격을 더 불러올 때 쓴다
  name: string;
  image: string;
  images: string[]; // 결과 카드 사진 넘기기용 (첫 장은 image와 같다)
  kind: string; // "호텔", "휴가용 숙소" 같은 숙소 종류
  amenities: string[]; // 무료 Wi-Fi, 수영장 …
  deal: string; // Google이 붙인 특가 문구 ("평소보다 20% 저렴")
  gps: [number, number] | null;
  stars: number | null;
  rating: number | null;
  reviews: number | null;
  perNight: number | null;
  total: number | null;
  priceSource: string | null; // perNight·total을 가져온 예약 사이트. 사이트 가격이 없으면 null
  sources: HotelSource[]; // 검색 목록에 함께 온 몇 곳
  near?: NearPlace | null; // 가까운 역·주요 장소 (값이 온 숙소만)
  freeCancel?: boolean; // 무료 취소 가능한 예약처가 하나라도 있다고 온 경우만 true
};

export type HotelResults = { options: HotelOption[]; next: string | null }; // next: 다음 쪽을 부를 때 쓰는 값
// Google이 후기를 주제별로 센 값 (reviews_breakdown). 후기 글은 받지도 저장하지도 않는다
export type ReviewTopic = { name: string; total: number; positive: number; negative: number };
// info: 같이 온 숙소 기본 정보 (예전에 저장된 응답에는 없다)
export type HotelInfo = { name: string; images: string[]; gps: [number, number] | null; stars: number | null; rating: number | null; reviews: number | null; kind: string; amenities: string[] };
export type HotelPrices = { sources: HotelSource[]; topics: ReviewTopic[] | null; info?: HotelInfo | null }; // topics: null이면 이 호텔은 주제 데이터가 없다

export type HotelQuery = { q: string; checkIn: string; checkOut: string; adults: number };

// 결과 페이지 주소 (/hotels?q=…). 주소만 보내도 같은 검색이 열린다
export function hotelsPath(query: HotelQuery): string {
  const p = new URLSearchParams({ q: query.q, checkin: query.checkIn, checkout: query.checkOut, adults: String(query.adults) });
  return `/hotels?${p}`;
}

export function parseHotelsPath(sp: Record<string, string | string[] | undefined>): HotelQuery | null {
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const q = one("q").trim();
  const checkIn = one("checkin");
  const checkOut = one("checkout");
  const adults = Number(one("adults") || 2);
  const date = /^\d{4}-\d{2}-\d{2}$/;
  if (!q || q.length > 100 || !date.test(checkIn) || !date.test(checkOut) || checkOut <= checkIn) return null;
  if (!Number.isInteger(adults) || adults < 1 || adults > 9) return null;
  return { q, checkIn, checkOut, adults };
}

// 아고다 검색 결과 주소. cid는 제휴 설정(lib/affiliate.ts)이 켜져 있을 때만 붙는다
export function agodaSearchUrl(name: string, query: HotelQuery): string {
  return agodaSearch(name, query);
}

export function isAgoda(source: string): boolean {
  return /agoda|아고다/i.test(source);
}

// 비교한 예약 사이트 중 가장 낮은 한 곳.
// 총액이 둘 이상이면 총액으로, 아니면 1박 요금으로 비교한다 (상세의 최저가 배지와 같은 기준).
export function lowestOffer(sources: HotelSource[]): HotelSource | null {
  const priced = sources.filter((s) => s.total !== null || s.perNight !== null);
  if (!priced.length) return null;
  const useTotal = priced.filter((s) => s.total !== null).length > 1;
  const cost = (s: HotelSource) => (useTotal ? s.total ?? Number.POSITIVE_INFINITY : s.perNight ?? Number.POSITIVE_INFINITY);
  return priced.reduce((best, s) => (cost(s) < cost(best) ? s : best));
}

// 카드의 큰 숫자. 안내가 1박 평균이라, 아는 사이트 중 1박 요금이 가장 낮은 곳을 쓴다.
export function lowestNightly(sources: HotelSource[]): HotelSource | null {
  const priced = sources.filter((s): s is HotelSource & { perNight: number } => s.perNight !== null);
  if (!priced.length) return null;
  return priced.reduce((best, s) => (s.perNight < best.perNight ? s : best));
}

// '최저가' 배지. 이용 제한이 없고 평점이 이 값 이상인 숙소 중에서만 붙인다.
export const LOWEST_BADGE_MIN_RATING = 3.5;

export function canTakeLowestBadge(hotel: { name: string; rating: number | null }): boolean {
  if (stayLimits(hotel.name).length > 0) return false;
  return hotel.rating !== null && hotel.rating >= LOWEST_BADGE_MIN_RATING;
}

// 한국어로 예약할 수 있는 큰 예약 사이트. 아고다가 하위권일 때 대신 추천할 '안전한 곳'
const KOREAN_OK = /agoda|아고다|trip\.com|트립닷컴|booking|부킹|expedia|익스피디아|hotels\.com|호텔스닷컴|klook|클룩|야놀자|여기어때|인터파크|myrealtrip|마이리얼트립/i;

// 'Gollazyum AI' 표시를 붙일 사이트 이름. 실제 최저가(lowestOffer와 같은 기준)인 한 곳에만 붙인다
export function roboPick(sources: HotelSource[], _seed?: string): string | null {
  return lowestOffer(sources)?.name ?? null;
}

// 표시 이유 한 줄. 받아 온 가격으로 확인되는 사실만 말한다
export function roboReason(sources: HotelSource[], pick: string): string {
  const priced = sources.filter((s) => s.total !== null || s.perNight !== null);
  if (priced.length <= 1) return "🏨 지금 가격이 나온 곳은 여기 한 곳이에요";
  const totals = priced.filter((s) => s.total !== null).length > 1;
  return priced.some((s) => s.name === pick) ? `🏆 확인한 ${priced.length}곳 중 ${totals ? "총액이" : "1박 요금이"} 가장 낮아요` : "";
}

// 예약 사이트로 가는 주소. Google을 거쳐 가는 주소는 쓰지 않는다.
// 1) 응답에 판매처 직링크(google 도메인 아님)가 있으면 그 주소를 한국어·원화로 열리게 바꿔 쓰고
// 2) 없으면 그 판매처의 검색 결과 주소(호텔 이름 쿼리)로 보낸다. 허용 목록 밖 판매처는 빈 문자열
export function bookingLink(s: HotelSource, hotelName: string, query: HotelQuery): string {
  const key = hotelSellerKey(s.name, s.official, s.link);
  if (!key) return "";
  // 공식 사이트는 날짜를 넣어 열 검색 주소가 없으니 직링크가 없으면 보여 주지 않는다
  if (key === "official" && (!s.link || isGoogleLink(s.link))) return "";
  if (!s.link || isGoogleLink(s.link)) return sellerSearchUrl(key, hotelName, query);
  let url: URL;
  try {
    url = new URL(s.link);
  } catch {
    return sellerSearchUrl(key, hotelName, query);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return sellerSearchUrl(key, hotelName, query);
  const host = url.hostname.toLowerCase();
  const on = (domain: string) => host === domain || host.endsWith(`.${domain}`);
  const p = url.searchParams;
  if (p.has("userCountry")) p.set("userCountry", "KR");
  // 주소 맨 앞의 언어 칸(/en-us/, /en/ …)을 바꾼다
  const relocale = (to: string) => {
    const parts = url.pathname.split("/");
    if (/^[a-z]{2}(-[a-z]{2,4})?$/i.test(parts[1] ?? "")) parts[1] = to;
    url.pathname = parts.join("/");
  };
  if (on("agoda.com")) {
    relocale("ko-kr");
    p.delete("tag");
    // 제휴 설정이 꺼져 있으면 cid를 붙이지 않는다 (원래 붙어 온 값도 뺀다)
    if (agodaAffiliateOn()) p.set("cid", AGODA_CID);
    else p.delete("cid");
    p.set("currencyCode", "KRW");
  } else if (on("trip.com")) {
    // 트립닷컴은 주소의 locale보다 사이트 주소(www·us…)를 따른다. 한국 사이트로 보낸다
    url.hostname = "kr.trip.com";
    p.set("locale", "ko-KR");
    p.set("curr", "KRW");
  } else if (on("booking.com")) {
    p.set("lang", "ko");
    p.set("selected_currency", "KRW");
  } else if (on("hotels.com")) {
    p.set("locale", "ko_KR");
    p.set("currency", "KRW");
  }
  return url.toString();
}

// 예약 사이트가 많으면 처음엔 5곳만: 최저가 1위, 로보티 추천, 큰 예약 사이트 순서로 채우고 남은 자리는 싼 순서.
// rows는 화면에 그리는 순서(싼 순) 그대로 받고, 처음에 보여 줄 사이트 이름을 돌려준다
export const FIRST_SITES = 5;
export function firstSites(rows: HotelSource[], pick: string | null): Set<string> {
  if (rows.length <= FIRST_SITES) return new Set(rows.map((s) => s.name));
  const keep = new Set<string>([rows[0].name]);
  if (pick) keep.add(pick);
  for (const s of rows) if (keep.size < FIRST_SITES && KOREAN_OK.test(s.name)) keep.add(s.name);
  for (const s of rows) if (keep.size < FIRST_SITES) keep.add(s.name);
  return keep;
}

// 예약처 시트의 줄. 허용 목록 밖·링크를 못 만드는 곳을 먼저 빼고 나서 총액 순으로 줄 세운다.
// '가장 낮아요' 꼬리표와 차액은 이렇게 거른 목록의 첫 줄 기준이다
export type SellerRow = HotelSource & { key: HotelSellerKey; href: string; cost: number; approx: boolean };

export function sellerRows(sources: HotelSource[], nights: number, hotelName: string, query: HotelQuery): SellerRow[] {
  const out: SellerRow[] = [];
  for (const s of allowedSellers(sources)) {
    const key = hotelSellerKey(s.name, s.official, s.link);
    const href = key ? bookingLink(s, hotelName, query) : "";
    const cost = s.total ?? (s.perNight ? s.perNight * nights : null);
    if (!key || !href || !cost) continue;
    out.push({ ...s, key, href, cost, approx: s.total === null });
  }
  return out.sort((a, b) => a.cost - b.cost);
}

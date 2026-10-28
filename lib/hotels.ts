import { AFFILIATE_CID } from "./agoda";

// 호텔 검색 결과 모양과 링크. 서버(app/api/hotels)와 화면(HotelSearch)이 같이 쓴다.

export type HotelSource = {
  name: string; // 예약 사이트 이름 (Agoda, Booking.com …)
  logo: string;
  perNight: number | null; // 원, 1박 요금
  total: number | null; // 원, 전체 숙박 총액
  link: string; // 예약 사이트로 가는 주소
  official: boolean; // 호텔 공식 사이트
};

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
  sources: HotelSource[]; // 검색 목록에 함께 온 몇 곳
};

export type HotelResults = { options: HotelOption[]; next: string | null }; // next: 다음 쪽을 부를 때 쓰는 값
export type HotelPrices = { sources: HotelSource[] };

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

// 아고다 가격은 로보티 제휴 번호가 붙은 아고다 검색으로 보낸다 (제휴 수수료)
export function agodaSearchUrl(name: string, query: HotelQuery): string {
  const p = new URLSearchParams({
    textToSearch: name,
    checkIn: query.checkIn,
    checkOut: query.checkOut,
    rooms: "1",
    adults: String(query.adults),
    children: "0",
    currencyCode: "KRW",
    cid: AFFILIATE_CID,
  });
  return `https://www.agoda.com/ko-kr/search?${p}`;
}

export function isAgoda(source: string): boolean {
  return /agoda|아고다/i.test(source);
}

// 한국어로 예약할 수 있는 큰 예약 사이트. 아고다가 하위권일 때 대신 추천할 '안전한 곳'
const KOREAN_OK = /agoda|아고다|trip\.com|트립닷컴|booking|부킹|expedia|익스피디아|hotels\.com|호텔스닷컴|klook|클룩|야놀자|여기어때|인터파크|myrealtrip|마이리얼트립/i;

// 같은 호텔은 몇 번을 열어도 같은 결과가 나오게, 호텔 토큰으로 반반을 정한다
function coin(seed: string): boolean {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) | 0;
  return (h & 1) === 0;
}

// 예약 사이트 목록에서 '로보티 추천'을 붙일 곳 이름.
// 아고다가 1박 가격 3위 안이면 아고다. 4위 아래면 호텔마다 반반으로, 아고다 대신 상위 3곳 중
// 공식 사이트 → 한국어 되는 큰 예약 사이트 → 가장 싼 곳 순서로 고른다. 아고다가 없으면 늘 상위 3곳에서 고른다
export function roboPick(sources: HotelSource[], seed: string): string | null {
  const ranked = [...sources].filter((s) => s.perNight !== null).sort((a, b) => (a.perNight ?? 0) - (b.perNight ?? 0));
  if (!ranked.length) return null;
  const agoda = ranked.findIndex((s) => isAgoda(s.name));
  if (agoda >= 0 && (agoda < 3 || coin(seed))) return ranked[agoda].name;
  const top = ranked.slice(0, 3);
  return (top.find((s) => s.official) ?? top.find((s) => KOREAN_OK.test(s.name)) ?? top[0]).name;
}

// 예약 사이트로 가는 주소. 사이트를 알아볼 수 있으면 한국어·원화로 열리게 바꾸고,
// 아고다는 그 호텔 페이지 주소에 로보티 제휴 cid를 붙인다. Google을 거쳐 가는 주소는 손대지 않는다
export function bookingLink(s: HotelSource, hotelName: string, query: HotelQuery): string {
  if (!s.link) return isAgoda(s.name) ? agodaSearchUrl(hotelName, query) : "";
  let url: URL;
  try {
    url = new URL(s.link);
  } catch {
    return s.link;
  }
  const host = url.hostname.toLowerCase();
  const on = (domain: string) => host === domain || host.endsWith(`.${domain}`);
  const p = url.searchParams;
  // 주소 맨 앞의 언어 칸(/en-us/, /en/ …)을 바꾼다
  const relocale = (to: string) => {
    const parts = url.pathname.split("/");
    if (/^[a-z]{2}(-[a-z]{2,4})?$/i.test(parts[1] ?? "")) parts[1] = to;
    url.pathname = parts.join("/");
  };
  if (on("agoda.com")) {
    relocale("ko-kr");
    p.delete("tag");
    p.set("cid", AFFILIATE_CID);
    p.set("currencyCode", "KRW");
  } else if (on("trip.com")) {
    p.set("locale", "ko-KR");
    p.set("curr", "KRW");
  } else if (on("booking.com")) {
    p.set("lang", "ko");
    p.set("selected_currency", "KRW");
  } else if (on("hotels.com")) {
    p.set("locale", "ko_KR");
    p.set("currency", "KRW");
  } else if (on("klook.com")) {
    relocale("ko");
    p.set("currency", "KRW");
  } else {
    return s.link;
  }
  return url.toString();
}

// 숙소 예약 사이트(판매처) 허용 목록. 한국 사용자가 한국어·원화로 예약할 수 있는 곳만 보여 준다.
// 목록에 없는 판매처(Bluepillow, 한국어를 지원하지 않는 해외 메타 사이트 등)는 결과에서 뺀다.
// 같은 판매처가 "Hoteles.com", "Expedia.co.kr", "부킹닷컴"처럼 여러 이름으로 오므로 이름을 정규화해서 맞춘다.

import { AGODA_CID, agodaAffiliateOn } from "./affiliate";

export type HotelSellerKey =
  | "agoda"
  | "trip"
  | "expedia"
  | "hotels"
  | "booking"
  | "yanolja"
  | "yeogi"
  | "interpark"
  | "myrealtrip"
  | "official";

// rooms·childAges는 P1-4 (없으면 객실 1, 아동 0)
export type SearchQuery = { checkIn: string; checkOut: string; adults: number; rooms?: number; childAges?: number[] };
const roomsQ = (q: SearchQuery) => String(Math.max(1, q.rooms ?? 1));
const agesQ = (q: SearchQuery) => q.childAges ?? [];

type SellerDef = {
  key: HotelSellerKey;
  label: string; // 화면에 쓰는 이름 (응답 이름 대신 이 이름으로 통일)
  ko: string; // 토스트 등 한글 문장에 쓰는 이름
  aliases: string[]; // 정규화한 이름이 이 중 하나와 같거나 이걸로 시작하면 같은 판매처
  hosts: string[]; // 직링크 도메인
  search?: (hotel: string, q: SearchQuery) => string; // 직링크가 없을 때 호텔 이름으로 여는 그 판매처 검색 결과 주소
};

const qs = (p: Record<string, string>) => new URLSearchParams(p).toString();

// 허용 목록. 이 상수 하나만 고치면 된다. 순서는 의미 없음
export const HOTEL_SELLER_ALLOWLIST: readonly SellerDef[] = [
  {
    key: "agoda",
    label: "Agoda",
    ko: "아고다",
    aliases: ["agoda", "아고다"],
    hosts: ["agoda.com"],
    search: (hotel, q) => agodaSearch(hotel, q),
  },
  {
    key: "trip",
    label: "Trip.com",
    ko: "트립닷컴",
    aliases: ["tripcom", "트립닷컴", "트립컴"],
    hosts: ["trip.com"],
    search: (hotel, q) =>
      `https://kr.trip.com/hotels/list?${qs({ keyword: hotel, checkin: q.checkIn, checkout: q.checkOut, adult: String(q.adults), children: String(agesQ(q).length), ...(agesQ(q).length ? { ages: agesQ(q).join(",") } : {}), crn: roomsQ(q), curr: "KRW", locale: "ko-KR" })}`,
  },
  {
    key: "expedia",
    label: "Expedia",
    ko: "익스피디아",
    aliases: ["expedia", "익스피디아"],
    hosts: ["expedia.co.kr", "expedia.com"],
    search: (hotel, q) =>
      `https://www.expedia.co.kr/Hotel-Search?${qs({ destination: hotel, startDate: q.checkIn, endDate: q.checkOut, adults: String(q.adults), rooms: roomsQ(q), ...(agesQ(q).length ? { children: agesQ(q).map((a) => `1_${a}`).join(",") } : {}) })}`,
  },
  {
    key: "hotels",
    label: "Hotels.com",
    ko: "호텔스닷컴",
    aliases: ["hotelscom", "hotelescom", "hoteiscom", "호텔스닷컴", "호텔스컴"],
    hosts: ["hotels.com"],
    search: (hotel, q) =>
      `https://kr.hotels.com/Hotel-Search?${qs({ destination: hotel, startDate: q.checkIn, endDate: q.checkOut, adults: String(q.adults), rooms: roomsQ(q), ...(agesQ(q).length ? { children: agesQ(q).map((a) => `1_${a}`).join(",") } : {}) })}`,
  },
  {
    key: "booking",
    label: "Booking.com",
    ko: "부킹닷컴",
    aliases: ["bookingcom", "부킹닷컴", "부킹컴"],
    hosts: ["booking.com"],
    search: (hotel, q) =>
      `https://www.booking.com/searchresults.ko.html?${qs({ ss: hotel, checkin: q.checkIn, checkout: q.checkOut, group_adults: String(q.adults), no_rooms: roomsQ(q), group_children: String(agesQ(q).length), selected_currency: "KRW", lang: "ko" })}${agesQ(q).map((a) => `&age=${a}`).join("")}`,
  },
  {
    key: "yanolja",
    label: "야놀자",
    ko: "야놀자",
    aliases: ["야놀자", "yanolja"],
    hosts: ["yanolja.com"],
    search: (hotel) => `https://www.yanolja.com/search/${encodeURIComponent(hotel)}`,
  },
  {
    key: "yeogi",
    label: "여기어때",
    ko: "여기어때",
    aliases: ["여기어때", "yeogi", "yeogiottae", "goodchoice"],
    hosts: ["yeogi.com", "goodchoice.kr"],
    search: (hotel, q) => `https://www.yeogi.com/domestic-accommodations?${qs({ keyword: hotel, checkIn: q.checkIn, checkOut: q.checkOut, personal: String(q.adults + agesQ(q).length) })}`,
  },
  {
    key: "interpark",
    label: "인터파크",
    ko: "인터파크",
    aliases: ["인터파크", "interpark", "nol", "놀", "nolinterpark", "nol인터파크", "놀인터파크", "인터파크트리플", "인터파크투어"],
    hosts: ["interpark.com", "nol.com"],
    search: (hotel) => `https://travel.interpark.com/search?${qs({ q: hotel })}`,
  },
  {
    key: "myrealtrip",
    label: "마이리얼트립",
    ko: "마이리얼트립",
    aliases: ["마이리얼트립", "myrealtrip"],
    hosts: ["myrealtrip.com"],
    search: (hotel) => `https://www.myrealtrip.com/search?${qs({ q: hotel })}`,
  },
  // 호텔 공식 사이트: 응답의 official 플래그나 이름의 Official/공식 키워드로 판별한다. 정해진 검색 주소가 없다
  { key: "official", label: "호텔 공식 사이트", ko: "호텔 공식 사이트", aliases: [], hosts: [] },
];

// 소문자, 공백·점·하이픈·밑줄·가운뎃점 제거
export function cleanSellerName(s: string): string {
  return s.toLowerCase().normalize("NFC").replace(/[\s.\-_·/()]/g, "");
}

function hostOf(link: string | null | undefined): string {
  try {
    return link ? new URL(link).hostname.toLowerCase() : "";
  } catch {
    return "";
  }
}

const onHost = (host: string, domain: string) => host === domain || host.endsWith(`.${domain}`);

// Google을 거쳐 가는 주소(google.com, google.co.kr …)인지
export function isGoogleLink(link: string | null | undefined): boolean {
  return /(^|\.)google\.[a-z.]+$/.test(hostOf(link));
}

const OFFICIAL_WORD = /official|공식/i;

// 지금 화면에 보여 주는 판매처. 2026-11-17 초록 지시서: 아래 7곳만 (트립비토즈·모두투어는 같은 날 빼기로 함) (서버 /api/hotels 에서 이 목록 밖은 걸러 낸다).
// 인터파크·마이리얼트립·호텔 공식 사이트는 정의만 남기고 보여 주지 않는다
export const HOTEL_SELLERS_SHOWN: readonly HotelSellerKey[] = ["booking", "agoda", "yeogi", "yanolja", "hotels", "expedia", "trip"];

// 판매처 이름·공식 플래그·링크로 허용 목록 중 하나를 찾는다. 없거나 지금 보여 주지 않는 곳이면 null (결과에서 뺀다)
export function hotelSellerKey(name: string | null | undefined, official = false, link?: string | null): HotelSellerKey | null {
  const key = anySellerKey(name, official, link);
  return key && HOTEL_SELLERS_SHOWN.includes(key) ? key : null;
}

// 숨긴 곳까지 포함한 허용 목록 판별
export function anySellerKey(name: string | null | undefined, official = false, link?: string | null): HotelSellerKey | null {
  const c = cleanSellerName(name ?? "");
  if (c) {
    const exact = HOTEL_SELLER_ALLOWLIST.find((s) => s.aliases.some((a) => cleanSellerName(a) === c));
    if (exact) return exact.key;
    // 국가 도메인이 붙은 이름: "expediacokr", "agodacom", "bookingcomkr"
    const prefix = HOTEL_SELLER_ALLOWLIST.find((s) => s.aliases.some((a) => a.length >= 4 && c.startsWith(cleanSellerName(a))));
    if (prefix) return prefix.key;
  }
  // 직링크(google 아님) 도메인으로도 맞춰 본다
  const host = isGoogleLink(link) ? "" : hostOf(link);
  if (host) {
    const hit = HOTEL_SELLER_ALLOWLIST.find((s) => s.hosts.some((h) => onHost(host, h)));
    if (hit) return hit.key;
  }
  if (official || OFFICIAL_WORD.test(name ?? "")) return "official";
  return null;
}

export function sellerDef(key: HotelSellerKey): SellerDef {
  return HOTEL_SELLER_ALLOWLIST.find((s) => s.key === key)!;
}

// 화면에 쓰는 판매처 이름. 공식 사이트는 응답 이름(호텔 이름)을 그대로 쓴다
export function sellerLabel(key: HotelSellerKey, original: string): string {
  return key === "official" ? original : sellerDef(key).label;
}

type Priced = { name: string; official: boolean; link: string; perNight: number | null; total: number | null };

// 허용 목록 안의 판매처만 남기고 이름을 표준 이름으로 바꾼다. 같은 판매처가 여러 번 오면 싼 쪽 하나만.
// 순서는 받은 순서를 따른다 (정렬은 쓰는 쪽에서)
export function allowedSellers<T extends Priced>(list: T[]): T[] {
  const out = new Map<string, T>();
  const cost = (s: T) => s.total ?? s.perNight ?? Infinity;
  for (const s of list) {
    const key = hotelSellerKey(s.name, s.official, s.link);
    if (!key) continue;
    const name = sellerLabel(key, s.name);
    const next = { ...s, name, official: s.official || key === "official" };
    const id = key === "official" ? `official:${name}` : key;
    const prev = out.get(id);
    if (!prev || cost(next) < cost(prev)) out.set(id, next);
  }
  return [...out.values()];
}

// 아고다 호텔 검색 주소. 제휴 설정이 켜져 있고 cid가 있을 때만 cid를 붙인다
export function agodaSearch(hotel: string, q: SearchQuery): string {
  const p: Record<string, string> = {
    textToSearch: hotel,
    checkIn: q.checkIn,
    checkOut: q.checkOut,
    rooms: roomsQ(q),
    adults: String(q.adults),
    children: String(agesQ(q).length),
    ...(agesQ(q).length ? { childages: agesQ(q).join(",") } : {}),
    currencyCode: "KRW",
  };
  if (agodaAffiliateOn()) p.cid = AGODA_CID;
  return `https://www.agoda.com/ko-kr/search?${qs(p)}`;
}

// 직링크가 없을 때 갈 주소. 공식 사이트는 정해진 검색 주소가 없어 호텔 이름으로 네이버 검색을 연다
export function sellerSearchUrl(key: HotelSellerKey, hotel: string, q: SearchQuery): string {
  const def = sellerDef(key);
  if (def.search) return def.search(hotel, q);
  return `https://search.naver.com/search.naver?${qs({ query: `${hotel} 공식 홈페이지` })}`;
}

// 외부 링크 rel. 제휴 설정이 켜진 아고다 링크에만 sponsored를 붙인다
export function linkRel(key: HotelSellerKey | null): string {
  return key === "agoda" && agodaAffiliateOn() ? "noopener noreferrer sponsored" : "noopener noreferrer";
}

// "아고다로", "트립닷컴으로"처럼 받침에 맞춰 (으)로를 붙인다. 영문은 끝 글자 소리로 짐작한다
export function withRo(word: string): string {
  const last = word.trim().slice(-1);
  const code = last.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) {
    const jong = (code - 0xac00) % 28;
    return `${word}${jong === 0 || jong === 8 ? "로" : "으로"}`; // 받침 없음·ㄹ받침 → 로
  }
  return `${word}${/[bcdgjkmnpqtxz]$/i.test(last) ? "으로" : "로"}`;
}

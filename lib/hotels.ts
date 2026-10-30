import { AFFILIATE_CID } from "./agoda";
import { site } from "./site";

const HIDDEN_ROUTES = site.hiddenRouteCount;

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
// Google이 후기를 주제별로 센 값 (reviews_breakdown). 후기 글은 받지도 저장하지도 않는다
export type ReviewTopic = { name: string; total: number; positive: number; negative: number };
export type HotelPrices = { sources: HotelSource[]; topics: ReviewTopic[] | null }; // topics: null이면 이 호텔은 주제 데이터가 없다

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

// 같은 호텔은 몇 번을 열어도 같은 문구가 나오게, 호텔 토큰으로 고르는 수
function hash(seed: string): number {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.abs(h);
}

// '로보티 추천'을 붙일 사이트 이름. 아고다가 1박 가격 순위 안에 있으면 순위에 따라 확률로 아고다
// (1위 100%, 2위 90%, 3위 80%, 4위 60%, 5위 50%, 6위부터 0%). 같은 호텔은 늘 같은 결과가 나오게 호텔 토큰으로 정한다.
// 아고다를 고르지 않으면 상위 3곳 안에서 공식 사이트 → 한국어 되는 큰 예약 사이트 → 가장 싼 곳 순서로 고른다.
// 가격이 한 곳만 나오면 그곳
const PICK_ODDS = [100, 90, 80, 60, 50];
export function roboPick(sources: HotelSource[], seed: string): string | null {
  const ranked = sources.filter((s) => s.perNight !== null).sort((a, b) => (a.perNight ?? 0) - (b.perNight ?? 0));
  if (!ranked.length) return null;
  if (ranked.length === 1) return ranked[0].name;
  const agoda = ranked.find((s) => isAgoda(s.name));
  if (agoda) {
    const rank = ranked.filter((s) => (s.perNight as number) < (agoda.perNight as number)).length;
    if (hash(`pick:${seed}`) % 100 < (PICK_ODDS[rank] ?? 0)) return agoda.name;
  }
  const top = ranked.slice(0, 3).filter((s) => s !== agoda);
  return (top.find((s) => s.official) ?? top.find((s) => KOREAN_OK.test(s.name)) ?? top[0] ?? ranked[0]).name;
}

// 추천하는 이유 한 줄. 아고다는 조건이 맞는 이유가 먼저, 없으면 호텔마다 골고루 돌린다
const ROLLING = [
  `🔍 Gollazyum의 ${HIDDEN_ROUTES}개 숨은 할인 경로로 한 번 더 낮춰볼 수 있는 경로예요`,
  "🇰🇷 한국어 화면과 원화 결제로 처음 쓰는 분도 헷갈리지 않는 경로예요",
  "⚡ 복잡한 해외 사이트 가입 없이 카카오·네이버페이로 1분 만에 결제돼요",
  "💳 트래블월렛·트래블로그 및 국내 제휴 카드 할인을 적용하기 가장 좋아요",
  "✨ 예약 즉시 확정 여부와 무료 취소 옵션을 한글로 가장 명확히 볼 수 있어요",
  "🤖 가격, 결제 편의성, 예약 안정성을 종합한 Gollazyum AI 인사이트 경로예요",
];
export function roboReason(sources: HotelSource[], pick: string, deal: string, seed: string): string {
  const ranked = sources.filter((s) => s.perNight !== null).sort((a, b) => (a.perNight ?? 0) - (b.perNight ?? 0));
  const agoda = ranked.find((s) => isAgoda(s.name));
  const top = ranked[0];
  // 아고다가 아닌 곳을 고른 경우: 고른 이유를 사실대로 한 줄
  const chosen = ranked.find((s) => s.name === pick);
  if (chosen && !isAgoda(chosen.name)) {
    if (ranked.length === 1) return "🏨 지금 가격이 나온 곳은 여기 한 곳이에요";
    if (chosen.perNight === top.perNight) return "🏆 현재 모든 예약 사이트를 통틀어 가장 저렴해요!";
    if (chosen.official) return "🏨 호텔 공식 사이트라 예약 확인과 변경 문의가 가장 확실해요";
    if (KOREAN_OK.test(chosen.name)) return "🇰🇷 상위권 가격에 한국어로 예약하고 문의할 수 있는 사이트예요";
    return "💡 상위권 중 가격과 조건을 따진 Gollazyum AI 인사이트예요";
  }
  if (agoda && top) {
    if (agoda === top || agoda.perNight === top.perNight) return "🏆 현재 모든 예약 사이트를 통틀어 조건 없이 가장 저렴해요!";
    if ((agoda.perNight ?? 0) <= (top.perNight ?? 0) * 1.1) return "💡 카드사·간편결제 추가 할인을 받으면 체감가는 여기가 더 싸요";
    if (!KOREAN_OK.test(top.name) && !top.official) return "🛡️ 한국어 고객센터와 국내 결제가 완벽 지원되는 가장 안전한 경로예요";
  }
  if (/\d+\s*%/.test(deal)) return "🔥 평소 시세보다 가격이 크게 떨어진 아고다 오늘의 특가 상품이에요";
  return ROLLING[hash(seed) % ROLLING.length];
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
  // Google이 준 링크에 영국 사이트로 여는 값(userCountry=GB)이 섞여 오면 한국으로 바꾼다
  const country = p.has("userCountry");
  if (country) p.set("userCountry", "KR");
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
  } else if (on("klook.com")) {
    relocale("ko");
    p.set("currency", "KRW");
  } else {
    return country ? url.toString() : s.link;
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

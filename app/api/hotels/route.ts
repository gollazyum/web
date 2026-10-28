import type { HotelOption, HotelPrices, HotelResults, HotelSource } from "@/lib/hotels";
import { DATE, serpSearch, today } from "@/lib/serpapi";

// 실시간 호텔 가격. SerpApi의 Google Hotels 결과를 받아 화면용으로 줄인다.
// token 없이 부르면 호텔 목록, token을 주면 그 호텔의 예약 사이트별 가격.
export const runtime = "nodejs";
// SerpApi 응답이 10초를 넘길 때가 있어 함수 시간을 넉넉히 준다
export const maxDuration = 30;

const MAX_OPTIONS = 20;
const MAX_SOURCES = 12;
const MAX_IMAGES = 5;
const MAX_AMENITIES = 20;

function parseQuery(body: unknown) {
  if (!body || typeof body !== "object") return null;
  const { q, checkIn, checkOut, adults, token, page } = body as Record<string, unknown>;
  if (typeof q !== "string" || !q.trim() || q.length > 100) return null;
  if (typeof checkIn !== "string" || !DATE.test(checkIn) || checkIn < today()) return null;
  if (typeof checkOut !== "string" || !DATE.test(checkOut) || checkOut <= checkIn) return null;
  if (typeof adults !== "number" || !Number.isInteger(adults) || adults < 1 || adults > 9) return null;
  if (token !== undefined && (typeof token !== "string" || !token || token.length > 500)) return null;
  if (page !== undefined && (typeof page !== "string" || !page || page.length > 500)) return null;
  return { q: q.trim(), checkIn, checkOut, adults, token: token as string | undefined, page: page as string | undefined };
}

// hl=ko로 불러도 Google이 편의시설을 영어로 줄 때가 있어 자주 나오는 것은 한글로 바꾼다
const AMENITY_KO: Record<string, string> = {
  "free wi-fi": "무료 와이파이",
  "wi-fi": "와이파이",
  "paid wi-fi": "와이파이(유료)",
  "free breakfast": "무료 조식",
  breakfast: "조식",
  "free parking": "무료 주차",
  parking: "주차",
  "paid parking": "주차(유료)",
  "pool": "수영장",
  "outdoor pool": "야외 수영장",
  "indoor pool": "실내 수영장",
  "hot tub": "온수 욕조",
  spa: "스파",
  "fitness centre": "피트니스 센터",
  "fitness center": "피트니스 센터",
  restaurant: "레스토랑",
  bar: "바",
  "room service": "룸서비스",
  "air conditioning": "에어컨",
  "air-conditioned": "에어컨",
  "airport shuttle": "공항 셔틀",
  "free airport shuttle": "무료 공항 셔틀",
  "full-service laundry": "세탁 서비스",
  "laundry service": "세탁 서비스",
  kitchen: "주방",
  "kitchen in some rooms": "일부 객실 주방",
  kitchenette: "간이 주방",
  accessible: "장애인 편의시설",
  "wheelchair accessible": "휠체어 이용 가능",
  "pet-friendly": "반려동물 동반 가능",
  "pets allowed": "반려동물 동반 가능",
  "kid-friendly": "어린이 친화",
  "child-friendly": "어린이 친화",
  "business centre": "비즈니스 센터",
  "business center": "비즈니스 센터",
  "smoke-free property": "전 구역 금연",
  "non-smoking": "금연",
  "beach access": "해변 이용",
  "public bath": "대욕장",
  "hot spring": "온천",
  "hot springs": "온천",
  "onsen": "온천",
  sauna: "사우나",
  elevator: "엘리베이터",
  "24-hour front desk": "24시간 프런트",
  "front desk": "프런트",
  "luggage storage": "짐 보관",
  "airport transfer": "공항 이동 서비스",
  "electric car charging station": "전기차 충전소",
  "ev charger": "전기차 충전소",
  "washer and dryer": "세탁기·건조기",
  washer: "세탁기",
  dryer: "건조기",
  microwave: "전자레인지",
  refrigerator: "냉장고",
  balcony: "발코니",
  "all-inclusive available": "올인클루시브 가능",
  "golf": "골프",
  "tennis": "테니스",
  "ski-in/ski-out": "스키 인·아웃",
  "crib": "아기 침대",
  "cribs": "아기 침대",
  heating: "난방",
  "cable tv": "케이블 TV",
  tv: "TV",
};

// "Breakfast ($)"처럼 유료 표시가 붙은 것도 바꾸고, 모르는 것은 그대로 둔다
function amenityKo(name: string): string {
  const paid = /\s*\(\$\)$/.test(name);
  const base = name.replace(/\s*\(\$\)$/, "").trim();
  const ko = AMENITY_KO[base.toLowerCase()];
  if (!ko) return name;
  return paid && !ko.includes("유료") ? `${ko}(유료)` : ko;
}

type Rate = { extracted_lowest?: number };
type SerpPrice = { source?: string; logo?: string; link?: string; official?: boolean; rate_per_night?: Rate; total_rate?: Rate };
type SerpProperty = {
  name?: string;
  type?: string;
  property_token?: string;
  images?: { thumbnail?: string }[];
  amenities?: string[];
  deal?: string;
  deal_description?: string;
  hotel_class?: string;
  gps_coordinates?: { latitude?: number; longitude?: number };
  extracted_hotel_class?: number;
  overall_rating?: number;
  reviews?: number;
  rate_per_night?: Rate;
  total_rate?: Rate;
  prices?: SerpPrice[];
};

function toSource(p: SerpPrice): HotelSource | null {
  if (!p.source) return null;
  return {
    name: p.source,
    logo: p.logo ?? "",
    perNight: p.rate_per_night?.extracted_lowest ?? null,
    total: p.total_rate?.extracted_lowest ?? null,
    link: p.link ?? "",
    official: !!p.official,
  };
}

// 같은 사이트가 두 번 오면 싼 쪽만 남기고, 싼 순서로 줄 세운다
function cleanSources(list: SerpPrice[]): HotelSource[] {
  const best = new Map<string, HotelSource>();
  for (const s of list.map(toSource)) {
    if (!s || s.perNight === null) continue;
    const prev = best.get(s.name);
    if (!prev || s.perNight < (prev.perNight ?? Infinity)) best.set(s.name, s);
  }
  return [...best.values()].sort((a, b) => (a.perNight ?? 0) - (b.perNight ?? 0)).slice(0, MAX_SOURCES);
}

function toOption(p: SerpProperty): HotelOption | null {
  if (!p.name || !p.property_token) return null;
  const sources = cleanSources(p.prices ?? []);
  const images = (p.images ?? []).map((i) => i.thumbnail ?? "").filter(Boolean).slice(0, MAX_IMAGES);
  const gps = p.gps_coordinates;
  return {
    token: p.property_token,
    name: p.name,
    image: images[0] ?? "",
    images,
    kind: p.type === "vacation rental" ? "휴가용 숙소" : p.type && p.type !== "hotel" ? p.type : "호텔",
    amenities: [...new Set((p.amenities ?? []).map(amenityKo))].slice(0, MAX_AMENITIES),
    deal: [p.deal, p.deal_description].filter(Boolean).join(" · "),
    gps: typeof gps?.latitude === "number" && typeof gps?.longitude === "number" ? [gps.latitude, gps.longitude] : null,
    stars: p.extracted_hotel_class ?? null,
    rating: p.overall_rating ?? null,
    reviews: p.reviews ?? null,
    // 한 곳짜리 응답은 맨 위 요금이 빠질 때가 있어 사이트별 최저가로 채운다
    perNight: p.rate_per_night?.extracted_lowest ?? sources[0]?.perNight ?? null,
    total: p.total_rate?.extracted_lowest ?? null,
    sources: sources.slice(0, 3),
  };
}

// 호텔 이름으로 찾으면 Google이 목록 대신 그 호텔 한 곳의 정보를 바로 돌려준다
// (properties 없이 name·property_token·prices가 맨 위에 온다). 이때는 한 곳짜리 목록으로 만든다
function shapeList(raw: Record<string, unknown>): HotelResults {
  const single = raw.properties === undefined && typeof raw.property_token === "string" && typeof raw.name === "string";
  const props = single
    ? [{ ...(raw as SerpProperty), prices: [...((raw.featured_prices as SerpPrice[] | undefined) ?? []), ...((raw.prices as SerpPrice[] | undefined) ?? [])] }]
    : ((raw.properties as SerpProperty[] | undefined) ?? []);
  const next = (raw.serpapi_pagination as { next_page_token?: string } | undefined)?.next_page_token ?? null;
  return { options: props.map(toOption).filter((o): o is HotelOption => !!o && o.perNight !== null).slice(0, MAX_OPTIONS), next };
}

function shapePrices(raw: Record<string, unknown>): HotelPrices {
  const featured = (raw.featured_prices as SerpPrice[] | undefined) ?? [];
  const prices = (raw.prices as SerpPrice[] | undefined) ?? [];
  return { sources: cleanSources([...featured, ...prices]) };
}

export async function POST(req: Request) {
  const q = parseQuery(await req.json().catch(() => null));
  if (!q) return Response.json({ error: "bad_request" }, { status: 400 });

  const params: Record<string, string> = {
    engine: "google_hotels",
    q: q.q,
    check_in_date: q.checkIn,
    check_out_date: q.checkOut,
    adults: String(q.adults),
    currency: "KRW",
    hl: "ko",
    gl: "kr",
  };
  if (q.token) params.property_token = q.token;
  // "호텔 더 보기": Google은 한 번에 20곳 안팎만 주므로 다음 쪽을 따로 부른다 (검색 1번 요금)
  if (q.page) params.next_page_token = q.page;
  return q.token ? serpSearch(req, params, shapePrices) : serpSearch(req, params, shapeList);
}

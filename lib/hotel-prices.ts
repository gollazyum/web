import type { HotelInfo, HotelPrices, HotelSource, ReviewTopic } from "./hotels";
import { amenityKo, kindKo } from "./hotelText";
import { allowedSellers } from "./hotel-sellers";

// 숙소 한 곳의 예약처별 가격 응답을 화면용으로 줄인다 (app/api/hotels 와 가격 지킴이 크론이 같이 쓴다)
export const MAX_SOURCES = 12;

type Rate = { extracted_lowest?: number };
export type SerpPrice = { source?: string; logo?: string; link?: string; official?: boolean; rate_per_night?: Rate; total_rate?: Rate; free_cancellation?: boolean };

export function toSource(p: SerpPrice): HotelSource | null {
  if (!p.source) return null;
  return {
    name: p.source,
    logo: p.logo ?? "",
    perNight: p.rate_per_night?.extracted_lowest ?? null,
    total: p.total_rate?.extracted_lowest ?? null,
    link: p.link ?? "",
    official: !!p.official,
    ...(p.free_cancellation === true ? { freeCancel: true } : {}),
  };
}

// 한국 사용자용 허용 목록(lib/hotel-sellers.ts) 안의 판매처만 남기고 이름을 표준 이름으로 맞춘다.
// 같은 사이트가 두 번 오면 싼 쪽만 남기고, 싼 순서로 줄 세운다
export function cleanSources(list: SerpPrice[]): HotelSource[] {
  const priced = list.map(toSource).filter((s): s is HotelSource => !!s && s.perNight !== null);
  return allowedSellers(priced)
    .sort((a, b) => (a.perNight ?? 0) - (b.perNight ?? 0))
    .slice(0, MAX_SOURCES);
}

// 호텔 상세 응답의 reviews_breakdown (주제별 언급 수·긍정·부정). 숫자만 받아 온다
function shapeTopics(raw: unknown): ReviewTopic[] | null {
  if (!Array.isArray(raw)) return null;
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  const list = raw
    .map((t) => (t && typeof t === "object" ? (t as Record<string, unknown>) : {}))
    .map((t) => ({
      name: typeof t.name === "string" ? t.name.slice(0, 40) : "",
      total: n(t.total_mentioned),
      positive: n(t.positive),
      negative: n(t.negative),
    }))
    .filter((t) => t.name && t.total > 0)
    .slice(0, 12);
  return list.length ? list : null;
}

// 숙소 한 곳 조회에 같이 오는 기본 정보 (공유 링크로 바로 들어온 상세 페이지가 이름·사진·좌표를 채울 때만 쓴다). 온 값만 담는다
function shapeInfo(raw: Record<string, unknown>): HotelInfo | null {
  const name = typeof raw.name === "string" ? raw.name.normalize("NFC") : "";
  if (!name) return null;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const gps = raw.gps_coordinates as { latitude?: number; longitude?: number } | undefined;
  const images = ((raw.images as { thumbnail?: string; original_image?: string }[] | undefined) ?? [])
    .map((i) => i.thumbnail ?? "")
    .filter((u) => /^https:\/\//.test(u))
    .slice(0, 8);
  return {
    name: name.slice(0, 300),
    images,
    gps: typeof gps?.latitude === "number" && typeof gps?.longitude === "number" ? [gps.latitude, gps.longitude] : null,
    stars: num(raw.extracted_hotel_class),
    rating: num(raw.overall_rating),
    reviews: num(raw.reviews),
    kind: kindKo(typeof raw.type === "string" ? raw.type : undefined),
    amenities: [...new Set(((raw.amenities as unknown[] | undefined) ?? []).filter((a): a is string => typeof a === "string").map((a) => amenityKo(a.normalize("NFC"))))].slice(0, 20),
  };
}

export function shapePrices(raw: Record<string, unknown>): HotelPrices {
  const featured = (raw.featured_prices as SerpPrice[] | undefined) ?? [];
  const prices = (raw.prices as SerpPrice[] | undefined) ?? [];
  return { sources: cleanSources([...featured, ...prices]), topics: shapeTopics(raw.reviews_breakdown), info: shapeInfo(raw), checkedAt: Date.now() };
}

import { lowestOffer, type HotelOption, type HotelPrices, type HotelResults, type HotelSource, type ReviewTopic } from "@/lib/hotels";
import { DATE, serpSearch, today } from "@/lib/serpapi";
import { amenityKo, dealKo, kindKo } from "@/lib/hotelText";

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
  // 카드에 적는 가격은 이번 응답에서 비교한 사이트 중 가장 낮은 곳이다.
  // 숙소 맨 위 요금(rate_per_night)은 그 최솟값과 다른 사이트일 때가 있어 쓰지 않는다.
  const best = lowestOffer(sources);
  const shown = sources.slice(0, 3);
  if (best && !shown.some((s) => s.name === best.name)) shown.unshift(best);
  const images = (p.images ?? []).map((i) => i.thumbnail ?? "").filter(Boolean).slice(0, MAX_IMAGES);
  const gps = p.gps_coordinates;
  return {
    token: p.property_token,
    name: p.name,
    image: images[0] ?? "",
    images,
    kind: kindKo(p.type),
    amenities: [...new Set((p.amenities ?? []).map(amenityKo))].slice(0, MAX_AMENITIES),
    deal: [p.deal, p.deal_description].filter(Boolean).map((t) => dealKo(t as string)).join(" · "),
    gps: typeof gps?.latitude === "number" && typeof gps?.longitude === "number" ? [gps.latitude, gps.longitude] : null,
    stars: p.extracted_hotel_class ?? null,
    rating: p.overall_rating ?? null,
    reviews: p.reviews ?? null,
    perNight: best ? best.perNight : (p.rate_per_night?.extracted_lowest ?? null),
    total: best ? best.total : (p.total_rate?.extracted_lowest ?? null),
    priceSource: best?.name ?? null,
    sources: shown.slice(0, 3),
  };
}

// 호텔 이름으로 찾으면 Google이 목록 대신 그 호텔 한 곳의 정보를 바로 돌려준다
// (properties 없이 name·property_token·prices가 맨 위에 온다). 이때는 한 곳짜리 목록으로 만든다
function propsOf(raw: Record<string, unknown>): { props: SerpProperty[]; single: boolean } {
  const single = raw.properties === undefined && typeof raw.property_token === "string" && typeof raw.name === "string";
  const props = single
    ? [{ ...(raw as SerpProperty), prices: [...((raw.featured_prices as SerpPrice[] | undefined) ?? []), ...((raw.prices as SerpPrice[] | undefined) ?? [])] }]
    : ((raw.properties as SerpProperty[] | undefined) ?? []);
  return { props, single };
}

const optionsOf = (props: SerpProperty[]) => props.map(toOption).filter((o): o is HotelOption => !!o && o.perNight !== null);

// 추천순 첫 20곳 비율. 비싼 고성급만 깔리지 않게 세 묶음으로 나눠 채운다
// - 가성비 우량: 3~4성, 후기 4.0 이상, 1박가가 전체 중간값 이하 (8~10곳)
// - 프리미엄 특가: 4~5성, '평소보다 n%' 특가가 있거나 후기 4.2 이상 (6~8곳)
// - 인기 비즈니스: 남은 2~3성 중 후기 많은 곳 (4곳)
// 묶음이 모자라면 Google 기본 순서에서 채운다. 순서는 묶음 안 순위를 따라 번갈아 놓는다
const MIX = { value: 10, premiumMin: 6, premiumMax: 8, business: 4 };
function mixClasses(base: HotelOption[], upper: HotelOption[]): HotelOption[] {
  const seen = new Set<string>();
  const pool = [...base, ...upper].filter((o) => !seen.has(o.token) && seen.add(o.token));
  const prices = pool.map((o) => o.perNight ?? 0).sort((a, b) => a - b);
  const median = prices[Math.floor((prices.length - 1) / 2)] ?? 0;
  const used = new Set<string>();
  const take = (list: HotelOption[], n: number) => {
    const out = list.filter((o) => !used.has(o.token)).slice(0, Math.max(n, 0));
    out.forEach((o) => used.add(o.token));
    return out;
  };
  const stars = (o: HotelOption, ...s: number[]) => s.includes(o.stars ?? 0);
  const rating = (o: HotelOption) => o.rating ?? 0;
  const value = take(
    pool.filter((o) => stars(o, 3, 4) && rating(o) >= 4 && (o.perNight ?? Infinity) <= median).sort((a, b) => rating(b) - rating(a) || (a.perNight ?? 0) - (b.perNight ?? 0)),
    MIX.value,
  );
  const business = take(
    pool.filter((o) => stars(o, 2, 3)).sort((a, b) => (b.reviews ?? 0) - (a.reviews ?? 0)),
    MIX.business,
  );
  const deal = (o: HotelOption) => (/\d+\s*%/.test(o.deal) ? 1 : 0);
  const premium = take(
    pool.filter((o) => stars(o, 4, 5) && (deal(o) || rating(o) >= 4.2)).sort((a, b) => deal(b) - deal(a) || rating(b) - rating(a)),
    Math.min(MIX.premiumMax, Math.max(MIX.premiumMin, MAX_OPTIONS - value.length - business.length)),
  );
  const rest = take(pool, MAX_OPTIONS - used.size);
  const ranked = [value, premium, business, rest].flatMap((list, g) => list.map((o, i) => ({ o, r: (i + g * 0.25) / Math.max(list.length, 1) })));
  return ranked.sort((a, b) => a.r - b.r).map((x) => x.o);
}

function shapeList(raw: Record<string, unknown>, upperRaw: Record<string, unknown> | null): HotelResults {
  const { props, single } = propsOf(raw);
  const next = (raw.serpapi_pagination as { next_page_token?: string } | undefined)?.next_page_token ?? null;
  const base = optionsOf(props);
  if (single || !upperRaw) return { options: base.slice(0, MAX_OPTIONS), next };
  return { options: mixClasses(base, optionsOf(propsOf(upperRaw).props)), next };
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

function shapePrices(raw: Record<string, unknown>): HotelPrices {
  const featured = (raw.featured_prices as SerpPrice[] | undefined) ?? [];
  const prices = (raw.prices as SerpPrice[] | undefined) ?? [];
  return { sources: cleanSources([...featured, ...prices]), topics: shapeTopics(raw.reviews_breakdown) };
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
  if (q.token) {
    params.property_token = q.token;
    return serpSearch(req, params, shapePrices);
  }
  // "호텔 더 보기": Google은 한 번에 20곳 안팎만 주므로 다음 쪽을 따로 부른다 (검색 1번 요금). 다음 쪽은 기본 순서 그대로
  if (q.page) {
    params.next_page_token = q.page;
    return serpSearch(req, params, shapeList);
  }
  // 첫 쪽은 4·5성만 한 번 더 불러 같이 놓고 추천순 비율로 고른다 (검색 2번 요금)
  return serpSearch(req, params, shapeList, { ...params, hotel_class: "4,5" });
}

import { lowestNightly, type HotelOption, type NearPlace, type HotelPrices, type HotelResults } from "@/lib/hotels";
import { DATE, DETAIL_DAILY_CAP, serpSearch, today } from "@/lib/serpapi";
import { normalizeText } from "@/lib/search-cache";
import { amenityKo, dealKo, kindKo } from "@/lib/hotelText";
import { cleanSources, shapePrices, type SerpPrice } from "@/lib/hotel-prices";
import { after } from "next/server";
import { priceHistoryOn, recordPrices } from "@/lib/price-history";
import { listRows, verifiedRow } from "@/lib/price-history-rows";
import { priceCacheSec, stayCacheSec, STAY_CACHE_NEAR_SEC } from "@/lib/stay-cache";
import { POPULAR_CACHE_SEC, popularCity } from "@/lib/popular-stay-cities";
import { recordMaster } from "@/lib/hotels-master";
import { recordSnapshot } from "@/lib/seller-snapshot";
import { supabaseOn } from "@/lib/supabase-server";

// 실시간 호텔 가격. SerpApi의 Google Hotels 결과를 받아 화면용으로 줄인다.
// token 없이 부르면 호텔 목록, token을 주면 그 호텔의 예약 사이트별 가격.
export const runtime = "nodejs";
// SerpApi 응답이 10초를 넘길 때가 있어 함수 시간을 넉넉히 준다
export const maxDuration = 30;

const MAX_OPTIONS = 20;
const MAX_POPULAR = 40; // 인기 도시: 첫 쪽 20곳 + 다음 쪽 (겹치는 숙소 빼고)
const MAX_IMAGES = 5;
const MAX_AMENITIES = 20;
const STARS = /^[2-5](,[2-5]){0,3}$/;

function parseQuery(body: unknown) {
  if (!body || typeof body !== "object") return null;
  const { q, checkIn, checkOut, adults, token, page, stars, childAges, fresh, detail, place } = body as Record<string, unknown>;
  // P1-4: 아동 나이 (0~17세, 최대 6명)
  if (childAges !== undefined && (!Array.isArray(childAges) || childAges.length > 6 || !childAges.every((a) => Number.isInteger(a) && a >= 0 && a <= 17))) return null;
  if (typeof q !== "string" || !q.trim() || q.length > 100) return null;
  if (typeof checkIn !== "string" || !DATE.test(checkIn) || checkIn < today()) return null;
  if (typeof checkOut !== "string" || !DATE.test(checkOut) || checkOut <= checkIn) return null;
  if (typeof adults !== "number" || !Number.isInteger(adults) || adults < 1 || adults > 9) return null;
  if (token !== undefined && (typeof token !== "string" || !token || token.length > 500)) return null;
  if (page !== undefined && (typeof page !== "string" || !page || page.length > 500)) return null;
  // stars: 성급만 다시 찾을 때 "4" 또는 "4,5" (검색이 2~5성만 받는다)
  if (stars !== undefined && (typeof stars !== "string" || !STARS.test(stars))) return null;
  return { q: normalizeText(q), checkIn, checkOut, adults, childAges: (childAges as number[] | undefined) ?? [], token: token as string | undefined, page: page as string | undefined, stars: stars as string | undefined, fresh: fresh === true, detail: detail === true, place: typeof place === "string" && place.trim() ? normalizeText(place).slice(0, 100) : null };
}

type Rate = { extracted_lowest?: number };
type SerpNearby = { name?: string; transportations?: { type?: string; duration?: string }[] };
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
  nearby_places?: SerpNearby[];
};

// "9분", "1시간 5분", "12 min" → 분. 못 읽으면 null
function minutesOf(d: string | undefined): number | null {
  if (!d) return null;
  const h = /(\d+)\s*(시간|hr|hour)/i.exec(d);
  const m = /(\d+)\s*(분|min)/i.exec(d);
  if (!h && !m) return null;
  return (h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0);
}

const HOW: Record<string, NearPlace["how"]> = { Walking: "도보", "Public transport": "대중교통", Taxi: "택시" };
const AIRPORT = /공항|airport/i;
const STATION = /역(\s*앞)?$|역\s|station/i;
// 식당·가게가 아니라 '주요 장소'로 볼 만한 이름 끝말 (역이 아닌 곳은 이것과 걸어서 20분 이내만)
const SPOT = /(시장|공원|성|신사|신궁|타워|해변|비치|광장|동물원|수족관|대교|궁|사원|거리|도톤보리|스트리트|스카이빌딩|[가-힣]{2}지)$/;

// 카드에 한 줄로 쓸 가까운 곳 하나. 공항·식당(한글 이름이 없는 곳)은 빼고, 역이면 먼저, 그다음 걸어서 가까운 장소.
// 걸어서 20분 넘는 곳은 '가깝다'고 보기 어려워 역이 아니면 쓰지 않는다
function nearOf(list: SerpNearby[] | undefined): NearPlace | null {
  const cands = (list ?? [])
    .filter((n) => n.name && /[가-힣]/.test(n.name) && !AIRPORT.test(n.name))
    .flatMap((n) =>
      (n.transportations ?? []).map((t) => ({ name: n.name!.normalize("NFC"), how: HOW[t.type ?? ""], mins: minutesOf(t.duration) })),
    )
    .filter((c): c is NearPlace => !!c.how && c.mins !== null && c.mins > 0);
  const rank = (c: NearPlace) => (STATION.test(c.name) ? 0 : 1) * 1000 + (c.how === "도보" ? 0 : 500) + c.mins;
  const ok = cands.filter((c) => STATION.test(c.name) || (SPOT.test(c.name) && c.how === "도보" && c.mins <= 20)).sort((a, b) => rank(a) - rank(b));
  return ok[0] ?? null;
}



function toOption(p: SerpProperty): HotelOption | null {
  if (!p.name || !p.property_token) return null;
  const raw = p.prices ?? [];
  const sources = cleanSources(raw);
  // 카드의 큰 숫자는 허용 목록으로 거른 사이트 중 가장 낮은 1박 요금이다.
  // 사이트 가격이 아예 없으면 목록에 온 1박 요금을 쓰고, 그때는 어느 사이트인지 밝히지 않는다.
  // 사이트 가격은 왔는데 모두 허용 목록 밖이면 그 가격을 쓰지 않는다 (목록에서 빠진다)
  const best = lowestNightly(sources);
  if (!best && raw.some((r) => r.source)) return null;
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
    amenities: [...new Set((p.amenities ?? []).map((a) => amenityKo(a.normalize("NFC"))))].slice(0, MAX_AMENITIES),
    deal: [p.deal, p.deal_description].filter(Boolean).map((t) => dealKo(t as string)).join(" · "),
    gps: typeof gps?.latitude === "number" && typeof gps?.longitude === "number" ? [gps.latitude, gps.longitude] : null,
    stars: p.extracted_hotel_class ?? null,
    rating: p.overall_rating ?? null,
    reviews: p.reviews ?? null,
    perNight: best ? best.perNight : (p.rate_per_night?.extracted_lowest ?? null),
    total: best ? best.total : (p.total_rate?.extracted_lowest ?? null),
    priceSource: best?.name ?? null,
    sources: shown.slice(0, 3),
    near: nearOf(p.nearby_places),
    freeCancel: sources.some((s) => s.freeCancel),
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

const nextOf = (raw: Record<string, unknown>) => (raw.serpapi_pagination as { next_page_token?: string } | undefined)?.next_page_token ?? null;

// page2Raw: 인기 도시에서 이어 받은 다음 쪽. 첫 쪽 20곳 뒤에 겹치지 않는 숙소를 붙이고(최대 40곳), 다음 쪽 값은 그 뒤 쪽으로
function shapeList(raw: Record<string, unknown>, upperRaw: Record<string, unknown> | null, page2Raw: Record<string, unknown> | null = null): HotelResults {
  const { props, single } = propsOf(raw);
  const base = optionsOf(props);
  const first = single || !upperRaw ? base.slice(0, MAX_OPTIONS) : mixClasses(base, optionsOf(propsOf(upperRaw).props));
  if (single || !page2Raw) return { options: first, next: nextOf(raw) };
  const have = new Set(first.map((o) => o.token));
  const add = optionsOf(propsOf(page2Raw).props).filter((o) => !have.has(o.token) && have.add(o.token));
  return { options: [...first, ...add].slice(0, MAX_POPULAR), next: nextOf(page2Raw) };
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
  if (q.childAges.length) {
    params.children = String(q.childAges.length);
    params.children_ages = q.childAges.join(",");
  }
  // 같은 조건은 체크인 7일 이내 60분, 그 밖에는 2시간 동안 저장된 응답을 다시 쓴다
  const ttlSec = stayCacheSec(q.checkIn);
  if (q.token) {
    params.property_token = q.token;
    const token = q.token;
    // 새로 받은 예약처 가격은 응답을 보낸 뒤 가격 기록에 남긴다 (q는 숙소 이름)
    // 예약처 3곳 이상이면 홈 '실제 검색 예시' 카드용 스냅샷도 남긴다 (place: 그 검색의 도시, 검색 조건에는 넣지 않는다)
    const onFresh = (d: HotelPrices) => {
      const row = verifiedRow(token, q.q, d.sources, q);
      after(async () => {
        await Promise.all([row ? recordPrices([row]) : null, recordSnapshot(token, q.q, q.place, q, d.sources)]);
      });
    };
    // 예약처별 가격은 12시간 저장해 두고 같이 쓴다 (체크인 7일 안은 60분). 목록 행·상세 페이지가 같은 저장분을 쓴다.
    // 상세 페이지(detail)에서 새로 부를 때만 한 접속 주소당 하루 70번까지 (저장된 가격은 무제한)
    return serpSearch(req, params, shapePrices, undefined, {
      fresh: q.fresh,
      ttlSec: priceCacheSec(q.checkIn),
      ...(q.detail ? { dailyCap: { scope: "detail", max: DETAIL_DAILY_CAP } } : {}),
      ...(supabaseOn() ? { onFresh } : {}),
    }); // fresh: 다시 확인할 때는 저장된 가격을 쓰지 않는다
  }
  // 성급 필터를 누른 사람만: 그 성급만 한 번 찾는다 (검색 1번 요금). 다음 쪽도 같은 성급
  if (q.stars) params.hotel_class = q.stars;
  // 새로 받은 목록 예상가는 응답을 보낸 뒤 가격 기록에 남기고, 숙소 좌표·기본 정보는 hotels_master에 쌓는다 (둘 다 실패해도 응답과 무관)
  const city = popularCity(q.q);
  const cityKey = city ?? q.q.toLowerCase();
  const onFresh = (d: HotelResults) =>
    after(async () => {
      await Promise.all([priceHistoryOn() ? recordPrices(listRows(d.options, { ...q, place: q.q })) : null, recordMaster(d.options, cityKey)]);
    });
  const opts = { ttlSec, ...(supabaseOn() ? { onFresh } : {}) };
  // "호텔 더 보기": Google은 한 번에 20곳 안팎만 주므로 다음 쪽을 따로 부른다 (검색 1번 요금). 다음 쪽은 기본 순서 그대로
  if (q.page) {
    params.next_page_token = q.page;
    return serpSearch(req, params, shapeList, undefined, opts);
  }
  if (q.stars) return serpSearch(req, params, shapeList, undefined, opts);
  // 첫 쪽은 4·5성만 한 번 더 불러 같이 놓고 추천순 비율로 고른다 (검색 2번 요금).
  // 인기 도시(서울·부산·제주 제외)는 다음 쪽까지 한 번 이어 받아 최대 40곳을 6시간 저장한다 (검색 3번 요금, 저장된 동안은 0번).
  // 체크인이 7일 안이면 가격이 자주 바뀌어 저장 시간은 원래대로 60분
  if (city) {
    const follow = (json: Record<string, unknown>) => {
      const next = nextOf(json);
      return next ? { ...params, next_page_token: next } : null;
    };
    const popTtl = ttlSec === STAY_CACHE_NEAR_SEC ? ttlSec : POPULAR_CACHE_SEC;
    return serpSearch(req, params, shapeList, { ...params, hotel_class: "4,5" }, { ...opts, ttlSec: popTtl, follow });
  }
  return serpSearch(req, params, shapeList, { ...params, hotel_class: "4,5" }, opts);
}

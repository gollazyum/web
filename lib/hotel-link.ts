import type { HotelOption } from "./hotels";
import type { StayQuery } from "./trip";

// 전용 숙소 상세 페이지 (/hotels/[propertyToken]) 주소와, 새 탭에서 바로 그릴 숙소 미리 보기.
// 새 탭은 이 탭의 화면 상태·sessionStorage를 같이 쓰지 못하므로 주소에는 검색 조건만 담고,
// 숙소 이름·사진·좌표는 이 기기 localStorage(최근 50곳)에서 먼저 꺼내 그린다. 비어 있으면 서버(hotels_master)에서 받는다

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function hotelHref(token: string, q: StayQuery): string {
  const p = new URLSearchParams({ checkIn: q.checkIn, checkOut: q.checkOut, adults: String(q.adults), rooms: String(q.rooms ?? 1), q: q.place });
  if (q.childAges?.length) p.set("ages", q.childAges.join(","));
  return `/hotels/${encodeURIComponent(token)}?${p}`;
}

// /hotels/<token> → token (아니면 null)
export function hotelTokenOf(pathname: string): string | null {
  const m = /^\/hotels\/([^/?#]+)\/?$/.exec(pathname);
  if (!m) return null;
  try {
    const t = decodeURIComponent(m[1]);
    return t && t.length <= 500 ? t : null;
  } catch {
    return null;
  }
}

// 상세 주소의 검색 조건. 날짜가 없거나 틀리면 null (그때는 가격 비교 대신 날짜를 고르라는 안내)
export function hotelQueryOf(search: string): StayQuery | null {
  const sp = new URLSearchParams(search);
  const one = (k: string) => (sp.get(k) ?? "").trim();
  const checkIn = one("checkIn");
  const checkOut = one("checkOut");
  const adults = Number(one("adults") || 2);
  const rooms = Number(one("rooms") || 1);
  const place = one("q").slice(0, 100);
  if (!DATE.test(checkIn) || !DATE.test(checkOut) || checkOut <= checkIn) return null;
  if (!Number.isInteger(adults) || adults < 1 || adults > 9) return null;
  const ages = one("ages") ? one("ages").split(",").map(Number) : [];
  const agesOk = ages.length && ages.length <= 6 && ages.every((a) => Number.isInteger(a) && a >= 0 && a <= 17) ? { childAges: ages } : {};
  return { place, checkIn, checkOut, adults, budget: 0, taste: "", ...(Number.isInteger(rooms) && rooms > 1 && rooms <= 9 ? { rooms } : {}), ...agesOk };
}

// ---------- 최근 본 숙소 미리 보기 (이 기기) ----------
export const PREVIEW_KEY = "recent_hotel_previews_v1";
const PREVIEW_MAX = 50;

export type HotelPreview = {
  propertyToken: string;
  name: string;
  starRating: number | null;
  rating: number | null;
  reviewsCount: number | null;
  lat: number | null;
  lng: number | null;
  photos: string[];
  previewLowestPrice: number | null; // 목록에서 보이던 N박 총액 (확인 전이면 예상)
  at: number;
  hotel?: HotelOption; // 같은 기기에서 연 숙소는 목록에 온 정보 전체 (편의시설·예약처 몇 곳 등)
};

function readAll(): HotelPreview[] {
  try {
    const raw = localStorage.getItem(PREVIEW_KEY);
    const list = raw ? (JSON.parse(raw) as HotelPreview[]) : [];
    return Array.isArray(list) ? list.filter((x) => x && typeof x.propertyToken === "string") : [];
  } catch {
    return [];
  }
}

export function savePreview(h: HotelOption, lowest: number | null) {
  const p: HotelPreview = {
    propertyToken: h.token,
    name: h.name,
    starRating: h.stars,
    rating: h.rating,
    reviewsCount: h.reviews,
    lat: h.gps?.[0] ?? null,
    lng: h.gps?.[1] ?? null,
    photos: (h.images.length ? h.images : h.image ? [h.image] : []).slice(0, 8),
    previewLowestPrice: lowest,
    at: Date.now(),
    hotel: h,
  };
  const list = [p, ...readAll().filter((x) => x.propertyToken !== h.token)].slice(0, PREVIEW_MAX);
  try {
    localStorage.setItem(PREVIEW_KEY, JSON.stringify(list));
  } catch {
    // 저장소가 가득 차면 절반만 남기고 한 번 더
    try {
      localStorage.setItem(PREVIEW_KEY, JSON.stringify(list.slice(0, Math.floor(PREVIEW_MAX / 2))));
    } catch {
      // 저장하지 못하면 새 탭에서는 서버 정보로 그린다
    }
  }
}

export function readPreview(token: string): HotelPreview | null {
  return readAll().find((x) => x.propertyToken === token) ?? null;
}

// 서버(hotels_master)에서 받은 기본 정보 (유료 검색 0회)
export type HotelSeed = { token: string; name: string; stars: number | null; rating: number | null; reviews: number | null; lat: number; lng: number; image: string | null; city: string | null };

// 미리 보기·서버 정보 → 상세 화면이 쓰는 숙소 (모르는 칸은 비워 둔다. 지어내지 않는다)
export function hotelFromPreview(p: HotelPreview): HotelOption {
  if (p.hotel && p.hotel.token === p.propertyToken) return p.hotel;
  return {
    token: p.propertyToken,
    name: p.name,
    image: p.photos[0] ?? "",
    images: p.photos,
    kind: "",
    amenities: [],
    deal: "",
    gps: p.lat !== null && p.lng !== null ? [p.lat, p.lng] : null,
    stars: p.starRating,
    rating: p.rating,
    reviews: p.reviewsCount,
    perNight: null,
    total: null,
    priceSource: null,
    sources: [],
    near: null,
    freeCancel: false,
  };
}

export function hotelFromSeed(s: HotelSeed): HotelOption {
  return hotelFromPreview({ propertyToken: s.token, name: s.name, starRating: s.stars, rating: s.rating, reviewsCount: s.reviews, lat: s.lat, lng: s.lng, photos: s.image ? [s.image] : [], previewLowestPrice: null, at: 0 });
}

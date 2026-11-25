import type { HotelOption, HotelSource } from "./hotels";

// 숙소 가격 기록(hotel_price_history) 한 줄. 화면에는 쓰지 않고, 나중에 '평소 가격'과 견주려고 쌓아 둔다.
// 확인 안 된 값은 지어내지 않는다: 무료 취소는 확인된 경우만 true, 모르면 null
export type PriceRow = {
  property_token: string;
  hotel_name: string;
  place: string | null;
  stay_date: string;
  nights: number;
  adults: number;
  is_weekend: boolean;
  lead_days: number;
  price_kind: "list" | "verified";
  nightly_krw: number;
  total_krw: number | null;
  best_vendor: string | null;
  is_refundable: true | null;
  recorded_at: string;
};

export type StayCtx = { checkIn: string; checkOut: string; adults: number; childAges: number[] };

const DAY = 86_400_000;
const utc = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

// 한국 날짜 (YYYY-MM-DD)
export function kstToday(now = Date.now()): string {
  return new Date(now + 9 * 3_600_000).toISOString().slice(0, 10);
}

const okPrice = (n: number | null | undefined): n is number => typeof n === "number" && Number.isFinite(n) && n > 0;
const krw = (n: number | null | undefined) => (okPrice(n) ? Math.round(n) : null);

// 날짜·인원 공통 칸. 아이가 있는 검색이나 이상한 날짜는 기록하지 않는다 (null)
function base(q: StayCtx, now: number) {
  if (q.childAges.length) return null;
  const nights = Math.round((utc(q.checkOut) - utc(q.checkIn)) / DAY);
  if (!(nights >= 1 && nights <= 30)) return null;
  const recorded_at = kstToday(now);
  const dow = new Date(utc(q.checkIn)).getUTCDay();
  return {
    stay_date: q.checkIn,
    nights,
    adults: q.adults,
    is_weekend: dow === 5 || dow === 6,
    lead_days: Math.round((utc(q.checkIn) - utc(recorded_at)) / DAY),
    recorded_at,
  };
}

// 숙소 목록 검색 결과 → 목록 예상가 기록
export function listRows(options: HotelOption[], q: StayCtx & { place: string }, now = Date.now()): PriceRow[] {
  const b = base(q, now);
  if (!b) return [];
  return options.flatMap((h) => {
    const nightly = krw(h.perNight);
    if (!nightly || !h.token) return [];
    const best = h.priceSource ? h.sources.find((s) => s.name === h.priceSource) : undefined;
    return [{
      property_token: h.token,
      hotel_name: h.name.slice(0, 200),
      place: q.place.slice(0, 100),
      ...b,
      price_kind: "list" as const,
      nightly_krw: nightly,
      total_krw: krw(h.total),
      best_vendor: h.priceSource,
      is_refundable: best?.freeCancel === true ? true : null,
    }];
  });
}

// 숙소 한 곳의 예약처별 가격(허용 판매처만) → 가장 싼 예약처 1줄
export function verifiedRow(token: string, name: string, sources: HotelSource[], q: StayCtx, now = Date.now()): PriceRow | null {
  const b = base(q, now);
  if (!b || !token) return null;
  const priced = sources.filter((s) => okPrice(s.perNight));
  if (!priced.length) return null;
  const best = priced.reduce((a, s) => (s.perNight! < a.perNight! ? s : a));
  return {
    property_token: token,
    hotel_name: name.slice(0, 200),
    place: null,
    ...b,
    price_kind: "verified",
    nightly_krw: Math.round(best.perNight!),
    total_krw: krw(best.total),
    best_vendor: best.name,
    is_refundable: best.freeCancel === true ? true : null,
  };
}

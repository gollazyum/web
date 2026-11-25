import "server-only";
import { timingSafeEqual } from "node:crypto";
import { bestForRefundable, kstDate, MAX_DAILY_PRICE_CHECKS, nextCheckAt, shouldAlert } from "./booking-watch";
import { shapePrices } from "./hotel-prices";
import { sellerRows, type HotelPrices } from "./hotels";
import { verifiedRow } from "./price-history-rows";
import { recordPrices } from "./price-history";
import { cached, cacheKey, normalizeText } from "./search-cache";
import { searchOnce } from "./serpapi";
import { stayCacheSec } from "./stay-cache";
import { rpc, sb } from "./supabase-server";

// 가격 지킴이 서버 쪽: 예약 행 읽기·쓰기, 예약처 가격 받기(하루 상한), 결과 반영

export type WatchRow = {
  id: string;
  device_token: string;
  property_token: string;
  hotel_name: string;
  place: string | null;
  check_in: string;
  check_out: string;
  adults: number;
  booked_price: number;
  booked_vendor: string | null;
  free_cancel_until: string | null;
  watch_until: string;
  latest_lowest_price: number | null;
  latest_lowest_vendor: string | null;
  latest_free_cancel: boolean | null;
  last_alerted_price: number | null;
  alerted_at: string | null;
  last_checked_at: string | null;
  next_check_at: string;
  status: "active" | "expired" | "stopped";
  created_at: string;
};

// 화면에 보내는 모양 (기기 번호는 빼고)
export function publicRow(r: WatchRow) {
  return {
    id: r.id,
    token: r.property_token,
    name: r.hotel_name,
    place: r.place ?? "",
    checkIn: r.check_in,
    checkOut: r.check_out,
    adults: r.adults,
    bookedPrice: r.booked_price,
    bookedVendor: r.booked_vendor,
    freeCancelUntil: r.free_cancel_until,
    watchUntil: r.watch_until,
    latest: r.latest_lowest_price,
    latestVendor: r.latest_lowest_vendor,
    latestFreeCancel: r.latest_free_cancel,
    alerted: r.last_alerted_price !== null,
    alertedAt: r.alerted_at,
    checkedAt: r.last_checked_at,
    status: r.status,
  };
}
export type PublicWatch = ReturnType<typeof publicRow>;

export function cronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // 비밀값이 없으면 유료 조회가 걸린 크론은 돌리지 않는다
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

export class CapReached extends Error {}

const enc = encodeURIComponent;
export const byDevice = (device: string, extra = "") => sb<WatchRow[]>(`watched_bookings?device_token=eq.${enc(device)}${extra}&order=created_at.desc&limit=20`);
export const byId = async (id: string, device: string) =>
  (await sb<WatchRow[]>(`watched_bookings?id=eq.${enc(id)}&device_token=eq.${enc(device)}&limit=1`))[0] ?? null;
export const patchRows = (ids: string[], body: Partial<WatchRow>) =>
  sb(`watched_bookings?id=in.(${ids.map(enc).join(",")})`, { method: "PATCH", body, prefer: "return=minimal" });

type StayKey = Pick<WatchRow, "property_token" | "hotel_name" | "check_in" | "check_out" | "adults">;

// 숙소 한 곳의 예약처 가격. 화면 검색과 같은 캐시 키를 써서 30분~2시간 안에 본 값은 다시 사지 않는다.
// 캐시에 없어 실제로 조회해야 할 때만, 조회 직전에 하루 횟수를 먼저 1 올리고 상한을 넘으면 CapReached
export async function stayPricesFor(s: StayKey, timeoutMs: number): Promise<HotelPrices> {
  const params: Record<string, string> = {
    engine: "google_hotels",
    q: normalizeText(s.hotel_name.slice(0, 100)),
    check_in_date: s.check_in,
    check_out_date: s.check_out,
    adults: String(s.adults),
    currency: "KRW",
    hl: "ko",
    gl: "kr",
    property_token: s.property_token,
  };
  const { data } = await cached<HotelPrices>(cacheKey("travel", params, null), stayCacheSec(s.check_in), async () => {
    const used = await rpc<number>("increment_daily_api_usage", { target_date: kstDate(Date.now()), delta: 1 });
    if (typeof used !== "number" || used > MAX_DAILY_PRICE_CHECKS) throw new CapReached();
    return shapePrices(await searchOnce(params, timeoutMs));
  });
  return data;
}

// 받은 가격을 같은 조건의 예약 행들에 반영한다 (알림 기준은 행마다)
export async function applyPrices(rows: WatchRow[], prices: HotelPrices, now: number): Promise<WatchRow[]> {
  const s = rows[0];
  const nights = Math.round((Date.parse(s.check_out) - Date.parse(s.check_in)) / 86_400_000);
  const list = sellerRows(prices.sources, nights, s.hotel_name, { q: s.place ?? s.hotel_name, checkIn: s.check_in, checkOut: s.check_out, adults: s.adults });
  const best = bestForRefundable(list);
  const out: WatchRow[] = [];
  for (const r of rows) {
    const alert = shouldAlert(r.booked_price, best?.price ?? null, r.last_alerted_price);
    const body: Partial<WatchRow> = {
      latest_lowest_price: best?.price ?? null,
      latest_lowest_vendor: best?.vendor ?? null,
      latest_free_cancel: best?.freeCancel ?? null,
      last_checked_at: new Date(now).toISOString(),
      next_check_at: new Date(nextCheckAt(r.check_in, now)).toISOString(),
      ...(alert && best ? { last_alerted_price: best.price, alerted_at: new Date(now).toISOString() } : {}),
    };
    await patchRows([r.id], body);
    out.push({ ...r, ...body });
  }
  const hist = verifiedRow(s.property_token, s.hotel_name, prices.sources, { checkIn: s.check_in, checkOut: s.check_out, adults: s.adults, childAges: [] }, now);
  if (hist) await recordPrices([hist]);
  return out;
}

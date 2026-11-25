import { DEVICE_MAX, kstLocalToMs, LATE_MESSAGE, parseWatchInput, tooLate, watchUntil } from "@/lib/booking-watch";
import { byDevice, publicRow, type WatchRow } from "@/lib/booking-watch-server";
import { sb, supabaseOn } from "@/lib/supabase-server";

// 가격 지킴이 등록: 예약한 숙소·날짜·결제 총액·무료 취소 마감을 저장한다. 첫 가격 확인은 크론이 한다
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const no = (error: string, status: number, message?: string) => Response.json({ error, ...(message ? { message } : {}) }, { status });

export async function POST(req: Request) {
  if (!supabaseOn()) return no("not_configured", 503);
  const w = parseWatchInput(await req.json().catch(() => null));
  if (!w) return no("bad_request", 400);
  const now = Date.now();
  const fcu = w.freeCancelUntil ? kstLocalToMs(w.freeCancelUntil) : null;
  const until = watchUntil(w.checkIn, fcu);
  if (tooLate(w.checkIn, until, now)) return no("too_late", 422, LATE_MESSAGE);
  try {
    const mine = await byDevice(w.device, "&status=eq.active");
    if (mine.length >= DEVICE_MAX) return no("too_many", 422, `가격 지킴이는 한 번에 ${DEVICE_MAX}개까지 등록할 수 있어요`);
    const same = mine.find((r) => r.property_token === w.token && r.check_in === w.checkIn && r.check_out === w.checkOut && r.adults === w.adults);
    if (same) return Response.json({ watch: publicRow(same) });
    const [row] = await sb<WatchRow[]>("watched_bookings", {
      method: "POST",
      prefer: "return=representation",
      body: {
        device_token: w.device,
        property_token: w.token,
        hotel_name: w.name,
        place: w.place || null,
        check_in: w.checkIn,
        check_out: w.checkOut,
        adults: w.adults,
        booked_price: w.bookedPrice,
        booked_vendor: w.bookedVendor,
        free_cancel_until: fcu === null ? null : new Date(fcu).toISOString(),
        watch_until: new Date(until).toISOString(),
        next_check_at: new Date(now).toISOString(), // 첫 확인은 다음 크론(15분 안)에. 방금 본 가격이면 캐시라 조회 비용이 없다
      },
    });
    return Response.json({ watch: publicRow(row) });
  } catch {
    return no("db", 502);
  }
}

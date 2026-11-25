import { CAP_MESSAGE, RECHECK_COOLDOWN_MS, validDevice } from "@/lib/booking-watch";
import { applyPrices, byId, CapReached, publicRow, stayPricesFor } from "@/lib/booking-watch-server";
import { supabaseOn } from "@/lib/supabase-server";

// 가격 지킴이 '지금 다시 확인'. 예약마다 10분에 한 번, 실제 조회는 크론과 같은 하루 상한에 들어간다
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const ID = /^[0-9a-f-]{36}$/i;

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!supabaseOn()) return Response.json({ error: "not_configured" }, { status: 503 });
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as { device?: unknown } | null;
  if (!ID.test(id) || !validDevice(body?.device)) return Response.json({ error: "bad_request" }, { status: 400 });
  try {
    const row = await byId(id, body.device);
    if (!row) return Response.json({ error: "not_found" }, { status: 404 });
    if (row.status !== "active") return Response.json({ watch: publicRow(row) });
    const now = Date.now();
    if (row.last_checked_at && now - Date.parse(row.last_checked_at) < RECHECK_COOLDOWN_MS) {
      return Response.json({ watch: publicRow(row), message: "방금 확인했어요. 10분 뒤에 다시 확인할 수 있어요" });
    }
    const prices = await stayPricesFor(row, 20_000);
    const [next] = await applyPrices([row], prices, now);
    return Response.json({ watch: publicRow(next) });
  } catch (e) {
    if (e instanceof CapReached) return Response.json({ error: "cap", message: CAP_MESSAGE }, { status: 429 });
    return Response.json({ error: "upstream", message: "가격을 확인하지 못했어요. 잠시 뒤 다시 시도해 주세요" }, { status: 502 });
  }
}

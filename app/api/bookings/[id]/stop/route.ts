import { validDevice } from "@/lib/booking-watch";
import { byId, patchRows } from "@/lib/booking-watch-server";
import { supabaseOn } from "@/lib/supabase-server";

// 가격 지킴이 그만 보기
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ID = /^[0-9a-f-]{36}$/i;

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!supabaseOn()) return Response.json({ error: "not_configured" }, { status: 503 });
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as { device?: unknown } | null;
  if (!ID.test(id) || !validDevice(body?.device)) return Response.json({ error: "bad_request" }, { status: 400 });
  try {
    const row = await byId(id, body.device);
    if (!row) return Response.json({ error: "not_found" }, { status: 404 });
    await patchRows([row.id], { status: "stopped" });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "db" }, { status: 502 });
  }
}

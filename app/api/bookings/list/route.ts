import { validDevice } from "@/lib/booking-watch";
import { byDevice, publicRow } from "@/lib/booking-watch-server";
import { supabaseOn } from "@/lib/supabase-server";

// 이 기기에서 등록한 가격 지킴이 목록 (그만 본 것은 빼고)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!supabaseOn()) return Response.json({ watches: [], off: true });
  const body = (await req.json().catch(() => null)) as { device?: unknown } | null;
  if (!validDevice(body?.device)) return Response.json({ error: "bad_request" }, { status: 400 });
  try {
    const rows = await byDevice(body.device, "&status=neq.stopped");
    return Response.json({ watches: rows.map(publicRow) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "db" }, { status: 502 });
  }
}

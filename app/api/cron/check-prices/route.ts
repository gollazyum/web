import { kstDate } from "@/lib/booking-watch";
import { applyPrices, CapReached, cronAuthorized, patchRows, stayPricesFor, type WatchRow } from "@/lib/booking-watch-server";
import { sb, supabaseOn } from "@/lib/supabase-server";

// 가격 지킴이 크론. Supabase Cron이 15분마다 부른다 (supabase/price-watch.sql).
// 1) 마감 6시간 전이 지난 예약은 조회 없이 끝낸다
// 2) 다시 볼 때가 된 예약을 같은 숙소·날짜·인원끼리 묶어, 오래된 순으로 한 번에 최대 10묶음만 조회한다 (묶음당 조회 1번)
// 3) 하루 유료 조회 상한을 넘으면 바로 멈추고, 24초가 지나면 남은 묶음은 다음 실행으로 넘긴다
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MAX_GROUPS = 10;
const enc = encodeURIComponent;
const STOP_AT_MS = 24_000;
const RETRY_MS = 60 * 60_000; // 조회 실패한 묶음은 1시간 뒤에 다시
const KEEP_DAYS = 30; // 끝난 예약은 체크아웃 30일 뒤 지운다

export async function POST(req: Request) {
  if (!cronAuthorized(req)) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!supabaseOn()) return Response.json({ error: "not_configured" }, { status: 503 });
  const started = Date.now();
  const nowIso = new Date(started).toISOString();
  let step = "expire";
  const out = { expired: 0, groups: 0, checked: 0, failed: 0, cap: false, timeUp: false };
  try {
    // or=(…) 안에서는 시각의 ':'·'.'를 따옴표로 감싸야 해서, 두 조건을 따로 끝낸다
    for (const cond of [`watch_until=lte.${enc(nowIso)}`, `check_in=lte.${kstDate(started)}`]) {
      const gone = await sb<{ id: string }[]>(`watched_bookings?status=eq.active&${cond}&select=id`, {
        method: "PATCH",
        body: { status: "expired" },
        prefer: "return=representation",
      });
      out.expired += gone.length;
    }
    step = "cleanup";
    const old = new Date(started - KEEP_DAYS * 86_400_000).toISOString().slice(0, 10);
    await sb(`watched_bookings?status=neq.active&check_out=lt.${old}`, { method: "DELETE", prefer: "return=minimal" });

    step = "due";
    const due = await sb<WatchRow[]>(`watched_bookings?status=eq.active&next_check_at=lte.${enc(nowIso)}&order=next_check_at.asc&limit=200`);
    const groups = new Map<string, WatchRow[]>();
    for (const r of due) {
      const k = [r.property_token, r.check_in, r.check_out, r.adults].join("|");
      if (!groups.has(k) && groups.size >= MAX_GROUPS) continue;
      groups.set(k, [...(groups.get(k) ?? []), r]);
    }
    for (const rows of groups.values()) {
      const left = STOP_AT_MS - (Date.now() - started);
      if (left < 4_000) {
        out.timeUp = true;
        break;
      }
      out.groups++;
      try {
        const prices = await stayPricesFor(rows[0], Math.min(15_000, left));
        await applyPrices(rows, prices, Date.now());
        out.checked += rows.length;
      } catch (e) {
        if (e instanceof CapReached) {
          out.cap = true;
          break;
        }
        out.failed++;
        await patchRows(rows.map((r) => r.id), { next_check_at: new Date(Date.now() + RETRY_MS).toISOString() }).catch(() => {});
      }
    }
  } catch (e) {
    console.error("[price-watch] cron", e instanceof Error ? e.message : e);
    // 어느 단계에서 멈췄는지 응답에 남긴다 (Supabase의 net._http_response 에서 볼 수 있게, 비밀값·내용은 넣지 않는다)
    return Response.json({ error: "db", step, detail: e instanceof Error ? e.message.slice(0, 40) : "", ...out }, { status: 502 });
  }
  return Response.json({ ok: true, ...out });
}

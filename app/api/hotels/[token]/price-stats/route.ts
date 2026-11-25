import { historyStats, type HistoryRow } from "@/lib/usual-price";
import { sb, supabaseOn } from "@/lib/supabase-server";

// 숙소 상세 '평소 가격과 비교'용 기록 평균. hotel_price_history 만 읽는다 (외부 유료 검색 호출 0회).
// GET /api/hotels/{token}/price-stats?adults=2&weekend=1 → { days, avgNightly }
// 기록이 없거나 Supabase가 꺼져 있으면 days: 0 (화면은 이번 검색 결과 동급 비교로 넘어간다)
export const runtime = "nodejs";

const EMPTY = { days: 0, avgNightly: null };
const ok = (body: unknown, cache = true) => Response.json(body, { headers: cache ? { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=600" } : { "Cache-Control": "no-store" } });

export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const sp = new URL(req.url).searchParams;
  const adults = Number(sp.get("adults"));
  const weekend = sp.get("weekend") === "1";
  if (!token || token.length > 500 || !Number.isInteger(adults) || adults < 1 || adults > 9) return Response.json({ error: "bad_request" }, { status: 400 });
  if (!supabaseOn()) return ok(EMPTY, false);
  try {
    // 최근 90일 기록만 (오래된 가격은 '평소'가 아니다)
    const since = new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10);
    const q = new URLSearchParams({
      select: "recorded_at,nights,total_krw,is_weekend",
      property_token: `eq.${token}`,
      adults: `eq.${adults}`,
      recorded_at: `gte.${since}`,
      order: "recorded_at.desc",
      limit: "500",
    });
    const rows = await sb<HistoryRow[]>(`hotel_price_history?${q}`);
    return ok(historyStats(rows ?? [], weekend));
  } catch {
    return ok(EMPTY, false);
  }
}

import { homeLows, type HistoryRow, type RecentRow } from "@/lib/usual-price";
import { kstToday } from "@/lib/price-history-rows";
import { sb, supabaseOn } from "@/lib/supabase-server";

// 홈 '평소보다 낮은 숙소': hotel_price_history 에 이미 쌓인 기록만 읽는다 (외부 유료 검색 호출 0회).
// 최근 2일 안에 기록된 성인 2명 숙소 가격 중, 같은 숙소의 지난 기록 평균보다 10% 이상 낮은 곳. 기록이 5일치가 안 되면 빈 목록
export const runtime = "nodejs";

const CANDIDATES = 40;

export async function GET() {
  const headers = { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=600" };
  if (!supabaseOn()) return Response.json({ items: [] }, { headers: { "Cache-Control": "no-store" } });
  try {
    const today = kstToday();
    const since = new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10);
    const rq = new URLSearchParams({
      select: "property_token,hotel_name,place,stay_date,recorded_at,nights,total_krw,is_weekend",
      adults: "eq.2",
      recorded_at: `gte.${since}`,
      stay_date: `gt.${today}`,
      place: "not.is.null",
      total_krw: "not.is.null",
      order: "recorded_at.desc",
      limit: "1000",
    });
    const recent = (await sb<RecentRow[]>(`hotel_price_history?${rq}`)) ?? [];
    // 숙소마다 1박이 가장 낮은 기록 하나만 후보로
    const low = new Map<string, number>();
    for (const r of recent) {
      const v = (r.total_krw ?? Infinity) / r.nights;
      if (v < (low.get(r.property_token) ?? Infinity)) low.set(r.property_token, v);
    }
    const tokens = [...low.entries()].sort((a, b) => a[1] - b[1]).slice(0, CANDIDATES).map(([t]) => t);
    if (!tokens.length) return Response.json({ items: [] }, { headers });
    const hq = new URLSearchParams({
      select: "property_token,recorded_at,nights,total_krw,is_weekend",
      adults: "eq.2",
      recorded_at: `gte.${new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10)}`,
      property_token: `in.(${tokens.map((t) => `"${t.replace(/"/g, "")}"`).join(",")})`,
      limit: "5000",
    });
    const history = (await sb<(HistoryRow & { property_token: string })[]>(`hotel_price_history?${hq}`)) ?? [];
    const set = new Set(tokens);
    return Response.json({ items: homeLows(recent.filter((r) => set.has(r.property_token)), history) }, { headers });
  } catch {
    return Response.json({ items: [] }, { headers: { "Cache-Control": "no-store" } });
  }
}

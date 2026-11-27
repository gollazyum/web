import { HOME_PLACES } from "@/lib/home-places";
import { kstToday } from "@/lib/price-history-rows";
import { sb, supabaseOn } from "@/lib/supabase-server";
import { cityLows, type CityRow } from "@/lib/home-cities";

// 홈 '지금 많이 찾는 관심 여행지' 카드의 "2박 총액 ○원부터" (2026-11-27 PR 2/3).
// hotel_price_history 에 이미 쌓인 기록만 읽는다 (외부 유료 검색 0회). 기록이 없는 도시는 빼서 카드에 금액을 쓰지 않는다 (지어내지 않는다).
// - 지금: 최근 2일 안에 기록된 성인 2명 · 2박 · 체크인이 오늘 이후인 숙소 총액 중 가장 낮은 값
// - 지난주: 7~13일 전에 기록된 같은 조건의 가장 낮은 값. 지금이 1% 이상 낮을 때만 pct
export const runtime = "nodejs";

const day = (n: number) => new Date(Date.now() + 9 * 3_600_000 - n * 86_400_000).toISOString().slice(0, 10);

export async function GET() {
  const headers = { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=600" };
  if (!supabaseOn()) return Response.json({ items: [] }, { headers: { "Cache-Control": "no-store" } });
  try {
    const places = HOME_PLACES.map((p) => p.name);
    const inPlaces = `in.(${places.map((p) => `"${p}"`).join(",")})`;
    const base = { select: "place,total_krw,recorded_at", adults: "eq.2", nights: "eq.2", place: inPlaces, total_krw: "not.is.null", stay_date: `gt.${kstToday()}`, limit: "5000" };
    const [recent, lastWeek] = await Promise.all([
      sb<CityRow[]>(`hotel_price_history?${new URLSearchParams({ ...base, recorded_at: `gte.${day(1)}` })}`),
      sb<CityRow[]>(`hotel_price_history?${new URLSearchParams({ ...base })}&recorded_at=gte.${day(13)}&recorded_at=lte.${day(7)}`),
    ]);
    return Response.json({ items: cityLows(recent ?? [], lastWeek ?? [], places) }, { headers });
  } catch {
    return Response.json({ items: [] }, { headers: { "Cache-Control": "no-store" } });
  }
}

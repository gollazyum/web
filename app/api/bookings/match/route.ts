import { sb, supabaseOn } from "@/lib/supabase-server";
import { matchTerm } from "@/lib/booking-match";

// 예약 등록 숙소 이름 자동완성·연결: 검색에 나온 적 있는 숙소 목록(hotels_master)에서만 찾는다 (유료 검색 0회)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Row = { property_token: string; name: string; city_key: string; thumbnail_url: string | null };

export async function GET(req: Request) {
  const term = matchTerm(new URL(req.url).searchParams.get("q") ?? "");
  if (!term || !supabaseOn()) return Response.json({ hotels: [] });
  try {
    const rows = await sb<Row[]>(`hotels_master?name=ilike.${encodeURIComponent(`*${term}*`)}&select=property_token,name,city_key,thumbnail_url&order=reviews_count.desc.nullslast&limit=6`);
    return Response.json(
      { hotels: rows.map((r) => ({ token: r.property_token, name: r.name, city: r.city_key, image: r.thumbnail_url })) },
      { headers: { "Cache-Control": "public, s-maxage=600" } },
    );
  } catch {
    return Response.json({ hotels: [] });
  }
}

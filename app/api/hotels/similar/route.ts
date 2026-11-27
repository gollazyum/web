import { sb, supabaseOn } from "@/lib/supabase-server";
import { pickSimilar, SIM_MAX } from "@/lib/similar-hotels";

// 숙소 상세 '비슷한 후보 숙소': 같은 탭에 검색 목록이 없을 때(새 탭·공유 링크) 검색에 나온 적 있는 숙소 목록(hotels_master)에서 고른다.
// 유료 검색 0회, 가격 없이 이름·평점·사진만
export const runtime = "nodejs";

type Row = { property_token: string; city_key: string; name: string; lat: number; lng: number; star_rating: number | null; rating: number | null; reviews_count: number | null; thumbnail_url: string | null };
const COLS = "property_token,city_key,name,lat,lng,star_rating,rating,reviews_count,thumbnail_url";

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  if (!token || token.length > 500 || !supabaseOn()) return Response.json({ hotels: [] });
  try {
    const [me] = await sb<Row[]>(`hotels_master?property_token=eq.${encodeURIComponent(token)}&select=${COLS}&limit=1`);
    if (!me) return Response.json({ hotels: [] });
    const d = 0.05; // 약 5km 상자 안에서만 받는다
    const rows = await sb<Row[]>(
      `hotels_master?city_key=eq.${encodeURIComponent(me.city_key)}&lat=gte.${me.lat - d}&lat=lte.${me.lat + d}&lng=gte.${me.lng - d}&lng=lte.${me.lng + d}&select=${COLS}&limit=200`,
    );
    const cand = (r: Row) => ({ token: r.property_token, gps: [r.lat, r.lng] as [number, number], stars: r.star_rating, rating: r.rating === null ? null : Number(r.rating), reviews: r.reviews_count, price: null, name: r.name, image: r.thumbnail_url });
    const picked = pickSimilar(cand(me), rows.map(cand), SIM_MAX);
    return Response.json({ hotels: picked }, { headers: { "Cache-Control": "public, s-maxage=3600" } });
  } catch {
    return Response.json({ hotels: [] });
  }
}

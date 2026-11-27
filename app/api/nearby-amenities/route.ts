import { nearbyAmenities } from "@/lib/nearby-amenities";

// 숙소 상세 페이지에 들어왔을 때 그 숙소 1곳만 부른다 (목록 미리 부르기 없음).
// 30일 저장분이 있으면 외부 호출 0번. 실패하면 { amenities: null } → 화면은 요약 줄을 숨긴다
export const runtime = "nodejs";

const WINDOW_MS = 10 * 60 * 1000;
const LIMIT = 40;
const hits = new Map<string, { n: number; reset: number }>();

function limited(req: Request): boolean {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
  const now = Date.now();
  const e = hits.get(ip);
  if (!e || e.reset < now) {
    if (hits.size > 5_000) hits.clear();
    hits.set(ip, { n: 1, reset: now + WINDOW_MS });
    return false;
  }
  e.n += 1;
  return e.n > LIMIT;
}

export async function GET(req: Request) {
  const u = new URL(req.url);
  const lat = Number(u.searchParams.get("lat"));
  const lng = Number(u.searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  if (limited(req)) return Response.json({ amenities: null }, { status: 429 });
  const { data, hit } = await nearbyAmenities(lat, lng);
  return Response.json(
    { amenities: data },
    { headers: { "Cache-Control": data ? "public, s-maxage=86400, stale-while-revalidate=86400" : "no-store", "x-cache": hit ? "HIT" : "MISS" } },
  );
}

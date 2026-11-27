import { latestSnapshot } from "@/lib/seller-snapshot";

// 홈 첫 화면 '실제 검색 예시' 카드: 이미 저장된 예약처별 총액 스냅샷만 읽는다 (외부 유료 검색 0회).
// 없으면 { snap: null } → 화면은 '이해를 돕기 위한 예시 화면이에요' 예시 카드로
export const runtime = "nodejs";

export async function GET() {
  try {
    const snap = await latestSnapshot();
    return Response.json({ snap }, { headers: { "Cache-Control": snap ? "public, s-maxage=600, stale-while-revalidate=600" : "public, s-maxage=120" } });
  } catch {
    return Response.json({ snap: null }, { headers: { "Cache-Control": "no-store" } });
  }
}

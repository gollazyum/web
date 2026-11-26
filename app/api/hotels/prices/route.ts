import { POST as hotels } from "../route";

// 숙소 한 곳의 예약처별 가격 (화면의 가격 확인 전용 주소).
// 하는 일은 /api/hotels 에 token을 넣어 부르는 것과 같다. 주소만 나눠 두어 Network 탭에서 '목록 검색'과 '가격 확인'이 바로 구분된다
export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.token !== "string" || !body.token) return Response.json({ error: "bad_request" }, { status: 400 });
  // 사용량 제한이 보는 접속 주소 머리글은 그대로 넘긴다
  const headers = new Headers(req.headers);
  headers.delete("content-length");
  return hotels(new Request(req.url, { method: "POST", headers, body: JSON.stringify(body) }));
}

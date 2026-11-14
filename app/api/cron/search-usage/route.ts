import { checkSearchUsage } from "@/lib/search-usage";

// 하루 한 번 Vercel Cron이 부른다 (vercel.json). 남은 검색 사용량을 서버 로그에 남기고, 20% 아래면 경고한다.
// CRON_SECRET 환경변수가 있으면 Vercel이 보내는 Authorization 헤더가 맞을 때만 실행한다.
// 응답에는 사용량 숫자를 넣지 않는다 (로그에서만 본다)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const summary = await checkSearchUsage();
  return Response.json({ ok: summary !== null });
}

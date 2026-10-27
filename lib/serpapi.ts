// SerpApi 공통 호출. 서버에서만 쓴다. API 키는 Vercel 환경변수 SERPAPI_API_KEY 에만 둔다.
// 검색 1번마다 SerpApi 요금이 나가서 같은 조건은 잠깐 저장해 두고 다시 쓰고,
// 한 사람이 너무 자주 찾지 못하게 막는다. 저장소와 횟수는 서버 인스턴스마다 따로 센다.

const CACHE_MS = 30 * 60 * 1000;
const CACHE_MAX = 500;
const LIMIT_PER_WINDOW = 20;
const WINDOW_MS = 10 * 60 * 1000;

const cache = new Map<string, { at: number; data: unknown }>();
const hits = new Map<string, { count: number; reset: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || entry.reset < now) {
    hits.set(ip, { count: 1, reset: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > LIMIT_PER_WINDOW;
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export const DATE = /^\d{4}-\d{2}-\d{2}$/;

// params로 SerpApi를 부르고 shape로 화면용 데이터를 만들어 응답한다.
// 결과가 없는 검색도 error 문구로 오므로 empty로 넘겨 빈 결과를 만든다.
export async function serpSearch<T>(
  req: Request,
  params: Record<string, string>,
  shape: (json: Record<string, unknown>) => T,
): Promise<Response> {
  const key = process.env.SERPAPI_API_KEY;
  if (!key) return Response.json({ error: "not_configured" }, { status: 503 });

  const cacheKey = JSON.stringify(params);
  const saved = cache.get(cacheKey);
  if (saved && Date.now() - saved.at < CACHE_MS) return Response.json(saved.data);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  if (rateLimited(ip)) return Response.json({ error: "rate_limited" }, { status: 429 });

  let json: Record<string, unknown>;
  try {
    const res = await fetch(`https://serpapi.com/search.json?${new URLSearchParams({ ...params, api_key: key })}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(25_000),
    });
    json = (await res.json()) as Record<string, unknown>;
    const error = typeof json.error === "string" ? json.error : "";
    if (!res.ok && !error.includes("hasn't returned any results")) {
      console.error("serpapi", params.engine, res.status, error);
      return Response.json({ error: "upstream" }, { status: 502 });
    }
  } catch (e) {
    console.error("serpapi", params.engine, e);
    return Response.json({ error: "upstream" }, { status: 502 });
  }

  const data = shape(json);
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
  cache.set(cacheKey, { at: Date.now(), data });
  return Response.json(data);
}

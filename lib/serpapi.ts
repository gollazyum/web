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

// SerpApi 한 번 부르기. 실패하면 화면에 돌려줄 오류 응답을 준다.
// 결과가 없는 검색도 error 문구로 오므로 실패로 보지 않고 그대로 넘겨 빈 결과를 만든다
async function call(params: Record<string, string>, key: string): Promise<Record<string, unknown> | Response> {
  try {
    const res = await fetch(`https://serpapi.com/search.json?${new URLSearchParams({ ...params, api_key: key })}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(25_000),
    });
    const json = (await res.json()) as Record<string, unknown>;
    const error = typeof json.error === "string" ? json.error : "";
    if (!res.ok && !error.includes("hasn't returned any results")) {
      console.error("serpapi", params.engine, res.status, error);
      return Response.json({ error: "upstream", detail: `${res.status} ${error}`.slice(0, 120) }, { status: 502 });
    }
    return json;
  } catch (e) {
    console.error("serpapi", params.engine, e);
    const detail = e instanceof Error ? e.name : "fetch failed";
    return Response.json({ error: "upstream", detail }, { status: 502 });
  }
}

// params로 SerpApi를 부르고 shape로 화면용 데이터를 만들어 응답한다.
// extra를 주면 같은 검색을 조건을 바꿔 한 번 더 불러(검색 1번 요금 추가) shape에 같이 넘긴다.
// extra 쪽이 실패하면 null로 넘겨 기본 결과만으로 만든다. 횟수 제한은 검색 한 번으로 센다
export async function serpSearch<T>(
  req: Request,
  params: Record<string, string>,
  shape: (json: Record<string, unknown>, extra: Record<string, unknown> | null) => T,
  extra?: Record<string, string>,
): Promise<Response> {
  const key = process.env.SERPAPI_API_KEY;
  if (!key) return Response.json({ error: "not_configured" }, { status: 503 });

  const cacheKey = JSON.stringify(extra ? [params, extra] : params);
  const saved = cache.get(cacheKey);
  if (saved && Date.now() - saved.at < CACHE_MS) return Response.json(saved.data);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  if (rateLimited(ip)) return Response.json({ error: "rate_limited" }, { status: 429 });

  const [json, more] = await Promise.all([call(params, key), extra ? call(extra, key) : null]);
  if (json instanceof Response) return json;

  const data = shape(json, more instanceof Response ? null : more);
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
  cache.set(cacheKey, { at: Date.now(), data });
  return Response.json(data);
}

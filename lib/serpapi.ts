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
// extra에 함수를 주면 첫 결과를 받은 뒤 그 결과로 다음 검색 조건을 만들어 이어서 부른다 (null이면 안 부름).
// extra 쪽이 실패하면 null로 넘겨 기본 결과만으로 만든다. 횟수 제한은 검색 한 번으로 센다
export async function serpSearch<T>(
  req: Request,
  params: Record<string, string>,
  shape: (json: Record<string, unknown>, extra: Record<string, unknown> | null) => T,
  extra?: Record<string, string> | ((json: Record<string, unknown>) => Record<string, string> | null),
): Promise<Response> {
  const key = process.env.SERPAPI_API_KEY;
  if (!key) return Response.json({ error: "not_configured" }, { status: 503 });

  const cacheKey = JSON.stringify(typeof extra === "function" ? [params, "chain"] : extra ? [params, extra] : params);
  const saved = cache.get(cacheKey);
  if (saved && Date.now() - saved.at < CACHE_MS) return Response.json(saved.data);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  if (rateLimited(ip)) return Response.json({ error: "rate_limited" }, { status: 429 });

  let json: Record<string, unknown> | Response;
  let more: Record<string, unknown> | Response | null;
  if (typeof extra === "function") {
    json = await call(params, key);
    if (json instanceof Response) return json;
    const next = extra(json);
    more = next ? await call(next, key) : null;
  } else {
    [json, more] = await Promise.all([call(params, key), extra ? call(extra, key) : null]);
  }
  if (json instanceof Response) return json;

  const data = shape(json, more instanceof Response ? null : more);
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
  cache.set(cacheKey, { at: Date.now(), data });
  return Response.json(data);
}

// SerpApi 원본 응답을 그대로 받아 오고, 같은 조건은 cacheMs 동안 저장해 두고 다시 쓴다.
// 서버 인스턴스 메모리와 Next 데이터 캐시(revalidate) 둘 다 써서, 인스턴스가 바뀌어도 같은 검색을 다시 부르지 않게 한다.
// 실패 응답은 저장하지 않는다. 키는 저장 키에 넣지 않는다
const rawCache = new Map<string, { at: number; data: Record<string, unknown> }>();

export async function serpRaw(params: Record<string, string>, cacheMs: number): Promise<Record<string, unknown> | Response> {
  const key = process.env.SERPAPI_API_KEY;
  if (!key) return Response.json({ error: "not_configured" }, { status: 503 });
  const cacheKey = JSON.stringify(params);
  const saved = rawCache.get(cacheKey);
  if (saved && Date.now() - saved.at < cacheMs) return saved.data;

  try {
    const res = await fetch(`https://serpapi.com/search.json?${new URLSearchParams({ ...params, api_key: key })}`, {
      next: { revalidate: Math.floor(cacheMs / 1000) },
      signal: AbortSignal.timeout(25_000),
    });
    const json = (await res.json()) as Record<string, unknown>;
    const error = typeof json.error === "string" ? json.error : "";
    if (!res.ok && !error.includes("hasn't returned any results")) {
      console.error("serpapi", params.engine, res.status, error);
      return Response.json({ error: "upstream", detail: `${res.status} ${error}`.slice(0, 120) }, { status: 502 });
    }
    if (rawCache.size >= CACHE_MAX) rawCache.delete(rawCache.keys().next().value!);
    rawCache.set(cacheKey, { at: Date.now(), data: json });
    return json;
  } catch (e) {
    console.error("serpapi", params.engine, e);
    return Response.json({ error: "upstream", detail: e instanceof Error ? e.name : "fetch failed" }, { status: 502 });
  }
}

// 한 사람이 너무 자주 찾지 못하게 막는다. 막혔으면 돌려줄 응답, 아니면 null
export function rateLimit(req: Request): Response | null {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  return rateLimited(ip) ? Response.json({ error: "rate_limited" }, { status: 429 }) : null;
}

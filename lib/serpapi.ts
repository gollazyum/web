import { cached, cacheKey, NoStore, put } from "./search-cache";

// 검색 API 공통 호출. 서버에서만 쓴다. API 키는 Vercel 환경변수 SERPAPI_API_KEY 에만 둔다.
// 검색 1번마다 요금이 나가서 같은 조건의 성공 응답은 서버 캐시(lib/search-cache.ts)에 저장해 두고 다시 쓰고,
// 한 사람이 너무 자주 찾지 못하게 막는다. 횟수는 서버 인스턴스마다 따로 센다.
//
// 외부 오류는 화면에 원문을 보내지 않는다.
// - 사용량 소진(429 또는 본문에 'run out of searches') → 503 {"error":"quota"}
// - 그 밖의 외부 오류 → 502 {"error":"upstream"}
// 서버 로그에는 원문을 남기되 API 키 값은 지운다.

// 숙소·항공 30분
export const TRAVEL_CACHE_SEC = 30 * 60;
const LIMIT_PER_WINDOW = 20;
const WINDOW_MS = 10 * 60 * 1000;

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

// 전용 숙소 상세 페이지의 새 가격 조회(저장된 가격이 없을 때만 센다): 한 접속 주소당 하루 70번 (비정상 봇 방어용).
// 저장된 가격을 다시 쓰는 건 세지 않는다. 횟수는 서버 인스턴스마다 따로 센다
export const DETAIL_DAILY_CAP = 70;
const daily = new Map<string, { count: number; day: string }>();

function dailyCapped(key: string, max: number): boolean {
  const day = new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10); // 한국 날짜
  const e = daily.get(key);
  if (!e || e.day !== day) {
    if (daily.size > 20_000) daily.clear();
    daily.set(key, { count: 1, day });
    return false;
  }
  e.count += 1;
  return e.count > max;
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export const DATE = /^\d{4}-\d{2}-\d{2}$/;

export type SearchFailKind = "quota" | "upstream" | "rate_limited";

// 외부 검색 실패. 화면에는 kind만 간다
export class SearchFail extends Error {
  constructor(readonly kind: SearchFailKind) {
    super(kind);
  }
}

export function failResponse(kind: SearchFailKind): Response {
  if (kind === "quota") return Response.json({ error: "quota" }, { status: 503 });
  if (kind === "rate_limited") return Response.json({ error: "rate_limited" }, { status: 429 });
  return Response.json({ error: "upstream" }, { status: 502 });
}

// 로그에 남기기 전에 키 값을 지운다
export function scrubKey(text: string): string {
  const key = process.env.SERPAPI_API_KEY;
  let out = text.replace(/api_key=[^&\s"']+/gi, "api_key=***");
  if (key) out = out.split(key).join("***");
  return out;
}

const QUOTA_TEXT = /run out of searches/i;

// 외부 응답이 사용량 소진인지
export function isQuota(status: number, body: string): boolean {
  return status === 429 || QUOTA_TEXT.test(body);
}

// 결과가 없는 검색도 error 문구로 오므로 실패로 보지 않고 그대로 넘겨 빈 결과를 만든다
const NO_RESULTS = "hasn't returned any results";

// 검색 한 번. 실패하면 SearchFail을 던진다
async function call(params: Record<string, string>, key: string, timeoutMs = 25_000): Promise<Record<string, unknown>> {
  const engine = params.engine ?? "";
  let res: Response;
  let text: string;
  try {
    res = await fetch(`https://serpapi.com/search.json?${new URLSearchParams({ ...params, api_key: key })}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
    text = await res.text();
  } catch (e) {
    console.error("[search] fetch", engine, scrubKey(e instanceof Error ? `${e.name}: ${e.message}` : String(e)));
    throw new SearchFail("upstream");
  }
  let json: Record<string, unknown> | null = null;
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    json = null;
  }
  const error = typeof json?.error === "string" ? json.error : "";
  if (isQuota(res.status, error || (json ? "" : text))) {
    console.error("[search] quota", engine, res.status, scrubKey(error || text.slice(0, 300)));
    throw new SearchFail("quota");
  }
  if (!json || (!res.ok && !error.includes(NO_RESULTS))) {
    console.error("[search] upstream", engine, res.status, scrubKey(error || text.slice(0, 300)));
    throw new SearchFail("upstream");
  }
  return json;
}

function ipOf(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
}

// 새로 받은 검색 결과를 넘겨받는 곳(가격 기록 등). 여기서 무슨 일이 나도 검색 응답은 그대로 나간다
function fresh<T>(cb: ((data: T) => void) | undefined, data: T) {
  if (!cb) return;
  try {
    cb(data);
  } catch (e) {
    console.error("[search] onFresh", e instanceof Error ? e.message : e);
  }
}

// 서버 작업(가격 지킴이 크론 등)에서 검색 한 번. 키가 없으면 SearchFail("upstream")
export function searchOnce(params: Record<string, string>, timeoutMs = 25_000): Promise<Record<string, unknown>> {
  const key = process.env.SERPAPI_API_KEY;
  if (!key) throw new SearchFail("upstream");
  return call(params, key, timeoutMs);
}

// params로 검색하고 shape로 화면용 데이터를 만들어 응답한다.
// extra를 주면 같은 검색을 조건을 바꿔 한 번 더 불러(검색 1번 요금 추가) shape에 같이 넘긴다.
// extra에 함수를 주면 첫 결과를 받은 뒤 그 결과로 다음 검색 조건을 만들어 이어서 부른다 (null이면 안 부름).
// extra 쪽이 실패하면 null로 넘겨 기본 결과만으로 만들고, 이때는 저장하지 않는다.
// 같은 조건의 성공 응답은 30분 동안 저장해 두고 다시 쓴다. 횟수 제한은 실제로 검색할 때만 센다
export async function serpSearch<T>(
  req: Request,
  params: Record<string, string>,
  shape: (json: Record<string, unknown>, extra: Record<string, unknown> | null, follow: Record<string, unknown>[]) => T,
  extra?: Record<string, string> | ((json: Record<string, unknown>) => Record<string, string> | null),
  // follow: 받은 쪽에서 다음 쪽 조건을 만들어 followPages쪽(기본 1)까지 이어서 받는다 (인기 도시 숙소 60곳). 다음 쪽이 없으면 멈춘다
  // dailyCap: 새로 검색할 때만 세는 하루 상한 (상세 페이지 가격 조회)
  // keyParams: 저장 키를 만들 조건 (없으면 params). 숙소 한 곳 가격은 숙소 이름(q) 없이 token·날짜·인원만으로 저장해 목록·상세가 같은 저장분을 쓴다
  opts: { fresh?: boolean; onFresh?: (data: T) => void; ttlSec?: number; follow?: (json: Record<string, unknown>) => Record<string, string> | null; followPages?: number; dailyCap?: { scope: string; max: number }; keyParams?: Record<string, string> } = {},
): Promise<Response> {
  const key = process.env.SERPAPI_API_KEY;
  if (!key) return Response.json({ error: "not_configured" }, { status: 503 });

  const ck = cacheKey("travel", opts.keyParams ?? params, typeof extra === "function" ? "chain" : (extra ?? null), ...(opts.follow ? [`p${(opts.followPages ?? 1) + 1}`] : []));
  // 요청 헤더는 캐시 함수 밖에서 읽는다 (Next 캐시 안에서는 요청 데이터를 못 쓴다)
  const ip = ipOf(req);
  try {
    const load = async (): Promise<T | NoStore<T>> => {
      if (rateLimited(ip)) throw new SearchFail("rate_limited");
      if (opts.dailyCap && dailyCapped(`${opts.dailyCap.scope}:${ip}`, opts.dailyCap.max)) throw new SearchFail("rate_limited");
      const json = await call(params, key);
      let more: Record<string, unknown> | null = null;
      let partial = false;
      const next = typeof extra === "function" ? extra(json) : (extra ?? null);
      if (next) {
        try {
          more = await call(next, key);
        } catch {
          partial = true;
        }
      }
      const after: Record<string, unknown>[] = [];
      if (opts.follow) {
        let last = json;
        for (let i = 0; i < (opts.followPages ?? 1); i++) {
          const nextPage = opts.follow(last);
          if (!nextPage) break;
          try {
            last = await call(nextPage, key);
            after.push(last);
          } catch {
            partial = true; // 다음 쪽이 실패하면 받은 쪽까지만 보여 주고 저장하지 않는다
            break;
          }
        }
      }
      const data = shape(json, more, after);
      return partial ? new NoStore(data) : data;
    };
    // fresh: '가격 다시 보기'처럼 지금 값을 꼭 새로 받아야 할 때는 저장된 응답을 쓰지 않는다
    if (opts.fresh) {
      const out = await load();
      const data = out instanceof NoStore ? out.data : out;
      // 다시 확인한 값으로 공용 저장분도 바꿔 둔다 (다른 화면·다른 기기가 옛 가격을 읽지 않게)
      if (!(out instanceof NoStore)) await put(ck, data, opts.ttlSec ?? TRAVEL_CACHE_SEC);
      fresh(opts.onFresh, data);
      return Response.json(data, { headers: { "x-cache": "BYPASS" } });
    }
    const { data, hit } = await cached<T>(ck, opts.ttlSec ?? TRAVEL_CACHE_SEC, load);
    if (!hit) fresh(opts.onFresh, data); // 저장된 응답을 다시 쓸 때는 같은 값이라 넘기지 않는다
    return Response.json(data, { headers: { "x-cache": hit ? "HIT" : "MISS" } });
  } catch (e) {
    if (e instanceof SearchFail) return failResponse(e.kind);
    console.error("[search] unexpected", scrubKey(e instanceof Error ? `${e.name}: ${e.message}` : String(e)));
    return failResponse("upstream");
  }
}

// 검색 원본 응답을 그대로 받아 오고, 같은 조건의 성공 응답은 cacheMs 동안 저장해 두고 다시 쓴다.
// 실패하면 화면에 돌려줄 오류 응답(Response)을 준다
export async function serpRaw(params: Record<string, string>, cacheMs: number): Promise<Record<string, unknown> | Response> {
  const key = process.env.SERPAPI_API_KEY;
  if (!key) return Response.json({ error: "not_configured" }, { status: 503 });
  try {
    const { data } = await cached(cacheKey("raw", params), Math.floor(cacheMs / 1000), () => call(params, key));
    return data;
  } catch (e) {
    if (e instanceof SearchFail) return failResponse(e.kind);
    console.error("[search] unexpected", scrubKey(e instanceof Error ? `${e.name}: ${e.message}` : String(e)));
    return failResponse("upstream");
  }
}

// 한 사람이 너무 자주 찾지 못하게 막는다. 막혔으면 돌려줄 응답, 아니면 null
export function rateLimit(req: Request): Response | null {
  return rateLimited(ipOf(req)) ? failResponse("rate_limited") : null;
}

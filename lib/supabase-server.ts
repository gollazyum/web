import "server-only";

// Supabase REST(PostgREST)를 서버에서만 부른다. 서비스 키는 서버 환경변수(SUPABASE_SERVICE_ROLE_KEY)로만 읽고 화면에 보내지 않는다.
// 모든 테이블은 RLS가 켜져 있고 정책이 없어 브라우저 키로는 접근할 수 없다

function config(): { url: string; key: string } | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? { url: url.replace(/\/$/, ""), key } : null;
}

export const supabaseOn = () => config() !== null;

export class DbError extends Error {}

// path: "rest/v1/…" 뒤쪽. 실패하면 DbError (본문 내용은 로그에 남기지 않는다)
export async function sb<T = unknown>(path: string, init: { method?: string; body?: unknown; prefer?: string } = {}): Promise<T> {
  const c = config();
  if (!c) throw new DbError("not_configured");
  const headers: Record<string, string> = { apikey: c.key, "Content-Type": "application/json" };
  // 예전 형식(JWT) 키는 Authorization에도 넣는다. 새 형식(sb_secret_…) 키는 apikey만 쓴다
  if (c.key.startsWith("eyJ")) headers.Authorization = `Bearer ${c.key}`;
  if (init.prefer) headers.Prefer = init.prefer;
  const res = await fetch(`${c.url}/rest/v1/${path}`, {
    method: init.method ?? "GET",
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
    signal: AbortSignal.timeout(5_000),
  });
  if (!res.ok) {
    console.error("[db]", init.method ?? "GET", path.split("?")[0], res.status);
    throw new DbError(`db ${res.status}`);
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

export const rpc = <T = unknown>(name: string, args: Record<string, unknown>) => sb<T>(`rpc/${name}`, { method: "POST", body: args });

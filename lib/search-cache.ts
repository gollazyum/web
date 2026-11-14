import { createHash } from "node:crypto";
import { unstable_cache } from "next/cache";

// 검색 결과 서버 캐시. 서버에서만 쓴다.
// - Vercel KV(또는 Upstash Redis) 환경변수가 있으면 KV에 저장한다 (인스턴스가 달라도 같이 쓴다)
// - 없으면 Next.js 데이터 캐시(unstable_cache)를 쓴다
// - 같은 인스턴스 안에서는 메모리에도 잠깐 들고 있어 두 번째 검색이 바로 나온다
// 성공한 응답만 저장한다. loader가 던지면(실패) 아무것도 저장하지 않는다.

const MEMORY_MAX = 500;
const memory = new Map<string, { until: number; data: unknown }>();

// ---------- 검색 조건 정규화 ----------

// 사람이 입력한 글자 (목적지·검색어): 대소문자·공백을 맞춘다
const TEXT_KEYS = new Set(["q"]);
// 날짜: 2026.11.20 · 2026/11/20 · 20261120 · 2026-1-5 → 2026-11-20 꼴로 맞춘다
const DATE_KEYS = new Set(["check_in_date", "check_out_date", "outbound_date", "return_date"]);
// 공항·도시 코드: 대문자, 공백 없이
const CODE_KEYS = new Set(["departure_id", "arrival_id"]);

export function normalizeDate(v: string): string {
  const s = v.trim();
  const m = s.match(/^(\d{4})[-./\s]?(\d{1,2})[-./\s]?(\d{1,2})$/);
  if (!m) return s;
  return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
}

export function normalizeText(v: string): string {
  return v.normalize("NFC").trim().replace(/\s+/g, " ");
}

function normalizeValue(key: string, value: string): string {
  if (DATE_KEYS.has(key)) return normalizeDate(value);
  if (CODE_KEYS.has(key)) return value.replace(/\s+/g, "").toUpperCase();
  if (TEXT_KEYS.has(key)) return normalizeText(value).toLowerCase();
  // 페이지 토큰 같은 값은 대소문자를 구분하므로 앞뒤 공백만 지운다
  return value.trim();
}

// 검색 조건을 정규화한 문자열. 키 순서와 상관없이 같은 조건이면 같은 문자열이 된다. api_key는 절대 넣지 않는다
export function normalizeParams(params: Record<string, string>): string {
  return Object.keys(params)
    .filter((k) => k !== "api_key")
    .sort()
    .map((k) => `${k}=${normalizeValue(k, String(params[k]))}`)
    .join("&");
}

// 여러 검색 묶음(기본 + 추가 검색)을 하나의 캐시 키로
export function cacheKey(scope: string, ...parts: (Record<string, string> | string | null | undefined)[]): string {
  const raw = parts.map((p) => (p == null ? "-" : typeof p === "string" ? p : normalizeParams(p))).join("|");
  return `${scope}:${createHash("sha256").update(raw).digest("hex").slice(0, 40)}`;
}

// ---------- 저장소 ----------

function kvConfig(): { url: string; token: string } | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ""), token } : null;
}

async function kvCommand(cmd: (string | number)[]): Promise<unknown> {
  const kv = kvConfig();
  if (!kv) return null;
  const res = await fetch(kv.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${kv.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
    cache: "no-store",
    signal: AbortSignal.timeout(3_000),
  });
  if (!res.ok) throw new Error(`kv ${res.status}`);
  return ((await res.json()) as { result?: unknown }).result ?? null;
}

// loader가 이 값을 돌려주면 응답은 쓰되 저장하지 않는다 (예: 추가 검색 하나가 실패해 일부만 만든 결과)
export class NoStore<T> {
  constructor(readonly data: T) {}
}

export type CacheResult<T> = { data: T; hit: "memory" | "kv" | "data" | null };

function remember(key: string, data: unknown, ttlSec: number) {
  if (memory.size >= MEMORY_MAX) memory.delete(memory.keys().next().value!);
  memory.set(key, { until: Date.now() + ttlSec * 1000, data });
}

export function memoryHit<T>(key: string): T | undefined {
  const saved = memory.get(key);
  if (!saved) return undefined;
  if (saved.until > Date.now()) return saved.data as T;
  memory.delete(key);
  return undefined;
}

// key로 저장된 성공 응답을 돌려주고, 없으면 loader를 불러 저장한다.
// loader가 던진 오류는 그대로 다시 던진다 (저장하지 않음)
export async function cached<T>(key: string, ttlSec: number, loader: () => Promise<T | NoStore<T>>): Promise<CacheResult<T>> {
  const inMemory = memoryHit<T>(key);
  if (inMemory !== undefined) return { data: inMemory, hit: "memory" };

  if (kvConfig()) {
    try {
      const saved = await kvCommand(["GET", key]);
      if (typeof saved === "string") {
        const data = JSON.parse(saved) as T;
        remember(key, data, ttlSec);
        return { data, hit: "kv" };
      }
    } catch (e) {
      console.error("[search-cache] kv get", e instanceof Error ? e.message : e);
    }
    const out = await loader();
    if (out instanceof NoStore) return { data: out.data, hit: null };
    remember(key, out, ttlSec);
    await kvCommand(["SET", key, JSON.stringify(out), "EX", ttlSec]).catch((e) =>
      console.error("[search-cache] kv set", e instanceof Error ? e.message : e),
    );
    return { data: out, hit: null };
  }

  // Next.js 데이터 캐시. 던지면 저장되지 않으므로 '일부만 성공'은 NoStore 오류로 빠져나온다
  let fresh = false;
  const run = unstable_cache(
    async () => {
      fresh = true;
      const out = await loader();
      if (out instanceof NoStore) throw out;
      return out;
    },
    ["search", key],
    { revalidate: ttlSec, tags: ["search"] },
  );
  try {
    const data = await run();
    remember(key, data, ttlSec);
    return { data, hit: fresh ? null : "data" };
  } catch (e) {
    if (e instanceof NoStore) return { data: e.data as T, hit: null };
    throw e;
  }
}

import { createHmac } from "node:crypto";

// 쿠팡 파트너스 Deeplink API: 쿠팡 상품·검색 주소를 파트너스 링크(link.coupang.com/…)로 바꾼다. 서버에서만 쓴다.
// Vercel 환경변수 COUPANG_ACCESS_KEY, COUPANG_SECRET_KEY 가 둘 다 있을 때만 켜진다. 없으면 원래 주소를 그대로 쓴다.
// 문서: 쿠팡 파트너스 > API > Deeplink (POST /v2/providers/affiliate_open_api/apis/openapi/v1/deeplink, 한 번에 최대 20개)

const HOST = "https://api-gateway.coupang.com";
const PATH = "/v2/providers/affiliate_open_api/apis/openapi/v1/deeplink";
const MAX_PER_CALL = 20;
const CACHE_MS = 24 * 60 * 60 * 1000;
const cache = new Map<string, { at: number; url: string }>();

export function deeplinkEnabled(): boolean {
  return !!(process.env.COUPANG_ACCESS_KEY?.trim() && process.env.COUPANG_SECRET_KEY?.trim());
}

// 서명 시각: yyMMdd'T'HHmmss'Z' (UTC)
export function signedDate(d: Date = new Date()): string {
  return d.toISOString().replace(/^\d{2}(\d{2})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}).*$/, "$1$2$3T$4$5$6Z");
}

export function authorization(method: string, path: string, query: string, access: string, secret: string, d: Date = new Date()): string {
  const dt = signedDate(d);
  const signature = createHmac("sha256", secret).update(dt + method + path + query).digest("hex");
  return `CEA algorithm=HmacSHA256, access-key=${access}, signed-date=${dt}, signature=${signature}`;
}

// 주소들을 파트너스 링크로. 실패하거나 꺼져 있으면 받은 주소 그대로 돌려준다 (순서·개수 유지).
// 부르는 쪽(applyDeeplink)은 link.coupang.com 이 아닌 결과를 기본 파트너스 링크로 바꾼다
export async function toDeeplinks(urls: string[]): Promise<string[]> {
  const access = process.env.COUPANG_ACCESS_KEY?.trim() ?? "";
  const secret = process.env.COUPANG_SECRET_KEY?.trim() ?? "";
  if (!access || !secret || !urls.length) return urls;
  const now = Date.now();
  const todo = [...new Set(urls.filter((u) => u && !(cache.get(u) && now - cache.get(u)!.at < CACHE_MS)))];
  for (let i = 0; i < todo.length; i += MAX_PER_CALL) {
    const batch = todo.slice(i, i + MAX_PER_CALL);
    try {
      const res = await fetch(HOST + PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json;charset=UTF-8", Authorization: authorization("POST", PATH, "", access, secret) },
        body: JSON.stringify({ coupangUrls: batch }),
        signal: AbortSignal.timeout(5000),
        cache: "no-store",
      });
      const json = (await res.json()) as { rCode?: string; data?: { originalUrl?: string; shortenUrl?: string }[] };
      if (json.rCode !== "0" || !Array.isArray(json.data)) {
        console.error("coupang deeplink", res.status, json.rCode);
        continue;
      }
      for (const row of json.data) if (row.originalUrl && row.shortenUrl) cache.set(row.originalUrl, { at: now, url: row.shortenUrl });
    } catch (e) {
      console.error("coupang deeplink", e instanceof Error ? e.name : e);
    }
  }
  return urls.map((u) => cache.get(u)?.url ?? u);
}

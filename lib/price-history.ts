import "server-only";
import type { PriceRow } from "./price-history-rows";

// 숙소 가격 기록을 Supabase(hotel_price_history)에 저장한다. 서버에서만 쓴다.
// 서비스 키는 서버 환경변수(SUPABASE_SERVICE_ROLE_KEY)로만 읽고 화면에 보내지 않는다.
// 환경변수가 없거나 저장에 실패해도 검색 응답에는 아무 영향이 없다 (조용히 건너뛴다).
// 테이블과 저장 함수는 supabase/price-history.sql

function config(): { url: string; key: string } | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? { url: url.replace(/\/$/, ""), key } : null;
}

export const priceHistoryOn = () => config() !== null;

export async function recordPrices(rows: PriceRow[]): Promise<void> {
  const c = config();
  if (!c || !rows.length) return;
  try {
    const headers: Record<string, string> = { apikey: c.key, "Content-Type": "application/json" };
    // 예전 형식(JWT) 키는 Authorization에도 넣는다. 새 형식(sb_secret_…) 키는 apikey만 쓴다
    if (c.key.startsWith("eyJ")) headers.Authorization = `Bearer ${c.key}`;
    const res = await fetch(`${c.url}/rest/v1/rpc/record_hotel_prices`, {
      method: "POST",
      headers,
      body: JSON.stringify({ rows }),
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) console.error("[price-history] save", res.status, (await res.text().catch(() => "")).slice(0, 200));
  } catch (e) {
    console.error("[price-history] save", e instanceof Error ? e.message : e);
  }
}

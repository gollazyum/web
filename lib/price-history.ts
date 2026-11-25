import "server-only";
import type { PriceRow } from "./price-history-rows";
import { rpc, supabaseOn } from "./supabase-server";

// 숙소 가격 기록을 Supabase(hotel_price_history)에 저장한다. 서버에서만 쓴다.
// 환경변수가 없거나 저장에 실패해도 검색 응답에는 아무 영향이 없다 (조용히 건너뛴다).
// 테이블과 저장 함수는 supabase/price-history.sql

export const priceHistoryOn = supabaseOn;

export async function recordPrices(rows: PriceRow[]): Promise<void> {
  if (!supabaseOn() || !rows.length) return;
  try {
    await rpc("record_hotel_prices", { rows });
  } catch (e) {
    console.error("[price-history] save", e instanceof Error ? e.message : e);
  }
}

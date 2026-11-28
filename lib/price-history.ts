import "server-only";
import type { PriceRow } from "./price-history-rows";
import { cityKey } from "./city-key";
import { rpc, sb, supabaseOn } from "./supabase-server";

// 숙소 가격 기록을 Supabase(hotel_price_history)에 저장한다. 서버에서만 쓴다.
// 환경변수가 없거나 저장에 실패해도 검색 응답에는 아무 영향이 없다 (조용히 건너뛴다).
// 테이블과 저장 함수는 supabase/price-history.sql

export const priceHistoryOn = supabaseOn;

// place(목적지)가 비어 있는 줄(숙소 한 곳 가격 확인 등)은 hotels_master.city_key(영어 슬러그)로 채운다. 못 찾으면 비운 채로 둔다
export async function fillPlaces(rows: PriceRow[]): Promise<PriceRow[]> {
  const empty = [...new Set(rows.filter((r) => !r.place?.trim()).map((r) => r.property_token))];
  if (!empty.length) return rows;
  try {
    const found = await sb<{ property_token: string; city_key: string }[]>(
      `hotels_master?property_token=in.(${empty.map((t) => encodeURIComponent(`"${t.replace(/"/g, "")}"`)).join(",")})&select=property_token,city_key`,
    );
    const city = new Map((found ?? []).map((m) => [m.property_token, cityKey(m.city_key)]));
    return rows.map((r) => (r.place?.trim() ? r : { ...r, place: city.get(r.property_token) || null }));
  } catch (e) {
    console.error("[price-history] place", e instanceof Error ? e.message : e);
    return rows;
  }
}

export async function recordPrices(rows: PriceRow[]): Promise<void> {
  if (!supabaseOn() || !rows.length) return;
  try {
    await rpc("record_hotel_prices", { rows: await fillPlaces(rows) });
  } catch (e) {
    console.error("[price-history] save", e instanceof Error ? e.message : e);
  }
}

import "server-only";
import { sellerRows, type HotelSource } from "./hotels";
import type { HotelSellerKey } from "./hotel-sellers";
import { kstToday } from "./price-history-rows";
import { sb, supabaseOn } from "./supabase-server";

// 홈 첫 화면 '실제 검색 예시' 카드: 예약처 가격을 새로 받은 숙소 한 곳의 예약처별 총액을 Supabase seller_snapshots 에 남기고,
// 홈은 그중 체크인이 오늘(한국 날짜) 이후이고 예약처 3곳 이상인 가장 최근 한 줄만 읽는다 (외부 유료 검색 0회).
// 테이블: supabase/seller-snapshots.sql. 테이블이 없거나 실패해도 검색·홈에는 영향이 없다 (홈은 예시 화면으로 돌아간다)
export const HERO_MIN_SELLERS = 3;

export type SnapSeller = { key: HotelSellerKey; cost: number; fc: boolean };
export type SellerSnapshot = { token: string; name: string; place: string | null; checkIn: string; checkOut: string; adults: number; sellers: SnapSeller[]; at: string };

// 예약처마다 가장 낮은 총액 하나만, 낮은 순
export function snapSellers(sources: HotelSource[], nights: number, name: string, q: { checkIn: string; checkOut: string; adults: number }): SnapSeller[] {
  const best = new Map<HotelSellerKey, SnapSeller>();
  for (const r of sellerRows(sources, nights, name, { q: name, ...q })) {
    if (r.key === "official") continue;
    const cur = best.get(r.key);
    if (!cur || r.cost < cur.cost) best.set(r.key, { key: r.key, cost: Math.round(r.cost), fc: r.freeCancel === true });
  }
  return [...best.values()].sort((a, b) => a.cost - b.cost);
}

export async function recordSnapshot(token: string, name: string, place: string | null, q: { checkIn: string; checkOut: string; adults: number; childAges: number[] }, sources: HotelSource[]): Promise<void> {
  if (!supabaseOn() || q.childAges.length) return;
  const nights = Math.round((Date.parse(`${q.checkOut}T00:00:00Z`) - Date.parse(`${q.checkIn}T00:00:00Z`)) / 86_400_000);
  if (!(nights >= 1 && nights <= 30)) return;
  const sellers = snapSellers(sources, nights, name, q);
  if (sellers.length < HERO_MIN_SELLERS) return;
  try {
    await sb("seller_snapshots", {
      method: "POST",
      body: { property_token: token.slice(0, 500), hotel_name: name.slice(0, 200), place: place ? place.slice(0, 100) : null, check_in: q.checkIn, check_out: q.checkOut, adults: q.adults, sellers, seller_count: sellers.length },
      prefer: "return=minimal",
    });
  } catch (e) {
    console.error("[seller-snapshot] save", e instanceof Error ? e.message : e);
  }
}

type Row = { property_token: string; hotel_name: string; place: string | null; check_in: string; check_out: string; adults: number; sellers: SnapSeller[]; recorded_at: string };

// 체크인이 오늘(한국) 이후 · 예약처 3곳 이상인 가장 최근 스냅샷. 없으면 null
export async function latestSnapshot(now = Date.now()): Promise<SellerSnapshot | null> {
  if (!supabaseOn()) return null;
  const q = new URLSearchParams({
    select: "property_token,hotel_name,place,check_in,check_out,adults,sellers,recorded_at",
    check_in: `gte.${kstToday(now)}`,
    seller_count: `gte.${HERO_MIN_SELLERS}`,
    recorded_at: `gte.${new Date(now - 3 * 86_400_000).toISOString()}`,
    order: "recorded_at.desc",
    limit: "1",
  });
  const r = (await sb<Row[]>(`seller_snapshots?${q}`))?.[0];
  if (!r || !Array.isArray(r.sellers) || r.sellers.length < HERO_MIN_SELLERS) return null;
  return { token: r.property_token, name: r.hotel_name, place: r.place, checkIn: r.check_in, checkOut: r.check_out, adults: r.adults, sellers: r.sellers.slice(0, 5), at: r.recorded_at };
}

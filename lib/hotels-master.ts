import "server-only";
import type { HotelOption } from "./hotels";
import { cityKey as toCityKey } from "./city-key";
import { sb, supabaseOn } from "./supabase-server";

// 검색에 나온 숙소의 고정 정보(좌표·이름·성급·평점·사진)를 Supabase hotels_master에 쌓는다. 서버에서만 쓴다.
// 응답을 보낸 뒤(after) 부르고, 테이블이 없거나 저장에 실패해도 검색에는 아무 영향이 없다.
// 테이블: supabase/hotels-master.sql (property_token 기준으로 덮어쓴다)
export type MasterRow = {
  property_token: string;
  city_key: string;
  name: string;
  lat: number;
  lng: number;
  star_rating: number | null;
  rating: number | null;
  reviews_count: number | null;
  thumbnail_url: string | null;
  updated_at: string;
};

// 좌표가 없는 숙소는 뺀다 (lat·lng는 비워 둘 수 없다)
export function masterRows(options: HotelOption[], cityKey: string, now = new Date()): MasterRow[] {
  const seen = new Set<string>();
  const at = now.toISOString();
  return options
    .filter((h) => h.token && h.name && h.gps && Number.isFinite(h.gps[0]) && Number.isFinite(h.gps[1]) && !seen.has(h.token) && !!seen.add(h.token))
    .map((h) => ({
      property_token: h.token.slice(0, 500),
      city_key: toCityKey(cityKey).slice(0, 100) || "unknown",
      name: h.name.slice(0, 300),
      lat: h.gps![0],
      lng: h.gps![1],
      star_rating: typeof h.stars === "number" && h.stars > 0 ? Math.round(h.stars) : null,
      rating: typeof h.rating === "number" ? Math.round(h.rating * 10) / 10 : null,
      reviews_count: typeof h.reviews === "number" ? Math.round(h.reviews) : null,
      thumbnail_url: h.image || null,
      updated_at: at,
    }));
}

export async function recordMaster(options: HotelOption[], cityKey: string): Promise<void> {
  if (!supabaseOn()) return;
  const rows = masterRows(options, cityKey);
  if (!rows.length) return;
  try {
    await sb("hotels_master?on_conflict=property_token", { method: "POST", body: rows, prefer: "resolution=merge-duplicates,return=minimal" });
  } catch (e) {
    console.error("[hotels-master] save", e instanceof Error ? e.message : e);
  }
}

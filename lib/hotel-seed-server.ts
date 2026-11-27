import "server-only";
import { cache } from "react";
import type { HotelSeed } from "./hotel-link";
import { sb, supabaseOn } from "./supabase-server";

// 공유 링크로 바로 들어온 상세 페이지: hotels_master 에 쌓인 숙소 기본 정보(이름·좌표·성급·평점·사진 1장)만 읽는다.
// 외부 유료 검색은 부르지 않는다. 없거나 실패하면 null (화면은 이름 없이 가격 조회 결과로 채운다)
type Row = { property_token: string; city_key: string | null; name: string; lat: number; lng: number; star_rating: number | null; rating: number | null; reviews_count: number | null; thumbnail_url: string | null };

export const hotelSeed = cache(async (token: string): Promise<HotelSeed | null> => {
  if (!supabaseOn() || !token || token.length > 500) return null;
  try {
    const q = new URLSearchParams({ select: "property_token,city_key,name,lat,lng,star_rating,rating,reviews_count,thumbnail_url", property_token: `eq.${token}`, limit: "1" });
    const rows = await sb<Row[]>(`hotels_master?${q}`);
    const r = rows?.[0];
    if (!r) return null;
    return { token: r.property_token, name: r.name, stars: r.star_rating, rating: r.rating === null ? null : Number(r.rating), reviews: r.reviews_count, lat: r.lat, lng: r.lng, image: r.thumbnail_url, city: r.city_key };
  } catch {
    return null;
  }
});

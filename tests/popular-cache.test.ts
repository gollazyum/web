import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { popularCity } from "@/lib/popular-stay-cities";
import { masterRows } from "@/lib/hotels-master";
import type { HotelOption } from "@/lib/hotels";

describe("인기 도시 40곳 저장", () => {
  it("한글·영문 이름과 동네가 붙은 검색어도 같은 도시", () => {
    expect(popularCity("도쿄")).toBe("tokyo");
    expect(popularCity("Tokyo")).toBe("tokyo");
    expect(popularCity("도쿄 신주쿠")).toBe("tokyo");
    expect(popularCity("Da Nang")).toBe("danang");
    expect(popularCity("타이페이")).toBe("taipei");
  });
  it("서울·부산·제주와 그 밖의 도시는 넣지 않는다", () => {
    for (const q of ["서울", "부산", "제주", "Seoul", "Jeju", "싱가포르", ""]) expect(popularCity(q)).toBeNull();
  });
});

const h = (over: Partial<HotelOption>): HotelOption => ({ token: "t1", name: "호텔", image: "https://x/1.jpg", images: [], kind: "호텔", amenities: [], deal: "", gps: [35.6, 139.7], stars: 4, rating: 4.36, reviews: 120, perNight: 1, total: 2, priceSource: null, sources: [], near: null, freeCancel: false, ...over });

describe("hotels_master 행", () => {
  it("표 구조에 맞춰 만들고 좌표 없는 숙소·겹치는 숙소는 뺀다", () => {
    const rows = masterRows([h({}), h({ token: "t2", gps: null }), h({}), h({ token: "t3", stars: null, rating: null, reviews: null, image: "" })], "tokyo", new Date("2026-11-26T00:00:00Z"));
    expect(rows.map((r) => r.property_token)).toEqual(["t1", "t3"]);
    expect(rows[0]).toEqual({ property_token: "t1", city_key: "tokyo", name: "호텔", lat: 35.6, lng: 139.7, star_rating: 4, rating: 4.4, reviews_count: 120, thumbnail_url: "https://x/1.jpg", updated_at: "2026-11-26T00:00:00.000Z" });
    expect(rows[1]).toMatchObject({ star_rating: null, rating: null, reviews_count: null, thumbnail_url: null });
  });
});

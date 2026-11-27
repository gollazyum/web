import { describe, expect, it } from "vitest";
import { pickSimilar } from "@/lib/similar-hotels";
import { cityViewOf } from "@/lib/city-view";

describe("비슷한 후보 숙소", () => {
  const me = { token: "me", gps: [35.69, 139.7] as [number, number], stars: 4, rating: 4.3, reviews: 1000, price: 300000 };
  const c = (token: string, lat: number, stars: number, rating: number, price: number | null = 300000) => ({ token, gps: [lat, 139.7] as [number, number], stars, rating, reviews: 500, price });
  it("자기 자신·5km 밖은 빼고 가까운 비슷한 곳 먼저", () => {
    const out = pickSimilar(me, [c("me", 35.69, 4, 4.3), c("far", 35.8, 4, 4.9), c("near", 35.691, 4, 4.2), c("cheapo", 35.692, 2, 3.2, 60000)]);
    expect(out.map((x) => x.token)).toEqual(["near", "cheapo"]);
  });
});

describe("도시 첫 지도 화면", () => {
  it("도시 이름만이면 도심 줌, 동네까지 적으면 핀에 맞춤", () => {
    expect(cityViewOf("도쿄")?.zoom).toBeGreaterThan(11.5);
    expect(cityViewOf(" 도쿄 ")).not.toBeNull();
    expect(cityViewOf("도쿄 신주쿠")).toBeNull();
  });
});

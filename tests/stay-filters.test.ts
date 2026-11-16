import { describe, expect, it } from "vitest";
import { activeCount, applyFilter, countFilters, EMPTY_FILTER } from "@/lib/stay-filters";
import type { HotelOption } from "@/lib/hotels";

const h = (token: string, o: Partial<HotelOption>): HotelOption => ({ token, name: token, image: "", images: [], kind: "호텔", amenities: [], deal: "", gps: null, stars: null, rating: null, reviews: null, perNight: null, total: null, priceSource: null, sources: [], ...o });
const list = [
  h("a", { stars: 4, rating: 4.6, amenities: ["조식", "무료 취소", "수영장"], total: 300000 }),
  h("b", { stars: 3, rating: 4.1, amenities: ["무료 Wi-Fi"], kind: "게스트하우스", total: 150000 }),
  h("c", { stars: 5, rating: 3.6, amenities: ["수영장", "조식 포함"], total: 900000 }),
  h("d", { stars: null, rating: null, amenities: [], total: null }),
];
const cost = (x: HotelOption) => x.total ?? Infinity;

describe("숙소 필터", () => {
  it("아무것도 안 고르면 그대로", () => {
    expect(applyFilter(list, EMPTY_FILTER, cost, 2)).toHaveLength(4);
    expect(activeCount(EMPTY_FILTER)).toBe(0);
  });
  it("성급·평점·조식·무료 취소·편의시설을 함께 건다", () => {
    expect(applyFilter(list, { ...EMPTY_FILTER, stars: [4, 5] }, cost, 2).map((x) => x.token)).toEqual(["a", "c"]);
    expect(applyFilter(list, { ...EMPTY_FILTER, minRating: 4 }, cost, 2).map((x) => x.token)).toEqual(["a", "b"]);
    expect(applyFilter(list, { ...EMPTY_FILTER, breakfast: true, amenities: ["수영장"] }, cost, 2).map((x) => x.token)).toEqual(["a", "c"]);
    expect(applyFilter(list, { ...EMPTY_FILTER, freeCancel: true }, cost, 2).map((x) => x.token)).toEqual(["a"]);
    expect(applyFilter(list, { ...EMPTY_FILTER, kinds: ["게스트하우스"] }, cost, 2).map((x) => x.token)).toEqual(["b"]);
  });
  it("요금대는 여러 개 고를 수 있고, 금액 모르는 숙소는 빠진다", () => {
    // 2박: a 1박 15만, b 7.5만, c 45만
    expect(applyFilter(list, { ...EMPTY_FILTER, bands: ["b1", "b2"] }, cost, 2).map((x) => x.token)).toEqual(["a", "b"]);
  });
  it("개수는 실제 목록에서 센다 (조식·무료 취소는 편의시설에서 뺀다)", () => {
    const c = countFilters(list, cost, 2);
    expect(c.stars.map((s) => s.count)).toEqual([0, 0, 1, 1, 1]);
    expect(c.breakfast).toBe(2);
    expect(c.freeCancel).toBe(1);
    expect(c.amenities[0]).toEqual({ name: "수영장", count: 2 });
    expect(c.amenities.some((a) => /조식|무료 취소/.test(a.name))).toBe(false);
    expect(c.kinds).toEqual([{ name: "호텔", count: 3 }, { name: "게스트하우스", count: 1 }]);
  });
});

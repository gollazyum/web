import { describe, expect, it } from "vitest";
import { findBannedWords, SHOP_RESULTS_COPY } from "@/lib/brand-mode";
import { filterItems, lowestItem, priceBandCounts, sellerOptions, sortItems } from "@/lib/shop-results";
import type { SearchItem } from "@/lib/shopping";

const item = (id: string, price: number | null, seller: string | null): SearchItem => ({
  token: "",
  productId: id,
  title: `상품 ${id}`,
  image: "",
  price,
  seller,
});

const items = [
  item("1", 45_000, "쿠팡"),
  item("2", 12_000, "네이버"),
  item("3", null, "쿠팡"),
  item("4", 80_000, "11번가"),
  item("5", 29_999, "G마켓"),
  item("6", 50_000, "네이버"),
];
const ids = (list: SearchItem[]) => list.map((x) => x.productId);

describe("쇼핑 검색 결과 PC 정렬·필터", () => {
  it("추천순은 받은 순서 그대로, 가격순은 가격 모르는 상품을 맨 뒤로", () => {
    expect(ids(sortItems(items, "default"))).toEqual(["1", "2", "3", "4", "5", "6"]);
    expect(ids(sortItems(items, "low"))).toEqual(["2", "5", "1", "6", "4", "3"]);
    expect(ids(sortItems(items, "high"))).toEqual(["4", "6", "1", "5", "2", "3"]);
  });

  it("가격대 개수는 실제 상품 수 (3만원 미만 / 3~5만원 / 5만원 이상)", () => {
    expect(priceBandCounts(items)).toEqual({ under30k: 2, "30to50k": 1, over50k: 2 });
  });

  it("같은 묶음은 OR, 가격대와 판매처는 AND", () => {
    expect(ids(filterItems(items, ["under30k", "over50k"], []))).toEqual(["2", "4", "5", "6"]);
    expect(ids(filterItems(items, [], ["쿠팡", "네이버"]))).toEqual(["1", "2", "3", "6"]);
    expect(ids(filterItems(items, ["under30k", "over50k"], ["네이버"]))).toEqual(["2", "6"]);
    expect(filterItems(items, ["30to50k"], ["G마켓"])).toEqual([]);
  });

  it("판매처 칩은 중복 없이 최대 8개", () => {
    expect(sellerOptions(items)).toEqual(["쿠팡", "네이버", "11번가", "G마켓"]);
    const many = Array.from({ length: 12 }, (_, i) => item(String(i), 1000, `가게${i % 10}`));
    expect(sellerOptions(many)).toHaveLength(8);
  });

  it("가장 낮은 가격 상품은 전체 결과 기준", () => {
    expect(lowestItem(items)?.productId).toBe("2");
    expect(lowestItem([item("x", null, null)])).toBeNull();
  });

  it("승인된 화면 문구에도 항상 금지어와 출처는 없다", () => {
    const all = Object.values(SHOP_RESULTS_COPY)
      .map((v) => (typeof v === "function" ? v(3) : v))
      .join(" ");
    expect(findBannedWords(all, false)).toEqual([]);
    expect(all).not.toMatch(/로보티|고르|골라/);
  });
});

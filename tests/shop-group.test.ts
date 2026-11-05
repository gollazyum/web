import { describe, expect, it } from "vitest";
import { groupItems, groupParts } from "@/lib/shop-group";
import { relevanceOrder } from "@/lib/shop-results";
import { cleanOutboundUrl } from "@/lib/sellers";
import { shapeDetail, shapeSearch } from "@/lib/shopping";

const r = (title: string, source: string, price: number, id: string) => ({ title, source, extracted_price: price, product_id: id, link: "" });

describe("같은 상품 묶기 (LB-069)", () => {
  it("색상만 다른 상품, 같은 이름의 다른 판매처는 한 카드", () => {
    const q = "캐리어 24인치";
    const key = (t: string, s: string) => groupParts(t, s, q).key;
    expect(key("트래블기어 접이식캐리어 24인치 블랙", "쿠팡")).toBe(key("트래블기어 접이식캐리어 24인치 / 화이트", "무신사"));
    expect(key("에센셜 캐리어 24인치 트리플 블랙", "아르메")).toBe(key("에센셜 캐리어 24인치 스페이스 실버", "아르메"));
    expect(key("Apple 아이폰 17 256GB 자급제 블랙", "11번가")).toBe(key("애플 아이폰17 256GB 블랙 자급제 정품", "네이버"));
  });

  it("크기·용량이 다르면, 이름이 짧아 브랜드를 알 수 없는 다른 판매처 상품이면 묶지 않는다", () => {
    const q = "캐리어 24인치";
    const key = (t: string, s: string) => groupParts(t, s, q).key;
    expect(key("클레이 캐리어 24인치 / 화이트", "맨코")).not.toBe(key("클레이 캐리어 24인치 20인치 / 블랙", "맨코"));
    expect(key("캐리어 24인치 (레몬)", "레고트")).not.toBe(key("캐리어 24인치 블랙", "다른몰"));
    expect(key("클래식 캐리어 24인치", "코닥")).not.toBe(key("클래식 캐리어 24인치", "다른몰"));
    expect(key("캐리어 24인치 (레몬)", "레고트")).toBe(key("캐리어 24인치 (민트)", "레고트"));
  });

  it("카드: 가장 낮은 가격부터, 판매처 수, 색상 수 (같은 색을 한글·영어로 따로 세지 않는다)", () => {
    const items = [
      r("트래블기어 접이식캐리어 24인치 블랙", "쿠팡", 120000, "1"),
      r("트래블기어 접이식캐리어 24인치 화이트", "무신사", 115000, "2"),
      r("트래블기어 접이식캐리어 24인치 Black", "G마켓", 119000, "3"),
      r("트래블기어 접이식캐리어 24인치 민트", "29cm", 125000, "4"),
      r("다른 브랜드 캐리어 24인치", "SSG", 90000, "5"),
    ];
    const { items: cards } = shapeSearch({ shopping_results: items }, "캐리어 24인치");
    const tg = cards.find((c) => c.title.startsWith("트래블기어"))!;
    expect(cards).toHaveLength(2);
    expect(tg).toMatchObject({ productId: "1", price: 115000, priceFrom: true, storeCount: 4, optionCount: 3 });
    // 묶이지 않은 카드는 그대로
    expect(cards.find((c) => c.productId === "5")).toMatchObject({ price: 90000, seller: "SSG" });
    expect(cards.find((c) => c.productId === "5")!.storeCount).toBeUndefined();
  });

  it("카드를 누르면(상세) 묶인 판매처가 모두 가격순으로", () => {
    const items = [
      { ...r("트래블기어 접이식캐리어 24인치 블랙", "무신사", 120000, "1"), link: "https://www.musinsa.com/p/1" },
      { ...r("트래블기어 접이식캐리어 24인치 화이트", "G마켓", 115000, "2"), link: "https://item.gmarket.co.kr/Item?goodscode=2" },
      { ...r("트래블기어 접이식캐리어 24인치 민트", "29cm", 125000, "3"), link: "https://www.29cm.co.kr/p/3" },
    ];
    const { product } = shapeDetail("캐리어 24인치", { token: "", pid: "1" }, { shopping_results: items }, null);
    expect(product!.offers.filter((o) => !o.placeholder).map((o) => [o.seller.key, o.price])).toEqual([
      ["G마켓", 115000],
      ["무신사", 120000],
      ["29cm", 125000],
    ]);
  });

  it("groupItems는 처음 나온 상품을 대표로 둔다", () => {
    const g = groupItems(["a 블랙", "a 화이트", "b"], (t) => ({ title: `브랜드상품 ${t}`, source: "x", seller: "x", price: 1 }), "q");
    expect(g.map((x) => x.lead)).toEqual(["a 블랙", "b"]);
  });
});

describe("관련도순 (LB-053): 본품 먼저", () => {
  it("케이스·이름 없는 싼 부속품은 뒤로, 본체+충전케이스 같은 본품은 앞에", () => {
    const items = [
      { title: "에어팟하드 햄바라기 에어팟 PRO 2", price: 13500 },
      { title: "Apple Airpods Pro 2세대", price: 184000 },
      { title: "TULIP PODS 에어팟 프로 2", price: 18000 },
      { title: "애플 에어팟 프로 2세대 본체 C타입 충전케이스", price: 139000 },
      { title: "에어팟 프로 2", price: 150000 },
    ];
    const order = relevanceOrder(items, "에어팟 프로 2").map((i) => i.price);
    expect(order.slice(0, 3)).toEqual([184000, 139000, 150000]);
    expect(order.slice(3).sort()).toEqual([13500, 18000]);
  });
});

describe("판매처 주소의 추적·출처 파라미터 (LB-065)", () => {
  it("srsltid·utm_*·gclid는 빼고 상품 값은 남긴다", () => {
    expect(cleanOutboundUrl("https://www.musinsa.com/products/1?srsltid=AfmBOo&utm_source=google&utm_medium=cpc&gclid=x&color=black")).toBe(
      "https://www.musinsa.com/products/1?color=black",
    );
    expect(cleanOutboundUrl("https://item.gmarket.co.kr/Item?goodscode=3003")).toBe("https://item.gmarket.co.kr/Item?goodscode=3003");
    expect(cleanOutboundUrl("")).toBe("");
  });

  it("상세 판매처 링크에도 남지 않는다", () => {
    const sel = { ...r("상품명 긴이름 A1", "무신사", 10000, "1"), link: "https://www.musinsa.com/p/1?srsltid=abc&utm_source=google" };
    const { product } = shapeDetail("q", { token: "", pid: "1" }, { shopping_results: [sel] }, null);
    expect(product!.offers[0].link).toBe("https://www.musinsa.com/p/1");
  });
});

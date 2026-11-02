import { describe, expect, it } from "vitest";
import { COUPANG_HOME } from "@/lib/coupang-links";
import { SAMPLE_PRODUCT_JSON, SAMPLE_SHOPPING_JSON, shapeShopping } from "@/lib/shopping";

const first = { shopping_results: [{ title: "상품", source: "x", extracted_price: 1 , immersive_product_page_token: "t" }] };
const detail = (stores: Record<string, unknown>[]) => ({ product_results: { title: "상품", stores } });

describe("shapeShopping", () => {
  it("4곳만 남기고 싼 순서로, 쿠팡은 SerpApi 원본 주소 대신 getCoupangLink를 쓴다", () => {
    const { product } = shapeShopping("이어폰", SAMPLE_SHOPPING_JSON, SAMPLE_PRODUCT_JSON);
    const offers = product!.offers;
    expect(offers.map((o) => o.seller.key)).toEqual(["쿠팡", "11번가", "네이버", "G마켓"]);
    const coupang = offers[0];
    expect(coupang.link).toBe(COUPANG_HOME);
    expect(coupang.coupang).toEqual({ url: COUPANG_HOME, type: "home" });
    expect(product!.price).toBe(289000);
    expect(product!.changePct).toBe(8);
    expect(offers[3].price! - offers[0].price!).toBe(114280);
  });

  it("같은 판매처는 가장 싼 1개만 남긴다", () => {
    const { product } = shapeShopping("상품", first, detail([
      { name: "11st", link: "https://www.11st.co.kr/a", extracted_price: 30000 },
      { name: "11번가", link: "https://www.11st.co.kr/b", extracted_price: 25000 },
    ]));
    expect(product!.offers).toHaveLength(1);
    expect(product!.offers[0].price).toBe(25000);
    expect(product!.offers[0].link).toBe("https://www.11st.co.kr/b");
  });

  it("품절이나 가격 미확인 판매처는 1위가 되지 않고 뒤로 간다", () => {
    const { product } = shapeShopping("상품", first, detail([
      { name: "쿠팡", link: "https://www.coupang.com/x", extracted_price: 10000, tag: "일시품절" },
      { name: "Gmarket", link: "https://www.gmarket.co.kr/x" },
      { name: "Naver", link: "https://smartstore.naver.com/x", extracted_price: 20000 },
    ]));
    const offers = product!.offers;
    expect(offers[0].seller.key).toBe("네이버");
    expect(product!.price).toBe(20000);
    expect(offers.slice(1).map((o) => o.seller.key).sort()).toEqual(["G마켓", "쿠팡"].sort());
    expect(offers.find((o) => o.seller.key === "쿠팡")!.available).toBe(false);
  });

  it("4곳이 모두 없으면 판매처 목록이 비어 있다", () => {
    const { product } = shapeShopping("상품", first, detail([{ name: "SSG.COM", link: "https://www.ssg.com/x", extracted_price: 5000 }]));
    expect(product!.offers).toEqual([]);
    expect(product!.price).toBeNull();
  });

  it("결과가 없으면 null", () => {
    expect(shapeShopping("x", {}, null).product).toBeNull();
  });
});

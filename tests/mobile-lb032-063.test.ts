import { describe, expect, it } from "vitest";
import { cityAnchor, hotelDistance } from "@/lib/hotel-distance";
import { resized } from "@/lib/hotel-photo";
import { favId } from "@/lib/shop-favs";
import { relevance, relevantOnly } from "@/lib/shop-results";
import { conditionOf, gradeOf, rankOffers, shapeDetail, shippingOf, stripLocation, type Offer } from "@/lib/shopping";
import { shopSeller } from "@/lib/sellers";
import { reportMailto } from "@/components/shop/ReportSheet";
import { conditionLabel, rowLabel, shippingLabel } from "@/components/shop/SellerRow";

const offer = (key: string, price: number | null, extra: Partial<Offer> = {}): Offer => ({
  seller: shopSeller(key, "")!,
  price,
  available: true,
  link: `https://example.com/${key}`,
  coupang: null,
  ...extra,
});

describe("중고·배송비 (LB-054)", () => {
  it("상태와 등급을 읽는다", () => {
    expect(conditionOf('["중고","온라인 재고 있음"]', "에어팟 프로 2세대 (Lightning) A2931 GB B+")).toBe("used");
    expect(gradeOf("에어팟 프로 2세대 (Lightning) A2931 GB B+")).toBe("B+");
    expect(gradeOf("아이폰 17 256GB 블랙 중고 S급")).toBe("S");
    expect(gradeOf("Apple 아이폰 17 256GB 자급제 블랙")).toBeNull();
    expect(conditionOf("", "에어팟프로2 미개봉 새상품")).toBe("new");
    expect(conditionOf("", "갤럭시 S25 리퍼 상품")).toBe("refurb");
    expect(conditionOf("", "Apple 아이폰 17 256GB")).toBe("new");
  });

  it("배송비: 무료 / 금액 / 모름", () => {
    expect(shippingOf({ shipping: "무료" })).toBe(0);
    expect(shippingOf({ details_and_offers: ["온라인 재고 있음", "무료 배송"] })).toBe(0);
    expect(shippingOf({ shipping_extracted: 3000 })).toBe(3000);
    expect(shippingOf({ additional_costs: "배송비 별도" })).toBeNull();
    expect(shippingLabel(offer("쿠팡", 1, { shippingFee: 0 }))).toBe("무료배송");
    expect(shippingLabel(offer("쿠팡", 1, { shippingFee: null }))).toBe("배송비 확인 필요");
  });

  it("1위는 새 상품끼리, 중고 포함·배송비 포함은 칩으로", () => {
    const list = [
      offer("폰가비", 90000, { condition: "used", grade: "B+", shippingFee: 0 }),
      offer("11번가", 120000, { shippingFee: 5000 }),
      offer("G마켓", 122000, { shippingFee: 0 }),
    ];
    const def = rankOffers(list, { includeUsed: false, withShipping: false });
    expect(def.top?.seller.key).toBe("11번가");
    expect(def.hiddenUsed).toBe(1);
    expect(rankOffers(list, { includeUsed: true, withShipping: false }).top?.seller.key).toBe("폰가비");
    expect(rankOffers(list, { includeUsed: false, withShipping: true }).top?.seller.key).toBe("G마켓");
    expect(conditionLabel(list[0])).toBe("중고 · B+ 등급");
  });

  it("링크 이름: 순위를 한 번만 읽고 새 탭 안내를 붙인다", () => {
    const label = rowLabel(offer("폰가비", 110100, { condition: "used", grade: "B+", shippingFee: 0 }), 1);
    expect(label).toBe("가격 1위 폰가비 110,100원, 중고 · B+ 등급, 무료배송, 새 탭에서 열려요");
    expect(label.match(/1위/g)).toHaveLength(1);
  });

  it("상세: 새 상품이 있으면 대표 가격은 새 상품 1위", () => {
    const search = {
      shopping_results: [{ title: "에어팟 프로 2세대", source: "11번가", link: "https://www.11st.co.kr/products/1", extracted_price: 200000, product_id: "77" }],
    };
    const detail = {
      product_results: {
        title: "에어팟 프로 2세대",
        stores: [
          { name: "폰가비", link: "https://fongabi.com/a", extracted_price: 110000, details_and_offers: ["중고", "무료 배송"], title: "에어팟 프로 2세대 B+" },
          { name: "11번가", link: "https://www.11st.co.kr/products/1", extracted_price: 200000, shipping: "무료" },
          { name: "G마켓", link: "https://item.gmarket.co.kr/1", extracted_price: 205000 },
        ],
      },
    };
    const { product } = shapeDetail("에어팟 프로 2", { token: "", pid: "77" }, search, detail);
    expect(product!.price).toBe(200000);
    expect(product!.productId).toBe("77");
    expect(product!.offers.find((o) => o.seller.key === "폰가비")?.grade).toBe("B+");
  });
});

describe("검색 품질 (LB-045·047)", () => {
  it("관계없는 상품은 빼고, 하나도 맞지 않으면 unrelated", () => {
    expect(relevance("에어팟 프로 2", "Apple AirPods Pro 2nd Gen")).toBeGreaterThanOrEqual(0.5);
    expect(relevantOnly([{ title: "정관장 홍삼액 50ml 30포" }, { title: "홍삼정 에브리타임" }], "쿼크플럭스 무선").unrelated).toBe(true);
    const { items, unrelated } = relevantOnly([{ title: "에어팟 프로 2세대" }, { title: "정관장 홍삼액" }], "에어팟 프로 2");
    expect(unrelated).toBe(false);
    expect(items.map((i) => i.title)).toEqual(["에어팟 프로 2세대"]);
  });

  it("'근처, 37 km' 같은 위치 문구를 지운다", () => {
    expect(stripLocation("하이마트 근처, 37 km")).toBe("하이마트");
    expect(stripLocation("근처, 37 km")).toBe("");
    expect(stripLocation("쿠팡")).toBe("쿠팡");
  });
});

describe("찜은 상품 ID 단위 (LB-058)", () => {
  it("pid가 있으면 pid, 없으면 토큰 해시", () => {
    expect(favId("123", "tok")).toBe("p:123");
    expect(favId("", "a".repeat(2100))).toMatch(/^t:[0-9a-z]+$/);
    expect(favId("", "tok-a")).not.toBe(favId("", "tok-b"));
    expect(favId("", "")).toBe("");
  });
});

describe("제보 메일 (LB-062)", () => {
  it("상품 주소·판매처·가격·기준 시각을 본문에 넣는다", () => {
    const href = reportMailto(
      "가격이 달라요",
      { title: "에어팟", url: "https://www.gollazyum.com/shop/product?q=a&pid=1", rows: [{ seller: "11번가", price: "200,000원" }], fetchedAt: "2026. 11. 04. 18:03" },
      "x@example.com",
    );
    const body = decodeURIComponent(href.split("&body=")[1]);
    expect(body).toContain("상품 주소: https://www.gollazyum.com/shop/product?q=a&pid=1");
    expect(body).toContain("- 11번가: 200,000원");
    expect(body).toContain("기준 시각: 2026. 11. 04. 18:03");
  });
});

describe("숙소 거리·사진 (LB-059·063)", () => {
  it("도시 대표 지점과의 거리, 20km 넘으면 시내 밖", () => {
    expect(cityAnchor("도쿄")?.point).toBe("도쿄역");
    const near = hotelDistance([35.6970283, 139.7835349], "도쿄");
    expect(near?.text).toBe("도쿄역에서 2.3 km");
    expect(near?.outside).toBeNull();
    const far = hotelDistance([35.4437, 139.638], "도쿄"); // 요코하마
    expect(far?.outside).toBe("도쿄 시내 밖");
    expect(hotelDistance([35.7, 139.7], "어딘가")).toBeNull();
    expect(hotelDistance(null, "도쿄")).toBeNull();
  });

  it("사진 크기 값만 바꿔 큰 사진을 받는다", () => {
    const src = "https://lh3.googleusercontent.com/grass-cs/AAB=s287-w287-h192-n-k-no-v1";
    expect(resized(src, 288, 360)).toBe("https://lh3.googleusercontent.com/grass-cs/AAB=w288-h360-k-no");
    expect(resized("https://example.com/a.jpg", 288, 360)).toBe("https://example.com/a.jpg");
  });
});

import { describe, expect, it } from "vitest";
import { SAMPLE_PRODUCT_JSON, SAMPLE_SHOPPING_JSON, relevantShoppingResult, shapeShopping } from "@/lib/shopping";
import { RELEVANCE_MIN_COVERAGE, filterProductOptions, titleRelevance } from "@/lib/shop-match";

const NONSENSE = "ㅁㄴㅇㄹqwer없는상품";

describe("titleRelevance", () => {
  it("기준은 검색어 토큰의 2/3 이다", () => {
    expect(RELEVANCE_MIN_COVERAGE).toBeCloseTo(2 / 3);
  });

  it("의미 없는 검색어는 홍삼 상품과 겹치지 않는다", () => {
    const rel = titleRelevance(NONSENSE, "순한 홍삼액 2개묶음");
    expect(rel.strong).toBe(false);
    expect(rel.matched).toBe(0);
  });

  it("아이폰과 iPhone, 화이트와 White 를 같은 말로 본다", () => {
    expect(titleRelevance("아이폰 17", "Apple iPhone 17 Pro 256GB").strong).toBe(true);
    expect(titleRelevance("아이폰17", "iPhone 17").strong).toBe(true);
    expect(titleRelevance("화이트", "White Sneakers").strong).toBe(true);
    expect(titleRelevance("White", "화이트 256GB").strong).toBe(true);
  });

  it("모델 숫자가 다르면 절반 이상 겹쳐도 확정하지 않는다", () => {
    const rel = titleRelevance("아이폰 17", "아이폰 16 프로");
    expect(rel.strong).toBe(false);
    expect(rel.coverage).toBe(0.5);
  });

  it("두 단어 중 하나만 겹치면 확정하지 않는다", () => {
    const rel = titleRelevance("무선 이어폰", "무선 마우스");
    expect(rel.coverage).toBe(0.5);
    expect(rel.strong).toBe(false);
  });

  it("치수 숫자가 다르면 약한 일치다", () => {
    expect(titleRelevance("캐리어 24인치", "캐리어 28인치").strong).toBe(false);
  });

  it("한 단어가 상품명 안에 있으면 강한 일치다", () => {
    expect(titleRelevance("이어폰", "노이즈캔슬링 무선 이어폰 2세대").strong).toBe(true);
    expect(titleRelevance("홍삼", "순한 홍삼액 2개묶음").strong).toBe(true);
  });

  it("검색어 쪽이 더 길면 짧은 제목 조각으로 맞았다고 치지 않는다", () => {
    expect(titleRelevance("없는상품", "좋은 상품 모음").strong).toBe(false);
  });
});

describe("filterProductOptions", () => {
  it("근처와 거리는 빼고 색·용량만 남긴다", () => {
    expect(filterProductOptions(["근처", "37 km", "화이트", "128GB"])).toBe("화이트 · 128GB");
    expect(filterProductOptions(["근처, 37 km"])).toBe("");
    expect(filterProductOptions(["37km", "매장까지 2.4km"])).toBe("");
  });

  it("크기와 수량을 남긴다", () => {
    expect(filterProductOptions(["24인치", "2개입", "XL"])).toBe("24인치 · 2개입 · XL");
    expect(filterProductOptions(["2개묶음"])).toBe("2개묶음");
  });

  it("출처 문구와 상품 옵션이 아닌 말은 뺀다", () => {
    expect(filterProductOptions(["Google", "SerpApi 기준", "블랙"])).toBe("블랙");
    expect(filterProductOptions(["구글", "출처"])).toBe("");
    expect(filterProductOptions(["USB-C 케이스", "무료배송", "4.5"])).toBe("");
  });
});

describe("shapeShopping relevance", () => {
  const hongsam = {
    shopping_results: [
      {
        title: "순한 홍삼액 2개묶음",
        source: "Coupang",
        extracted_price: 39000,
        extensions: ["근처", "37 km"],
        thumbnail: "https://example.test/ginseng.jpg",
        immersive_product_page_token: "ginseng",
      },
    ],
  };

  it("약한 일치는 상품으로 잠그지 않고, 검색어를 제목으로 바꾸지 않는다", () => {
    const res = shapeShopping(NONSENSE, hongsam, {
      product_results: { title: "순한 홍삼액 2개묶음", stores: [{ name: "Coupang", link: "https://www.coupang.com/x", extracted_price: 39000 }] },
    });
    expect(res.product).toBeNull();
    expect(res.candidates).toHaveLength(1);
    expect(res.candidates[0].title).toBe("순한 홍삼액 2개묶음");
    expect(res.candidates[0].title).not.toBe(NONSENSE);
    expect(res.candidates[0].option).toBe("");
    expect(relevantShoppingResult(NONSENSE, hongsam)).toBeNull();
  });

  it("아이폰 17 은 iPhone 상품으로 확정하고, 거리 문구는 옵션에서 뺀다", () => {
    const res = shapeShopping("아이폰 17", SAMPLE_SHOPPING_JSON, SAMPLE_PRODUCT_JSON);
    expect(res.product).not.toBeNull();
    expect(res.product!.query).toBe("아이폰 17");
    expect(res.product!.title).toBe("Apple iPhone 17 128GB");
    expect(res.product!.option).toBe("화이트 · 128GB");
    expect(res.product!.option).not.toMatch(/근처|km|Google|SerpApi/i);
    expect(res.product!.price).toBe(1250000);
    expect(res.candidates).toEqual([]);
    expect(relevantShoppingResult("아이폰 17", SAMPLE_SHOPPING_JSON)?.immersive_product_page_token).toBe("sample-iphone");
  });

  it("앞에 있는 약한 결과보다 뒤의 강한 결과를 쓴다", () => {
    const json = {
      shopping_results: [
        { title: "순한 홍삼액 2개묶음", extensions: ["근처"], immersive_product_page_token: "bad" },
        { title: "Apple iPhone 17 128GB", extensions: ["블랙", "256GB"], immersive_product_page_token: "good", source: "Coupang", extracted_price: 1300000 },
      ],
    };
    const res = shapeShopping("아이폰 17", json, null);
    expect(res.product!.title).toBe("Apple iPhone 17 128GB");
    expect(res.product!.option).toBe("블랙 · 256GB");
    expect(relevantShoppingResult("아이폰 17", json)?.immersive_product_page_token).toBe("good");
  });

  it("이어폰 검색은 이어폰 예시를 유지한다", () => {
    const { product } = shapeShopping("무선 이어폰", SAMPLE_SHOPPING_JSON, SAMPLE_PRODUCT_JSON);
    expect(product!.title).toBe("노이즈캔슬링 무선 이어폰 2세대");
    expect(product!.option).toBe("화이트");
    expect(product!.price).toBe(289000);
  });
});

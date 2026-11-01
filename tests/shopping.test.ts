import { describe, expect, it } from "vitest";
import { findBannedWords } from "@/lib/brand-mode";
import { COUPANG_HOME } from "@/lib/coupang-links";
import { maskSecrets, rankable, rawSellerLog, shapeDetail, shapeSearch } from "@/lib/shopping";
import { SAMPLE_DETAIL_JSON, SAMPLE_SEARCH_JSON } from "@/lib/shopping-fixtures";

const TOKEN = "sample-iphone17-256-black";
const search = (results: Record<string, unknown>[]) => ({ shopping_results: results });
const detail = (stores: Record<string, unknown>[]) => ({ product_results: { title: "상품", stores } });
const item = (over: Record<string, unknown> = {}) => ({ title: "Apple 아이폰 17 256GB 자급제 블랙", source: "x", immersive_product_page_token: "t", ...over });

describe("shapeSearch", () => {
  it("검색 목록만 만들고, 판매처는 4곳일 때만 붙인다", () => {
    const { items } = shapeSearch(SAMPLE_SEARCH_JSON);
    expect(items[0]).toMatchObject({ token: TOKEN, seller: "11번가", price: 1290000 });
    expect(items[1].seller).toBe("네이버"); // 판매처 이름은 상점명이지만 실제 주소가 스마트스토어
    expect(items.find((i) => i.token === "sample-8")!.seller).toBeNull(); // SSG는 4곳이 아님
  });
});

describe("shapeDetail (아이폰 17: 스토어 목록에 11번가만 오는 경우)", () => {
  const { product } = shapeDetail("아이폰 17", TOKEN, SAMPLE_SEARCH_JSON, SAMPLE_DETAIL_JSON[TOKEN]);
  const names = product!.offers.map((o) => o.seller.key);

  it("같은 상품이 확실한 검색 결과에서 네이버·G마켓을 보태고, 중고·Pro·다른 용량·케이스는 합치지 않는다", () => {
    expect(names).toEqual(["11번가", "네이버", "G마켓", "쿠팡"]);
    expect(product!.offers.map((o) => o.price)).toEqual([1290000, 1310000, 1335000, null]);
  });

  it("쿠팡이 없으면 맨 아래 덧붙임 행: 가격 없음, 순위·대표 가격 계산에서 빠짐, getCoupangLink 주소", () => {
    const cp = product!.offers.at(-1)!;
    expect(cp).toMatchObject({ placeholder: true, price: null, link: COUPANG_HOME, coupang: { url: COUPANG_HOME, type: "home" } });
    expect(rankable(cp)).toBe(false);
    expect(product!.price).toBe(1290000);
    expect(product!.changePct).toBe(8);
  });

  it("다른 판매처 링크는 중간 이동 주소를 푼 실제 판매처 주소", () => {
    expect(product!.offers[0].link).toBe("https://www.11st.co.kr/products/1001");
    expect(product!.offers[2].link).toBe("https://item.gmarket.co.kr/Item?goodscode=3003");
  });

  it("화면에 나갈 값에 금지어·출처가 없다", () => {
    const text = JSON.stringify(product!.offers.map((o) => [o.seller.key, o.link.includes("google")]));
    expect(findBannedWords(text, true)).toEqual([]);
    expect(product!.offers.some((o) => /google/.test(o.link))).toBe(false);
  });
});

describe("shapeDetail 규칙", () => {
  it("쿠팡이 있으면 SerpApi 원본 주소 대신 getCoupangLink, 덧붙임 행은 없다", () => {
    const { product } = shapeDetail("q", "t", search([item()]), detail([{ name: "Coupang", link: "https://www.coupang.com/vp/products/1", extracted_price: 1000 }]));
    expect(product!.offers).toHaveLength(1);
    expect(product!.offers[0].link).toBe(COUPANG_HOME);
    expect(product!.offers[0].placeholder).toBeUndefined();
  });

  it("같은 판매처는 가장 싼 1개만", () => {
    const { product } = shapeDetail("q", "t", search([item()]), detail([
      { name: "11st", link: "https://www.11st.co.kr/a", extracted_price: 30000 },
      { name: "11번가", link: "https://www.11st.co.kr/b", extracted_price: 25000 },
    ]));
    const st = product!.offers.filter((o) => o.seller.key === "11번가");
    expect(st).toHaveLength(1);
    expect(st[0].price).toBe(25000);
  });

  it("품절·가격 미확인은 1위가 되지 않는다", () => {
    const { product } = shapeDetail("q", "t", search([item()]), detail([
      { name: "쿠팡", link: "https://www.coupang.com/x", extracted_price: 10000, tag: "일시품절" },
      { name: "Gmarket", link: "https://www.gmarket.co.kr/x" },
      { name: "Naver", link: "https://smartstore.naver.com/x", extracted_price: 20000 },
    ]));
    expect(product!.offers[0].seller.key).toBe("네이버");
    expect(product!.price).toBe(20000);
    expect(product!.offers.find((o) => o.seller.key === "쿠팡")!.available).toBe(false);
  });

  it("스토어 조회가 실패하고 같은 상품도 없으면 확인된 판매처 1곳(고른 상품)만", () => {
    const { product } = shapeDetail("q", "t", search([
      item({ source: "11번가", link: "https://www.11st.co.kr/1", extracted_price: 100 }),
      item({ title: "아이폰 17 256GB 블랙 공기계", source: "G마켓", link: "https://www.gmarket.co.kr/2", immersive_product_page_token: "u", extracted_price: 90 }),
    ]), null);
    expect(product!.offers.filter((o) => !o.placeholder).map((o) => o.seller.key)).toEqual(["11번가"]);
  });

  it("4곳이 모두 없으면 쿠팡 덧붙임 행만 남는다", () => {
    const { product } = shapeDetail("q", "t", search([item()]), detail([{ name: "SSG.COM", link: "https://www.ssg.com/x", extracted_price: 5000 }]));
    expect(product!.offers.map((o) => o.placeholder)).toEqual([true]);
    expect(product!.price).toBeNull();
  });

  it("고른 상품을 찾지 못하면 null", () => {
    expect(shapeDetail("x", "t", {}, null).product).toBeNull();
  });
});

describe("개발용 원본 로그", () => {
  it("인증 값을 지운다", () => {
    expect(maskSecrets("https://serpapi.com/search.json?engine=x&api_key=abc123&q=1")).toBe("https://serpapi.com/search.json?engine=x&api_key=***&q=1");
    const { rows } = rawSellerLog(SAMPLE_SEARCH_JSON);
    expect(JSON.stringify(rows)).not.toContain("SHOULD_NOT_LEAK");
    expect(rows[0]).toMatchObject({ source: "11번가", seller: "11번가" });
  });
});

import { describe, expect, it } from "vitest";
import { findBannedWords } from "@/lib/brand-mode";
import { COUPANG_HOME, coupangSearchUrl } from "@/lib/coupang-links";
import { detailHref, maskSecrets, rankable, rawSellerLog, shapeDetail, shapeSearch } from "@/lib/shopping";
import { SAMPLE_DETAIL_JSON, SAMPLE_SEARCH_JSON } from "@/lib/shopping-fixtures";

const TOKEN = "sample-iphone17-256-black";
const search = (results: Record<string, unknown>[]) => ({ shopping_results: results });
const detail = (stores: Record<string, unknown>[]) => ({ product_results: { title: "상품", stores } });
const item = (over: Record<string, unknown> = {}) => ({ title: "Apple 아이폰 17 256GB 자급제 블랙", source: "x", immersive_product_page_token: "t", ...over });

describe("shapeSearch", () => {
  it("검색 목록만 만들고, 주요 4곳은 표준 이름, 그 밖은 판매처 이름 그대로", () => {
    const { items } = shapeSearch(search([
      item({ source: "11번가", immersive_product_page_token: "a", extracted_price: 1000 }),
      item({ title: "Apple 아이폰 17 Pro 256GB", source: "애플 공식 판매처", link: "https://smartstore.naver.com/s/1", immersive_product_page_token: "b" }),
      item({ title: "Apple 아이폰 17 512GB", source: "SSG.COM", immersive_product_page_token: "c" }),
    ]));
    expect(items[0]).toMatchObject({ token: "a", seller: "11번가", price: 1000 });
    expect(items[1].seller).toBe("네이버"); // 판매처 이름은 상점명이지만 실제 주소가 스마트스토어
    expect(items.find((i) => i.token === "c")!.seller).toBe("SSG");
  });
});

describe("shapeDetail (아이폰 17: 스토어 목록에 11번가만 오는 경우)", () => {
  const { product } = shapeDetail("아이폰 17", TOKEN, SAMPLE_SEARCH_JSON, SAMPLE_DETAIL_JSON[TOKEN]);
  const names = product!.offers.map((o) => o.seller.key);

  it("같은 상품이 확실한 검색 결과에서 네이버·G마켓을 보태고, 중고·Pro·다른 용량·케이스는 합치지 않는다", () => {
    // 목록에서 같은 카드로 묶인 SSG(같은 이름)·KREAM(화이트)도 들어온다. 1원(KT모바일샵)은 빠진다
    expect(names).toEqual(["SSG", "11번가", "하이마트", "네이버", "KREAM", "G마켓", "쿠팡"]);
    expect(product!.offers.map((o) => o.price)).toEqual([1280000, 1290000, 1300000, 1310000, 1310000, 1335000, null]);
  });

  it("쿠팡이 없으면 맨 아래 덧붙임 행: 가격 없음, 순위·대표 가격 계산에서 빠짐, 파트너스 링크 (딥링크 대상은 상품명 검색결과)", () => {
    const cp = product!.offers.at(-1)!;
    const url = coupangSearchUrl(product!.title);
    expect(cp).toMatchObject({ placeholder: true, price: null, link: COUPANG_HOME, coupang: { url: COUPANG_HOME, type: "home", name: product!.title, target: { url, type: "search" } } });
    expect(rankable(cp)).toBe(false);
    expect(product!.price).toBe(1280000);
    expect(product!.changePct).toBeNull();
  });

  it("다른 판매처 링크는 중간 이동 주소를 푼 실제 판매처 주소", () => {
    const link = (k: string) => product!.offers.find((o) => o.seller.key === k)!.link;
    expect(link("11번가")).toBe("https://www.11st.co.kr/products/1001");
    expect(link("하이마트")).toBe("https://www.e-himart.co.kr/x");
    expect(link("G마켓")).toBe("https://item.gmarket.co.kr/Item?goodscode=3003");
  });

  it("화면에 나갈 값에 금지어·출처가 없다", () => {
    const text = JSON.stringify(product!.offers.map((o) => [o.seller.key, o.link.includes("google")]));
    expect(findBannedWords(text, true)).toEqual([]);
    expect(product!.offers.some((o) => /google/.test(o.link))).toBe(false);
  });
});

describe("shapeDetail 규칙", () => {
  it("쿠팡 판매처에 실제 상품 주소가 있으면 그 주소를 딥링크 대상으로, 화면 링크는 파트너스 링크. 덧붙임 행은 없다", () => {
    const { product } = shapeDetail("q", "t", search([item({ source: "" })]), detail([{ name: "Coupang", link: "https://www.coupang.com/vp/products/1", extracted_price: 1000 }]));
    expect(product!.offers).toHaveLength(1);
    expect(product!.offers[0].link).toBe(COUPANG_HOME);
    expect(product!.offers[0].coupang?.target).toEqual({ url: "https://www.coupang.com/vp/products/1", type: "product" });
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

  it("주요 4곳 밖 판매처(SSG 등)도 보여 주고, 쿠팡 덧붙임 행은 맨 아래", () => {
    const { product } = shapeDetail("q", "t", search([item({ source: "" })]), detail([{ name: "SSG.COM", link: "https://www.ssg.com/x", extracted_price: 5000 }]));
    expect(product!.offers.map((o) => [o.seller.key, o.price, !!o.placeholder])).toEqual([["SSG", 5000, false], ["쿠팡", null, true]]);
    expect(product!.offers[0].link).toBe("https://www.ssg.com/x");
    expect(product!.price).toBe(5000);
  });

  it("상세가 0건이면 검색 결과의 판매처·가격·링크 1곳으로 보여 준다 (판매처 0곳이 되지 않는다)", () => {
    const sel = item({ title: "Apple iPhone 17 자급제 256GB 화이트", source: "KREAM", extracted_price: 1310000, link: "https://kream.co.kr/products/1" });
    for (const d of [detail([]), null, {}]) {
      const { product } = shapeDetail("아이폰 17", "t", search([sel]), d);
      const real = product!.offers.filter((o) => !o.placeholder);
      expect(real.map((o) => [o.seller.key, o.price, o.link])).toEqual([["KREAM", 1310000, "https://kream.co.kr/products/1"]]);
      expect(product!.price).toBe(1310000);
      expect(product!.priceFromList).toBe(false);
    }
  });

  it("검색 결과 링크가 없으면 product_link를 쓴다", () => {
    const sel = item({ source: "29cm", extracted_price: 270000, product_link: "https://www.29cm.co.kr/p/1" });
    const { product } = shapeDetail("q", "t", search([sel]), null);
    expect(product!.offers[0]).toMatchObject({ price: 270000, link: "https://www.29cm.co.kr/p/1" });
    expect(product!.offers[0].seller.key).toBe("29cm");
  });

  it("데이터 출처 이름은 판매처로 보여 주지 않는다", () => {
    const { product } = shapeDetail("q", "t", search([item({ source: "Google" })]), detail([{ name: "Google Shopping", extracted_price: 5000 }]));
    expect(product!.offers.filter((o) => !o.placeholder)).toEqual([]);
  });

  it("1위 판매처가 있으면 목록 가격 표시가 아니다", () => {
    const { product } = shapeDetail("q", "t", search([item({ source: "", extracted_price: 999 })]), detail([{ name: "11번가", link: "https://www.11st.co.kr/1", extracted_price: 5000 }]));
    expect(product!.price).toBe(5000);
    expect(product!.priceFromList).toBe(false);
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

describe("이상한 가격", () => {
  it("100원 이하(0원·1원 등)는 검색 목록에서 뺀다", () => {
    const { items } = shapeSearch(search([
      item({ title: "상품 A1", immersive_product_page_token: "a", extracted_price: 1 }),
      item({ title: "상품 B2", immersive_product_page_token: "b", extracted_price: 0 }),
      item({ title: "상품 C3", immersive_product_page_token: "c", extracted_price: 100 }),
      item({ title: "상품 D4", immersive_product_page_token: "d", extracted_price: 101 }),
      item({ title: "상품 E5", immersive_product_page_token: "e" }),
    ]));
    expect(items.map((i) => [i.token, i.price])).toEqual([["d", 101], ["e", null]]);
  });
  it("100원 이하 값은 목록 대표 가격으로도 쓰지 않는다", () => {
    const { product } = shapeDetail("q", "t", search([item({ extracted_price: 1 })]), detail([]));
    expect(product!.price).toBeNull();
    expect(product!.priceFromList).toBe(false);
  });
  it("상세에서 1원·터무니없이 싼 값은 1위가 되지 않는다", () => {
    const { product } = shapeDetail("q", "t", search([item()]), detail([
      { name: "11번가", link: "https://www.11st.co.kr/1", extracted_price: 1 },
      { name: "G마켓", link: "https://www.gmarket.co.kr/1", extracted_price: 300000 },
      { name: "네이버", link: "https://smartstore.naver.com/1", extracted_price: 1300000 },
      { name: "쿠팡", link: "https://www.coupang.com/1", extracted_price: 1310000 },
      { name: "Gmarket", link: "https://www.gmarket.co.kr/2", extracted_price: 1320000 },
    ]));
    expect(product!.price).toBe(1300000);
    expect(product!.offers[0].seller.key).toBe("네이버");
  });
});

describe("shapeDetail (실제 아이폰 17 화이트 스토어 목록, more_stores)", () => {
  const sel = item({ title: "Apple iPhone 17 자급제 256GB 화이트", source: "KREAM", extracted_price: 1310000, immersive_product_page_token: "w" });
  const stores = [
    { name: "KREAM", extracted_price: 1310000, link: "https://kream.co.kr/products/604070" },
    { name: "Apple", extracted_price: 1450000, link: "/goto?url=A" },
    { name: "11번가", extracted_price: 1000, link: "https://www.11st.co.kr/connect/Gateway.tmall?prdNo=1" },
    { name: "KT모바일샵", extracted_price: 886000, link: "/goto?url=B" },
    { name: "G마켓", extracted_price: 1499000, link: "/goto?url=C" },
    { name: "세컨웨어", extracted_price: 1000000, link: "/goto?url=D" },
    { name: "KT모바일샵", extracted_price: 1, link: "/goto?url=E" },
    { name: "G마켓", extracted_price: 1590000, link: "/goto?url=F" },
    { name: "롯데하이마트", extracted_price: 1450000, link: "/goto?url=G" },
  ];
  const { product } = shapeDetail("아이폰 17", "w", search([sel]), detail(stores));

  it("모든 판매처를 싼 순서로, 11번가 1,000원은 전체 가운데값 기준 미끼 가격으로 뺀다", () => {
    expect(product!.offers.map((o) => [o.seller.key, o.price])).toEqual([
      ["KT모바일샵", 886000],
      ["세컨웨어", 1000000],
      ["KREAM", 1310000],
      ["Apple", 1450000],
      ["롯데하이마트", 1450000],
      ["G마켓", 1499000],
      ["11번가", null],
      ["쿠팡", null],
    ]);
    // 구글 이동 주소(/goto)뿐인 판매처는 그 판매처의 검색 페이지로 (google.com 링크는 내보내지 않는다)
    expect(product!.offers.find((o) => o.seller.key === "G마켓")!.link).toBe(`https://browse.gmarket.co.kr/search?keyword=${encodeURIComponent(product!.title)}`);
    expect(product!.offers.some((o) => /google\./.test(o.link))).toBe(false);
  });

  it("주요 4곳이 없어도 판매처 목록이 비지 않는다", () => {
    const { product: p } = shapeDetail("아이폰 17", "w", search([sel]), detail(stores.slice(0, 2)));
    expect(p!.offers.map((o) => o.seller.key)).toEqual(["KREAM", "Apple", "쿠팡"]);
    expect(p!.price).toBe(1310000);
  });
});

describe("상세 응답 키 여러 개", () => {
  const sel = item({ immersive_product_page_token: "", product_id: "123", source: "KREAM", extracted_price: 50000 });
  it("sellers_results.online_sellers / offers_results.online_sellers / stores 를 모두 읽는다", () => {
    const d = {
      sellers_results: { online_sellers: [{ name: "11번가", direct_link: "https://www.11st.co.kr/d", link: "https://www.google.com/x", base_price: "₩41,000" }] },
      offers_results: { online_sellers: [{ merchant: "Gmarket", link: "https://item.gmarket.co.kr/1", extracted_price: 42000 }] },
      stores: [{ source: "lotteon.com", product_link: "https://www.lotteon.com/p/1", extracted_total: 43000, extracted_price: 40000 }],
    };
    const { product } = shapeDetail("q", { token: "", pid: "123" }, search([sel]), d);
    // 가격은 상품 가격(배송비 빼고). 총액과의 차이(3,000원)는 배송비로 따로 둔다
    expect(product!.offers.map((o) => [o.seller.key, o.price, o.link])).toEqual([
      ["lotteon", 40000, "https://www.lotteon.com/p/1"],
      ["11번가", 41000, "https://www.11st.co.kr/d"],
      ["G마켓", 42000, "https://item.gmarket.co.kr/1"],
      ["KREAM", 50000, ""],
      ["쿠팡", null, COUPANG_HOME],
    ]);
  });
  it("검색 목록은 토큰이 없어도 product_id가 있으면 넣고, inline_shopping_results 도 읽는다", () => {
    const { items } = shapeSearch({ inline_shopping_results: [sel] });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ token: "", productId: "123", seller: "KREAM", price: 50000 });
  });
});

describe("숙소 필터와 분리", () => {
  it("쇼핑 판매처는 숙소 허용 목록을 거치지 않는다. 구글 이동 주소는 판매처 검색 페이지로 바꾼다", async () => {
    const { allowedSellers } = await import("@/lib/hotel-sellers");
    expect(typeof allowedSellers).toBe("function");
    const { product } = shapeDetail("q", "t", search([item({ source: "" })]), detail([
      { name: "쿠팡", link: "https://www.coupang.com/1", extracted_price: 10000 },
      { name: "네이버", link: "https://www.google.com/goto?url=n", extracted_price: 11000 },
      { name: "G마켓", link: "https://item.gmarket.co.kr/1", extracted_price: 12000 },
      { name: "11번가", link: "https://www.11st.co.kr/1", extracted_price: 13000 },
    ]));
    expect(product!.offers.map((o) => o.seller.key)).toEqual(["쿠팡", "네이버", "G마켓", "11번가"]);
    expect(product!.offers[1].link).toBe("https://search.shopping.naver.com/search/all?query=" + encodeURIComponent("Apple 아이폰 17 256GB 자급제 블랙"));
  });
});

describe("상세 화면 주소", () => {
  it("product_id가 있으면 2,000자 넘는 토큰 대신 짧은 pid만 싣는다", () => {
    const href = detailHref("다이슨 에어랩", { token: "x".repeat(2100), productId: "15346608567883463621" });
    expect(href).toBe(`/shop/product?q=${encodeURIComponent("다이슨 에어랩").replace(/%20/g, "+")}&pid=15346608567883463621`);
  });
  it("product_id가 없으면 토큰", () => {
    expect(detailHref("q", { token: "abc", productId: "" })).toBe("/shop/product?q=q&token=abc");
  });
  it("pid만으로도 고른 상품을 찾는다", () => {
    const sel = item({ immersive_product_page_token: "x".repeat(2100), product_id: "77", source: "무신사", extracted_price: 57900, link: "https://www.musinsa.com/p/1" });
    const { product } = shapeDetail("q", { token: "", pid: "77" }, search([sel]), null);
    expect(product!.offers[0]).toMatchObject({ price: 57900, link: "https://www.musinsa.com/p/1" });
  });
});

describe("구글 쇼핑으로 가는 판매처 링크 (2026-11-04)", () => {
  const title = "Apple 아이폰 17 256GB 자급제 블랙";
  it("구글 이동 주소뿐이면 판매처 검색 페이지, 모르는 판매처는 링크 없는 '가격 참고' 줄", () => {
    const { product } = shapeDetail("q", "t", search([item({ source: "" })]), detail([
      { name: "무신사", link: "https://www.google.com/search?ibp=oshop&q=x&prds=1", extracted_price: 20000 },
      { name: "어떤쇼핑몰", link: "https://www.google.com/goto?url=ENC", extracted_price: 21000 },
      { name: "KREAM", link: "/goto?url=ENC2", extracted_price: 22000 },
      { name: "11번가", link: "https://www.11st.co.kr/products/1", extracted_price: 23000 },
    ]));
    const link = (k: string) => product!.offers.find((o) => o.seller.key === k)!.link;
    expect(link("무신사")).toBe(`https://www.musinsa.com/search/goods?keyword=${encodeURIComponent(title)}`);
    expect(link("어떤쇼핑몰")).toBe("");
    expect(link("KREAM")).toBe(`https://kream.co.kr/search?keyword=${encodeURIComponent(title)}`);
    expect(link("11번가")).toBe("https://www.11st.co.kr/products/1");
    expect(product!.offers.some((o) => /google\./.test(o.link))).toBe(false);
    // 가격은 받은 값 그대로 (링크가 없어도 가격 참고로 보인다)
    expect(product!.offers.find((o) => o.seller.key === "어떤쇼핑몰")!.price).toBe(21000);
  });
});

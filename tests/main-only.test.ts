import { describe, expect, it } from "vitest";
import { findBannedWords } from "@/lib/brand-mode";
import { LINK_PASTE_HINT, looksLikeUrl, mainOnly, medianPrice } from "@/lib/shop-results";
import type { SearchItem } from "@/lib/shopping";

const it_ = (title: string, price: number | null): SearchItem => ({ token: title, productId: "", title, image: "", price, seller: null });

describe("본품만", () => {
  const airpods = [
    it_("Apple 에어팟 프로 2세대 USB-C", 329000),
    it_("Apple 에어팟 프로 2 MagSafe", 299000),
    it_("에어팟 프로 2 자급제 정품", 315000),
    it_("에어팟 프로 2 실리콘 케이스", 12900),
    it_("에어팟 프로2 고속 무선 충전기", 25900),
    it_("에어팟 프로 2 호환 이어팁", 8900),
    it_("에어팟 프로 2 가죽 커버 고급형", 89000), // 중앙값 25% 이상이지만 단어로 빠짐
    it_("에어팟 프로 2 리퍼", 199000),
  ];

  it("'에어팟 프로 2' 검색에 켜면 케이스·충전기 같은 액세서리가 빠진다", () => {
    const titles = mainOnly(airpods, "에어팟 프로 2").map((x) => x.title);
    expect(titles).toEqual(["Apple 에어팟 프로 2세대 USB-C", "Apple 에어팟 프로 2 MagSafe", "에어팟 프로 2 자급제 정품", "에어팟 프로 2 리퍼"]);
  });

  it("중앙값의 25% 미만 초저가는 단어가 없어도 빠진다", () => {
    const items = [it_("본체 A", 100000), it_("본체 B", 110000), it_("본체 C", 120000), it_("이어팁 소형", 9000)];
    expect(medianPrice(items)).toBe(105000);
    expect(mainOnly(items, "본체").map((x) => x.title)).toEqual(["본체 A", "본체 B", "본체 C"]);
  });

  it("검색어 자체에 있는 단어로는 빼지 않는다 ('무선충전기' 검색 시 '충전기')", () => {
    const items = [it_("삼성 15W 무선 충전기 패드", 29000), it_("벨킨 무선충전기 3in1", 99000), it_("무선충전기 전용 케이블", 5900)];
    // 케이블은 여전히 액세서리 단어라 빠진다
    expect(mainOnly(items, "무선충전기").map((x) => x.title)).toEqual(["삼성 15W 무선 충전기 패드", "벨킨 무선충전기 3in1"]);
  });

  it("영어 상품명도 단어 단위로 본다", () => {
    const items = [it_("Apple AirPods Pro 2", null), it_("Belkin BoostCharge Pro 2-in-1 Magnetic Charging Tray", null), it_("Clear Case for AirPods", null), it_("Showcase Edition", null)];
    expect(mainOnly(items, "airpods").map((x) => x.title)).toEqual(["Apple AirPods Pro 2", "Showcase Edition"]);
  });

  it("가격을 모르는 상품은 단어 기준만 본다", () => {
    expect(mainOnly([it_("본체", null), it_("본체 케이스", null)], "본체").map((x) => x.title)).toEqual(["본체"]);
  });
});

describe("링크 붙여넣기 안내", () => {
  it("스토어 주소를 알아본다", () => {
    expect(looksLikeUrl("https://www.coupang.com/vp/products/1")).toBe(true);
    expect(looksLikeUrl("smartstore.naver.com/abc/products/1")).toBe(true);
    expect(looksLikeUrl("www.11st.co.kr/products/1")).toBe(true);
    expect(looksLikeUrl("에어팟 프로 2")).toBe(false);
    expect(looksLikeUrl("갤럭시 S25 울트라")).toBe(false);
  });
  it("문구에 금지어가 없다", () => {
    expect(findBannedWords(LINK_PASTE_HINT, true)).toEqual([]);
  });
});

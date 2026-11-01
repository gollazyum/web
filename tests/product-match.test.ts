import { describe, expect, it } from "vitest";
import { isSameProduct } from "@/lib/product-match";

const BASE = "Apple 아이폰 17 256GB 자급제 블랙";

describe("isSameProduct", () => {
  it.each([
    "애플 아이폰17 256GB 블랙 자급제 정품",
    "Apple iPhone 17 256GB Black 자급제",
    "아이폰 17 256기가 블랙",
  ])("같은 상품: %s", (t) => expect(isSameProduct(BASE, t)).toBe(true));

  it.each([
    ["중고", "아이폰 17 256GB 블랙 중고 S급"],
    ["리퍼", "아이폰 17 256GB 블랙 리퍼"],
    ["케이스", "아이폰 17 256GB 블랙 실리콘 케이스"],
    ["필름", "아이폰 17 강화유리 필름 256GB 블랙"],
    ["공기계", "아이폰 17 256GB 블랙 공기계"],
    ["렌탈", "아이폰 17 256GB 블랙 렌탈"],
    ["대여", "아이폰 17 256GB 블랙 단기 대여"],
    ["Pro", "Apple 아이폰 17 Pro 256GB 자급제 블랙"],
    ["Pro Max", "아이폰 17 프로 맥스 256GB 블랙"],
    ["Air", "아이폰 에어 256GB 블랙"],
    ["다른 모델 숫자", "Apple 아이폰 16 256GB 자급제 블랙"],
    ["다른 용량", "Apple 아이폰 17 512GB 자급제 블랙"],
    ["용량 없음", "Apple 아이폰 17 자급제 블랙"],
    ["다른 색", "Apple 아이폰 17 256GB 자급제 화이트"],
    ["색 없음", "Apple 아이폰 17 256GB 자급제"],
    ["다른 상품군", "갤럭시 S17 256GB 블랙"],
  ])("다른 상품 (%s): %s", (_, t) => expect(isSameProduct(BASE, t)).toBe(false));

  it.each([
    ["Apple iPhone 17 자급제 256GB 화이트", "아이폰 17 256GB White 자급제"],
    ["Apple iPhone 17 자급제 256GB 블랙", "애플 아이폰17 256기가 BLACK"],
    ["아이폰 17 256GB 미스트 블루", "Apple iPhone 17 256GB Mist Blue"],
    ["아이폰 17 256GB 미스트 블루", "아이폰 17 256GB 미스트블루 자급제"],
  ])("iPhone=아이폰, 영문·한글 색상을 같게 본다: %s / %s", (a, b) => expect(isSameProduct(a, b)).toBe(true));

  it("미스트 블루와 그냥 블루는 다른 색", () => {
    expect(isSameProduct("아이폰 17 256GB 미스트 블루", "아이폰 17 256GB 블루")).toBe(false);
  });

  it("'자급제'는 거르지 않는다", () => {
    expect(isSameProduct("아이폰 17 256GB 블랙", "아이폰 17 256GB 블랙 자급제")).toBe(true);
  });

  it("모델 숫자가 없으면 확신할 수 없어 합치지 않는다", () => {
    expect(isSameProduct("무선 이어폰 화이트", "무선 이어폰 화이트")).toBe(false);
  });

  it("고른 상품이 케이스면 케이스끼리는 비교할 수 있다", () => {
    expect(isSameProduct("아이폰 17 실리콘 케이스 블랙", "아이폰17 실리콘 케이스 블랙")).toBe(true);
  });
});

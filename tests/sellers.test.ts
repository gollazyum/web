import { describe, expect, it } from "vitest";
import { normalizeSeller, resolveSellerUrl } from "@/lib/sellers";

describe("normalizeSeller", () => {
  it.each([
    ["Coupang", "쿠팡"],
    ["쿠팡", "쿠팡"],
    ["coupang.com", "쿠팡"],
    ["쿠팡 로켓배송", "쿠팡"],
    ["11st", "11번가"],
    ["11번가", "11번가"],
    ["11street", "11번가"],
    ["Gmarket", "G마켓"],
    ["G마켓", "G마켓"],
    ["지마켓", "G마켓"],
    ["Naver", "네이버"],
    ["네이버", "네이버"],
    ["스마트스토어", "네이버"],
    ["네이버 스마트스토어 OO몰", "네이버"],
  ])("이름 %s → %s", (raw, name) => expect(normalizeSeller(raw)).toBe(name));

  it.each([
    ["https://www.coupang.com/vp/products/1", "쿠팡"],
    ["https://www.11st.co.kr/products/1", "11번가"],
    ["https://item.gmarket.co.kr/Item?goodscode=1", "G마켓"],
    ["https://smartstore.naver.com/shop/products/1", "네이버"],
    ["https://shopping.naver.com/window-products/1", "네이버"],
    ["https://brand.naver.com/applestore/products/1", "네이버"],
    ["https://link.coupang.com/a/abc", "쿠팡"],
  ])("링크 도메인 %s → %s", (link, name) => expect(normalizeSeller("OO상점", link)).toBe(name));

  it("4곳이 아니면 null", () => {
    expect(normalizeSeller("SSG.COM", "https://www.ssg.com/item")).toBeNull();
    expect(normalizeSeller("Amazon")).toBeNull();
    expect(normalizeSeller("", "not a url")).toBeNull();
    expect(normalizeSeller(null, null)).toBeNull();
    expect(normalizeSeller("OO상점", "https://fakecoupang.com.evil.example/")).toBeNull();
  });
});

describe("중간 이동 주소 풀기 (외부 요청 없이 쿼리만 읽음)", () => {
  it.each([
    ["https://www.google.com/url?url=https%3A%2F%2Fsmartstore.naver.com%2Fs%2Fproducts%2F1&sa=U", "https://smartstore.naver.com/s/products/1"],
    ["https://www.googleadservices.com/pagead/aclk?sa=L&adurl=https%3A%2F%2Fitem.gmarket.co.kr%2FItem%3Fgoodscode%3D3", "https://item.gmarket.co.kr/Item?goodscode=3"],
    ["https://www.google.co.kr/url?q=https://www.11st.co.kr/products/9&sa=U", "https://www.11st.co.kr/products/9"],
    ["https://www.11st.co.kr/products/9", "https://www.11st.co.kr/products/9"],
  ])("%s → %s", (link, real) => expect(resolveSellerUrl(link)).toBe(real));

  it("구글 이동 주소는 실제 판매처 도메인으로 판단한다", () => {
    expect(normalizeSeller("애플 공식 판매처", "https://www.google.com/url?url=https%3A%2F%2Fsmartstore.naver.com%2Fx")).toBe("네이버");
  });

  it("구글 주소나 검색어에 판매처 글자가 들어 있다고 인정하지 않는다", () => {
    expect(normalizeSeller("OO상점", "https://www.google.com/shopping/product/1?q=쿠팡+coupang.com")).toBeNull();
    expect(normalizeSeller("OO상점", "https://www.google.com/search?tbm=shop&q=11st.co.kr")).toBeNull();
    expect(normalizeSeller("OO상점", "https://evil.example/?u=https://www.coupang.com")).toBeNull();
  });

  it("쿼리의 주소가 http(s)가 아니면 풀지 않는다", () => {
    expect(resolveSellerUrl("https://www.google.com/url?url=javascript:alert(1)")).toBe("https://www.google.com/url?url=javascript:alert(1)");
  });
});

describe("스토어 목록의 상대 주소 (/goto?url=…)", () => {
  it("구글 주소로 붙여서 누를 수 있게 하고, 이름으로 판매처를 맞춘다", () => {
    expect(resolveSellerUrl("/goto?url=CAESnwIB6zsw")).toBe("https://www.google.com/goto?url=CAESnwIB6zsw");
    expect(normalizeSeller("G마켓", "/goto?url=CAESnwIB6zsw")).toBe("G마켓");
    expect(normalizeSeller("롯데하이마트", "/goto?url=CAES0gEB")).toBeNull();
  });
  it("다른 상대 주소는 그대로 무시한다", () => {
    expect(resolveSellerUrl("/search?q=x")).toBe("");
  });
});

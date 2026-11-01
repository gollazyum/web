import { describe, expect, it } from "vitest";
import { normalizeSeller } from "@/lib/sellers";

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
  ])("링크 도메인 %s → %s", (link, name) => expect(normalizeSeller("OO상점", link)).toBe(name));

  it("4곳이 아니면 null", () => {
    expect(normalizeSeller("SSG.COM", "https://www.ssg.com/item")).toBeNull();
    expect(normalizeSeller("Amazon")).toBeNull();
    expect(normalizeSeller("", "not a url")).toBeNull();
    expect(normalizeSeller(null, null)).toBeNull();
    expect(normalizeSeller("OO상점", "https://fakecoupang.com.evil.example/")).toBeNull();
  });
});

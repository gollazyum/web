import { describe, expect, it } from "vitest";
import { COUPANG_HOME, coupangLinkLabel, coupangSearchUrl, getCoupangLink, isCoupangProductUrl, withPartnersTag } from "@/lib/coupang-links";

const PRODUCT = "https://www.coupang.com/vp/products/7007?itemId=1&vendorItemId=2";

describe("getCoupangLink", () => {
  it("쿠팡 상품 상세 주소가 있으면 그 주소 그대로 (추적 파라미터 없음)", () => {
    expect(getCoupangLink({ title: "에어팟 프로 2", link: PRODUCT }, "에어팟", { partnersTag: "" })).toEqual({ url: PRODUCT, type: "product", name: "에어팟 프로 2" });
    expect(getCoupangLink({ title: "x", link: "https://m.coupang.com/vm/products/12" }, "x", { partnersTag: "" }).type).toBe("product");
  });

  it("추적 파라미터가 설정돼 있을 때만 붙인다", () => {
    expect(getCoupangLink({ title: "a", link: PRODUCT }, "a", { partnersTag: "AF123" }).url).toBe(`${PRODUCT}&lptag=AF123`);
    expect(withPartnersTag(PRODUCT, "lptag=AF1&subid=g")).toBe(`${PRODUCT}&lptag=AF1&subid=g`);
    expect(withPartnersTag(PRODUCT, "")).toBe(PRODUCT);
  });

  it("상품 주소가 없거나 쿠팡 상품 상세가 아니면 상품명 검색결과 (쿠팡 홈 아님)", () => {
    for (const link of [undefined, "", "https://www.coupang.com/", "https://www.coupang.com/np/campaigns/82", "https://www.11st.co.kr/products/1", "https://evil.com/vp/products/1"]) {
      const r = getCoupangLink({ title: "에어팟 프로 2 케이스", link }, "에어팟");
      expect(r).toEqual({ url: coupangSearchUrl("에어팟 프로 2 케이스"), type: "search", name: "에어팟 프로 2 케이스" });
      expect(r.url).not.toBe(COUPANG_HOME);
    }
  });

  it("상품마다 주소가 다르다", () => {
    const a = getCoupangLink({ title: "에어팟 프로 2" }, "에어팟").url;
    const b = getCoupangLink({ title: "에어팟 프로 2 실리콘 케이스" }, "에어팟").url;
    expect(a).not.toBe(b);
    expect(a).toBe(`https://www.coupang.com/np/search?q=${encodeURIComponent("에어팟 프로 2")}`);
  });

  it("상품명이 없으면 검색어로 찾는다", () => {
    expect(getCoupangLink(null, " 캐리어 ").url).toBe(coupangSearchUrl("캐리어"));
  });

  it("문구", () => {
    expect(coupangLinkLabel(getCoupangLink({ title: "에어팟" }, ""))).toBe("쿠팡에서 '에어팟' 검색결과 보기 ↗");
    expect(isCoupangProductUrl(PRODUCT)).toBe(true);
  });
});

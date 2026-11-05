import { describe, expect, it } from "vitest";
import { applyDeeplink, COUPANG_HOME, coupangLinkLabel, coupangSearchUrl, getCoupangLink, isCoupangProductUrl, isPartnersLink } from "@/lib/coupang-links";

const PRODUCT = "https://www.coupang.com/vp/products/7007?itemId=1&vendorItemId=2";

describe("getCoupangLink", () => {
  it("화면 링크는 항상 기본 파트너스 링크(link.coupang.com), 추적 없는 coupang.com 주소는 쓰지 않는다", () => {
    for (const link of [undefined, "", PRODUCT, "https://www.coupang.com/", "https://evil.com/vp/products/1"]) {
      const r = getCoupangLink({ title: "에어팟 프로 2", link }, "에어팟");
      expect(r.url).toBe(COUPANG_HOME);
      expect(r.type).toBe("home");
      expect(isPartnersLink(r.url)).toBe(true);
    }
  });

  it("딥링크로 바꿀 원래 주소: 쿠팡 상품 상세면 그 주소, 아니면 상품명 검색결과", () => {
    expect(getCoupangLink({ title: "에어팟 프로 2", link: PRODUCT }, "에어팟").target).toEqual({ url: PRODUCT, type: "product" });
    expect(getCoupangLink({ title: "x", link: "https://m.coupang.com/vm/products/12" }, "x").target?.type).toBe("product");
    for (const link of [undefined, "https://www.coupang.com/np/campaigns/82", "https://www.11st.co.kr/products/1", "https://evil.com/vp/products/1"]) {
      expect(getCoupangLink({ title: "에어팟 프로 2 케이스", link }, "에어팟").target).toEqual({ url: coupangSearchUrl("에어팟 프로 2 케이스"), type: "search" });
    }
  });

  it("상품명이 없으면 검색어로 찾는다", () => {
    expect(getCoupangLink(null, " 캐리어 ").target?.url).toBe(coupangSearchUrl("캐리어"));
  });
});

describe("applyDeeplink", () => {
  const base = getCoupangLink({ title: "에어팟 프로 2", link: PRODUCT }, "에어팟");
  it("link.coupang.com 딥링크면 그 링크", () => {
    expect(applyDeeplink(base, "https://link.coupang.com/a/abc123")).toMatchObject({ url: "https://link.coupang.com/a/abc123", type: "product" });
  });
  it("실패(원래 주소가 그대로 오거나 빈 값, 다른 도메인)면 기본 파트너스 링크", () => {
    for (const d of [PRODUCT, "", null, "https://link.coupang.com.evil.com/a/x", "http://link.coupang.com/a/x"]) {
      expect(applyDeeplink(base, d)).toMatchObject({ url: COUPANG_HOME, type: "home" });
    }
  });
});

describe("문구", () => {
  it("링크 종류에 맞는 문구 (기본 링크에는 상품명을 넣지 않는다)", () => {
    expect(coupangLinkLabel(getCoupangLink({ title: "에어팟" }, ""))).toBe("쿠팡에서 찾아보기 ↗");
    expect(coupangLinkLabel({ url: "https://link.coupang.com/a/x", type: "search", name: "에어팟" })).toBe("쿠팡에서 '에어팟' 검색결과 보기 ↗");
    expect(coupangLinkLabel({ url: "https://link.coupang.com/a/x", type: "product", name: "에어팟" })).toBe("쿠팡에서 구매하러 가기 ↗");
    expect(isCoupangProductUrl(PRODUCT)).toBe(true);
  });
});

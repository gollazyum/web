import { describe, expect, it } from "vitest";
import { COUPANG_HOME, getCoupangLink } from "@/lib/coupang-links";

const HOME = "https://link.coupang.com/a/home";
const links = {
  에어팟: "https://link.coupang.com/a/airpods",
  "에어팟 프로": "https://link.coupang.com/a/airpodspro",
  캐리어: "https://link.coupang.com/a/carrier",
};

describe("getCoupangLink", () => {
  it("키워드 링크가 비어 있으면 쿠팡 홈 링크", () => {
    expect(getCoupangLink({ title: "에어팟 프로 2" }, "에어팟", { home: HOME, keywordLinks: {} })).toEqual({ url: HOME, type: "home" });
  });

  it("기본 설정은 COUPANG_HOME을 그대로 쓴다", () => {
    expect(getCoupangLink(null, "아무거나")).toEqual({ url: COUPANG_HOME, type: "home" });
    expect(COUPANG_HOME).toBe("https://link.coupang.com/a/ijuyP3uVoW");
  });

  it("검색어가 키와 같으면 검색결과 링크 (공백·대소문자 무시)", () => {
    expect(getCoupangLink(null, " 에어팟프로 ", { home: HOME, keywordLinks: links })).toEqual({ url: links["에어팟 프로"], type: "search" });
  });

  it("검색어나 상품명에 키가 들어 있으면 긴 키를 먼저 고른다", () => {
    expect(getCoupangLink(null, "에어팟 프로 2세대 화이트", { home: HOME, keywordLinks: links }).url).toBe(links["에어팟 프로"]);
    expect(getCoupangLink({ title: "하드 캐리어 24인치" }, "여행가방", { home: HOME, keywordLinks: links })).toEqual({ url: links.캐리어, type: "search" });
  });

  it("맞는 키워드가 없으면 홈 링크", () => {
    expect(getCoupangLink({ title: "무선 청소기" }, "청소기", { home: HOME, keywordLinks: links })).toEqual({ url: HOME, type: "home" });
  });

  it("빈 링크 값은 무시한다", () => {
    expect(getCoupangLink(null, "캐리어", { home: HOME, keywordLinks: { 캐리어: "" } })).toEqual({ url: HOME, type: "home" });
  });

  it("링크 주소를 가공하거나 파라미터를 붙이지 않는다", () => {
    const raw = "https://link.coupang.com/a/Ab_c-9?x=1";
    expect(getCoupangLink(null, "캐리어", { home: HOME, keywordLinks: { 캐리어: raw } }).url).toBe(raw);
    expect(getCoupangLink(null, "없음", { home: raw, keywordLinks: {} }).url).toBe(raw);
  });

  it("API가 켜져 있어도 연동 전에는 검색결과/홈 링크로 넘어간다", () => {
    expect(getCoupangLink(null, "캐리어", { home: HOME, keywordLinks: links, apiEnabled: true })).toEqual({ url: links.캐리어, type: "search" });
  });

  it("상품과 검색어가 없어도 동작한다", () => {
    expect(getCoupangLink(undefined, undefined, { home: HOME, keywordLinks: links })).toEqual({ url: HOME, type: "home" });
  });
});

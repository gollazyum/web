import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ALWAYS_BANNED_WORDS, BRAND_COPY_KEYS, brandCopy, findBannedWords } from "@/lib/brand-mode";
import { COUPANG_SAMPLE_PRODUCTS } from "@/lib/coupang-links";

// 화면 문구가 들어 있는 파일들 (주석은 빼고 검사한다)
const UI_PATHS = [
  "components/shop",
  "app/shop",
  "app/page.tsx",
  "components/SiteNav.tsx",
  "components/LinkChecker.tsx",
  "components/ShopSearch.tsx",
  "components/FamilyCards.tsx",
];

function walk(p: string): string[] {
  return statSync(p).isDirectory() ? readdirSync(p).flatMap((f) => walk(join(p, f))) : /\.tsx?$/.test(p) ? [p] : [];
}

function stripComments(code: string): string {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("금지어", () => {
  it("안전 모드 문구에는 금지어와 출처가 없다", () => {
    for (const k of BRAND_COPY_KEYS) expect(findBannedWords(brandCopy(k, true), true), k).toEqual([]);
  });

  it("일반 모드 문구에도 항상 금지어와 출처는 없다", () => {
    for (const k of BRAND_COPY_KEYS) expect(findBannedWords(brandCopy(k, false), false), k).toEqual([]);
  });

  it("모드에 따라 문구가 바뀐다", () => {
    expect(brandCopy("topBanner", true)).toBe("현재 가장 유리한 조건의 스토어 데이터예요");
    expect(brandCopy("topBanner", false)).toBe("확인한 판매처 중 가장 저렴해요");
    expect(brandCopy("topTabBadge", true)).toBe("BEST");
    expect(brandCopy("topTabBadge", false)).toBe("최저");
    expect(brandCopy("topCardLabel", true)).toBe("스토어 데이터 1위");
    expect(brandCopy("topCardLabel", false)).toBe("확인한 판매처 중 최저가");
  });

  it("검사기가 금지어를 실제로 잡는다", () => {
    expect(findBannedWords("실시간 가격", false)).toEqual(["실시간"]);
    expect(findBannedWords("가격비교 최저가", true)).toEqual(expect.arrayContaining(["비교", "가격비교", "최저가"]));
    expect(findBannedWords("가격비교", false)).toEqual([]);
    expect(findBannedWords("google 쇼핑 기준", false)).toEqual(["Google"]);
  });

  it.each(UI_PATHS.flatMap(walk))("%s 화면 문구에 금지어·출처가 없다 (안전 모드 기준)", (file) => {
    expect(findBannedWords(stripComments(readFileSync(file, "utf8")), true)).toEqual([]);
  });

  it("쇼핑 탭 예시 상품 이름에도 금지어가 없다", () => {
    for (const p of COUPANG_SAMPLE_PRODUCTS) expect(findBannedWords(`${p.name} ${p.keyword}`, true)).toEqual([]);
  });

  it("항상 금지 목록에 '골라'가 들어 있다", () => {
    expect(ALWAYS_BANNED_WORDS).toContain("골라");
  });
});

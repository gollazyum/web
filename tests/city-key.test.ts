import { describe, expect, it } from "vitest";
import { cityKey, cityLabel, romanize } from "@/lib/city-key";

describe("city_key 영어 소문자 슬러그", () => {
  it("대표 한글·영문 이름, 대소문자·공백을 같은 슬러그로", () => {
    for (const v of ["벳푸", "벳부", "Beppu", "  BEPPU ", "beppu"]) expect(cityKey(v)).toBe("beppu");
    for (const v of ["도쿄", "동경", "Tokyo", "도쿄도 신주쿠", "도쿄  신주쿠"]) expect(cityKey(v)).toBe("tokyo");
    expect(cityKey("호치민")).toBe("ho-chi-minh");
    expect(cityKey("Ho Chi Minh")).toBe("ho-chi-minh");
    expect(cityKey("Hong  Kong")).toBe("hong-kong");
  });
  it("표에 없는 이름도 늘 같은 영어 슬러그 (한글은 로마자)", () => {
    expect(cityKey("San Sebastián")).toBe("san-sebastian");
    expect(cityKey("가나다")).toBe("ganada");
    expect(cityKey("가나다")).toMatch(/^[a-z0-9-]+$/);
    expect(romanize("한국")).toBe("hanguk");
  });
  it("두 번 거쳐도 같다", () => {
    for (const v of ["beppu", "ho-chi-minh", "ganada", "san-sebastian"]) expect(cityKey(v)).toBe(v);
  });
  it("비어 있으면 빈 값, 화면 이름은 한글로", () => {
    expect(cityKey("")).toBe("");
    expect(cityKey(null)).toBe("");
    expect(cityLabel("beppu")).toBe("벳푸");
    expect(cityLabel("osaka")).toBe("오사카");
    expect(cityLabel("unknown-town")).toBe("unknown-town");
  });
});

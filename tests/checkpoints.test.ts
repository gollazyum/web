import { describe, expect, it } from "vitest";
import type { HotelOption } from "@/lib/hotels";
import { CHECK_BREAKFAST, CHECK_CANCEL, CHECK_TAX, checkInput, checkKey, isTaxArea, readCheckInput, ruleCheckpoints, shapeCheck } from "@/lib/checkpoints";
import type { StayQuery } from "@/lib/trip";
import { findBannedWords } from "@/lib/brand-mode";

const h = (o: Partial<HotelOption>) => ({ token: "t", name: "호텔 A", kind: "호텔", stars: null, amenities: [], rating: null, reviews: null, ...o }) as unknown as HotelOption;
const q = (place: string): StayQuery => ({ place, checkIn: "2026-12-05", checkOut: "2026-12-07", adults: 2, budget: 0, taste: "" });
const topic = (name: string, positive: number, total: number) => ({ name, positive, negative: total - positive, total });

describe("숙박세 지역", () => {
  it("일본 주요 도시는 표시하고 다른 곳은 하지 않는다", () => {
    expect(isTaxArea("오사카 난바")).toBe(true);
    expect(isTaxArea("Tokyo")).toBe(true);
    expect(isTaxArea("다낭")).toBe(false);
  });
});

describe("규칙 체크포인트", () => {
  it("확인 못 한 것은 결제 화면에서 확인으로만 말한다", () => {
    const c = ruleCheckpoints(checkInput(h({}), q("다낭")));
    expect(c.checks).toEqual([CHECK_CANCEL, CHECK_BREAKFAST]);
    expect(c.ai).toBe(false);
  });
  it("숙박세 지역 + 무료 취소 확인됨", () => {
    const c = ruleCheckpoints(checkInput(h({ freeCancel: true }), q("오사카")));
    expect(c.checks).toEqual([CHECK_TAX, CHECK_BREAKFAST]);
  });
  it("후기 주제 좋아요 비율이 낮으면 그 숫자를 먼저", () => {
    const inp = checkInput(h({ rating: 4.5, reviews: 800, near: { name: "난바역", how: "도보", mins: 4 } }), q("오사카"), { topics: [topic("Location", 285, 300), topic("Room", 40, 100)] });
    const c = ruleCheckpoints(inp);
    expect(c.checks[0]).toMatch(/좋아요 비율이 40%로 낮은 편/);
    expect(c.checks[1]).toBe(CHECK_TAX);
    expect(c.pros).toMatch(/좋아요 95%/);
    expect(c.pros).toMatch(/난바역까지 도보 4분/);
  });
  it("와이파이는 장점으로 쓰지 않는다", () => {
    const c = ruleCheckpoints(checkInput(h({ amenities: ["무료 와이파이"] }), q("다낭")));
    expect(c.pros).toBe("");
  });
});

describe("AI 답 다듬기", () => {
  const inp = checkInput(h({ rating: 4.3 }), q("오사카"));
  it("데이터에 없는 말·금액·포함 주장은 버리고 규칙으로 채운다", () => {
    const c = shapeCheck({ pros: "가성비 좋은 3만 원대 숙소예요", checks: ["엘리베이터가 느려요", "조식이 포함돼요", "무료 취소 가능해요"] }, inp);
    expect(c.pros).toBe(ruleCheckpoints(inp).pros);
    expect(c.checks).toEqual([CHECK_TAX, CHECK_CANCEL]);
    expect(c.ai).toBe(true);
  });
  it("숙박세 지역이면 숙박세 줄이 꼭 들어간다", () => {
    const c = shapeCheck({ pros: "후기 점수가 4.3점이에요", checks: ["무료 취소 여부는 결제 화면에서 확인해 주세요", "조식 포함 여부는 결제 화면에서 확인해 주세요"] }, inp);
    expect(c.checks).toHaveLength(2);
    expect(c.checks).toContain(CHECK_TAX);
  });
  it("금지어가 없다", () => {
    const c = ruleCheckpoints(checkInput(h({ rating: 3.2 }), q("도쿄")));
    expect(findBannedWords([c.pros, ...c.checks].join(" "), true)).toEqual([]);
  });
});

describe("서버 입력 검사·캐시 열쇠", () => {
  it("모양이 틀리면 버리고 길이를 자른다", () => {
    expect(readCheckInput(null)).toBeNull();
    expect(readCheckInput({ name: "" })).toBeNull();
    const r = readCheckInput({ name: "A", stars: 9, rating: 4.2, freeCancel: "yes", price: "x", amenities: ["a".repeat(99)] })!;
    expect(r.stars).toBeNull();
    expect(r.freeCancel).toBe(false);
    expect(r.price).toBe("estimate");
    expect(r.amenities[0]).toHaveLength(30);
  });
  it("숙소 + 검색 조건으로 나눈다", () => {
    expect(checkKey("t", q("오사카"), false)).not.toBe(checkKey("t", q("오사카"), true));
    expect(checkKey("t", q("오사카"), false)).toBe(checkKey("t", q("도쿄"), false));
  });
});

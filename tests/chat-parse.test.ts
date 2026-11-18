import { describe, expect, it } from "vitest";
import { adultsIn, datesIn, placeIn } from "@/lib/chat-parse";

const T = "2026-11-18";
describe("AI 채팅 문장에서 도시·날짜 뽑기 (A2)", () => {
  it("도시", () => {
    expect(placeIn("12월 오사카 2박, 역 가까운 곳")).toBe("오사카");
    expect(placeIn("부모님이랑 조용한 온천 숙소")).toBe("");
    expect(placeIn("코타키나발루 리조트")).toBe("코타키나발루");
  });
  it("월만 말하면 그 달 첫 금요일, N박", () => {
    expect(datesIn("12월 오사카 2박", T)).toEqual({ checkIn: "2026-12-04", checkOut: "2026-12-06" });
    expect(datesIn("12월 24일 3박", T)).toEqual({ checkIn: "2026-12-24", checkOut: "2026-12-27" });
    expect(datesIn("3월", T)?.checkIn).toBe("2027-03-05");
    expect(datesIn("11월", T)?.checkIn).toBe("2026-11-20");
    expect(datesIn("온천", T)).toBeNull();
  });
  it("인원", () => {
    expect(adultsIn("성인 3명")).toBe(3);
    expect(adultsIn("커플 여행")).toBe(2);
    expect(adultsIn("오사카")).toBe(0);
  });
});

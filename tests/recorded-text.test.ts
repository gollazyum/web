import { describe, expect, it } from "vitest";
import { recordedText } from "@/lib/checked-at";

// 2026-11-28 15:00 KST
const now = Date.parse("2026-11-28T06:00:00Z");

describe("recordedText (배치 가격 확인 시각)", () => {
  it("시각이 있으면 오전/오후 몇 시 기준", () => {
    expect(recordedText("2026-11-28T00:00:00Z", now)).toBe("오늘 오전 9시 기준");
    expect(recordedText("2026-11-27T09:30:00Z", now)).toBe("어제 오후 6시 30분 기준");
    expect(recordedText("2026-11-26T03:00:00Z", now)).toBe("11월 26일 오후 12시 기준");
  });
  it("날짜만 있으면 날짜 기준", () => {
    expect(recordedText("2026-11-28", now)).toBe("오늘 기준");
    expect(recordedText("2026-11-27", now)).toBe("어제 기준");
    expect(recordedText("2026-11-20", now)).toBe("11월 20일 기준");
  });
  it("빈 값·이상한 값은 빈 글자, '실시간'은 쓰지 않는다", () => {
    expect(recordedText(null, now)).toBe("");
    expect(recordedText("x", now)).toBe("");
    expect(recordedText("2026-11-28T00:00:00Z", now)).not.toContain("실시간");
  });
});

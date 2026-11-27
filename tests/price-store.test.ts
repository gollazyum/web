import { describe, expect, it } from "vitest";
import { acceptIncoming, type Verified } from "@/components/trip/prices";
import { checkedText } from "@/lib/checked-at";

const v = (at: number, extra: Partial<Verified> = {}): Verified => ({ total: 300000, count: 3, at, ...extra });

describe("옛 가격 덮어쓰기 방지", () => {
  it("새 값의 확인 시각이 같거나 최신일 때만 받는다", () => {
    expect(acceptIncoming(undefined, v(1))).toBe(true);
    expect(acceptIncoming(v(2000), v(1000))).toBe(false);
    expect(acceptIncoming(v(1000), v(1000))).toBe(true);
    expect(acceptIncoming(v(1000), v(2000))).toBe(true);
  });
  it("확정 값은 미확정(partial) 값으로 덮어쓰지 않는다", () => {
    expect(acceptIncoming(v(1000), v(5000, { partial: true }))).toBe(false);
    expect(acceptIncoming(v(5000, { partial: true }), v(1000))).toBe(true);
  });
});

describe("확인 시각 글자", () => {
  const now = Date.parse("2026-11-27T07:47:00Z"); // 한국 16:47
  it("1시간 안은 분 단위", () => {
    expect(checkedText(now - 20_000, now)).toBe("방금 확인");
    expect(checkedText(now - 12 * 60_000, now)).toBe("12분 전 확인");
  });
  it("그 밖은 한국 날짜·시각, ISO 문자열도 받는다", () => {
    expect(checkedText(now - 2 * 3_600_000, now)).toBe("11월 27일 14:47 확인");
    expect(checkedText("2026-11-27T07:47:00Z", now + 3 * 3_600_000)).toBe("11월 27일 16:47 확인");
    expect(checkedText(null, now)).toBe("");
  });
});

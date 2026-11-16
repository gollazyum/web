import { describe, expect, it } from "vitest";
import { distText, km, nearby } from "@/lib/landmarks";

describe("주요 장소까지 거리", () => {
  it("직선거리를 계산한다 (난바역 ↔ 오사카역 약 4km)", () => {
    const d = km([34.6661, 135.5003], [34.7025, 135.4959]);
    expect(d).toBeGreaterThan(3.8);
    expect(d).toBeLessThan(4.4);
  });
  it("가까운 순으로, 공항은 한 곳만 맨 뒤에", () => {
    const list = nearby([34.668, 135.501]); // 도톤보리 근처
    expect(list).toHaveLength(4);
    expect(list[0].name).toBe("도톤보리");
    expect(list.filter((l) => l.airport)).toHaveLength(1);
    expect(list[3].name).toBe("간사이국제공항");
  });
  it("모르는 도시·좌표 없음이면 보여 주지 않는다", () => {
    expect(nearby(null)).toEqual([]);
    expect(nearby([37.5665, 126.978])).toEqual([]); // 서울
  });
  it("거리 글자", () => {
    expect(distText(0.33)).toBe("350m");
    expect(distText(1.234)).toBe("1.2km");
    expect(distText(41.6)).toBe("42km");
  });
});

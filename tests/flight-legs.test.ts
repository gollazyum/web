import { describe, expect, it } from "vitest";
import { dayShift, durText, legDate, perPerson, waits } from "@/lib/flight-legs";
import type { FlightSegment } from "@/lib/flights";

const seg = (fromId: string, toId: string, departTime: string, arriveTime: string): FlightSegment => ({ airline: "타이항공", flightNo: "TG 659", plane: "", fromId, fromName: "", toId, toName: "", departTime, arriveTime, minutes: 0 });

describe("flight-legs", () => {
  it("날짜 · 요일", () => {
    expect(legDate("2026-12-12 09:00")).toBe("12월 12일 (토)");
    expect(legDate("")).toBe("");
  });
  it("다음 날 도착이면 +1", () => {
    expect(dayShift("2026-12-12 22:40", "2026-12-13 02:35")).toBe(1);
    expect(dayShift("2026-12-12 09:00", "2026-12-12 11:20")).toBe(0);
    expect(dayShift("", "")).toBe(0);
  });
  it("1인 평균은 2명 이상일 때만", () => {
    expect(perPerson(500001, 2)).toBe(250001);
    expect(perPerson(300000, 1)).toBeNull();
  });
  it("소요 시간", () => {
    expect(durText(140)).toBe("2시간 20분");
    expect(durText(120)).toBe("2시간");
    expect(durText(0)).toBe("");
  });
  it("경유 대기 시간: layovers가 있으면 그 값, 없으면 시각 차이", () => {
    const segments = [seg("ICN", "TPE", "2026-12-12 08:00", "2026-12-12 09:40"), seg("TPE", "BKK", "2026-12-12 11:50", "2026-12-12 14:40")];
    expect(waits({ segments, layovers: [130] }).map((w) => [w.at.toId, w.mins])).toEqual([["TPE", 130]]);
    expect(waits({ segments, layovers: [] })[0].mins).toBe(130);
    expect(waits({ segments: segments.slice(0, 1), layovers: [] })).toEqual([]);
  });
});

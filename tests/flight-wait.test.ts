import { describe, expect, it } from "vitest";
import { maxWait, overnight, waitLines } from "@/lib/flight-legs";
const seg = (from: string, to: string, d: string, a: string) => ({ airline: "", flightNo: "", plane: "", fromId: from, fromName: "", toId: to, toName: "", departTime: d, arriveTime: a, minutes: 0 });
describe("경유 대기 줄 (모바일 P1-3)", () => {
  it("대기 시간·밤샘·가장 긴 대기", () => {
    const o = { segments: [seg("ICN", "SIN", "2026-12-08 09:00", "2026-12-08 14:00"), seg("SIN", "NRT", "2026-12-08 16:10", "2026-12-08 23:00")], layovers: [130] };
    expect(waitLines(o, (c) => (c === "SIN" ? "싱가포르" : c))).toEqual([{ text: "싱가포르(SIN)에서 2시간 10분 대기", long: false, night: false }]);
    expect(maxWait(o)).toBe(130);
    expect(overnight("2026-12-08 23:30", 7 * 60)).toBe(true);
    expect(overnight("2026-12-08 23:30", 70)).toBe(false);
    expect(overnight("2026-12-08 02:00", 300)).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { bestForRefundable, kstLocalToMs, nextCheckAt, parseWatchInput, shouldAlert, tooLate, watchUntil } from "@/lib/booking-watch";
import type { SellerRow } from "@/lib/hotels";

const H = 3_600_000;
// 2026-11-25 10:00 KST
const NOW = Date.parse("2026-11-25T01:00:00Z");

describe("가격 지킴이 규칙", () => {
  it("지켜보기 끝: 마감 6시간 전, 마감을 모르면 체크인 전날 18시(한국)", () => {
    const fcu = kstLocalToMs("2026-12-10T23:59")!;
    expect(new Date(watchUntil("2026-12-12", fcu)).toISOString()).toBe("2026-12-10T08:59:00.000Z");
    expect(new Date(watchUntil("2026-12-12", null)).toISOString()).toBe("2026-12-11T09:00:00.000Z");
  });

  it("마감 6시간 안쪽이거나 체크인이 오늘이면 등록하지 않는다", () => {
    expect(tooLate("2026-11-25", NOW + 100 * H, NOW)).toBe(true);
    expect(tooLate("2026-12-01", NOW + 5 * H, NOW)).toBe(true);
    expect(tooLate("2026-12-01", NOW + 7 * H, NOW)).toBe(false);
  });

  it("체크인 30일 넘게 남으면 84시간, 아니면 24시간 뒤 다시 확인", () => {
    expect(nextCheckAt("2026-12-20", NOW) - NOW).toBe(24 * H);
    expect(nextCheckAt("2027-01-20", NOW) - NOW).toBe(84 * H);
  });

  it("알림은 5,000원 이상 그리고 3% 이상, 다시 알릴 때는 5,000원 더 내려야", () => {
    expect(shouldAlert(300000, 290000, null)).toBe(true);
    expect(shouldAlert(300000, 294000, null)).toBe(false); // 6,000원이지만 2%
    expect(shouldAlert(100000, 96000, null)).toBe(false); // 4%지만 4,000원
    expect(shouldAlert(1000000, 990000, null)).toBe(false); // 1만 원이지만 1%
    expect(shouldAlert(300000, 286000, 290000)).toBe(false);
    expect(shouldAlert(300000, 285000, 290000)).toBe(true);
    expect(shouldAlert(300000, null, null)).toBe(false);
  });

  it("무료 취소로 확인된 요금을 먼저 견준다", () => {
    const r = (key: string, cost: number, freeCancel?: boolean) => ({ key, cost, freeCancel }) as unknown as SellerRow;
    expect(bestForRefundable([r("agoda", 100), r("trip", 120, true)])).toEqual({ price: 120, vendor: "trip", freeCancel: true });
    expect(bestForRefundable([r("agoda", 100), r("trip", 120)])).toEqual({ price: 100, vendor: "agoda", freeCancel: null });
    expect(bestForRefundable([])).toBeNull();
  });

  it("등록 입력 검사", () => {
    const ok = { device: "abcdef0123456789abcd", token: "t", name: "호텔", place: "오사카", checkIn: "2026-12-10", checkOut: "2026-12-12", adults: 2, bookedPrice: 300000, bookedVendor: "agoda", freeCancelUntil: "2026-12-08T23:59" };
    expect(parseWatchInput(ok)).toMatchObject({ bookedPrice: 300000, freeCancelUntil: "2026-12-08T23:59" });
    expect(parseWatchInput({ ...ok, freeCancelUntil: "" })?.freeCancelUntil).toBeNull();
    expect(parseWatchInput({ ...ok, freeCancelUntil: "내일" })).toBeNull();
    expect(parseWatchInput({ ...ok, device: "x" })).toBeNull();
    expect(parseWatchInput({ ...ok, bookedPrice: 12.5 })).toBeNull();
    expect(parseWatchInput({ ...ok, checkOut: "2026-12-10" })).toBeNull();
  });
});

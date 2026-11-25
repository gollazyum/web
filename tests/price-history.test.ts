import { describe, expect, it } from "vitest";
import { kstToday, listRows, verifiedRow } from "@/lib/price-history-rows";
import type { HotelOption, HotelSource } from "@/lib/hotels";

// 2026-11-25 10:00 KST
const NOW = Date.parse("2026-11-25T01:00:00Z");
const q = { checkIn: "2026-12-04", checkOut: "2026-12-06", adults: 2, childAges: [] as number[] };

const hotel = (over: Partial<HotelOption> = {}): HotelOption =>
  ({ token: "t1", name: "호텔 A", perNight: 100000, total: 200000, priceSource: "아고다", sources: [{ name: "아고다", perNight: 100000, total: 200000, logo: "", link: "", official: false }], ...over }) as HotelOption;

describe("가격 기록 줄 만들기", () => {
  it("한국 날짜로 기록일과 남은 날을 센다", () => {
    expect(kstToday(Date.parse("2026-11-24T16:00:00Z"))).toBe("2026-11-25");
    const [r] = listRows([hotel()], { ...q, place: "오사카" }, NOW);
    expect(r).toMatchObject({ recorded_at: "2026-11-25", lead_days: 9, nights: 2, adults: 2, is_weekend: true, price_kind: "list", nightly_krw: 100000, total_krw: 200000, place: "오사카" });
  });

  it("무료 취소는 확인된 경우만 true, 아니면 null", () => {
    expect(listRows([hotel()], { ...q, place: "x" }, NOW)[0].is_refundable).toBeNull();
    const fc = hotel({ sources: [{ name: "아고다", perNight: 100000, total: 200000, logo: "", link: "", official: false, freeCancel: true }] });
    expect(listRows([fc], { ...q, place: "x" }, NOW)[0].is_refundable).toBe(true);
  });

  it("아이가 있는 검색과 가격 없는 숙소는 기록하지 않는다", () => {
    expect(listRows([hotel()], { ...q, childAges: [5], place: "x" }, NOW)).toEqual([]);
    expect(listRows([hotel({ perNight: null })], { ...q, place: "x" }, NOW)).toEqual([]);
  });

  it("예약처 가격은 가장 싼 1박 1줄만", () => {
    const s = (name: string, perNight: number | null): HotelSource => ({ name, perNight, total: perNight && perNight * 2, logo: "", link: "", official: false });
    const r = verifiedRow("t1", "호텔 A", [s("A", 120000), s("B", 98000), s("C", null)], { ...q, checkIn: "2026-12-01", checkOut: "2026-12-02" }, NOW);
    expect(r).toMatchObject({ price_kind: "verified", nightly_krw: 98000, best_vendor: "B", is_weekend: false, nights: 1, place: null, is_refundable: null });
    expect(verifiedRow("t1", "x", [], q, NOW)).toBeNull();
  });
});

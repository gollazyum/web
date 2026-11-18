import { describe, expect, it } from "vitest";
import { decodeTrip, encodeTrip, sharePath, type SharedTrip } from "@/lib/trip-share";

const T: SharedTrip = {
  place: "오사카 난바",
  checkIn: "2026-12-10",
  checkOut: "2026-12-12",
  adults: 2,
  hotels: [
    { token: "ChcIabc_-123", name: "도톤보리 크리스탈 호텔 IV", price: 115076, verified: true },
    { token: "Zx9", name: "&And Hostel", price: null, verified: false },
  ],
};

describe("여행 공유 링크", () => {
  it("담은 그대로 다시 읽는다 (한글 포함)", () => {
    expect(decodeTrip(encodeTrip(T))).toEqual(T);
    expect(sharePath(T)).toMatch(/^\/my\?trip=[A-Za-z0-9_-]+$/);
  });
  it("모양이 틀리면 null", () => {
    expect(decodeTrip("")).toBeNull();
    expect(decodeTrip("%%%")).toBeNull();
    expect(decodeTrip(encodeTrip({ ...T, checkOut: "2026-12-09" }))).toBeNull();
    expect(decodeTrip(encodeTrip({ ...T, adults: 0 }))).toBeNull();
    expect(decodeTrip(encodeTrip({ ...T, hotels: [] }))).toBeNull();
  });
});

describe("공유 링크 인원", () => {
  it("객실·아동 나이를 담고 되살린다", () => {
    const t = { place: "오사카", checkIn: "2026-12-09", checkOut: "2026-12-11", adults: 2, rooms: 2, childAges: [5, 0], hotels: [{ token: "a", name: "A", price: 100000, verified: true }] };
    const back = decodeTrip(encodeTrip(t));
    expect(back?.rooms).toBe(2);
    expect(back?.childAges).toEqual([5, 0]);
  });
  it("인원보다 객실이 많거나 나이가 틀리면 버린다", () => {
    const base = { place: "오사카", checkIn: "2026-12-09", checkOut: "2026-12-11", adults: 1, hotels: [{ token: "a", name: "A", price: null, verified: false }] };
    expect(decodeTrip(encodeTrip({ ...base, rooms: 2 }))).toBeNull();
    expect(decodeTrip(encodeTrip({ ...base, childAges: [18] }))).toBeNull();
  });
});

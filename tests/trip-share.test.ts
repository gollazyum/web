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

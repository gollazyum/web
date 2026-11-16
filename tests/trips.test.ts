import { describe, expect, it } from "vitest";
import { daysUntil, groupTrips } from "@/lib/trips";
import type { HotelOption } from "@/lib/hotels";
import type { StayQuery } from "@/lib/trip";

const item = (token: string, place: string, checkIn: string, checkOut: string, adults = 2) => ({
  hotel: { token } as HotelOption,
  query: { place, checkIn, checkOut, adults, budget: 0, taste: "" } as StayQuery,
});

describe("마이: 여행 단위로 묶기", () => {
  it("같은 도시에 날짜가 겹치면 한 여행, 날짜 범위를 넓힌다", () => {
    const t = groupTrips([item("a", "오사카 난바", "2026-12-05", "2026-12-07"), item("b", "오사카", "2026-12-06", "2026-12-09")], "2026-11-17");
    expect(t).toHaveLength(1);
    expect(t[0]).toMatchObject({ city: "오사카", checkIn: "2026-12-05", checkOut: "2026-12-09" });
    expect(t[0].items.map((x) => x.hotel.token)).toEqual(["a", "b"]);
  });

  it("도시가 다르거나 날짜가 안 겹치면 따로, 다가오는 여행이 먼저 지난 여행은 뒤", () => {
    const t = groupTrips([item("a", "도쿄", "2027-01-10", "2027-01-12"), item("b", "오사카", "2026-12-05", "2026-12-07"), item("c", "부산", "2026-10-01", "2026-10-02")], "2026-11-17");
    expect(t.map((x) => [x.city, x.past])).toEqual([["오사카", false], ["도쿄", false], ["부산", true]]);
  });

  it("남은 날 계산", () => {
    expect(daysUntil("2026-12-05", "2026-11-17")).toBe(18);
    expect(daysUntil("2026-11-17", "2026-11-17")).toBe(0);
  });
});

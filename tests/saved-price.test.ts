import { describe, expect, it } from "vitest";
import { baseOf, changeText, priceChange, savedBaseFor, setSavedList } from "@/components/trip/saved-price";
import type { HotelOption } from "@/lib/hotels";
import type { StayQuery } from "@/lib/trip";

const q: StayQuery = { place: "오사카", checkIn: "2026-12-05", checkOut: "2026-12-07", adults: 2, budget: 0, taste: "" };
const hotel = { token: "t1", total: 300000, perNight: 150000 } as unknown as HotelOption;

describe("가벼운 가격 알림", () => {
  it("금액 기록이 없던 예전 담기는 목록 값(예상 총액)을 기준으로 쓴다", () => {
    expect(baseOf({ hotel, query: q })).toEqual({ price: 300000, verified: false, at: 0 });
  });

  it("같은 기준(예상↔예상, 확인↔확인)끼리만 견준다", () => {
    const base = { price: 300000, verified: true, at: 1 };
    expect(priceChange(base, { value: 280000, verified: true, none: false })).toBe(-20000);
    expect(priceChange(base, { value: 280000, verified: false, none: false })).toBeNull();
  });

  it("1,000원 아래 차이와 예약처 없음은 알리지 않는다", () => {
    const base = { price: 300000, verified: false, at: 1 };
    expect(priceChange(base, { value: 300500, verified: false, none: false })).toBeNull();
    expect(priceChange(base, { value: null, verified: false, none: true })).toBeNull();
  });

  it("날짜·인원이 같은 담기만 찾는다", () => {
    setSavedList([{ hotel, query: q, base: { price: 1, verified: false, at: 1 } }]);
    expect(savedBaseFor("t1", q)?.price).toBe(1);
    expect(savedBaseFor("t1", { ...q, adults: 3 })).toBeUndefined();
  });

  it("문구", () => {
    expect(changeText(-20000)).toBe("담을 때보다 20,000원↓");
    expect(changeText(5000)).toBe("담을 때보다 5,000원↑");
  });
});

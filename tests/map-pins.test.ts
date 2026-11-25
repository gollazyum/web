import { describe, expect, it } from "vitest";
import { circleRing, EMPTY_CHIPS, filterPins, lowestToken, pinText } from "@/lib/map-pins";

const h = (token: string, o: Partial<{ gps: [number, number] | null; rating: number | null; stars: number | null; fc: boolean; price: number | null }> = {}) => ({ token, gps: [34.7, 135.5] as [number, number], rating: 4.6, stars: 4, fc: true, price: 200000, ...o });

describe("가격 핀 지도", () => {
  it("핀 글자는 만 원 단위 한 자리", () => {
    expect(pinText(256000)).toBe("25.6만");
    expect(pinText(300000)).toBe("30만");
    expect(pinText(1234567)).toBe("123만");
    expect(pinText(null)).toBe("가격 확인");
  });

  it("좌표가 없는 숙소는 핀이 없고, 칩은 받은 목록 안에서만 거른다", () => {
    const list = [h("a"), h("b", { gps: null }), h("c", { fc: false }), h("d", { rating: 4.2 }), h("e", { stars: 3 }), h("f", { price: 600000 }), h("g", { price: null })];
    expect(filterPins(list, EMPTY_CHIPS).map((x) => x.token)).toEqual(["a", "c", "d", "e", "f", "g"]);
    expect(filterPins(list, { ...EMPTY_CHIPS, freeCancel: true }).map((x) => x.token)).not.toContain("c");
    expect(filterPins(list, { ...EMPTY_CHIPS, rating45: true }).map((x) => x.token)).not.toContain("d");
    expect(filterPins(list, { ...EMPTY_CHIPS, stars4: true }).map((x) => x.token)).not.toContain("e");
    const b = filterPins(list, { ...EMPTY_CHIPS, budget: 500000 }).map((x) => x.token);
    expect(b).not.toContain("f");
    expect(b).not.toContain("g"); // 금액을 모르면 예산 칩에서 빠진다
  });

  it("가장 낮은 핀은 하나일 때만", () => {
    expect(lowestToken([h("a", { price: 1 }), h("b", { price: 2 })])).toBe("a");
    expect(lowestToken([h("a", { price: 1 }), h("b", { price: 1 })])).toBeNull();
  });

  it("400m 원은 중심에서 약 400m", () => {
    const ring = circleRing(34.7, 135.5, 400);
    const [lng, lat] = ring[16]; // 90도
    expect(Math.round((lat - 34.7) * 111_320)).toBe(400);
    expect(ring[0]).toEqual(ring[ring.length - 1]);
  });
});

import { describe, expect, it } from "vitest";
import { inBand, PRICE_BANDS } from "@/lib/price-bands";

describe("가격대", () => {
  const [b1, b2, , b4] = PRICE_BANDS;
  it("1박 금액으로 나눈다 (경계값은 아래 칸)", () => {
    expect(inBand(200000, 2, b1)).toBe(true); // 1박 10만
    expect(inBand(200000, 2, b2)).toBe(false);
    expect(inBand(200002, 2, b2)).toBe(true);
    expect(inBand(700000, 2, b4)).toBe(true);
  });
  it("금액을 모르면 어느 칸에도 넣지 않는다", () => {
    for (const b of PRICE_BANDS) expect(inBand(Infinity, 2, b)).toBe(false);
  });
});

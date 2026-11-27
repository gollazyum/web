import { describe, expect, it } from "vitest";
import { freeCancelGap, maxGapOf, savingsOf } from "@/lib/savings";

describe("아낀 금액", () => {
  it("세금 포함 총액끼리 두 번째로 싼 곳 − 가장 낮은 곳 (가장 비싼 곳과의 차이는 maxGap)", () => {
    expect(savingsOf([{ cost: 312000 }, { cost: 318000 }, { cost: 353000 }])).toEqual({ amount: 6000, count: 3, maxGap: 41000 });
    expect(savingsOf([{ cost: 353000 }, { cost: 312000 }, { cost: 318000 }])?.amount).toBe(6000);
  });
  it("어림한 줄은 빼고 견준다", () => {
    expect(savingsOf([{ cost: 300000 }, { cost: 305000 }, { cost: 900000, approx: true }])).toEqual({ amount: 5000, count: 2, maxGap: 5000 });
  });
  it("1·2위 금액이 같으면 숨긴다 (비교표 아래 최고가 차이는 남는다)", () => {
    expect(savingsOf([{ cost: 300000 }, { cost: 300000 }, { cost: 340000 }])).toBeNull();
    expect(maxGapOf([{ cost: 300000 }, { cost: 300000 }, { cost: 340000 }])).toBe(40000);
  });
  it("1위가 어림한 금액이면 보여 주지 않는다", () => {
    expect(savingsOf([{ cost: 290000, approx: true }, { cost: 300000 }, { cost: 320000 }])).toBeNull();
  });
  it("확인한 곳이 1곳이거나 차이가 1,000원 아래면 없음", () => {
    expect(savingsOf([{ cost: 300000 }])).toBeNull();
    expect(savingsOf([{ cost: 300000 }, { cost: 300900 }])).toBeNull();
    expect(savingsOf([])).toBeNull();
  });
});

describe("무료 취소 차액", () => {
  it("1위가 무료 취소가 아니면 가장 낮은 무료 취소 요금과의 차이", () => {
    const r = freeCancelGap([{ cost: 312000 }, { cost: 318000, freeCancel: true }, { cost: 320000, freeCancel: true }]);
    expect(r?.gap).toBe(6000);
  });
  it("1위가 무료 취소거나 무료 취소 요금이 없으면 없음", () => {
    expect(freeCancelGap([{ cost: 1, freeCancel: true }, { cost: 2 }])).toBeNull();
    expect(freeCancelGap([{ cost: 1 }, { cost: 2 }])).toBeNull();
  });
});

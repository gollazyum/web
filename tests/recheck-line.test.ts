import { describe, expect, it } from "vitest";
import { recheckLine } from "@/components/trip/TripRecheck";
import type { SellerRow } from "@/lib/hotels";

const row = (cost: number) => ({ key: "agoda", name: "Agoda", cost, href: "", approx: false, freeCancel: false }) as unknown as SellerRow;
const at = new Date(2026, 10, 18, 12, 30).getTime();

describe("마이 '가격 다시 보기' 한 줄 (A1)", () => {
  it("내렸어요·올랐어요·같아요 + 확인 시각", () => {
    expect(recheckLine("A", { price: 208000, verified: true }, [row(200000)], at).text).toBe("₩8,000 내렸어요 · 지금 ₩200,000 · 12:30 확인");
    expect(recheckLine("A", { price: 200000, verified: true }, [row(208000)], at).tone).toBe("up");
    expect(recheckLine("A", { price: 200000, verified: true }, [row(200500)], at).text).toBe("담을 때와 같아요 · ₩200,500 · 12:30 확인");
  });
  it("실패·숙소 없음", () => {
    expect(recheckLine("A", undefined, null, at).text).toBe("지금은 가격을 불러오지 못했어요");
    expect(recheckLine("A", undefined, [], at).text).toBe("이 날짜엔 이 숙소를 찾지 못했어요");
  });
});

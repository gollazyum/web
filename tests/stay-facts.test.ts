import { describe, expect, it } from "vitest";
import type { HotelOption } from "@/lib/hotels";
import { rankNotes, stayFactLine } from "@/lib/stay-facts";

const h = (o: Partial<HotelOption>) => ({ token: "t", name: "n", amenities: [], rating: null, reviews: null, ...o }) as unknown as HotelOption;
const P = (value: number, verified = true) => ({ value, verified, none: false });

describe("카드 한 줄 사실", () => {
  it("값이 있을 때만", () => {
    expect(stayFactLine(h({}))).toBe("");
    expect(stayFactLine(h({ near: { name: "난바역", how: "도보", mins: 4 }, freeCancel: true }))).toBe("난바역까지 도보 4분 · 무료 취소 가능한 예약처 있음");
  });
});

describe("AI 3곳 순위 이유", () => {
  it("받은 데이터끼리만 견주고, 확인 못 한 조건을 적는다", () => {
    const a = h({ token: "a", rating: 4.6, reviews: 500, amenities: ["대욕장"] });
    const b = h({ token: "b", rating: 4.2, reviews: 1200 });
    const c = h({ token: "c", rating: 4.0, reviews: 100 });
    const [na, nb, nc] = rankNotes([a, b, c], "대욕장 있고 조식", [P(200000), P(150000), P(90000, false)]);
    expect(na.why).toBe("1위 · 취향 온천·대욕장 맞음 · 평점 3곳 중 가장 높음");
    expect(na.unknown).toEqual(["조식"]);
    expect(nb.why).toBe("2위 · 리뷰 수 가장 많음");
    expect(nc.why).toBe("3위 · 예상 가격 가장 낮음");
    expect(nc.unknown).toEqual(["조식", "온천·대욕장"]);
  });
});

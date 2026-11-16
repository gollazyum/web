import { describe, expect, it } from "vitest";
import { cleanProfile, criteriaWeights, profileTaste, withProfile, EMPTY_PROFILE, type TasteProfile } from "@/lib/taste";
import { fallbackStayPicks, flightWants, stayWants } from "@/lib/trip";
import type { HotelOption } from "@/lib/hotels";

const P: TasteProfile = { tastes: ["onsen", "food"], criteria: ["price", "breakfast"], flight: ["direct", "morning"] };

describe("취향 온보딩", () => {
  it("저장값에서 모르는 값과 중복은 버린다", () => {
    expect(cleanProfile({ tastes: ["onsen", "x", "onsen"], criteria: ["clean", 3], flight: "direct" })).toEqual({ tastes: ["onsen"], criteria: ["clean"], flight: [] });
    expect(cleanProfile(null)).toBeNull();
    expect(cleanProfile("x")).toBeNull();
  });

  it("숙소 취향 글: 순서와 좋아하는 여행을 담고, 규칙 낱말에 걸린다", () => {
    const t = profileTaste(P, "stay");
    expect(t).toContain("1.가성비");
    expect(t).toContain("2.조식");
    expect(t).toContain("온천·휴식");
    expect(stayWants(t).map((w) => w.label)).toEqual(expect.arrayContaining(["조식", "온천·대욕장"]));
  });

  it("항공 취향 글은 직항·오전 출발 규칙에 걸린다", () => {
    const t = profileTaste(P, "flight");
    expect(flightWants(t).map((w) => w.label)).toEqual(expect.arrayContaining(["직항", "오전 출발"]));
  });

  it("그때 적은 말이 앞에 오고, 취향이 없으면 그대로", () => {
    expect(withProfile("역 근처", P, "flight")).toBe("역 근처 / 직항, 오전 출발");
    expect(withProfile("역 근처", null, "stay")).toBe("역 근처");
    expect(withProfile("", EMPTY_PROFILE, "stay")).toBe("");
  });

  it("가격을 1순위로 두면 싼 곳이, 평점을 1순위로 두면 평점 높은 곳이 먼저", () => {
    const h = (token: string, rating: number, total: number) => ({ token, name: token, rating, reviews: 500, total, perNight: null, amenities: [], sources: [] }) as unknown as HotelOption;
    const list = [h("비싸고좋음", 4.9, 400000), h("싸고보통", 4.1, 90000), h("중간", 4.4, 200000), h("그저그럼", 3.9, 250000)];
    const top = (p: TasteProfile | null) => list[fallbackStayPicks(list, "", 0, 2, criteriaWeights(p))[0].n - 1].token;
    expect(top({ ...EMPTY_PROFILE, criteria: ["price"] })).toBe("싸고보통");
    expect(top({ ...EMPTY_PROFILE, criteria: ["clean"] })).toBe("비싸고좋음");
  });
});

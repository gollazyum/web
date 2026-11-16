import { describe, expect, it } from "vitest";
import { cleanProfile, criteriaWeights, profileLines, profileTaste, withProfile, EMPTY_PROFILE, type TasteProfile } from "@/lib/taste";
import { fallbackStayPicks, flightWants, stayWants } from "@/lib/trip";
import type { HotelOption } from "@/lib/hotels";

const P: TasteProfile = { ...EMPTY_PROFILE, who: ["family"], budget: "b2", tastes: ["onsen", "food"], stays: ["ryokan", "value"], criteria: ["price", "breakfast"], flight: ["direct", "morning"], foods: ["local"], avoid: ["seafood"], notes: { stay: "캡슐 호텔" } };

describe("취향 설문", () => {
  it("저장값에서 모르는 값·중복은 버리고, 기타 글은 40자로 자른다", () => {
    const p = cleanProfile({ who: ["solo", "x", "solo"], budget: "b9", criteria: ["clean", 3], flight: "direct", notes: { stay: "a".repeat(80), bad: "x" } });
    expect(p).toMatchObject({ who: ["solo"], budget: "", criteria: ["clean"], flight: [], stays: [] });
    expect(p?.notes).toEqual({ stay: "a".repeat(40) });
    expect(cleanProfile(null)).toBeNull();
  });

  it("예전 저장값(사진·순서·항공만)도 읽힌다", () => {
    expect(cleanProfile({ tastes: ["onsen"], criteria: ["price"], flight: ["direct"] })).toEqual({ ...EMPTY_PROFILE, tastes: ["onsen"], criteria: ["price"], flight: ["direct"] });
  });

  it("숙소 취향 글: 누구와·예산·숙소 스타일·순서를 담고 규칙 낱말에 걸린다", () => {
    const t = profileTaste(P, "stay");
    expect(t).toContain("아이와 가족 여행");
    expect(t).toContain("적당한 예산");
    expect(t).toContain("료칸·온천");
    expect(t).toContain("캡슐 호텔");
    expect(t).toContain("1.가성비");
    expect(stayWants(t).map((w) => w.label)).toEqual(expect.arrayContaining(["조식", "온천·대욕장", "아이 동반"]));
  });

  it("항공 취향 글은 직항·오전 출발 규칙에 걸린다", () => {
    expect(flightWants(profileTaste(P, "flight")).map((w) => w.label)).toEqual(expect.arrayContaining(["직항", "오전 출발"]));
  });

  it("그때 적은 말이 앞에 오고, 취향이 없으면 그대로", () => {
    expect(withProfile("역 근처", P, "flight")).toBe("역 근처 / 직항, 오전 출발");
    expect(withProfile("역 근처", null, "stay")).toBe("역 근처");
    expect(withProfile("", EMPTY_PROFILE, "stay")).toBe("");
  });

  const h = (token: string, rating: number, total: number) => ({ token, name: token, rating, reviews: 500, total, perNight: null, amenities: [], sources: [] }) as unknown as HotelOption;
  const list = [h("비싸고좋음", 4.9, 400000), h("싸고보통", 4.1, 90000), h("중간", 4.4, 200000), h("그저그럼", 3.9, 250000)];
  const top = (p: TasteProfile | null) => list[fallbackStayPicks(list, "", 0, 2, criteriaWeights(p))[0].n - 1].token;

  it("가성비 1순위·알뜰 예산이면 싼 곳, 평점 1순위·고급 예산이면 평점 높은 곳이 먼저", () => {
    expect(top({ ...EMPTY_PROFILE, criteria: ["price"] })).toBe("싸고보통");
    expect(top({ ...EMPTY_PROFILE, budget: "b1" })).toBe("싸고보통");
    expect(top({ ...EMPTY_PROFILE, criteria: ["clean"] })).toBe("비싸고좋음");
    expect(top({ ...EMPTY_PROFILE, budget: "b4" })).toBe("비싸고좋음");
  });

  it("마이 요약: 고른 묶음만 줄로, '없어요'는 빼고", () => {
    expect(profileLines(P)).toEqual(["아이와 가족, 예산 적당하게", "료칸·온천 숙소, 가성비 호텔, 캡슐 호텔", "중요한 순서: 최저가 · 가성비 > 조식 포함", "온천 · 휴식, 맛집 탐방", "현지 맛집·노포", "못 먹는 것: 해산물", "직항만, 오전 출발"]);
    expect(profileLines({ ...EMPTY_PROFILE, avoid: ["none"] })).toEqual([]);
  });
});

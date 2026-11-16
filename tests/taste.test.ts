import { describe, expect, it } from "vitest";
import { cleanProfile, criteriaWeights, profileLines, profileTaste, readSaved, withProfile, BUDGETS, CRITERIA, EMPTY_PROFILE, FLIGHT_PREFS, PACES, STAYS, TASTES, WHO, type TasteProfile } from "@/lib/taste";
import { fallbackStayPicks, flightWants, refineFlights, refineStays, stayWants } from "@/lib/trip";
import type { HotelOption } from "@/lib/hotels";
import type { FlightOption } from "@/lib/flights";

const P: TasteProfile = { ...EMPTY_PROFILE, who: ["family"], budget: "b2", pace: "slow", tastes: ["onsen", "food"], stays: ["ryokan", "value"], criteria: ["price", "breakfast"], flight: ["direct", "morning"] };

describe("취향 설문 (3단계)", () => {
  it("지시서의 선택지 그대로", () => {
    expect(WHO.map((o) => o.label)).toEqual(["혼자", "연인·부부", "아이와 가족", "친구", "부모님과"]);
    expect(BUDGETS.map((o) => o.label)).toEqual(["알뜰하게", "적당하게", "여유 있게", "고급스럽게"]);
    expect(PACES.map((o) => o.label)).toEqual(["적게 걷고 여유롭게", "핵심 명소만 적당히", "알차게 많이 걷기"]);
    expect(TASTES).toHaveLength(6);
    expect(STAYS.map((o) => o.label)).toEqual(["고급 호텔·리조트", "깔끔한 가성비·비즈니스 호텔", "료칸·온천 숙소", "감성 숙소", "독채·레지던스", "게스트하우스·민박"]);
    expect(CRITERIA.map((o) => o.label)).toEqual(["역·관광지와 가까운 위치", "깨끗한 객실·높은 평점", "최저가·가성비", "무료 취소 가능", "조식 포함", "대욕장·수영장"]);
    expect(FLIGHT_PREFS.map((o) => o.label)).toEqual(["최저가 우선", "직항만", "오전 출발", "위탁 수하물 포함", "대형 항공사", "비즈니스석 선호"]);
  });

  it("저장값에서 모르는 값·중복은 버린다", () => {
    const p = cleanProfile({ who: ["solo", "x", "solo"], budget: "b9", pace: "full", criteria: ["clean", 3], flight: "direct", foods: ["local"] });
    expect(p).toEqual({ ...EMPTY_PROFILE, who: ["solo"], pace: "full", criteria: ["clean"] });
    expect(cleanProfile(null)).toBeNull();
  });

  it("앞선 판의 숙소 유형은 새 이름으로 옮긴다", () => {
    expect(cleanProfile({ stays: ["resort", "business", "boutique", "minbak", "ryokan"] })?.stays).toEqual(["luxury", "value", "mood", "guesthouse", "ryokan"]);
  });

  it("저장 상태: done·skipped, 상태가 없는 앞선 판 값은 done", () => {
    expect(readSaved(JSON.stringify({ profile: P, status: "skipped" }))?.status).toBe("skipped");
    expect(readSaved(JSON.stringify({ profile: P, status: "done" }))?.profile).toEqual(P);
    expect(readSaved(JSON.stringify({ tastes: ["onsen"] }))).toEqual({ profile: { ...EMPTY_PROFILE, tastes: ["onsen"] }, status: "done" });
    expect(readSaved(null)).toBeNull();
    expect(readSaved("{bad")).toBeNull();
  });

  it("숙소 취향 글: 동행·예산·이동량·숙소·순서를 담고 규칙 낱말에 걸린다", () => {
    const t = profileTaste(P, "stay");
    for (const w of ["아이와 가족 여행", "적당한 예산", "적게 걷는 여유로운 일정", "료칸·온천", "1.가성비 2.조식"]) expect(t).toContain(w);
    expect(stayWants(t).map((w) => w.label)).toEqual(expect.arrayContaining(["조식", "온천·대욕장", "아이 동반"]));
  });

  it("항공 취향 글은 직항·오전 출발 규칙에 걸린다", () => {
    expect(flightWants(profileTaste(P, "flight")).map((w) => w.label)).toEqual(expect.arrayContaining(["직항", "오전 출발"]));
  });

  it("지금 말한 조건이 앞에 오고 우선이다", () => {
    expect(withProfile("역 근처", P, "flight")).toBe("역 근처 (이번 조건이 우선) / 평소 취향: 직항, 오전 출발, 적당한 예산");
    expect(withProfile("", P, "flight")).toBe("평소 취향: 직항, 오전 출발, 적당한 예산");
    expect(withProfile("역 근처", null, "stay")).toBe("역 근처");
    expect(withProfile("", EMPTY_PROFILE, "stay")).toBe("");
  });

  const h = (token: string, rating: number, total: number, amenities: string[] = []) => ({ token, name: token, rating, reviews: 500, total, perNight: null, amenities, sources: [] }) as unknown as HotelOption;
  const list = [h("비싸고좋음", 4.9, 400000, ["대욕장", "조식 포함"]), h("싸고보통", 4.1, 90000), h("중간", 4.4, 200000, ["실내 수영장"]), h("그저그럼", 3.9, 250000)];
  const top = (p: TasteProfile | null) => list[fallbackStayPicks(list, "", 0, 2, criteriaWeights(p))[0].n - 1].token;

  it("가성비 1순위·알뜰 예산이면 싼 곳, 평점 1순위·고급 예산이면 평점 높은 곳이 먼저", () => {
    expect(top({ ...EMPTY_PROFILE, criteria: ["price"] })).toBe("싸고보통");
    expect(top({ ...EMPTY_PROFILE, budget: "b1" })).toBe("싸고보통");
    expect(top({ ...EMPTY_PROFILE, criteria: ["clean"] })).toBe("비싸고좋음");
    expect(top({ ...EMPTY_PROFILE, budget: "b4" })).toBe("비싸고좋음");
  });

  it("후속 조건은 받은 목록 안에서만 거른다", () => {
    expect(refineStays(list, "breakfast", 2).map((x) => x.token)).toEqual(["비싸고좋음"]);
    expect(refineStays(list, "bath", 2).map((x) => x.token)).toEqual(["비싸고좋음", "중간"]);
    expect(refineStays(list, "cancel", 2)).toEqual([]);
    expect(refineStays(list, "cheap", 2)[0].token).toBe("싸고보통");
    expect(refineStays(list, "rating", 2)[0].token).toBe("비싸고좋음");
    const f = (price: number, time: string, stops: number) => ({ price, departTime: `2026-12-05 ${time}`, stops: Array(stops).fill("X"), minutes: 120 }) as unknown as FlightOption;
    const fl = [f(300000, "20:40", 0), f(250000, "08:10", 1), f(320000, "09:00", 0)];
    expect(refineFlights(fl, "morningDirect")).toEqual([fl[2]]);
    expect(refineFlights(fl, "direct")).toHaveLength(2);
    expect(refineFlights(fl, "cheap")[0]).toBe(fl[1]);
  });

  it("마이 요약: 선택한 묶음만 줄로", () => {
    expect(profileLines(P)).toEqual(["아이와 가족, 예산 적당하게, 적게 걷고 여유롭게", "온천 · 휴식, 맛집 탐방", "료칸·온천 숙소, 깔끔한 가성비·비즈니스 호텔", "중요한 순서: 최저가·가성비 > 조식 포함", "직항만, 오전 출발"]);
    expect(profileLines(EMPTY_PROFILE)).toEqual([]);
  });
});

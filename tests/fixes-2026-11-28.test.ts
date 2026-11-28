import { describe, expect, it } from "vitest";
import type { HotelOption } from "@/lib/hotels";
import type { FlightOption } from "@/lib/flights";
import { CITY_AREAS, cityAreaOf, cityFirst, inCityArea, splitByCity } from "@/lib/city-bounds";
import { budgetQuestion, fixAskCount, readBudget, totalBudget } from "@/lib/budget-read";
import { budgetFit, budgetText, checkTags, conditionLine, facilityTags, partyReason, stationText } from "@/lib/stay-reason";
import { checkFlightReason, flightLow } from "@/lib/flight-reason";
import { flightFactReason, withinBudget } from "@/lib/trip";

const h = (o: Partial<HotelOption>) => ({ token: "t", name: "n", amenities: [], rating: null, reviews: null, near: null, gps: null, total: null, perNight: null, ...o }) as unknown as HotelOption;

describe("1) 검색 도시 경계", () => {
  const tokyo = cityAreaOf("도쿄")!;
  it("15개 도시 경계를 상수로 둔다", () => {
    expect(CITY_AREAS).toHaveLength(15);
    expect(cityAreaOf("도쿄 신주쿠")?.key).toBe("tokyo");
    expect(cityAreaOf("가와사키")).toBeNull();
  });
  it("도쿄도 밖(가와사키·마이하마)은 밖, 하네다공항·신주쿠·마치다는 안", () => {
    expect(inCityArea(tokyo, [35.5313, 139.6989])).toBe(false); // 호텔 메트로폴리탄 가와사키
    expect(inCityArea(tokyo, [35.6366, 139.8831])).toBe(false); // 마이하마 (지바현)
    expect(inCityArea(tokyo, [35.5494, 139.7798])).toBe(true); // 하네다공항
    expect(inCityArea(tokyo, [35.5465, 139.7889])).toBe(true); // 하네다 제2터미널 쪽
    expect(inCityArea(tokyo, [35.6896, 139.7006])).toBe(true); // 신주쿠
    expect(inCityArea(tokyo, [35.5423, 139.4466])).toBe(true); // 마치다 (도쿄도)
    expect(inCityArea(tokyo, null)).toBe(true); // 좌표 없음: 판단하지 않는다
  });
  it("관련도순은 도시 안 먼저, 근처 지역은 받은 순서 그대로 뒤로", () => {
    const list = [h({ token: "kawasaki", gps: [35.5313, 139.6989] }), h({ token: "shinjuku", gps: [35.6896, 139.7006] }), h({ token: "haneda", gps: [35.5494, 139.7798] })];
    const { inside, nearby } = splitByCity(list, "도쿄");
    expect(inside.map((x) => x.token)).toEqual(["shinjuku", "haneda"]);
    expect(nearby.map((x) => x.token)).toEqual(["kawasaki"]);
    // AI 3곳 후보: 도시 안이 3곳 미만이면 근처 지역도 뒤에 둔다
    expect(cityFirst(list, "도쿄").map((x) => x.token)).toEqual(["shinjuku", "haneda", "kawasaki"]);
    expect(cityFirst(list, "도쿄", 2).map((x) => x.token)).toEqual(["shinjuku", "haneda"]);
  });
  it("오사카: 난바는 안, 고베는 밖. 런던 히드로공항은 예외로 안", () => {
    expect(inCityArea(cityAreaOf("오사카")!, [34.6661, 135.5003])).toBe(true);
    expect(inCityArea(cityAreaOf("오사카")!, [34.6901, 135.1955])).toBe(false);
    expect(inCityArea(cityAreaOf("런던")!, [51.4712, -0.4521])).toBe(true);
  });
});

describe("2) 예산 해석", () => {
  it("N박, X원 안에서 → 총액 / 1박에 X원 → 1박 기준 / 애매하면 되묻기", () => {
    const a = readBudget("12월 오사카 2박, 30만 원 안에서 역 가까운 곳")!;
    expect(a).toMatchObject({ amount: 300000, basis: "total", nights: 2 });
    expect(totalBudget(a, 2)).toBe(300000);
    expect(readBudget("오사카 2박 1박에 15만 원")).toMatchObject({ amount: 150000, basis: "night" });
    expect(totalBudget(readBudget("오사카 2박 1박에 15만 원")!, 2)).toBe(300000);
    expect(readBudget("오사카 300,000원 이하")).toMatchObject({ amount: 300000, basis: "total" });
    const u = readBudget("오사카 2박 30만 원 역 근처")!;
    expect(u.basis).toBe("unclear");
    expect(totalBudget(u, 2)).toBeNull();
    const q = budgetQuestion(u, 2)!;
    expect(q.q).toBe("30만 원은 2박 총액인가요, 1박 기준인가요?");
    expect(q.options.map((o) => o.value)).toEqual(["300000", "600000"]);
    expect(fixAskCount("좋아요! 딱 맞게 찾으려고 두 가지만 여쭤볼게요.", 1)).toBe("좋아요! 딱 맞게 찾으려고 한 가지만 여쭤볼게요.");
  });
  it("확인한 총액이 예산 이하만 '조건에 맞는', 확인 전은 가능성, 넘으면 N원 높아요", () => {
    expect(budgetFit({ value: 289000, verified: true, none: false }, 300000)?.kind).toBe("fit");
    expect(budgetFit({ value: 280000, verified: false, none: false }, 300000)?.kind).toBe("maybe");
    const over = budgetFit({ value: 315751, verified: true, none: false }, 300000)!;
    expect(budgetText(over, 2)).toBe("예산보다 15,751원 높아요");
    expect(budgetText(budgetFit({ value: 331246, verified: true, none: false }, 300000)!, 2)).toBe("예산보다 31,246원 높아요");
    expect(budgetText(budgetFit({ value: null, verified: false, none: false }, 300000)!, 2)).toBe("예산 안일 가능성이 있어요");
    expect(budgetFit({ value: 1, verified: true, none: false }, 0)).toBeNull();
  });
  it("후보 고르기는 확인한 총액이 있으면 그 값으로 예산을 본다", () => {
    const a = h({ token: "a", total: 280000 }); // 예상은 예산 안, 확인하니 315,751원
    const b = h({ token: "b", total: 290000 });
    const verified: Record<string, number> = { a: 315751 };
    const r = withinBudget([a, b], 300000, 2, (x) => verified[x.token] ?? x.total ?? Infinity);
    expect(r.list.map((x) => x.token)).toEqual(["b"]);
  });
});

describe("3) 비교표 역 거리 = 추천 이유 역 거리", () => {
  it("역 시간이 없으면 대표 역 직선거리를 같은 글자로", () => {
    const vessel = h({ gps: [34.6688, 135.5003] }); // 난바역에서 약 300m
    expect(stationText(vessel)).toBe("난바역까지 직선 300m");
    expect(conditionLine(vessel, "역 가까운 곳", null, 2)).toBe("난바역까지 직선 300m");
    expect(stationText(h({ near: { name: "난바역", how: "도보", mins: 4 } }))).toBe("난바역까지 도보 4분");
    expect(stationText(h({}))).toBe("");
  });
});

describe("4) 추천 이유와 시설 태그", () => {
  it("첫 문장은 질문 조건(역 거리·예산)", () => {
    const x = h({ gps: [34.6688, 135.5003] });
    expect(conditionLine(x, "역 가까운 곳", budgetFit({ value: 289000, verified: true, none: false }, 300000), 2)).toBe("난바역까지 직선 300m · 2박 총액이 예산 안이에요");
  });
  it("성인만이면 어린이 시설은 태그·이유에서 빠진다", () => {
    const ams = ["대욕장", "어린이 친화", "장애인 편의시설", "무료 Wi-Fi"];
    expect(facilityTags(ams, 0)).toEqual(["대욕장", "장애인 편의시설"]);
    expect(facilityTags(ams, 1)).toEqual(["대욕장", "장애인 편의시설", "어린이 시설"]);
    expect(partyReason("어린이 친화 시설도 있어요", 0)).toBe("");
    expect(partyReason("후기 만족도가 높아요", 0)).toBe("후기 만족도가 높아요");
    expect(partyReason("난바역까지 직선 300m라 편해요", 0)).toBe("");
    expect(checkTags(["대욕장", "장애인 편의시설", "어린이 친화", "수영장"], "대욕장, 어린이 친화, 장애인 편의시설", 0)).toEqual(["대욕장", "장애인 편의시설"]);
  });
});

const f = (o: Partial<FlightOption>) => ({ price: 700000, airlines: ["대한항공"], logo: "", departTime: "2026-12-19 09:00", arriveTime: "2026-12-19 11:20", fromId: "ICN", toId: "HND", minutes: 140, stops: [], segments: [], layovers: [], ...o }) as FlightOption;

describe("5) 항공 가격은 이번 검색 응답 하나로", () => {
  it("가장 낮은 총액은 목록에 실제로 있는 값", () => {
    const list = [f({ price: 727172 }), f({ price: 702768 }), f({ price: 760000 })];
    expect(flightLow(list)).toBe(702768);
    expect(list.some((o) => o.price === flightLow(list))).toBe(true);
  });
});

describe("6) 항공 추천 이유 검증", () => {
  const ke = f({ minutes: 130, departTime: "2026-12-19 20:40", price: 760000 });
  const a = f({ minutes: 140, price: 702768 });
  const list = [a, ke];
  it("목록에 더 짧은 편이 있으면 '가장 짧은'을 쓰지 않는다", () => {
    expect(checkFlightReason("140분으로 가장 짧은 비행", a, list)).toBe("");
    expect(checkFlightReason("130분으로 가장 짧은 비행", ke, list)).toBe("2시간 10분으로 가장 짧은 비행");
  });
  it("시간·금액이 그 편 값과 다르면 쓰지 않는다", () => {
    expect(checkFlightReason("직항 145분", a, list)).toBe("");
    expect(checkFlightReason("가장 싼 직항", a, list)).toBe("가장 싼 직항");
    expect(checkFlightReason("가장 싼 직항", ke, list)).toBe("");
    expect(checkFlightReason("직항 2시간 20분, 오전 출발", a, list)).toBe("직항 2시간 20분, 오전 출발");
  });
  it("사실 한 줄도 카드와 같은 시간 표기", () => {
    expect(flightFactReason(a, "")).toBe("직항 · 2시간 20분");
    expect(flightFactReason(f({ minutes: 120 }), "")).toBe("직항 · 2시간");
  });
});

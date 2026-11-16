import { describe, expect, it } from "vitest";
import type { HotelOption } from "@/lib/hotels";
import type { FlightOption } from "@/lib/flights";
import { brand, brandCssVars, cssVarName } from "@/lib/brand";
import { site } from "@/lib/site";
import {
  cleanCopy,
  fallbackFlightPicks,
  fallbackStayPicks,
  flightReady,
  mergePicks,
  nightsOf,
  stayFactReason,
  stayReady,
  stayTotal,
  withinBudget,
} from "@/lib/trip";

const hotel = (p: Partial<HotelOption>): HotelOption => ({
  token: p.name ?? "t",
  name: "호텔",
  image: "",
  images: [],
  kind: "호텔",
  amenities: [],
  deal: "",
  gps: null,
  stars: 3,
  rating: 4,
  reviews: 100,
  perNight: 100_000,
  total: 200_000,
  priceSource: null,
  sources: [],
  ...p,
});

const flight = (p: Partial<FlightOption>): FlightOption => ({
  price: 200_000,
  airlines: ["진에어"],
  logo: "",
  departTime: "2026-12-05 07:25",
  arriveTime: "2026-12-05 09:20",
  fromId: "ICN",
  toId: "KIX",
  minutes: 115,
  stops: [],
  segments: [],
  layovers: [],
  ...p,
});

describe("브랜드 설정", () => {
  it("운영 이름과 앱 이름을 한 곳에서 가져온다", () => {
    expect(site.name).toBe(brand.legalName);
    expect(brand.appName.length).toBeGreaterThan(0);
  });
  it("색을 CSS 변수로 내린다", () => {
    expect(cssVarName("accentDark")).toBe("--tb-accent-dark");
    expect(brandCssVars()).toContain(`--accent:${brand.colors.accent};`);
    expect(brandCssVars()).toContain("--tb-accent:var(--accent);");
  });
});

describe("검색 조건", () => {
  const today = "2026-11-14";
  it("숙소는 장소·날짜·인원이 있어야 찾는다", () => {
    expect(stayReady({ place: "오사카", checkIn: "2026-12-05", checkOut: "2026-12-07", adults: 2 }, today)).toBe(true);
    expect(stayReady({ place: "", checkIn: "2026-12-05", checkOut: "2026-12-07", adults: 2 }, today)).toBe(false);
    expect(stayReady({ place: "오사카", checkIn: "2026-11-01", checkOut: "2026-11-03", adults: 2 }, today)).toBe(false);
    expect(stayReady({ place: "오사카", checkIn: "2026-12-05", checkOut: "2026-12-05", adults: 2 }, today)).toBe(false);
  });
  it("항공은 코드 두 개와 날짜가 있어야 찾는다", () => {
    expect(flightReady({ from: "ICN", to: "OSA", depart: "2026-12-05", ret: "2026-12-07", adults: 1 }, today)).toBe(true);
    expect(flightReady({ from: "ICN", to: "OSA", depart: "2026-12-05", ret: "", adults: 1 }, today)).toBe(true);
    expect(flightReady({ from: "ICN", to: "ICN", depart: "2026-12-05", ret: "", adults: 1 }, today)).toBe(false);
    expect(flightReady({ from: "ICN", to: "", depart: "2026-12-05", ret: "", adults: 1 }, today)).toBe(false);
  });
  it("박수를 센다", () => {
    expect(nightsOf({ checkIn: "2026-12-05", checkOut: "2026-12-08" })).toBe(3);
  });
});

describe("숙소 총액·예산", () => {
  it("총액이 없으면 1박 요금 × 박수로 어림한다", () => {
    expect(stayTotal(hotel({ total: null, perNight: 90_000 }), 2)).toEqual({ value: 180_000, approx: true });
    expect(stayTotal(hotel({ total: 210_000 }), 2)).toEqual({ value: 210_000, approx: false });
  });
  it("예산 안의 곳만 남기고, 없으면 전체와 over를 준다", () => {
    const list = [hotel({ name: "a", total: 300_000 }), hotel({ name: "b", total: 500_000 })];
    expect(withinBudget(list, 400_000, 2).list.map((h) => h.name)).toEqual(["a"]);
    expect(withinBudget(list, 100_000, 2)).toEqual({ list, over: true });
    expect(withinBudget(list, 0, 2).over).toBe(false);
  });
});

describe("AI가 없을 때 3곳 먼저", () => {
  it("취향 편의시설이 있는 곳을 앞에 둔다", () => {
    const list = [
      hotel({ name: "평범", rating: 4.2 }),
      hotel({ name: "대욕장", rating: 4.1, amenities: ["대욕장", "무료 와이파이"] }),
      hotel({ name: "낮은 점수", rating: 3.0 }),
      hotel({ name: "넷째", rating: 3.9 }),
    ];
    const picks = fallbackStayPicks(list, "조용하고 대욕장 있으면", 0, 2);
    expect(picks).toHaveLength(3);
    expect(list[picks[0].n - 1].name).toBe("대욕장");
    expect(picks[0].reason).toContain("온천·대욕장");
  });
  it("이유는 받아 온 숫자로만 만든다", () => {
    expect(stayFactReason(hotel({ rating: 4.5, reviews: 1284, stars: 4 }), "")).toBe("후기 4.5점(1,284개) · 4성급");
  });
  it("항공은 직항·오전 조건을 먼저 본다", () => {
    const list = [flight({ price: 150_000, stops: ["NRT"], minutes: 300 }), flight({ price: 171_000 }), flight({ price: 160_000, departTime: "2026-12-05 19:40" })];
    const picks = fallbackFlightPicks(list, "직항, 오전 출발");
    expect(picks[0].n).toBe(2);
    expect(picks[0].reason).toContain("직항·오전 출발");
  });
});

describe("AI 결과 검사", () => {
  it("범위 밖·중복 번호는 빼고 모자라면 채운다", () => {
    const merged = mergePicks(
      [
        { n: 9, reason: "없는 번호" },
        { n: 2, reason: "조식 포함" },
        { n: 2, reason: "중복" },
      ],
      [
        { n: 1, reason: "규칙 1" },
        { n: 2, reason: "규칙 2" },
        { n: 3, reason: "규칙 3" },
      ],
      4,
      (n) => `사실 ${n}`,
    );
    expect(merged).toEqual([
      { n: 2, reason: "조식 포함" },
      { n: 1, reason: "규칙 1" },
      { n: 3, reason: "규칙 3" },
    ]);
  });
  it("금지어는 바꿔 쓰고, 출처 이름이 있으면 버린다", () => {
    expect(cleanCopy("가성비 추천 숙소예요")).toBe("가성비 잘 맞는 곳 숙소예요");
    expect(cleanCopy("최저가 숙소")).toBe("가장 낮은 가격 숙소");
    expect(cleanCopy("Google 기준 가격")).toBe("");
  });
  it("이유가 금지어로 비면 사실 이유로 채운다", () => {
    expect(mergePicks([{ n: 1, reason: "Google 평점 높음" }], [], 1, () => "후기 4.5점")).toEqual([{ n: 1, reason: "후기 4.5점" }]);
  });
});

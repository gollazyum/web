import { describe, expect, it } from "vitest";
import { airlineKo, applyFlightFilter, EMPTY_FLIGHT_FILTER, flightFacets } from "@/lib/flight-filters";
import type { FlightOption } from "@/lib/flights";

const o = (price: number, depart: string, stops: string[], toId: string, airlines: string[]): FlightOption => ({
  price, airlines, logo: "", departTime: `2026-12-08 ${depart}`, arriveTime: "2026-12-08 23:00", fromId: "ICN", toId, minutes: 120, stops, segments: [], layovers: [],
});
const list = [o(300000, "07:00", [], "NRT", ["대한항공"]), o(250000, "13:00", ["PVG"], "HND", ["중국동방항공"]), o(280000, "19:30", [], "NRT", ["진에어"]), o(260000, "08:10", [], "NRT", ["진에어"])];

describe("항공 필터 (P1-5)", () => {
  it("항목마다 편 수와 가장 낮은 총액", () => {
    const c = flightFacets(list, EMPTY_FLIGHT_FILTER);
    expect(c.stops).toEqual([
      { id: "0", label: "직항", count: 3, low: 260000 },
      { id: "1", label: "1회 경유", count: 1, low: 250000 },
    ]);
    expect(c.times.map((t) => [t.id, t.count])).toEqual([["am", 2], ["pm", 1], ["eve", 1]]);
    expect(c.arr[0]).toMatchObject({ id: "NRT", count: 3, low: 260000 });
    expect(c.airlines[0]).toMatchObject({ id: "진에어", count: 2, low: 260000 });
  });
  it("다른 칸 조건이 걸리면 그 안에서 센다", () => {
    const c = flightFacets(list, { ...EMPTY_FLIGHT_FILTER, stops: ["0"] });
    expect(c.arr.find((a) => a.id === "HND")).toBeUndefined();
    expect(applyFlightFilter(list, { ...EMPTY_FLIGHT_FILTER, stops: ["0"], times: ["am"] }).map((x) => x.price)).toEqual([300000, 260000]);
  });
  it("항공사 이름 한국어", () => {
    expect(airlineKo("Korean Air")).toBe("대한항공");
    expect(airlineKo("Thai Airways")).toBe("타이항공");
    expect(airlineKo("에어서울")).toBe("에어서울");
    expect(airlineKo("Unknown Air")).toBe("Unknown Air");
  });
});

describe("요금 필터 1박/총액 글자 (P2)", () => {
  it("총액은 박 수를 곱해 보여 준다", async () => {
    const { bandLabel, PRICE_BANDS } = await import("@/lib/price-bands");
    expect(PRICE_BANDS.map((b) => bandLabel(b, "total", 2))).toEqual(["20만 원 이하", "20만~40만 원", "40만~60만 원", "60만 원 이상"]);
    expect(bandLabel(PRICE_BANDS[1], "night", 2)).toBe("10~20만 원");
  });
});

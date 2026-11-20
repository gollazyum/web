import { describe, expect, it } from "vitest";
import { flightFilterOf, optsParam, readOpts, stayFilterOf, stayTasteOf } from "@/lib/home-opts";
import type { FlightOption } from "@/lib/flights";

describe("홈 입력 시트 빠른 조건", () => {
  it("주소의 opt에서 아는 칩만 읽는다", () => {
    expect(readOpts("?q=오사카&opt=cancel,rating45,bags,cancel")).toEqual(["cancel", "rating45"]);
    expect(optsParam([])).toBe("");
    expect(optsParam(["direct", "am"])).toBe("&opt=direct,am");
  });
  it("숙소: 데이터로 거르는 칩은 필터, 나머지는 취향으로", () => {
    const f = stayFilterOf(["cancel", "breakfast", "rating45", "bath"]);
    expect(f).toMatchObject({ freeCancel: true, breakfast: true, minRating: 4.5 });
    expect(stayTasteOf(["bath", "center", "cancel"])).toBe("온천·대욕장, 중심가 가까운 곳");
  });
  it("항공: 국적기는 받은 목록에 있는 항공사 이름으로만", () => {
    const o = (airlines: string[]) => ({ airlines }) as unknown as FlightOption;
    const f = flightFilterOf(["direct", "am", "kr"], [o(["대한항공"]), o(["제주항공"]), o(["Asiana"])]);
    expect(f.stops).toEqual(["0"]);
    expect(f.times).toEqual(["am"]);
    expect(f.airlines.sort()).toEqual(["Asiana", "대한항공"]);
    expect(flightFilterOf(["kr"], [o(["제주항공"])]).airlines).toEqual([]);
  });
});

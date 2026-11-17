import { describe, expect, it } from "vitest";
import { parseHomeSearch } from "@/lib/trip-url";

const T = "2026-11-17";

describe("주소의 날짜 고치기 (P1-3)", () => {
  it("맞는 날짜는 그대로, fixed 없음", () => {
    const r = parseHomeSearch("?q=오사카&checkin=2026-12-08&checkout=2026-12-10&adults=2", T);
    expect(r).toEqual({ kind: "stay", query: { place: "오사카", checkIn: "2026-12-08", checkOut: "2026-12-10", adults: 2, budget: 0, taste: "" } });
  });
  it("지난 날짜는 오늘+21일로, 박 수는 그대로, 도시는 그대로", () => {
    const r = parseHomeSearch("?q=오사카&checkin=2026-01-02&checkout=2026-01-05&adults=2", T);
    expect(r?.fixed).toBe(true);
    expect(r?.kind === "stay" && [r.query.place, r.query.checkIn, r.query.checkOut]).toEqual(["오사카", "2026-12-08", "2026-12-11"]);
  });
  it("없는 날짜·거꾸로 된 날짜", () => {
    const a = parseHomeSearch("?q=도쿄&checkin=2026-02-30&checkout=2026-03-02", T);
    expect(a?.kind === "stay" && [a.query.checkIn, a.query.checkOut]).toEqual(["2026-12-08", "2026-12-10"]);
    const b = parseHomeSearch("?q=도쿄&checkin=2026-12-20&checkout=2026-12-18", T);
    expect(b?.kind === "stay" && [b.fixed, b.query.checkIn, b.query.checkOut]).toEqual([true, "2026-12-20", "2026-12-22"]);
  });
  it("항공: 지난 가는 날·틀린 오는 날", () => {
    const a = parseHomeSearch("?from=ICN&to=NRT&depart=2025-05-01&return=2025-05-05&adults=2", T);
    expect(a?.kind === "flight" && [a.fixed, a.query.depart, a.query.ret]).toEqual([true, "2026-12-08", "2026-12-12"]);
    const b = parseHomeSearch("?from=ICN&to=NRT&depart=2026-12-20&return=2026-12-10", T);
    expect(b?.kind === "flight" && [b.query.depart, b.query.ret]).toEqual(["2026-12-20", "2026-12-24"]);
    const c = parseHomeSearch("?from=ICN&to=NRT&depart=bad", T);
    expect(c?.kind === "flight" && [c.query.depart, c.query.ret]).toEqual(["2026-12-08", ""]);
  });
  it("도시가 없거나 출발=도착이면 null", () => {
    expect(parseHomeSearch("?checkin=2026-12-08", T)).toBeNull();
    expect(parseHomeSearch("?from=ICN&to=ICN&depart=2026-12-08", T)).toBeNull();
  });
});

describe("주소의 인원 (P1-4)", () => {
  it("객실·아동 나이·소아·좌석 등급이 주소를 오간다", async () => {
    const { stayHref, flightHref } = await import("@/lib/trip-url");
    const s = { place: "오사카", checkIn: "2026-12-08", checkOut: "2026-12-10", adults: 2, budget: 0, taste: "", rooms: 2, childAges: [5, 8] };
    const back = parseHomeSearch(stayHref(s).slice(1), T);
    expect(back?.kind === "stay" && back.query).toEqual(s);
    const f = { from: "ICN", to: "NRT", depart: "2026-12-08", ret: "", adults: 2, taste: "", children: 1, cabin: "c" as const };
    const fb = parseHomeSearch(flightHref({ ...f, fromLabel: "", toLabel: "" }).slice(1), T);
    expect(fb?.kind === "flight" && fb.query).toEqual(f);
  });
  it("틀린 인원 값은 버린다", () => {
    const r = parseHomeSearch("?q=오사카&checkin=2026-12-08&checkout=2026-12-10&rooms=0&ages=5,99", T);
    expect(r?.kind === "stay" && [r.query.rooms, r.query.childAges]).toEqual([undefined, undefined]);
  });
});

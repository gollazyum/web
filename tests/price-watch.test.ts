import { describe, expect, it } from "vitest";
import { dropsOf, isDue, pickWatch, readWatch, watchDiff, WATCH_EVERY_MS } from "@/lib/price-watch";

const q = (checkIn: string) => ({ place: "오사카", checkIn, checkOut: "2026-12-14", adults: 2 });
const s = (token: string, checkIn = "2026-12-12") => ({ hotel: { token }, query: q(checkIn) });

describe("찜한 숙소 가격 다시 확인", () => {
  it("지난 여행은 빼고 최근 찜한 5곳만", () => {
    const saved = [s("a"), s("old", "2026-11-01"), s("b"), s("c"), s("d"), s("e"), s("f")];
    expect(pickWatch(saved, "2026-11-25").map((x) => x.hotel.token)).toEqual(["a", "b", "c", "d", "e"]);
  });
  it("하루에 한 번만", () => {
    expect(isDue(null, 0)).toBe(true);
    expect(isDue({ at: 0, lines: [] }, WATCH_EVERY_MS - 1)).toBe(false);
    expect(isDue({ at: 0, lines: [] }, WATCH_EVERY_MS)).toBe(true);
  });
  it("담을 때 확인한 총액과만 견준다", () => {
    expect(watchDiff({ price: 330000, verified: true }, 312000)).toBe(-18000);
    expect(watchDiff({ price: 330000, verified: false }, 312000)).toBeNull();
    expect(watchDiff({ price: 312500, verified: true }, 312000)).toBeNull();
    expect(watchDiff(undefined, 312000)).toBeNull();
  });
  it("내려간 숙소만, 아직 찜한 것만, 많이 내려간 순", () => {
    const st = {
      at: 1,
      lines: [
        { token: "a", name: "A", q: q("2026-12-12"), now: 1, diff: -6000 },
        { token: "b", name: "B", q: q("2026-12-12"), now: 1, diff: -18000 },
        { token: "c", name: "C", q: q("2026-12-12"), now: 1, diff: 4000 },
        { token: "gone", name: "G", q: q("2026-12-12"), now: 1, diff: -50000 },
      ],
    };
    expect(dropsOf(st, [s("a"), s("b"), s("c")]).map((l) => l.token)).toEqual(["b", "a"]);
  });
  it("저장값이 깨졌으면 없음", () => {
    expect(readWatch("{")).toBeNull();
    expect(readWatch('{"at":1}')).toBeNull();
  });
});

describe("찜 카드별 가격 추적 켜기/끄기", async () => {
  const { pickWatch, toggleTracked, trackKey, WATCH_MAX } = await import("@/lib/price-watch");
  const mk = (i: number, checkIn = "2026-12-20") => ({ hotel: { token: `t${i}` }, query: { place: "도쿄", checkIn, checkOut: "2026-12-22", adults: 2 } });
  const saved = Array.from({ length: 7 }, (_, i) => mk(i));
  const today = "2026-11-27";
  it("고른 적 없으면 예전처럼 최근 5곳", () => {
    expect(pickWatch(saved, today, null).length).toBe(WATCH_MAX);
  });
  it("켠 숙소만 확인한다", () => {
    expect(pickWatch(saved, today, [trackKey("t6", saved[6].query)]).map((s) => s.hotel.token)).toEqual(["t6"]);
    expect(pickWatch(saved, today, []).length).toBe(0);
  });
  it("끄고 켜기, 5곳이 넘으면 막는다", () => {
    const off = toggleTracked(saved, today, null, saved[0])!;
    expect(off).not.toContain(trackKey("t0", saved[0].query));
    const on = toggleTracked(saved, today, off, saved[6])!;
    expect(on.length).toBe(WATCH_MAX);
    expect(toggleTracked(saved, today, on, saved[5])).toBeNull();
  });
});

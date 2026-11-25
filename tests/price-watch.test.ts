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

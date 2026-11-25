import { describe, expect, it } from "vitest";
import { fromPeers, historyStats, homeLows, isWeekendStay, usualCompare, type HistoryRow } from "@/lib/usual-price";

const row = (d: string, total: number, nights = 2, weekend = false): HistoryRow => ({ recorded_at: d, nights, total_krw: total, is_weekend: weekend });

describe("평소 가격과 비교", () => {
  it("기록은 날짜별 평균을 먼저 내고, 평일/주말을 나눈다", () => {
    const s = historyStats([row("2026-11-20", 200000), row("2026-11-20", 400000), row("2026-11-21", 200000), row("2026-11-21", 900000, 2, true)], false);
    expect(s.days).toBe(2);
    expect(s.avgNightly).toBe(125000); // (150000 + 100000) / 2
  });

  it("기록이 5일 미만이면 기록 비교 대신 같은 성급 숙소(3곳 이상)와 견준다", () => {
    const days = ["01", "02", "03", "04"].map((d) => row(`2026-11-${d}`, 300000));
    const peers = [
      { token: "a", stars: 4, total: 300000, verified: true },
      { token: "b", stars: 4, total: 360000, verified: false },
      { token: "c", stars: 4.2, total: 330000, verified: true },
      { token: "d", stars: 3, total: 100000, verified: true },
    ];
    const c = usualCompare(historyStats(days, false), { token: "me", stars: 4 }, peers, 300000, 2);
    expect(c?.basis).toBe("peers");
    expect(c?.n).toBe(3);
    expect(c?.avg).toBe(330000);
    expect(c?.word).toBe("low");
    expect(c?.estimated).toBe(true);
  });

  it("기록이 5일 이상이면 기록 평균(이번 박 수로 환산)과 견준다", () => {
    const days = ["01", "02", "03", "04", "05"].map((d) => row(`2026-11-${d}`, 300000));
    const c = usualCompare(historyStats(days, false), { token: "me", stars: null }, [], 460000, 3);
    expect(c).toMatchObject({ basis: "history", n: 5, avg: 450000, word: "same" });
  });

  it("동급 표본이 3곳 미만이거나 성급을 모르면 숨긴다", () => {
    expect(fromPeers({ token: "me", stars: 4 }, [{ token: "a", stars: 4, total: 1, verified: true }], 100)).toBeNull();
    expect(fromPeers({ token: "me", stars: null }, [], 100)).toBeNull();
  });

  it("금·토 체크인은 주말", () => {
    expect(isWeekendStay("2026-11-27")).toBe(true); // 금
    expect(isWeekendStay("2026-11-30")).toBe(false); // 월
  });
});

describe("홈 평소보다 낮은 숙소", () => {
  const hist = ["01", "02", "03", "04", "05"].map((d) => ({ ...row(`2026-11-${d}`, 400000), property_token: "t" }));
  const recent = (total: number) => ({ ...row("2026-11-25", total), property_token: "t", hotel_name: "호텔", place: "오사카", stay_date: "2026-12-20" });

  it("평균보다 10% 이상 낮을 때만 고른다", () => {
    expect(homeLows([recent(380000)], hist)).toEqual([]);
    const [x] = homeLows([recent(320000)], hist);
    expect(x).toMatchObject({ token: "t", avg: 400000, pct: 20, days: 5 });
  });

  it("기록이 5일치가 안 되면 아무것도 보여 주지 않는다 (가짜 할인율 없음)", () => {
    expect(homeLows([recent(100000)], hist.slice(0, 4))).toEqual([]);
  });
});

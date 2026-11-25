import { describe, expect, it } from "vitest";
import { stayCacheSec } from "@/lib/stay-cache";

// 2026-11-25 10:00 KST
const NOW = Date.parse("2026-11-25T01:00:00Z");

describe("숙소 캐시 시간", () => {
  it("체크인 7일 이내는 60분", () => {
    expect(stayCacheSec("2026-11-25", NOW)).toBe(3600);
    expect(stayCacheSec("2026-12-02", NOW)).toBe(3600);
  });
  it("그 밖에는 2시간", () => {
    expect(stayCacheSec("2026-12-03", NOW)).toBe(7200);
  });
  it("한국 날짜로 센다 (UTC로는 전날 밤)", () => {
    expect(stayCacheSec("2026-12-02", Date.parse("2026-11-24T16:00:00Z"))).toBe(3600);
  });
});

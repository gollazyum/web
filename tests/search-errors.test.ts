import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { cacheKey, normalizeDate, normalizeParams } from "@/lib/search-cache";
import { failResponse, isQuota, scrubKey } from "@/lib/serpapi";
import { summarizeUsage } from "@/lib/search-usage";
import { searchErrorMessage, SEARCH_FAIL_MESSAGE, SEARCH_QUOTA_MESSAGE } from "@/lib/search-error";

describe("검색 오류 응답", () => {
  it("429나 'run out of searches'는 사용량 소진", () => {
    expect(isQuota(429, "")).toBe(true);
    expect(isQuota(200, "Your account has run out of searches.")).toBe(true);
    expect(isQuota(500, "Internal error")).toBe(false);
  });

  it("화면 응답에는 error 값만 있고 detail이 없다", async () => {
    const quota = failResponse("quota");
    expect(quota.status).toBe(503);
    expect(await quota.json()).toEqual({ error: "quota" });
    const up = failResponse("upstream");
    expect(up.status).toBe(502);
    expect(await up.json()).toEqual({ error: "upstream" });
  });

  it("로그 문구에서 키 값을 지운다", () => {
    process.env.SERPAPI_API_KEY = "secret123";
    expect(scrubKey("bad key secret123 at https://x/search.json?api_key=secret123&q=a")).not.toContain("secret123");
    delete process.env.SERPAPI_API_KEY;
  });

  it("화면 문구는 상태 코드만 보고 고른다", () => {
    expect(searchErrorMessage(503)).toBe(SEARCH_QUOTA_MESSAGE);
    expect(searchErrorMessage(502)).toBe(SEARCH_FAIL_MESSAGE);
    expect(searchErrorMessage(null)).toBe(SEARCH_FAIL_MESSAGE);
  });

  it("화면 코드에 서버 오류 원문을 붙이는 코드가 없다", () => {
    for (const f of ["components/HotelResults.tsx", "components/FlightResults.tsx", "components/shop/ProductResults.tsx", "components/shop/ProductDetail.tsx"]) {
      const code = readFileSync(f, "utf8");
      expect(code, f).not.toMatch(/오류 \{|\(오류 |errorCode|\.detail/);
    }
  });
});

describe("검색 캐시 키", () => {
  it("날짜 형식을 맞춘다", () => {
    expect(normalizeDate("2026.11.20")).toBe("2026-11-20");
    expect(normalizeDate("2026/1/5")).toBe("2026-01-05");
    expect(normalizeDate("20261120")).toBe("2026-11-20");
  });

  it("공백·대소문자·순서가 달라도 같은 조건이면 같은 키", () => {
    const a = { engine: "google_hotels", q: "  Tokyo   Shinjuku ", check_in_date: "2026.12.01", adults: "2" };
    const b = { adults: "2", q: "tokyo shinjuku", check_in_date: "2026-12-01", engine: "google_hotels" };
    expect(normalizeParams(a)).toBe(normalizeParams(b));
    expect(cacheKey("travel", a, null)).toBe(cacheKey("travel", b, null));
  });

  it("공항 코드는 대문자, 토큰은 대소문자를 그대로 둔다", () => {
    expect(normalizeParams({ departure_id: "icn", arrival_id: "nrt,hnd" })).toBe("arrival_id=NRT,HND&departure_id=ICN");
    expect(cacheKey("raw", { page_token: "AbC" })).not.toBe(cacheKey("raw", { page_token: "abc" }));
  });

  it("다른 조건(날짜·인원·페이지)은 다른 키, api_key는 키에 영향 없음", () => {
    const base = { q: "osaka", check_in_date: "2026-12-01", adults: "2" };
    expect(cacheKey("travel", base)).not.toBe(cacheKey("travel", { ...base, adults: "3" }));
    expect(cacheKey("travel", base)).not.toBe(cacheKey("travel", { ...base, next_page_token: "x" }));
    expect(normalizeParams({ ...base, api_key: "zzz" })).not.toContain("zzz");
  });
});

describe("사용량 경고", () => {
  it("남은 양이 20% 아래면 low", () => {
    expect(summarizeUsage({ searches_per_month: 5000, total_searches_left: 999, extra_credits: 0 })?.low).toBe(true);
    expect(summarizeUsage({ searches_per_month: 5000, total_searches_left: 3814, extra_credits: 0 })?.low).toBe(false);
    expect(summarizeUsage({})).toBeNull();
  });
});

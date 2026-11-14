import { afterEach, describe, expect, it, vi } from "vitest";

// Next 캐시는 테스트 밖에서 동작하지 않으므로 바로 실행하는 함수로 바꾼다
vi.mock("next/cache", () => ({ unstable_cache: (fn: () => unknown) => fn }));

import { serpRaw, serpSearch } from "@/lib/serpapi";

const req = () => new Request("http://localhost/api/hotels", { method: "POST" });

describe("외부 오류 → 화면 응답", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete process.env.SERPAPI_API_KEY;
  });

  it("사용량 소진은 503 quota, 원문·키는 응답과 로그에 없다", async () => {
    process.env.SERPAPI_API_KEY = "test-key-123";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "Your account has run out of searches." }), { status: 429 })));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await serpSearch(req(), { engine: "google_hotels", q: "quota-test-1" }, (j) => j);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "quota" });
    expect(JSON.stringify(log.mock.calls)).not.toContain("test-key-123");
  });

  it("200이어도 본문에 run out of searches면 quota", async () => {
    process.env.SERPAPI_API_KEY = "k";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "Your account has run out of searches." }), { status: 200 })));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await serpRaw({ engine: "google_shopping", q: "quota-test-2" }, 1000);
    expect(res instanceof Response && res.status).toBe(503);
  });

  it("그 밖의 오류는 502 upstream, 실패는 캐시하지 않는다", async () => {
    process.env.SERPAPI_API_KEY = "k";
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: "Invalid API key." }), { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
    for (let i = 0; i < 2; i++) {
      const res = await serpSearch(req(), { engine: "google_flights", q: "fail-test" }, (j) => j);
      expect(res.status).toBe(502);
      expect(await res.json()).toEqual({ error: "upstream" });
    }
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("성공은 캐시해서 두 번째는 바로 나온다", async () => {
    process.env.SERPAPI_API_KEY = "k";
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: 1 }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const a = await serpSearch(req(), { engine: "google_hotels", q: "Cache  Test" }, (j) => j);
    const b = await serpSearch(req(), { engine: "google_hotels", q: "cache test" }, (j) => j);
    expect(a.headers.get("x-cache")).toBe("MISS");
    expect(b.headers.get("x-cache")).toBe("HIT");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

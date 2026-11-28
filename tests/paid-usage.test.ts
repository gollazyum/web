import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ unstable_cache: (fn: () => unknown) => fn }));

// 외부 유료 검색을 실제로 부를 때만 daily_api_usage 를 +1 하고, 저장된 응답(캐시)은 세지 않는다
describe("유료 호출 횟수", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("검색 1번 = +1, 같은 조건 두 번째(캐시)는 0", async () => {
    vi.stubEnv("SERPAPI_API_KEY", "k");
    vi.stubEnv("SUPABASE_URL", "https://db.example");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "sb_secret_x");
    const rpcCalls: unknown[] = [];
    let searches = 0;
    vi.stubGlobal("fetch", async (url: string, init?: { body?: string }) => {
      if (url.includes("/rpc/increment_daily_api_usage")) {
        rpcCalls.push(JSON.parse(init?.body ?? "{}"));
        return new Response(String(rpcCalls.length));
      }
      searches++;
      return new Response(JSON.stringify({ properties: [] }));
    });
    const { serpSearch } = await import("@/lib/serpapi");
    const req = new Request("https://x", { headers: { "x-forwarded-for": "1.1.1.1" } });
    const params = { engine: "google_hotels", q: "paid-usage-test", check_in_date: "2099-01-01" };
    await serpSearch(req, params, () => ({}), undefined);
    expect(searches).toBe(1);
    expect(rpcCalls).toHaveLength(1);
    expect((rpcCalls[0] as { delta: number }).delta).toBe(1);
    expect((rpcCalls[0] as { target_date: string }).target_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    await serpSearch(req, params, () => ({}), undefined);
    expect(searches).toBe(1);
    expect(rpcCalls).toHaveLength(1);
    // 추가 검색(4·5성)이 붙으면 실제 호출 2번 = +2
    await serpSearch(req, { ...params, q: "paid-usage-test-2" }, () => ({}), { ...params, q: "paid-usage-test-2", hotel_class: "4,5" });
    expect(searches).toBe(3);
    expect(rpcCalls).toHaveLength(3);
  });

  it("세기에 실패해도 검색은 된다", async () => {
    vi.stubEnv("SERPAPI_API_KEY", "k");
    vi.stubEnv("SUPABASE_URL", "https://db.example");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "sb_secret_x");
    vi.stubGlobal("fetch", async (url: string) => (url.includes("/rpc/") ? new Response("no", { status: 403 }) : new Response(JSON.stringify({ ok: 1 }))));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { searchOnce } = await import("@/lib/serpapi");
    await expect(searchOnce({ engine: "google_hotels", q: "a" })).resolves.toEqual({ ok: 1 });
  });

  it("하루 상한은 환경변수로 바꿀 수 있다", async () => {
    const { dailyCap } = await import("@/lib/paid-usage");
    expect(dailyCap()).toBe(100);
    vi.stubEnv("PAID_CHECK_DAILY_CAP", "300");
    expect(dailyCap()).toBe(300);
  });
});

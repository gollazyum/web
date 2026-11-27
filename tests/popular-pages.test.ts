import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ unstable_cache: (fn: () => unknown) => fn }));
import { serpSearch } from "@/lib/serpapi";

// 인기 도시: 첫 쪽 + 다음 두 쪽 (3쪽). 다음 쪽 값이 없으면 멈춘다
describe("인기 도시 3쪽 이어 받기", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("follow를 followPages번까지 부르고 shape에 쪽들을 넘긴다", async () => {
    process.env.SERPAPI_API_KEY = "test";
    const seen: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const p = new URL(url).searchParams;
        const page = p.get("next_page_token") ?? "p1";
        seen.push(page);
        const next = page === "p1" ? "p2" : page === "p2" ? "p3" : "p4";
        return new Response(JSON.stringify({ page, serpapi_pagination: { next_page_token: next } }), { status: 200 });
      }),
    );
    const follow = (json: Record<string, unknown>) => {
      const n = (json.serpapi_pagination as { next_page_token?: string }).next_page_token;
      return n ? { engine: "google_hotels", q: "pages-test", next_page_token: n } : null;
    };
    const shape = (json: Record<string, unknown>, _x: unknown, pages: Record<string, unknown>[]) => ({ pages: [json.page, ...pages.map((p) => p.page)] });
    const res = await serpSearch(new Request("http://x", { headers: { "x-forwarded-for": "9.9.9.9" } }), { engine: "google_hotels", q: "pages-test" }, shape, undefined, { follow, followPages: 2 });
    expect(await res.json()).toEqual({ pages: ["p1", "p2", "p3"] });
    expect(seen).toEqual(["p1", "p2", "p3"]);
  });
});

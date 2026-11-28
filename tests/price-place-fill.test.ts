import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import type { PriceRow } from "@/lib/price-history-rows";

const row = (token: string, place: string | null): PriceRow => ({
  property_token: token, hotel_name: "h", place, stay_date: "2099-01-01", nights: 1, adults: 2, is_weekend: false, lead_days: 10,
  price_kind: "verified", nightly_krw: 100000, total_krw: 100000, best_vendor: "agoda", is_refundable: null, recorded_at: "2098-12-22",
});

describe("가격 기록 place 채우기", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });
  it("비어 있으면 hotels_master.city_key(슬러그)로, 있으면 그대로", async () => {
    vi.stubEnv("SUPABASE_URL", "https://db.example");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "sb_secret_x");
    const urls: string[] = [];
    vi.stubGlobal("fetch", async (url: string) => {
      urls.push(url);
      return new Response(JSON.stringify([{ property_token: "A", city_key: "벳푸" }]));
    });
    const { fillPlaces } = await import("@/lib/price-history");
    const out = await fillPlaces([row("A", null), row("B", ""), row("C", "오사카")]);
    expect(out.map((r) => r.place)).toEqual(["beppu", null, "오사카"]);
    expect(urls).toHaveLength(1);
    expect(decodeURIComponent(urls[0])).toContain('property_token=in.("A","B")');
  });
});

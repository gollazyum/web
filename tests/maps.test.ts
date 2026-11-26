import { describe, expect, it } from "vitest";
import { staticMapUrl } from "@/lib/maps";

describe("staticMapUrl", () => {
  it("토큰과 좌표가 있으면 Mapbox 정적 지도 주소", () => {
    const u = staticMapUrl(35.6895, 139.6917, "pk.test");
    expect(u).toContain("https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/");
    expect(u).toContain("pin-l+1E3A5F(139.69170,35.68950)/139.69170,35.68950,15,0/600x200@2x");
    expect(u).toContain("access_token=pk.test");
    expect(u).not.toContain("attribution=false");
    expect(u).not.toContain("logo=false");
  });
  it("토큰이 없거나 좌표가 이상하면 null", () => {
    expect(staticMapUrl(35.6, 139.6, "")).toBeNull();
    expect(staticMapUrl(35.6, 139.6, undefined)).toBeNull();
    expect(staticMapUrl(0, 0, "pk.test")).toBeNull();
    expect(staticMapUrl(NaN, 139.6, "pk.test")).toBeNull();
    expect(staticMapUrl(95, 139.6, "pk.test")).toBeNull();
  });
});

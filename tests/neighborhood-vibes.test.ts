import { describe, expect, it } from "vitest";
import { CITIES, cityNear, createSmoothZonePolygon, fixRadii, GAP_M, haversine, MIN_R, VIBES, zoneAt } from "@/data/neighborhoodVibes";

describe("동네 분위기 시드", () => {
  it("5개 도시, 7개 분위기만", () => {
    expect(CITIES.map((c) => c.id)).toEqual(["osaka", "tokyo", "fukuoka", "bangkok", "seoul"]);
    for (const c of CITIES) for (const z of c.zones) expect(Object.keys(VIBES)).toContain(z.vibe);
  });

  it("보정 뒤 같은 도시 구역끼리 틈(40m)을 두거나, 최소 반경끼리라 더 줄일 수 없다", () => {
    for (const c of CITIES)
      for (let i = 0; i < c.zones.length; i++)
        for (let j = i + 1; j < c.zones.length; j++) {
          const a = c.zones[i];
          const b = c.zones[j];
          const d = haversine(a.center, b.center);
          const ok = a.radiusMeters + b.radiusMeters <= d - GAP_M + 0.5 || (a.radiusMeters === MIN_R && b.radiusMeters === MIN_R);
          expect(ok, `${a.name} / ${b.name}`).toBe(true);
          expect(a.radiusMeters + b.radiusMeters).toBeLessThan(d); // 원이 실제로 겹치지는 않는다
        }
  });

  it("보정은 반경만 줄이고 좌표는 그대로", () => {
    const { cities, fixes } = fixRadii([{ id: "t", name: "t", center: [0, 0], matchKm: 15, zones: [
      { id: "a", name: "a", vibe: "hip", center: [0, 0], radiusMeters: 600, desc: "" },
      { id: "b", name: "b", vibe: "local", center: [0.01, 0], radiusMeters: 600, desc: "" },
    ] }]);
    const d = haversine([0, 0], [0.01, 0]);
    expect(cities[0].zones[0].center).toEqual([0, 0]);
    expect(cities[0].zones[0].radiusMeters + cities[0].zones[1].radiusMeters).toBeLessThanOrEqual(d - GAP_M);
    expect(fixes).toHaveLength(2);
  });

  it("도시 판정은 15km 안만 (요코하마는 도쿄 아님)", () => {
    expect(cityNear([139.6380, 35.4437])).toBeNull();
    expect(cityNear([139.7006, 35.6896])?.id).toBe("tokyo");
    expect(cityNear([135.5023, 34.6937])?.id).toBe("osaka");
  });

  it("숙소가 들어간 구역을 찾는다", () => {
    expect(zoneAt([135.5062, 34.6712])?.name).toBe("소에몬초·히가시신사이바시");
    expect(zoneAt([127.0557, 37.5446])?.name).toBe("성수동 카페거리");
    expect(zoneAt([135.45, 34.6])).toBeNull();
  });

  it("💰 실속 가성비·환승 구역 (방콕은 온눗 역세권)", () => {
    expect(VIBES.value).toEqual({ label: "실속 가성비·환승", emoji: "💰", color: "#4DB6AC" });
    const names = CITIES.flatMap((c) => c.zones.filter((z) => z.vibe === "value").map((z) => `${c.id}:${z.name}`));
    expect(names).toEqual(["osaka:다이코쿠초 역세권", "osaka:신오사카역 주변", "tokyo:아사쿠사바시·쿠라마에", "tokyo:오시아게·스미다", "fukuoka:기온·고후쿠마치", "bangkok:온눗 역세권", "seoul:마포·공덕 역세권"]);
    expect(zoneAt([100.601, 13.7055])?.name).toBe("온눗 역세권");
  });

  it("32각형 닫힌 원", () => {
    const r = createSmoothZonePolygon([139.7, 35.6], 500);
    expect(r).toHaveLength(33);
    expect(r[0]).toEqual(r[32]);
    expect(Math.abs(haversine([139.7, 35.6], r[8]) - 500)).toBeLessThan(5);
  });
});

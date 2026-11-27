import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { amenityLine, gridKey, parseOverpass, PINS_PER_KIND } from "@/lib/amenity-shape";
import { overpassQuery } from "@/lib/nearby-amenities";
import { cityKo } from "@/lib/trip";
import { popularCity } from "@/lib/popular-stay-cities";

const at = (dLat: number) => 35.6812 + dLat;

describe("도보 5분 내 편의시설", () => {
  it("격자 키는 소수점 3자리", () => {
    expect(gridKey(35.69849, 139.78612)).toBe("35.698:139.786");
  });
  it("Overpass 질의: 3종류, 반경 400m, out center 40", () => {
    const q = overpassQuery(35.6812, 139.7671);
    expect(q).toContain("around:400,35.6812,139.7671");
    expect(q).toContain('"shop"~"^(convenience|supermarket|grocery)$"');
    expect(q).toContain('"amenity"="pharmacy"');
    expect(q).toContain('"shop"="chemist"');
    expect(q).toContain('"amenity"~"^(hospital|clinic|doctors)$"');
    expect(q).not.toMatch(/restaurant|bar|pub|cafe/);
    expect(q.endsWith("out center 40;")).toBe(true);
  });
  it("종류별로 세고 가까운 순, 400m 밖·식당은 뺀다", () => {
    const els = [
      { type: "node", id: 1, lat: at(0.001), lon: 139.7671, tags: { shop: "convenience", name: "로손" } },
      { type: "way", id: 2, center: { lat: at(0.0005), lon: 139.7671 }, tags: { shop: "supermarket" } },
      { type: "node", id: 3, lat: at(0.002), lon: 139.7671, tags: { amenity: "pharmacy", name: "마츠키요" } },
      { type: "node", id: 4, lat: at(0.02), lon: 139.7671, tags: { amenity: "hospital" } },
      { type: "node", id: 5, lat: at(0.001), lon: 139.7671, tags: { amenity: "restaurant" } },
      { type: "node", id: 1, lat: at(0.001), lon: 139.7671, tags: { shop: "convenience", name: "로손" } },
    ];
    const a = parseOverpass({ elements: els }, 35.6812, 139.7671)!;
    expect(a.counts).toEqual({ mart: 2, pharmacy: 1, hospital: 0 });
    expect(a.items.map((x) => x.name)).toEqual(["편의점·마트", "로손", "마츠키요"]);
    expect(amenityLine(a)).toBe("도보 5분 내 · 편의점·마트 2곳 · 약국 1곳 · 병원 0곳");
  });
  it("핀은 종류마다 가까운 8개까지, 개수는 전부", () => {
    const els = Array.from({ length: 12 }, (_, i) => ({ type: "node", id: i, lat: at(i * 0.0002), lon: 139.7671, tags: { shop: "convenience" } }));
    const a = parseOverpass({ elements: els }, 35.6812, 139.7671)!;
    expect(a.counts.mart).toBe(12);
    expect(a.items).toHaveLength(PINS_PER_KIND);
  });
  it("오류 모양은 null (0곳으로 저장·표시하지 않음), 빈 결과는 진짜 0곳", () => {
    expect(parseOverpass(null, 0, 0)).toBeNull();
    expect(parseOverpass({ remark: "runtime error" }, 0, 0)).toBeNull();
    const zero = parseOverpass({ elements: [] }, 0, 0)!;
    expect(amenityLine(zero)).toBe("도보 5분 내 등록된 편의점·약국 정보가 없어요");
  });
});

describe("도시 이름 맞추기 · 인기 12개 도시", () => {
  it("도쿄도 → 도쿄, 오사카부 → 오사카", () => {
    expect(cityKo("도쿄도")).toBe("도쿄");
    expect(cityKo("도쿄도 신주쿠")).toBe("도쿄 신주쿠");
    expect(cityKo("오사카부")).toBe("오사카");
    expect(cityKo("오사카 난바")).toBe("오사카 난바");
    expect(cityKo("도쿄도청")).toBe("도쿄도청");
  });
  it("파리·런던 추가, 서울·부산·제주는 그대로 제외", () => {
    expect(popularCity("파리")).toBe("paris");
    expect(popularCity("London")).toBe("london");
    expect(popularCity("서울")).toBeNull();
  });
});

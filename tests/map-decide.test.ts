import { describe, expect, it } from "vitest";
import { CITIES } from "@/data/neighborhoodVibes";
import { manText, priceBrief, travelText, walkMin, zoneAverages } from "@/lib/map-decide";

const osaka = CITIES.find((c) => c.id === "osaka")!;
const z = (name: string) => osaka.zones.find((x) => x.name === name)!;
const at = (name: string): [number, number] => [z(name).center[1], z(name).center[0]]; // [lat, lng]

describe("동네 평균가", () => {
  it("확인 총액 2곳 이상일 때만", () => {
    const spots = [
      { token: "a", gps: at("도톤보리·난바 중심"), price: 200_000 },
      { token: "b", gps: at("도톤보리·난바 중심"), price: 360_000 },
      { token: "c", gps: at("미나미호리에"), price: 150_000 },
      { token: "d", gps: at("미나미호리에"), price: null }, // 확인 전은 빼고 센다
    ];
    const m = zoneAverages(osaka, spots);
    expect(m.get(z("도톤보리·난바 중심").id)).toEqual({ avg: 280_000, n: 2 });
    expect(m.has(z("미나미호리에").id)).toBe(false);
    expect(manText(280_000)).toBe("28만");
  });

  it("구역 안: 평균 대비 낮아요 / 비슷해요, 표본 부족이면 없음", () => {
    const g = at("도톤보리·난바 중심");
    const spots = [
      { token: "a", gps: g, price: 200_000 },
      { token: "b", gps: g, price: 360_000 },
    ];
    expect(priceBrief(osaka, spots[0], spots)).toBe("이 동네 평균(280,000원)보다 80,000원 낮아요");
    expect(priceBrief(osaka, { token: "x", gps: g, price: 282_000 }, spots)).toBe("이 동네 평균(280,000원)과 비슷해요");
    expect(priceBrief(osaka, spots[0], [spots[0]])).toBeNull();
  });

  it("구역 밖: 인기 구역 평균보다 쌀 때만 실속 문구", () => {
    const g = at("도톤보리·난바 중심");
    const spots = [
      { token: "a", gps: g, price: 200_000 },
      { token: "b", gps: g, price: 300_000 },
    ];
    const out: [number, number] = [34.62, 135.46];
    expect(priceBrief(osaka, { token: "o", gps: out, price: 150_000 }, spots)).toBe("인기 번화가 평균(250,000원)보다 약 40% 낮은 실속 위치예요");
    expect(priceBrief(osaka, { token: "o", gps: out, price: 300_000 }, spots)).toBeNull();
    expect(priceBrief(osaka, { token: "o", gps: out, price: null }, spots)).toBeNull();
  });
});

describe("예상 이동 시간", () => {
  it("도보 · 일반 · 공항", () => {
    expect(travelText("난바역", 0.4)).toEqual({ time: "도보 약 6분", sub: "400m" });
    expect(travelText("난바역", 0.05)).toEqual({ time: "도보 약 2분", sub: "50m" });
    expect(travelText("오사카성", 3.1)).toEqual({ time: "약 15분", sub: "직선 3.1km" });
    expect(travelText("간사이국제공항", 35)).toEqual({ time: "공항 약 75분", sub: "직선 35.0km" });
    expect(walkMin(320)).toBe(5);
    expect(walkMin(10)).toBe(1);
  });
});

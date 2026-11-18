import { describe, expect, it } from "vitest";
import { unknownPlace } from "@/lib/place-check";
import type { HotelOption } from "@/lib/hotels";

const h = (name: string, gps: [number, number] | null): HotelOption =>
  ({ token: name, name, image: "", images: [], kind: "", amenities: [], deal: "", gps, stars: null, rating: null, reviews: null, perNight: null, total: null, priceSource: null, sources: [] }) as HotelOption;

const korea = [h("엘모멘토 송도", [37.39, 126.64]), h("쏠비치 삼척", [37.42, 129.19]), h("카시아 속초", [38.19, 128.6]), h("그랜드 워커힐 서울", [37.55, 127.1])];
const osaka = [h("센타라 그랜드", [34.66, 135.5]), h("호텔 한큐", [34.7, 135.5]), h("네도코", [34.68, 135.47])];

describe("없는 도시 검색", () => {
  it("여러 지역에 흩어진 결과면 모르는 곳으로 본다", () => expect(unknownPlace("asdfqwer", korea, false)).toBe(true));
  it("아는 도시면 언제나 목록", () => expect(unknownPlace("asdfqwer", korea, true)).toBe(false));
  it("한 도시에 모인 결과면 목록", () => expect(unknownPlace("난바", osaka, false)).toBe(false));
  it("숙소 이름으로 찾으면 목록", () => expect(unknownPlace("워커힐", korea, false)).toBe(false));
});

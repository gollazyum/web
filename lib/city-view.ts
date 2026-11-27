import { POPULAR_STAY_CITIES } from "./popular-stay-cities";

// 결과 지도 첫 화면: 도시 이름만으로 찾았으면 핀 전체(교외까지 퍼진 60곳)에 맞추지 않고 도심 중심·도심 줌으로 연다.
// 도쿄 기준 줌 12.3 ≈ 신주쿠·시부야·미나토·주오·지요다·분쿄·다이토 등 5~9개 구가 한 화면 (휴대폰은 0.6 낮춤)
export type CityView = { lat: number; lng: number; zoom: number };

export const CITY_VIEWS: Record<string, CityView> = {
  tokyo: { lat: 35.6812, lng: 139.7369, zoom: 12.3 },
  osaka: { lat: 34.6863, lng: 135.5023, zoom: 12.6 },
  fukuoka: { lat: 33.5902, lng: 130.4017, zoom: 13 },
  kyoto: { lat: 35.0016, lng: 135.7629, zoom: 12.9 },
  sapporo: { lat: 43.0618, lng: 141.3545, zoom: 13 },
  okinawa: { lat: 26.2155, lng: 127.6842, zoom: 12.8 },
  bangkok: { lat: 13.7466, lng: 100.5393, zoom: 12.3 },
  danang: { lat: 16.0605, lng: 108.2272, zoom: 12.8 },
  nhatrang: { lat: 12.2434, lng: 109.1943, zoom: 13 },
  taipei: { lat: 25.0441, lng: 121.5291, zoom: 12.6 },
  paris: { lat: 48.8606, lng: 2.3376, zoom: 12.3 },
  london: { lat: 51.5098, lng: -0.1180, zoom: 12.3 },
};

// "도쿄"처럼 도시 이름만일 때만 (「도쿄 신주쿠」는 핀이 모인 곳에 맞추는 편이 맞다)
export function cityViewOf(place: string): CityView | null {
  const t = place.normalize("NFC").trim().toLowerCase().replace(/\s+/g, " ");
  const c = POPULAR_STAY_CITIES.find((x) => x.names.includes(t));
  return c ? (CITY_VIEWS[c.key] ?? null) : null;
}

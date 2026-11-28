// 검색 도시 경계 (2026-11-28 초록 요청 1번).
// "도쿄"로 찾았는데 가나가와현 가와사키 숙소가 관련도순 1위에 오는 일을 막는다.
// 인기 15개 도시(해외 12 + 서울·부산·제주)의 경계를 상수로 두고, 경계 밖 숙소는 관련도순 목록 아래 '근처 지역 숙소'로 내리고
// AI 추천 3곳 후보에서도 뺀다 (경계 안 숙소가 3곳 이상일 때만. 모자라면 경계 밖도 후보로 둔다).
//
// 경계 정하는 법
// - 도쿄: 도쿄도(23구 + 다마 지역, 섬 제외) 경계를 단순화한 다각형. 남쪽은 다마강(가와사키와의 경계), 동쪽은 에도강(지바현)
// - 오키나와·제주: 섬 전체 상자 (도시보다 섬 단위로 찾는 곳)
// - 나머지: 도심 중심에서 반경 km (행정구역을 대략 덮는 크기)
// 경계 예외(keep): 도시 경계 근처의 공항·주요 역. 경계 밖으로 잡혀도 이 지점 반경 안이면 도시 안으로 본다
// (하네다공항처럼 도시 안 공항 숙소는 다각형 끝에 걸려도 그대로 둔다). 도시 밖의 다른 지역 공항(나리타·간사이·수완나품 등)은 넣지 않는다
// 좌표가 없는 숙소는 판단할 수 없어 도시 안으로 둔다 (감점하지 않는다).
//
// 계산은 받아 온 목록에만 한다. 검색어·검색 조건·저장된 응답(캐시 키)은 그대로라 유료 검색이 늘지 않는다.

export type LatLng = [number, number];
type Keep = { name: string; at: LatLng; km: number };
export type CityArea =
  | { key: string; names: string[]; kind: "radius"; center: LatLng; km: number; keep: Keep[] }
  | { key: string; names: string[]; kind: "box"; south: number; west: number; north: number; east: number; keep: Keep[] }
  | { key: string; names: string[]; kind: "polygon"; points: LatLng[]; keep: Keep[] };

export const CITY_AREAS: readonly CityArea[] = [
  {
    key: "tokyo",
    names: ["도쿄", "동경", "tokyo"],
    kind: "polygon",
    // 도쿄도 본토 (시계 방향). 남동쪽은 하네다공항까지 바다 쪽으로, 남쪽은 다마강, 남서쪽은 마치다
    points: [
      [35.72, 138.94], [35.8, 139.0], [35.8, 139.3], [35.78, 139.5], [35.78, 139.6], [35.82, 139.75], [35.82, 139.85],
      [35.75, 139.89], [35.65, 139.875], [35.62, 139.86], [35.52, 139.83], [35.525, 139.76], [35.555, 139.72],
      [35.585, 139.67], [35.625, 139.58], [35.615, 139.53], [35.58, 139.5], [35.53, 139.49], [35.5, 139.45],
      [35.55, 139.4], [35.6, 139.33], [35.62, 139.2], [35.65, 139.05],
    ],
    keep: [{ name: "하네다공항", at: [35.5494, 139.7798], km: 2.5 }],
  },
  { key: "osaka", names: ["오사카", "osaka"], kind: "radius", center: [34.6863, 135.5023], km: 11, keep: [{ name: "신오사카역", at: [34.7334, 135.5001], km: 1.5 }] },
  { key: "fukuoka", names: ["후쿠오카", "fukuoka"], kind: "radius", center: [33.5902, 130.4017], km: 10, keep: [{ name: "후쿠오카공항", at: [33.5859, 130.4511], km: 2 }] },
  { key: "kyoto", names: ["교토", "kyoto"], kind: "radius", center: [35.0016, 135.7629], km: 10, keep: [{ name: "교토역", at: [34.9858, 135.7588], km: 1.5 }] },
  { key: "sapporo", names: ["삿포로", "sapporo"], kind: "radius", center: [43.0618, 141.3545], km: 12, keep: [{ name: "삿포로역", at: [43.0687, 141.3508], km: 1.5 }] },
  { key: "okinawa", names: ["오키나와", "나하", "okinawa", "naha"], kind: "box", south: 24.0, west: 122.9, north: 27.0, east: 128.4, keep: [] },
  { key: "bangkok", names: ["방콕", "bangkok"], kind: "radius", center: [13.7466, 100.5393], km: 22, keep: [{ name: "돈므앙공항", at: [13.9126, 100.6068], km: 2.5 }] },
  { key: "danang", names: ["다낭", "da nang", "danang"], kind: "radius", center: [16.0605, 108.2272], km: 15, keep: [{ name: "다낭국제공항", at: [16.0439, 108.1994], km: 2 }] },
  { key: "nhatrang", names: ["나트랑", "냐짱", "nha trang", "nhatrang"], kind: "radius", center: [12.2434, 109.1943], km: 15, keep: [] },
  { key: "taipei", names: ["타이베이", "타이페이", "taipei"], kind: "radius", center: [25.0441, 121.5291], km: 10, keep: [{ name: "쑹산공항", at: [25.0694, 121.5525], km: 2 }] },
  { key: "paris", names: ["파리", "paris"], kind: "radius", center: [48.8566, 2.3522], km: 7, keep: [] },
  { key: "london", names: ["런던", "london"], kind: "radius", center: [51.5072, -0.1276], km: 16, keep: [{ name: "히드로공항", at: [51.47, -0.4543], km: 3 }] },
  { key: "seoul", names: ["서울", "seoul"], kind: "radius", center: [37.5665, 126.978], km: 16, keep: [{ name: "김포공항", at: [37.5583, 126.7906], km: 2.5 }] },
  { key: "busan", names: ["부산", "busan"], kind: "radius", center: [35.1577, 129.0596], km: 20, keep: [{ name: "김해공항", at: [35.1796, 128.9382], km: 2.5 }] },
  { key: "jeju", names: ["제주", "제주도", "jeju"], kind: "box", south: 33.1, west: 126.1, north: 33.6, east: 127.0, keep: [] },
];

// 검색어 → 도시 경계. "도쿄 신주쿠"처럼 도시 이름이 들어 있어도 같은 도시로 본다. 모르는 곳이면 null (경계 처리를 하지 않는다)
export function cityAreaOf(place: string): CityArea | null {
  const t = place.normalize("NFC").trim().toLowerCase().replace(/\s+/g, " ");
  if (!t) return null;
  return CITY_AREAS.find((c) => c.names.some((n) => t === n || t.includes(n))) ?? null;
}

// 두 좌표 사이 직선거리 (km)
function km(a: LatLng, b: LatLng): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const dLat = r(b[0] - a[0]);
  const dLon = r(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

// 점이 다각형 안인지 (광선 교차)
function inPolygon(p: LatLng, pts: LatLng[]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [yi, xi] = pts[i];
    const [yj, xj] = pts[j];
    if (yi > p[0] !== yj > p[0] && p[1] < ((xj - xi) * (p[0] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// 좌표가 도시 안인지. 좌표가 없으면 true (판단하지 않는다)
export function inCityArea(area: CityArea, gps: LatLng | null | undefined): boolean {
  if (!gps) return true;
  if (area.keep.some((k) => km(gps, k.at) <= k.km)) return true;
  if (area.kind === "radius") return km(gps, area.center) <= area.km;
  if (area.kind === "box") return gps[0] >= area.south && gps[0] <= area.north && gps[1] >= area.west && gps[1] <= area.east;
  return inPolygon(gps, area.points);
}

// 목록을 도시 안 / 근처 지역으로 나눈다 (각자 받은 순서 그대로). 모르는 도시면 모두 안쪽
export function splitByCity<T extends { gps: LatLng | null }>(list: T[], place: string): { inside: T[]; nearby: T[] } {
  const area = cityAreaOf(place);
  if (!area) return { inside: list, nearby: [] };
  const inside: T[] = [];
  const nearby: T[] = [];
  for (const h of list) (inCityArea(area, h.gps) ? inside : nearby).push(h);
  return { inside, nearby };
}

// AI 추천 3곳 후보: 도시 안 숙소가 3곳 이상이면 그것만, 모자라면 도시 안을 앞에 두고 근처 지역을 뒤에 붙인다
export function cityFirst<T extends { gps: LatLng | null }>(list: T[], place: string, min = 3): T[] {
  const { inside, nearby } = splitByCity(list, place);
  return inside.length >= min ? inside : [...inside, ...nearby];
}

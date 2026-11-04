// 숙소 카드의 "📍 도쿄역에서 N km" 줄. 도시마다 대표 지점을 정해 두고 숙소 좌표와의 거리(직선)를 잰다.
// 검색어에 도시 이름이 없으면 거리 줄을 보여 주지 않는다 (지어내지 않는다)

export type CityAnchor = { city: string; point: string; lat: number; lng: number; aliases: string[] };

// 도시 → 대표 지점. 검색어에 aliases 중 하나가 들어 있으면 그 도시로 본다 (긴 이름부터 맞춘다)
export const CITY_ANCHORS: CityAnchor[] = [
  { city: "도쿄", point: "도쿄역", lat: 35.6812, lng: 139.7671, aliases: ["도쿄", "동경", "tokyo", "신주쿠", "시부야", "긴자", "아사쿠사", "우에노", "이케부쿠로"] },
  { city: "오사카", point: "오사카역", lat: 34.7025, lng: 135.4959, aliases: ["오사카", "osaka", "난바", "우메다", "도톤보리", "신사이바시"] },
  { city: "교토", point: "교토역", lat: 34.9858, lng: 135.7588, aliases: ["교토", "kyoto"] },
  { city: "후쿠오카", point: "하카타역", lat: 33.5902, lng: 130.4207, aliases: ["후쿠오카", "fukuoka", "하카타", "텐진"] },
  { city: "삿포로", point: "삿포로역", lat: 43.0687, lng: 141.3508, aliases: ["삿포로", "sapporo"] },
  { city: "나고야", point: "나고야역", lat: 35.1709, lng: 136.8815, aliases: ["나고야", "nagoya"] },
  { city: "오키나와", point: "나하 국제거리", lat: 26.2155, lng: 127.6853, aliases: ["오키나와", "okinawa", "나하", "naha"] },
  { city: "서울", point: "서울역", lat: 37.5547, lng: 126.9707, aliases: ["서울", "seoul", "명동", "홍대", "강남"] },
  { city: "부산", point: "부산역", lat: 35.1151, lng: 129.0415, aliases: ["부산", "busan", "해운대", "서면"] },
  { city: "제주", point: "제주공항", lat: 33.5104, lng: 126.4914, aliases: ["제주", "jeju"] },
  { city: "타이베이", point: "타이베이역", lat: 25.0478, lng: 121.517, aliases: ["타이베이", "타이페이", "taipei"] },
  { city: "홍콩", point: "센트럴역", lat: 22.282, lng: 114.1588, aliases: ["홍콩", "hong kong", "hongkong"] },
  { city: "방콕", point: "시암역", lat: 13.7456, lng: 100.5341, aliases: ["방콕", "bangkok"] },
  { city: "다낭", point: "한시장", lat: 16.0682, lng: 108.2241, aliases: ["다낭", "da nang", "danang"] },
  { city: "나트랑", point: "나트랑 해변", lat: 12.2388, lng: 109.1967, aliases: ["나트랑", "냐짱", "nha trang", "nhatrang"] },
  { city: "하노이", point: "호안끼엠 호수", lat: 21.0285, lng: 105.8522, aliases: ["하노이", "hanoi"] },
  { city: "호치민", point: "벤탄 시장", lat: 10.7725, lng: 106.698, aliases: ["호치민", "ho chi minh", "사이공"] },
  { city: "싱가포르", point: "마리나베이", lat: 1.2834, lng: 103.8607, aliases: ["싱가포르", "singapore"] },
  { city: "세부", point: "세부 막탄공항", lat: 10.3075, lng: 123.9794, aliases: ["세부", "cebu"] },
  { city: "괌", point: "투몬 해변", lat: 13.5149, lng: 144.8048, aliases: ["괌", "guam"] },
  { city: "파리", point: "샤틀레역", lat: 48.8584, lng: 2.347, aliases: ["파리", "paris"] },
  { city: "런던", point: "트래펄가 광장", lat: 51.508, lng: -0.1281, aliases: ["런던", "london"] },
  { city: "뉴욕", point: "타임스스퀘어", lat: 40.758, lng: -73.9855, aliases: ["뉴욕", "new york", "맨해튼"] },
];

// 이 거리(km)를 넘으면 "OO 시내 밖" 꼬리표
export const OUTSIDE_KM = 20;

export function cityAnchor(query: string): CityAnchor | null {
  const q = query.toLowerCase();
  let best: { a: CityAnchor; len: number } | null = null;
  for (const a of CITY_ANCHORS)
    for (const alias of a.aliases) if (q.includes(alias.toLowerCase()) && (!best || alias.length > best.len)) best = { a, len: alias.length };
  return best?.a ?? null;
}

// 두 좌표 사이 직선거리 (km, 하버사인)
export function distanceKm(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b[0] - a[0]);
  const dLng = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

// 1km 미만은 소수 한 자리, 그 위는 10km까지 소수 한 자리, 넘으면 정수
export function kmLabel(km: number): string {
  return km < 10 ? `${(Math.round(km * 10) / 10).toLocaleString("ko-KR")} km` : `${Math.round(km).toLocaleString("ko-KR")} km`;
}

export type HotelDistance = { text: string; outside: string | null; km: number };

// 카드에 넣을 거리 줄. 좌표나 도시를 모르면 null
export function hotelDistance(gps: [number, number] | null, query: string): HotelDistance | null {
  const a = cityAnchor(query);
  if (!a || !gps) return null;
  const km = distanceKm(gps, [a.lat, a.lng]);
  // 1,000km가 넘으면 좌표가 잘못 왔거나 다른 도시라 표시하지 않는다
  if (!Number.isFinite(km) || km > 1000) return null;
  return { text: `${a.point}에서 ${kmLabel(km)}`, outside: km > OUTSIDE_KM ? `${a.city} 시내 밖` : null, km };
}

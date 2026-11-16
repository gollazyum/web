// 숙소 상세의 '주요 장소까지 거리'. 지도 없이 글로만 보여 준다.
// 인기 여행지별 대표 장소(역·공항·명소)의 좌표만 직접 적어 두고, 숙소 좌표와의 직선거리를 계산한다
// (외부 장소 검색을 부르지 않는다). 실제 이동 거리는 이보다 길다는 걸 화면에 함께 적는다.
export type Landmark = { name: string; lat: number; lon: number; airport?: boolean };

export const LANDMARKS: Landmark[] = [
  // 오사카
  { name: "난바역", lat: 34.6661, lon: 135.5003 },
  { name: "도톤보리", lat: 34.6687, lon: 135.5013 },
  { name: "오사카역(우메다)", lat: 34.7025, lon: 135.4959 },
  { name: "오사카성", lat: 34.6873, lon: 135.5262 },
  { name: "유니버설 스튜디오 재팬", lat: 34.6654, lon: 135.4323 },
  { name: "간사이국제공항", lat: 34.4347, lon: 135.244, airport: true },
  // 후쿠오카
  { name: "하카타역", lat: 33.5897, lon: 130.4207 },
  { name: "텐진역", lat: 33.5911, lon: 130.399 },
  { name: "캐널시티 하카타", lat: 33.5897, lon: 130.4111 },
  { name: "후쿠오카공항", lat: 33.5859, lon: 130.4511, airport: true },
  // 도쿄
  { name: "도쿄역", lat: 35.6812, lon: 139.7671 },
  { name: "신주쿠역", lat: 35.6896, lon: 139.7006 },
  { name: "시부야역", lat: 35.658, lon: 139.7016 },
  { name: "아사쿠사 센소지", lat: 35.7148, lon: 139.7967 },
  { name: "하네다공항", lat: 35.5494, lon: 139.7798, airport: true },
  { name: "나리타공항", lat: 35.772, lon: 140.3929, airport: true },
  // 삿포로
  { name: "삿포로역", lat: 43.0687, lon: 141.3508 },
  { name: "오도리공원", lat: 43.0598, lon: 141.3486 },
  { name: "스스키노", lat: 43.0556, lon: 141.3533 },
  { name: "신치토세공항", lat: 42.7752, lon: 141.6923, airport: true },
  // 오키나와
  { name: "국제거리", lat: 26.2148, lon: 127.6862 },
  { name: "아메리칸 빌리지", lat: 26.3164, lon: 127.7577 },
  { name: "츄라우미 수족관", lat: 26.6943, lon: 127.8779 },
  { name: "나하공항", lat: 26.2064, lon: 127.6465, airport: true },
  // 다낭
  { name: "한시장", lat: 16.0684, lon: 108.224 },
  { name: "용다리", lat: 16.0612, lon: 108.2272 },
  { name: "미케비치", lat: 16.061, lon: 108.247 },
  { name: "호이안 구시가지", lat: 15.877, lon: 108.328 },
  { name: "다낭국제공항", lat: 16.0439, lon: 108.1994, airport: true },
  // 방콕
  { name: "시암", lat: 13.7462, lon: 100.5347 },
  { name: "아속(수쿰빗)", lat: 13.737, lon: 100.5603 },
  { name: "왕궁", lat: 13.75, lon: 100.4913 },
  { name: "카오산로드", lat: 13.759, lon: 100.4974 },
  { name: "수완나품공항", lat: 13.69, lon: 100.7501, airport: true },
  { name: "돈므앙공항", lat: 13.9126, lon: 100.6068, airport: true },
  // 타이베이
  { name: "타이베이역", lat: 25.0478, lon: 121.517 },
  { name: "시먼딩", lat: 25.0422, lon: 121.5078 },
  { name: "타이베이 101", lat: 25.034, lon: 121.5645 },
  { name: "스린 야시장", lat: 25.088, lon: 121.5241 },
  { name: "쑹산공항", lat: 25.0694, lon: 121.5525, airport: true },
  { name: "타오위안공항", lat: 25.0797, lon: 121.2342, airport: true },
];

// 두 좌표 사이 직선거리 (km)
export function km(a: [number, number], b: [number, number]): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const dLat = r(b[0] - a[0]);
  const dLon = r(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

const NEAR_KM = 25; // 시내 장소는 이 거리 안만
const AIRPORT_KM = 70; // 공항은 멀어도 보여 준다

// 가까운 순 최대 n곳. 공항은 가장 가까운 한 곳만. 목록에 없는 도시면 빈 배열
export function nearby(gps: [number, number] | null, n = 4): { name: string; km: number; airport: boolean }[] {
  if (!gps) return [];
  const all = LANDMARKS.map((l) => ({ name: l.name, km: km(gps, [l.lat, l.lon]), airport: !!l.airport }));
  const spots = all.filter((l) => !l.airport && l.km <= NEAR_KM).sort((a, b) => a.km - b.km);
  const air = all.filter((l) => l.airport && l.km <= AIRPORT_KM).sort((a, b) => a.km - b.km)[0];
  if (!spots.length && !air) return [];
  return [...spots.slice(0, air ? n - 1 : n), ...(air ? [air] : [])];
}

// "350m", "1.2km", "42km"
export const distText = (d: number) => (d < 1 ? `${Math.max(50, Math.round((d * 1000) / 50) * 50)}m` : d < 10 ? `${d.toFixed(1)}km` : `${Math.round(d)}km`);

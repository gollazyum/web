import type { HotelOption } from "./hotels";

// 없는 도시(예: 'asdfqwer')로 찾으면 검색 결과가 엉뚱한 곳(여러 지역의 숙소)으로 온다. 그럴 때는 목록 대신 안내를 보여 준다.
// knownCity: 공항·도시 목록이나 인기 여행지에서 찾은 이름이면 true (그러면 언제나 목록을 보여 준다)
export const SPREAD_KM = 150;

const km = (a: [number, number], b: [number, number]) => {
  const r = Math.PI / 180;
  const x = (b[1] - a[1]) * r * Math.cos(((a[0] + b[0]) / 2) * r);
  const y = (b[0] - a[0]) * r;
  return Math.sqrt(x * x + y * y) * 6371;
};

export function unknownPlace(query: string, options: HotelOption[], knownCity: boolean): boolean {
  if (knownCity || !options.length) return false;
  const tokens = query
    .normalize("NFC")
    .toLowerCase()
    .split(/[\s,·]+/)
    .filter((t) => t.length >= 2);
  // 숙소 이름으로 찾은 경우: 결과 이름에 찾은 말이 들어 있으면 그대로
  if (options.some((o) => tokens.some((t) => o.name.normalize("NFC").toLowerCase().includes(t)))) return false;
  // 결과가 한 지역에 모여 있으면 그대로 (위치를 모르는 숙소가 많으면 판단하지 않는다)
  const pts = options.map((o) => o.gps).filter((g): g is [number, number] => !!g);
  if (pts.length < 3) return false;
  let far = 0;
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) far = Math.max(far, km(pts[i], pts[j]));
  return far > SPREAD_KM;
}

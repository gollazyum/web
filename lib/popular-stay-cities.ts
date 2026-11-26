// 숙소 검색이 많은 해외 인기 도시. 이 도시를 찾으면 서버가 첫 쪽에 이어 다음 쪽까지 한 번에 받아(최대 40곳)
// 지도와 목록을 채우고 6시간 저장해 둔다 (같은 조건의 두 번째 검색부터는 유료 검색 0번).
// 서울·부산·제주는 넣지 않는다: 국내 숙소는 제휴 예약처가 아직 없어 해외 숙소만 넓게 받는다 (2026-11-25 초록 결정)
export type PopularCity = { key: string; names: string[] };

export const POPULAR_STAY_CITIES: readonly PopularCity[] = [
  { key: "tokyo", names: ["도쿄", "동경", "tokyo"] },
  { key: "osaka", names: ["오사카", "osaka"] },
  { key: "fukuoka", names: ["후쿠오카", "fukuoka"] },
  { key: "kyoto", names: ["교토", "kyoto"] },
  { key: "sapporo", names: ["삿포로", "sapporo"] },
  { key: "okinawa", names: ["오키나와", "나하", "okinawa", "naha"] },
  { key: "bangkok", names: ["방콕", "bangkok"] },
  { key: "danang", names: ["다낭", "da nang", "danang"] },
  { key: "nhatrang", names: ["나트랑", "냐짱", "nha trang", "nhatrang"] },
  { key: "taipei", names: ["타이베이", "타이페이", "taipei"] },
];

// 인기 도시 목록 검색 저장 시간 (체크인이 7일 안이면 가격이 자주 바뀌어 원래대로 60분)
export const POPULAR_CACHE_SEC = 6 * 60 * 60;

// 검색어가 인기 도시면 그 도시 키. "도쿄 신주쿠"처럼 도시 이름이 들어 있어도 같은 도시로 본다
export function popularCity(q: string): string | null {
  const t = q.normalize("NFC").trim().toLowerCase().replace(/\s+/g, " ");
  if (!t) return null;
  return POPULAR_STAY_CITIES.find((c) => c.names.some((n) => t === n || t.includes(n)))?.key ?? null;
}

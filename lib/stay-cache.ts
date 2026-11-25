// 숙소 검색·가격을 다시 쓰는 시간. 체크인이 7일 이내면 가격이 자주 바뀌어 60분, 그 밖에는 2시간.
// 서버 캐시(app/api/hotels)와 이 탭의 캐시(components/trip/api.ts)가 같이 쓴다
export const STAY_CACHE_NEAR_SEC = 60 * 60;
export const STAY_CACHE_SEC = 2 * 60 * 60;
const NEAR_DAYS = 7;

// checkIn: YYYY-MM-DD. 남은 날은 한국 날짜 기준
export function stayCacheSec(checkIn: string, now = Date.now()): number {
  const today = new Date(now + 9 * 3_600_000).toISOString().slice(0, 10);
  const days = (Date.parse(`${checkIn}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000;
  return Number.isFinite(days) && days > NEAR_DAYS ? STAY_CACHE_SEC : STAY_CACHE_NEAR_SEC;
}

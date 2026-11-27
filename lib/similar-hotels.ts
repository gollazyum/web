// 숙소 상세 맨 아래 '비슷한 후보 숙소 3~5곳'. 이미 받은 검색 목록(같은 탭) 또는 검색에 나온 적 있는 숙소 목록(hotels_master)에서만 고른다.
// 유료 검색·가격 조회 0회. 거리(5km 안)·성급·평점·가격대가 가까운 순
export type SimCand = { token: string; gps: [number, number] | null; stars: number | null; rating: number | null; reviews: number | null; price: number | null };

export const SIM_MAX = 5;
export const SIM_MIN = 3;
const MAX_KM = 5;

export function distKm(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLng = ((b[1] - a[1]) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a[0] * Math.PI) / 180) * Math.cos((b[0] * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function pickSimilar<T extends SimCand>(me: SimCand, pool: T[], n = SIM_MAX): T[] {
  const scored = pool
    .filter((c) => c.token !== me.token)
    .map((c) => {
      const d = me.gps && c.gps ? distKm(me.gps, c.gps) : null;
      if (d !== null && d > MAX_KM) return null;
      let score = 0;
      score += d === null ? -1.5 : -d * 0.6; // 가까울수록
      if (me.stars && c.stars) score -= Math.abs(me.stars - c.stars) * 0.8;
      score += ((c.rating ?? 3.8) - 3.8) * 1.5;
      score += Math.min(Math.log10((c.reviews ?? 0) + 1), 4) * 0.15;
      if (me.price && c.price) score -= Math.min(Math.abs(c.price - me.price) / me.price, 1) * 1.5;
      return { c, score };
    })
    .filter((x): x is { c: T; score: number } => !!x)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, n).map((x) => x.c);
}

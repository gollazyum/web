// 홈 도시 카드 "2박 총액 ○원부터" 계산 (app/api/home/cities)
export type CityRow = { place: string | null; total_krw: number | null; recorded_at: string };
export type CityLow = { place: string; from: number; pct: number | null };

export function cityLows(recent: CityRow[], lastWeek: CityRow[], places: string[]): CityLow[] {
  const min = (rows: CityRow[], place: string) => {
    const v = rows.filter((r) => r.place === place && typeof r.total_krw === "number" && r.total_krw > 0).map((r) => r.total_krw as number);
    return v.length ? Math.min(...v) : null;
  };
  return places.flatMap((place) => {
    const from = min(recent, place);
    if (from === null) return [];
    const prev = min(lastWeek, place);
    const pct = prev && prev > from ? Math.round(((prev - from) / prev) * 100) : null;
    return [{ place, from, pct: pct && pct >= 1 ? pct : null }];
  });
}


// 홈 도시 카드 "2박 총액 ○원부터" 계산 (app/api/home/cities)
export type CityRow = { place: string | null; total_krw: number | null; recorded_at: string };
export type CityLow = { place: string; from: number; pct: number | null; at?: string };

export function cityLows(recent: CityRow[], lastWeek: CityRow[], places: string[]): CityLow[] {
  const valid = (rows: CityRow[], place: string) => rows.filter((r) => r.place === place && typeof r.total_krw === "number" && r.total_krw > 0);
  const min = (rows: CityRow[], place: string) => {
    const v = valid(rows, place).map((r) => r.total_krw as number);
    return v.length ? Math.min(...v) : null;
  };
  return places.flatMap((place) => {
    const from = min(recent, place);
    if (from === null) return [];
    const prev = min(lastWeek, place);
    const pct = prev && prev > from ? Math.round(((prev - from) / prev) * 100) : null;
    // 확인 시각: 그 최저 총액이 기록된 시각 (같은 금액이 여러 번이면 가장 최근)
    const at = valid(recent, place).filter((r) => r.total_krw === from).map((r) => r.recorded_at).sort().pop();
    return [{ place, from, pct: pct && pct >= 1 ? pct : null, ...(at ? { at } : {}) }];
  });
}


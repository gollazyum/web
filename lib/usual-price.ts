// 숙소 상세 '평소 가격과 비교'. 화면과 서버가 같이 쓰는 계산만 둔다 (외부 검색 호출 없음).
// 1) 같은 숙소·같은 성인 수의 가격 기록이 서로 다른 날짜로 HISTORY_MIN_DAYS일 이상이면 그 기록의 평균(체크인 평일/주말을 맞춰서)
// 2) 아니면 이번 검색 결과 안의 같은 성급 숙소 평균 (PEER_MIN곳 이상일 때만)
// 3) 둘 다 안 되면 보여 주지 않는다. 비교는 모두 '전체 숙박 총액' 기준이다

export const HISTORY_MIN_DAYS = 5;
export const PEER_MIN = 3;
export const SIMILAR_RATIO = 0.03; // 평균과 3% 안쪽이면 '비슷해요'

// 서버가 hotel_price_history 에서 읽는 한 줄 (필요한 칸만)
export type HistoryRow = { recorded_at: string; nights: number; total_krw: number | null; is_weekend: boolean };

export type HistoryStats = { days: number; avgNightly: number | null };

// 기록 → 1박 평균 (총액 ÷ 박 수). 하루에 기록이 여러 줄이면 그날 평균을 먼저 낸 뒤 날짜끼리 평균 (많이 찾은 날이 평균을 끌지 않게)
export function historyStats(rows: HistoryRow[], weekend: boolean): HistoryStats {
  const byDay = new Map<string, number[]>();
  for (const r of rows) {
    if (r.is_weekend !== weekend || !r.total_krw || r.total_krw <= 0 || !(r.nights >= 1)) continue;
    const v = r.total_krw / r.nights;
    const list = byDay.get(r.recorded_at) ?? [];
    list.push(v);
    byDay.set(r.recorded_at, list);
  }
  const days = byDay.size;
  if (!days) return { days: 0, avgNightly: null };
  const dayAvgs = [...byDay.values()].map((l) => l.reduce((a, b) => a + b, 0) / l.length);
  return { days, avgNightly: Math.round(dayAvgs.reduce((a, b) => a + b, 0) / days) };
}

export type UsualCompare = {
  basis: "history" | "peers";
  n: number; // 기록 일수 또는 비교한 숙소 수
  avg: number; // 평균 총액 (원, 이번 박 수 기준)
  current: number; // 지금 이 숙소 총액
  diff: number; // current - avg (음수면 평균보다 낮다)
  word: "low" | "same" | "high";
  estimated: boolean; // 견준 금액에 예약처 확인 전 예상 총액이 섞였는지 (동급 비교)
};

const wordOf = (current: number, avg: number): UsualCompare["word"] => (Math.abs(current - avg) <= avg * SIMILAR_RATIO ? "same" : current < avg ? "low" : "high");

export function fromHistory(stats: HistoryStats | null, current: number, nights: number): UsualCompare | null {
  if (!stats || stats.days < HISTORY_MIN_DAYS || !stats.avgNightly || !(current > 0) || !(nights >= 1)) return null;
  const avg = Math.round((stats.avgNightly * nights) / 100) * 100;
  return { basis: "history", n: stats.days, avg, current, diff: current - avg, word: wordOf(current, avg), estimated: false };
}

// 같은 성급 숙소들의 총액 (이 숙소 제외). 성급을 모르는 숙소는 '동급'이라고 말할 수 없어 견주지 않는다
export type Peer = { token: string; stars: number | null; total: number | null; verified: boolean };

export function fromPeers(self: { token: string; stars: number | null }, peers: Peer[], current: number): UsualCompare | null {
  if (!self.stars || !(current > 0)) return null;
  const cls = Math.round(self.stars);
  const same = peers.filter((p) => p.token !== self.token && p.stars && Math.round(p.stars) === cls && p.total && p.total > 0);
  if (same.length < PEER_MIN) return null;
  const avg = Math.round(same.reduce((a, p) => a + (p.total as number), 0) / same.length / 100) * 100;
  return { basis: "peers", n: same.length, avg, current, diff: current - avg, word: wordOf(current, avg), estimated: same.some((p) => !p.verified) };
}

// 서버 기록이 충분하면 그걸, 아니면 이번 검색 결과 동급 비교
export function usualCompare(stats: HistoryStats | null, self: { token: string; stars: number | null }, peers: Peer[], current: number, nights: number): UsualCompare | null {
  return fromHistory(stats, current, nights) ?? fromPeers(self, peers, current);
}

// 체크인이 금·토요일이면 '주말' (가격 기록과 같은 기준)
export const isWeekendStay = (checkIn: string) => {
  const d = new Date(`${checkIn}T00:00:00Z`).getUTCDay();
  return d === 5 || d === 6;
};

// ---------- 홈 '평소보다 낮은 숙소' ----------
// 최근 기록(recent)마다 같은 숙소의 지난 기록(history) 평균과 견준다. 기록이 HISTORY_MIN_DAYS일 이상이고
// 평균보다 LOW_MIN_RATIO 이상 낮은 곳만 고른다 (기록이 모자라면 아무것도 고르지 않는다. 할인율을 지어내지 않는다)
export const LOW_MIN_RATIO = 0.1;
export type RecentRow = HistoryRow & { property_token: string; hotel_name: string; place: string | null; stay_date: string };
export type HomeLow = { token: string; name: string; place: string; stayDate: string; nights: number; total: number; avg: number; pct: number; days: number; at?: string };

export function homeLows(recent: RecentRow[], history: (HistoryRow & { property_token: string })[], max = 6): HomeLow[] {
  const hist = new Map<string, HistoryRow[]>();
  for (const r of history) {
    const l = hist.get(r.property_token) ?? [];
    l.push(r);
    hist.set(r.property_token, l);
  }
  const best = new Map<string, HomeLow>();
  for (const r of recent) {
    if (!r.place || !r.total_krw || !(r.nights >= 1)) continue;
    const s = historyStats(hist.get(r.property_token) ?? [], r.is_weekend);
    if (s.days < HISTORY_MIN_DAYS || !s.avgNightly) continue;
    const avg = Math.round((s.avgNightly * r.nights) / 100) * 100;
    const pct = Math.floor(((avg - r.total_krw) / avg) * 100);
    if (pct < LOW_MIN_RATIO * 100) continue;
    const prev = best.get(r.property_token);
    if (prev && prev.pct >= pct) continue;
    best.set(r.property_token, { token: r.property_token, name: r.hotel_name, place: r.place, stayDate: r.stay_date, nights: r.nights, total: r.total_krw, avg, pct, days: s.days, at: r.recorded_at });
  }
  return [...best.values()].sort((a, b) => b.pct - a.pct).slice(0, max);
}

// 아낀 금액 (2026-11-27 기준 변경): 확인한 예약처 총액 중 두 번째로 싼 곳 − 가장 싼 곳.
// "두 번째로 싼 곳보다 ○원 저렴해요"로 목록·상세 위·홈 카드에 쓴다. 가장 비싼 곳과의 차이(maxGap)는 상세 비교표 아래 보조 정보로만.
// 세금 포함 총액(approx 아님)끼리만 견준다. 1박 요금 × 박수로 어림한 줄은 기준이 달라 뺀다.
// 확인한 곳이 1곳뿐이거나 1·2위 금액이 같으면(차이가 1,000원 아래도 반올림·환율 흔들림으로 보고) 보여 주지 않는다
export const MIN_SAVE = 1000;

export type SaveRow = { cost: number; approx?: boolean };
export type Savings = { amount: number; count: number; maxGap: number };

export function savingsOf(rows: SaveRow[]): Savings | null {
  const exact = rows.filter((r) => !r.approx && r.cost > 0);
  if (exact.length < 2) return null;
  // 1위(가장 낮은 줄)가 어림한 금액이면 기준이 섞이므로 보여 주지 않는다
  const first = rows.reduce((a, b) => (b.cost < a.cost ? b : a), rows[0]);
  if (first.approx) return null;
  const costs = exact.map((r) => r.cost).sort((a, b) => a - b);
  const amount = costs[1] - costs[0];
  const maxGap = costs[costs.length - 1] - costs[0];
  return amount >= MIN_SAVE ? { amount, count: exact.length, maxGap } : null;
}

// 가장 비싼 곳과의 차이 (상세 비교표 아래 보조 정보). 2위와의 차이가 없어도 보여 줄 수 있다
export function maxGapOf(rows: SaveRow[]): number | null {
  const exact = rows.filter((r) => !r.approx && r.cost > 0).map((r) => r.cost);
  if (exact.length < 2) return null;
  const gap = Math.max(...exact) - Math.min(...exact);
  return gap >= MIN_SAVE ? gap : null;
}

// 무료 취소 차액: 1위가 무료 취소가 아닐 때, 무료 취소 요금 중 가장 낮은 곳과의 차이
export function freeCancelGap<T extends { cost: number; freeCancel?: boolean }>(rows: T[]): { row: T; gap: number } | null {
  if (!rows.length || rows[0].freeCancel) return null;
  const fc = rows.find((r) => r.freeCancel);
  return fc ? { row: fc, gap: fc.cost - rows[0].cost } : null;
}

// 홈 검색 카드의 '최근 검색' 칩: 이 브라우저에만 최근 조건 5개를 둔다 (기록 지우기에서 tb- 키와 함께 지워진다)
import { cityKo, type FlightQuery, type StayQuery } from "./trip";

export type Recent = { kind: "stay"; q: StayQuery } | { kind: "flight"; q: FlightQuery };

const KEY = "tb-recent-v1";
const MAX = 5;

const idOf = (r: Recent) => (r.kind === "stay" ? `s:${cityKo(r.q.place)}` : `f:${r.q.from}-${r.q.to}`); // 같은 곳·같은 노선은 하나만 (가장 최근 것)

export function readRecent(kind: Recent["kind"]): Recent[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || "[]") as Recent[];
    if (!Array.isArray(list)) return [];
    // 예전에 "도쿄도"로 저장된 것도 "도쿄"로 보고 같은 도시는 하나만
    const seen = new Set<string>();
    return list
      .filter((r) => r && r.kind === kind && r.q)
      .map((r) => (r.kind === "stay" ? { ...r, q: { ...r.q, place: cityKo(r.q.place) } } : r))
      .filter((r) => !seen.has(idOf(r)) && !!seen.add(idOf(r)));
  } catch {
    return [];
  }
}

export function addRecent(r: Recent) {
  if (r.kind === "stay") r = { ...r, q: { ...r.q, place: cityKo(r.q.place) } };
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || "[]") as Recent[];
    const next = [r, ...(Array.isArray(list) ? list : []).filter((x) => x && idOf(x) !== idOf(r))].slice(0, MAX * 2);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* 저장할 수 없는 브라우저면 칩 없이 둔다 */
  }
}

// 칩 글자: "오사카 12.11–12.13", "인천 → 도쿄 12.11–12.14"
const md = (iso: string) => `${Number(iso.slice(5, 7))}.${Number(iso.slice(8, 10))}`;
const city = (label: string, code: string) => (label.replace(/\s*\([A-Z]{3}\)$/, "").replace(/ 모든 공항$/, "") || code);
export function recentLabel(r: Recent): string {
  if (r.kind === "stay") return `${r.q.place} ${md(r.q.checkIn)}–${md(r.q.checkOut)}`;
  return `${city(r.q.fromLabel, r.q.from)} → ${city(r.q.toLabel, r.q.to)} ${md(r.q.depart)}${r.q.ret ? `–${md(r.q.ret)}` : ""}`;
}

export { MAX as RECENT_MAX };

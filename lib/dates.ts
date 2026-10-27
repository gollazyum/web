// 날짜는 "2026-11-27" 같은 문자열로 주고받는다. 브라우저 현지 날짜 기준이라
// 한국 오전 9시 전에도 "오늘"이 어제로 잡히지 않는다

export function isoDate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function today(): string {
  return isoDate(new Date());
}

export function parseIso(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(s: string, days: number): string {
  const d = parseIso(s);
  d.setDate(d.getDate() + days);
  return isoDate(d);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseIso(b).getTime() - parseIso(a).getTime()) / 86_400_000);
}

const weekdays = ["일", "월", "화", "수", "목", "금", "토"];

// "11월 27일 (금)"
export function shortLabel(s: string): string {
  const d = parseIso(s);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${weekdays[d.getDay()]})`;
}

export { weekdays };

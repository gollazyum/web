// 홈 '최근 확인한 최저 가격': 홈에서 찾은 결과의 가장 낮은 금액을 이 브라우저에 2개까지 남긴다 (기록 지우기의 tb- 접두어로 함께 지워진다).
// 숙소는 예약처에서 확인한 총액만 (확인 전 예상 금액은 쓰지 않는다), 항공은 받은 항공편 금액.
// 누르면 같은 검색 주소를 연다. 같은 탭에서 30분 안이면 저장된 결과를 다시 쓰고 검색을 다시 하지 않는다
export type Snapshot = { kind: "stay" | "flight"; href: string; title: string; sub: string; low: number | null; at: number };

const KEY = "tb-snap-v1";
const MAX = 2;

export function readSnaps(): Snapshot[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || "[]") as Snapshot[];
    return Array.isArray(list) ? list.filter((x) => x && typeof x.href === "string" && x.href.startsWith("/?")).slice(0, MAX) : [];
  } catch {
    return [];
  }
}

// 같은 주소면 바꿔 넣고 맨 앞으로. 금액이 그대로면 저장하지 않는다 (바뀐 게 없으면 false)
export function writeSnap(s: Snapshot): boolean {
  const list = readSnaps();
  const old = list.find((x) => x.href === s.href);
  if (old && old.low === s.low && list[0]?.href === s.href) return false;
  const keep = old && s.low === null ? { ...s, low: old.low, at: old.at } : s;
  try {
    localStorage.setItem(KEY, JSON.stringify([keep, ...list.filter((x) => x.href !== s.href)].slice(0, MAX)));
  } catch {
    return false;
  }
  return true;
}

export function agoText(at: number, now = Date.now()): string {
  const m = Math.max(0, Math.round((now - at) / 60000));
  if (m < 1) return "방금 확인";
  if (m < 60) return `${m}분 전 확인`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}시간 전 확인`;
  return `${Math.round(h / 24)}일 전 확인`;
}

// AI 채팅이 이어받는 '방금 본 검색' (이 탭에서만). 채팅에 보고 있는 결과가 없을 때 이 조건을 AI에게 함께 보낸다
const ACTIVE = "tb-active-ctx";
export function saveActive(ctx: string) {
  try {
    sessionStorage.setItem(ACTIVE, ctx.slice(0, 400));
  } catch {
    // 저장을 못 하면 이어받지 않는다
  }
}
export function readActive(): string {
  try {
    return sessionStorage.getItem(ACTIVE) ?? "";
  } catch {
    return "";
  }
}

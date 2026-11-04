// 쇼핑 최근 검색어 (이 기기에만 저장). 최대 8개, 하나씩 또는 전부 지울 수 있다
export const RECENT_KEY = "gollazyum:shop-recent";
export const MAX_RECENT = 8;
// 검색창을 눌렀을 때 함께 보여 주는 예시 (실제로 결과가 나오는 상품 이름)
export const EXAMPLE_QUERIES = ["에어팟 프로 2", "캐리어 24인치", "보조배터리", "여행 파우치"] as const;

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function readRecent(): string[] {
  try {
    const v = JSON.parse(storage()?.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && !!x.trim()).slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

function write(list: string[]) {
  try {
    storage()?.setItem(RECENT_KEY, JSON.stringify(list.slice(0, MAX_RECENT)));
  } catch {
    /* 저장이 막힌 경우 */
  }
}

// 맨 앞에 넣고 같은 말은 하나만 (띄어쓰기·대소문자 무시)
export function addRecent(q: string): string[] {
  const t = q.trim().slice(0, 100);
  if (!t) return readRecent();
  const same = (a: string) => a.replace(/\s+/g, "").toLowerCase() === t.replace(/\s+/g, "").toLowerCase();
  const next = [t, ...readRecent().filter((x) => !same(x))].slice(0, MAX_RECENT);
  write(next);
  return next;
}

export function removeRecent(q: string): string[] {
  const next = readRecent().filter((x) => x !== q);
  write(next);
  return next;
}

export function clearRecent(): string[] {
  write([]);
  return [];
}

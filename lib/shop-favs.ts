// 쇼핑 찜(★). 상품 ID 단위로 저장한다 (예전에는 검색어 단위라 같은 검색어의 다른 상품까지 함께 켜졌다)
export const FAV_KEY = "gollazyum:shop-favs:v2";
// 검색어 단위로 저장하던 옛 키. 읽지 않고 지운다
export const OLD_FAV_KEY = "gollazyum:shop-favs";
export const MAX_FAVS = 100;

// 짧은 해시 (토큰은 2,000자가 넘기도 해서 그대로 저장하지 않는다)
function hash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

// 상품 ID: product_id가 있으면 "p:<id>", 없으면 토큰 해시 "t:<hash>". 둘 다 없으면 빈 값 (찜 불가)
export function favId(pid: string, token: string): string {
  if (pid) return `p:${pid}`;
  if (token) return `t:${hash(token)}`;
  return "";
}

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function readFavIds(): string[] {
  const ls = storage();
  if (!ls) return [];
  try {
    ls.removeItem(OLD_FAV_KEY);
    const v = JSON.parse(ls.getItem(FAV_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export const isFav = (id: string) => !!id && readFavIds().includes(id);

// 켜져 있으면 끄고, 꺼져 있으면 켠다. 바뀐 뒤 상태를 돌려준다
export function toggleFavId(id: string): boolean {
  const list = readFavIds();
  const on = !list.includes(id);
  const next = on ? [id, ...list] : list.filter((x) => x !== id);
  try {
    storage()?.setItem(FAV_KEY, JSON.stringify(next.slice(0, MAX_FAVS)));
  } catch {
    /* 저장 공간이 막힌 경우 */
  }
  return on;
}

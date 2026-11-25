// 가격 핀 지도: 받은 숙소 목록만 거르고 핀 글자를 만든다 (검색·외부 호출 없음)

export type MapChips = { freeCancel: boolean; rating45: boolean; stars4: boolean; budget: number }; // budget: 총액 상한(원), 0이면 상관없음
export const EMPTY_CHIPS: MapChips = { freeCancel: false, rating45: false, stars4: false, budget: 0 };
export const MAP_BUDGETS = [200_000, 300_000, 500_000] as const;

export type PinItem = { token: string; gps: [number, number] | null; rating: number | null; stars: number | null; fc: boolean; price: number | null };

const okGps = (g: [number, number] | null): g is [number, number] => !!g && Number.isFinite(g[0]) && Number.isFinite(g[1]) && Math.abs(g[0]) <= 85 && Math.abs(g[1]) <= 180 && !(g[0] === 0 && g[1] === 0);

// 좌표가 있는 숙소만 + 칩 조건. 예산 상한을 고르면 금액을 모르는 숙소는 빠진다
export function filterPins<T extends PinItem>(list: T[], c: MapChips): T[] {
  return list.filter(
    (h) =>
      okGps(h.gps) &&
      (!c.freeCancel || h.fc) &&
      (!c.rating45 || (h.rating ?? 0) >= 4.5) &&
      (!c.stars4 || (h.stars ?? 0) >= 4) &&
      (!c.budget || (h.price !== null && h.price <= c.budget)),
  );
}

// 핀 글자: 25.6만, 1만 원 아래는 8,900원, 100만 이상은 정수 만
export function pinText(price: number | null): string {
  if (price === null || !(price > 0)) return "가격 확인";
  if (price < 10_000) return `${price.toLocaleString("ko-KR")}원`;
  const man = price / 10_000;
  return `${man >= 100 ? Math.round(man) : Math.round(man * 10) / 10}만`;
}

// 가장 낮은 핀 (같은 금액이 둘 이상이면 표시하지 않는다)
export function lowestToken(list: PinItem[]): string | null {
  const priced = list.filter((h) => h.price !== null && h.price > 0);
  if (!priced.length) return null;
  const min = Math.min(...priced.map((h) => h.price as number));
  const hits = priced.filter((h) => h.price === min);
  return hits.length === 1 ? hits[0].token : null;
}

// 원 하나(반지름 m)를 다각형 좌표로 (지도에 점선 원을 그릴 때)
export function circleRing(lat: number, lng: number, meters: number, steps = 64): [number, number][] {
  const out: [number, number][] = [];
  const dLat = meters / 111_320;
  const dLng = meters / (111_320 * Math.cos((lat * Math.PI) / 180));
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * 2 * Math.PI;
    out.push([lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)]);
  }
  return out;
}

// WebGL을 쓸 수 있는지 (지도를 만들기 전에 확인)
export function webglOk(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

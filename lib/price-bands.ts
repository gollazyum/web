// 결과 위 '가격대' 칩 (1박 기준, 세금 포함 총액을 박 수로 나눈 값). 받은 목록 안에서만 거른다
export type PriceBand = { id: string; label: string; min: number; max: number };
export const PRICE_BANDS: PriceBand[] = [
  { id: "b1", label: "1박 10만 원 이하", min: 0, max: 100000 },
  { id: "b2", label: "1박 10~20만 원", min: 100000, max: 200000 },
  { id: "b3", label: "1박 20~30만 원", min: 200000, max: 300000 },
  { id: "b4", label: "1박 30만 원 이상", min: 300000, max: Infinity },
];

// cost: 숙박 전체 총액 (모르면 Infinity → 어느 칸에도 넣지 않는다). 경계값은 아래 칸
export function inBand(cost: number, nights: number, band: PriceBand): boolean {
  if (!Number.isFinite(cost) || nights < 1) return false;
  const per = cost / nights;
  return (band.min === 0 ? per >= 0 : per > band.min) && per <= band.max;
}

// P2: 요금 필터 1박/총액 전환. 거르는 기준은 같고(1박 금액) 보이는 글자만 바뀐다. 기본은 총액
export type PriceBasis = "total" | "night";
const man = (n: number) => `${Math.round(n / 10000).toLocaleString("ko-KR")}만`;
export function bandLabel(b: PriceBand, basis: PriceBasis, nights: number): string {
  if (basis === "night" || nights < 1) return b.label.replace("1박 ", "");
  if (b.min === 0) return `${man(b.max * nights)} 원 이하`;
  if (!Number.isFinite(b.max)) return `${man(b.min * nights)} 원 이상`;
  return `${man(b.min * nights)}~${man(b.max * nights)} 원`;
}

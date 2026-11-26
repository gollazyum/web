// 지도 의사결정 보조 (2026-11-26 PR 2/2). 외부 호출 없이 이미 받은 숙소 목록·좌표만으로 계산한다.
// - 동네별 평균 총액: 예약처에서 확인한 총액(허용 예약처 1위, 세금 포함)끼리만, 구역 안 2곳 이상일 때만
// - 선택 숙소 '동네 대비 가격' 한 줄
// - 주요 장소까지 예상 이동 시간 (직선거리 기반 대략값)
// - 가장 가까운 역까지 도보 분
import { haversine, type City, type Zone } from "@/data/neighborhoodVibes";

export const MIN_SAMPLE = 2;

// gps는 숙소 데이터 그대로 [lat, lng]. price는 확인한 총액이 아니면 null로 넘긴다 (예상 금액과 섞지 않는다)
export type PricedSpot = { token: string; gps: [number, number] | null; price: number | null };

const inZone = (z: Zone, gps: [number, number]) => haversine([gps[1], gps[0]], z.center) <= z.radiusMeters;
const avg = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);

// 구역 id → { 평균, 표본 수 } (표본 2곳 이상인 구역만)
export function zoneAverages(city: City | null, spots: PricedSpot[]): Map<string, { avg: number; n: number }> {
  const out = new Map<string, { avg: number; n: number }>();
  if (!city) return out;
  for (const z of city.zones) {
    const xs = spots.filter((s) => s.gps && s.price !== null && s.price > 0 && inZone(z, s.gps)).map((s) => s.price as number);
    if (xs.length >= MIN_SAMPLE) out.set(z.id, { avg: avg(xs), n: xs.length });
  }
  return out;
}

// 알약 라벨용 '평균 28만' (만 단위 반올림, 100만 이상은 정수)
export function manText(v: number): string {
  const man = v / 10_000;
  return `${man >= 100 ? Math.round(man) : Math.round(man * 10) / 10}만`;
}

const won = (v: number) => `${Math.round(v).toLocaleString("ko-KR")}원`;
const SAME_PCT = 0.03; // 평균과 3% 안이면 '비슷해요'

// 선택 숙소 한 줄 브리핑. 견줄 근거가 없으면 null (무리한 비교 문구를 만들지 않는다)
// - 구역 안: 그 구역 평균(2곳+)과 비교 → 낮아요 / 비슷해요 / 높아요
// - 모든 구역 밖: 색칠된 인기 구역(💰 실속 구역 제외) 안 숙소들 평균(2곳+)보다 쌀 때만 '약 N% 낮은 실속 위치'
export function priceBrief(city: City | null, pick: PricedSpot | null, spots: PricedSpot[]): string | null {
  if (!city || !pick?.gps || pick.price === null || !(pick.price > 0)) return null;
  const priced = spots.filter((s) => s.gps && s.price !== null && s.price > 0);
  const home = city.zones.filter((z) => inZone(z, pick.gps!)).sort((a, b) => haversine([pick.gps![1], pick.gps![0]], a.center) - haversine([pick.gps![1], pick.gps![0]], b.center))[0];
  if (home) {
    const xs = priced.filter((s) => inZone(home, s.gps!)).map((s) => s.price as number);
    if (xs.length < MIN_SAMPLE) return null;
    const a = avg(xs);
    const d = pick.price - a;
    if (Math.abs(d) <= a * SAME_PCT) return `이 동네 평균(${won(a)})과 비슷해요`;
    return d < 0 ? `이 동네 평균(${won(a)})보다 ${won(-d)} 낮아요` : `이 동네 평균(${won(a)})보다 ${won(d)} 높아요`;
  }
  const hot = city.zones.filter((z) => z.vibe !== "value");
  const xs = priced.filter((s) => hot.some((z) => inZone(z, s.gps!))).map((s) => s.price as number);
  if (xs.length < MIN_SAMPLE) return null;
  const a = avg(xs);
  const pct = Math.round(((a - pick.price) / a) * 100);
  if (pct < 1) return null;
  return `인기 번화가 평균(${won(a)})보다 약 ${pct}% 낮은 실속 위치예요`;
}

// 주요 장소까지 예상 이동 시간 (직선거리 km 기반 대략값, 길찾기 API 없음)
const round5 = (m: number) => Math.max(5, Math.round(m / 5) * 5);
export function travelText(name: string, d: number): { time: string; sub: string } {
  if (/공항/.test(name)) return { time: `공항 약 ${round5(((d * 1.25) / 42) * 60 + 12)}분`, sub: `직선 ${d.toFixed(1)}km` };
  if (d <= 1.2) return { time: `도보 약 ${Math.max(2, Math.round(((d * 1.25) / 4.8) * 60))}분`, sub: `${Math.round(d * 1000)}m` };
  return { time: `약 ${round5(((d * 1.3) / 26) * 60 + 7)}분`, sub: `직선 ${d.toFixed(1)}km` };
}
export const TRAVEL_NOTE = "직선거리 기반 대중교통·도보 대략 시간이에요. 환승이나 교통 상황에 따라 달라질 수 있어요.";

// 가장 가까운 역까지 도보 분 (직선거리 m × 1.25 ÷ 분당 80m)
export const walkMin = (m: number) => Math.max(1, Math.round((m * 1.25) / 80));
export const STATION_MAX_M = 1200;

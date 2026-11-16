import type { HotelOption } from "@/lib/hotels";
import { nightsOf, stayTotal, type StayQuery } from "@/lib/trip";
import type { ShownPrice } from "./prices";

// 가벼운 가격 알림: 숙소를 담을 때 보이던 금액을 이 기기에 같이 적어 두고,
// 같은 날짜·인원으로 다시 볼 때 지금 금액과 견준다. 로그인·예약 확인·추가 검색 없이, 화면에 이미 받은 값만 쓴다.
// verified: 예약처 1위 총액(세금 포함)이었는지. 예상 총액과 확인 총액은 기준이 달라 서로 견주지 않는다
export type SavedBase = { price: number | null; verified: boolean; at: number };
export type SavedLike = { hotel: HotelOption; query: StayQuery; base?: SavedBase };

// 이 정도 아래 차이는 반올림·환율 흔들림으로 보고 알리지 않는다
export const MIN_DIFF = 1000;

// 예전에 담아 둔 숙소(금액 기록이 없던 때)는 담을 때 받은 목록 값(예상 총액)을 기준으로 쓴다
export function baseOf(s: SavedLike): SavedBase {
  if (s.base) return s.base;
  return { price: stayTotal(s.hotel, nightsOf(s.query))?.value ?? null, verified: false, at: 0 };
}

const sameStay = (a: StayQuery, b: Pick<StayQuery, "checkIn" | "checkOut" | "adults">) => a.checkIn === b.checkIn && a.checkOut === b.checkOut && a.adults === b.adults;

// 담아 둔 목록을 화면 어디서나 찾아볼 수 있게 (TripApp이 목록이 바뀔 때마다 넣는다)
let list: SavedLike[] = [];
export function setSavedList(next: SavedLike[]) {
  list = next;
}

export function savedBaseFor(token: string, q: Pick<StayQuery, "checkIn" | "checkOut" | "adults">): SavedBase | undefined {
  const s = list.find((x) => x.hotel.token === token && sameStay(x.query, q));
  return s ? baseOf(s) : undefined;
}

// 지금 금액 - 담을 때 금액 (원). 견줄 수 없으면 null
export function priceChange(base: SavedBase | undefined, now: Pick<ShownPrice, "value" | "verified" | "none">): number | null {
  if (!base || base.price === null || now.none || now.value === null) return null;
  if (base.verified !== now.verified) return null;
  const diff = now.value - base.price;
  return Math.abs(diff) >= MIN_DIFF ? diff : null;
}

export function changeText(diff: number): string {
  const n = Math.abs(Math.round(diff)).toLocaleString("ko-KR");
  return diff < 0 ? `담을 때보다 ${n}원 내려갔어요` : `담을 때보다 ${n}원 올랐어요`;
}

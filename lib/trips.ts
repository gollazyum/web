import type { HotelOption } from "./hotels";
import type { StayQuery } from "./trip";

// 마이 탭: 담아 둔 숙소를 여행 단위로 묶는다 (이 기기에 저장된 것만, 만들어 낸 일정은 없다).
// 같은 도시(장소 첫 단어)에 날짜가 겹치면 한 여행으로 본다. "오사카 난바"와 "오사카"는 같은 여행
export type TripItem = { hotel: HotelOption; query: StayQuery };
export type Trip<T extends TripItem = TripItem> = { key: string; city: string; checkIn: string; checkOut: string; adults: number; items: T[]; past: boolean };

export const cityOfPlace = (place: string) => place.trim().split(/\s+/)[0] ?? place;

export function groupTrips<T extends TripItem>(saved: T[], today: string): Trip<T>[] {
  const trips: Trip<T>[] = [];
  for (const s of saved) {
    const city = cityOfPlace(s.query.place);
    const t = trips.find((x) => x.city === city && s.query.checkIn < x.checkOut && x.checkIn < s.query.checkOut);
    if (t) {
      t.items.push(s);
      if (s.query.checkIn < t.checkIn) t.checkIn = s.query.checkIn;
      if (s.query.checkOut > t.checkOut) t.checkOut = s.query.checkOut;
      t.adults = Math.max(t.adults, s.query.adults);
    } else trips.push({ key: "", city, checkIn: s.query.checkIn, checkOut: s.query.checkOut, adults: s.query.adults, items: [s], past: false });
  }
  for (const t of trips) {
    t.key = `${t.city}|${t.checkIn}`;
    t.past = t.checkOut < today;
  }
  // 다가오는 여행(가까운 순) 먼저, 지난 여행은 뒤에 (최근 순)
  return trips.sort((a, b) => (a.past !== b.past ? (a.past ? 1 : -1) : a.past ? b.checkIn.localeCompare(a.checkIn) : a.checkIn.localeCompare(b.checkIn)));
}

// 오늘부터 출발까지 남은 날 (0 = 오늘)
export function daysUntil(iso: string, today: string): number {
  return Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
}

// "빠진 건 없나요?" 항목. 숙소는 담은 숙소가 있으면 저절로 체크, 나머지는 직접 체크해 이 기기에 남긴다
export const TRIP_CHECKS = [
  { id: "flight", label: "항공편", hint: "같은 날짜로 항공편 찾기" },
  // eSIM·로밍, 공항 이동은 제휴 링크가 생기면 다시 넣는다 (2026-11-17 초록: 우선 빼 두기)
] as const;
export type TripCheckId = (typeof TRIP_CHECKS)[number]["id"];
export type TripChecks = Record<string, Partial<Record<TripCheckId, boolean>>>;
export const TRIP_CHECK_KEY = "tb-trip-check-v1";

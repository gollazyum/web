// AI 채팅 문장에서 숙소 검색에 꼭 필요한 것(도시·날짜·인원)을 화면 쪽에서 먼저 뽑는다.
// AI 응답에 도시가 빠졌거나 AI를 못 쓸 때 채우는 용도. 문장에 없는 값은 만들지 않는다 (월만 말하면 그 달 첫 금요일부터)
import { addDays, daysBetween } from "./dates";
import { HOME_PLACES } from "./home-places";

// 자주 찾는 도시 (홈 인기 여행지 + 그 밖의 아시아 도시). 긴 이름이 먼저 맞도록 길이순
const CITIES = [
  ...HOME_PLACES.map((p) => p.name),
  "교토", "나고야", "고베", "나라", "요코하마", "가고시마", "구마모토", "벳푸", "유후인", "하코네", "히로시마", "가나자와",
  "서울", "부산", "제주", "강릉", "경주", "여수", "속초",
  "홍콩", "마카오", "상하이", "베이징", "칭다오", "싱가포르", "쿠알라룸푸르", "코타키나발루", "세부", "보라카이", "마닐라",
  "나트랑", "냐짱", "푸꾸옥", "하노이", "호치민", "달랏", "치앙마이", "푸껫", "파타야", "발리", "괌", "사이판", "가오슝", "타이중",
].sort((a, b) => b.length - a.length);

export function placeIn(text: string): string {
  return CITIES.find((c) => text.includes(c)) ?? "";
}

const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

// "12월 5일", "12/5" → 그 날짜, "12월"만 → 그 달 첫 금요일 (지났으면 내년). "N박"이면 체크아웃, 없으면 빈 값
export function datesIn(text: string, today: string): { checkIn: string; checkOut: string } | null {
  const ty = Number(today.slice(0, 4));
  const day = text.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/) ?? text.match(/\b(\d{1,2})\/(\d{1,2})\b/);
  const month = day ? null : text.match(/(\d{1,2})\s*월/);
  let checkIn = "";
  if (day) {
    const m = Number(day[1]);
    const d = Number(day[2]);
    if (m < 1 || m > 12 || d < 1 || d > 31) return null;
    checkIn = iso(ty, m, d);
    if (checkIn < today) checkIn = iso(ty + 1, m, d);
  } else if (month) {
    const m = Number(month[1]);
    if (m < 1 || m > 12) return null;
    let y = ty;
    if (iso(y, m, 31) < today) y += 1;
    let first = iso(y, m, 1);
    while (new Date(`${first}T00:00:00Z`).getUTCDay() !== 5) first = addDays(first, 1);
    checkIn = first < today ? addDays(today, 7 - ((daysBetween(first, today) % 7) || 7)) : first; // 이번 달이면 오늘 이후 첫 금요일
  } else return null;
  const n = text.match(/(\d{1,2})\s*박/);
  const nights = n ? Math.min(30, Math.max(1, Number(n[1]))) : 0;
  return { checkIn, checkOut: nights ? addDays(checkIn, nights) : "" };
}

// "2명", "성인 3", "어른 둘", "둘이", "커플" → 인원. 모르면 0
export function adultsIn(text: string): number {
  const n = text.match(/(?:성인|어른)\s*(\d)|(\d)\s*명/);
  if (n) return Number(n[1] ?? n[2]);
  if (/커플|둘이|두\s*명|어른\s*둘/.test(text)) return 2;
  if (/혼자/.test(text)) return 1;
  return 0;
}

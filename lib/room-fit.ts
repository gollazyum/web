// 인원에 맞는 객실인지 (AI 추천 3곳 후보 거르기 · 2026-11-27 PR 3/3)
// 성인 2명 이상이면 캡슐·도미토리(침대 한 칸 단위)는 AI 추천에서 뺀다. 목록에는 그대로 남는다.
// 'Dormy Inn'(도미 인, 일반 호텔 체인)은 도미토리가 아니라서 \bdorm\b 로 단어 전체만 본다

type Like = { name: string; kind?: string; amenities?: string[] };

const SOLO = /capsule|캡슐|\bdorm(?:itory|itories|s)?\b|도미토리|다인실|혼성\s*\d*인실|\bbunk\b/i;

export function soloOnly(h: Like): boolean {
  return SOLO.test(h.name) || SOLO.test(h.kind ?? "");
}

// AI 추천 후보로 둘 수 있는지 (성인 1명이면 다 된다)
export function fitsParty(h: Like, adults: number): boolean {
  return adults < 2 || !soloOnly(h);
}

// 카드에 보여 줄 조건 한 줄: 이 인원으로 검색해 가격이 나온 숙소만 (가격이 없으면 객실 여부를 모른다)
export function partyFitText(adults: number, rooms = 1): string | null {
  if (adults < 2) return null;
  return rooms > 1 ? `${adults}인 · 객실 ${rooms}개 있음` : `${adults}인 객실 있음`;
}

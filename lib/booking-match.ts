// 예약 등록 숙소 이름 → hotels_master 검색어. PostgREST 필터를 깨는 글자(, ( ) * : 따옴표 등)는 빼고 2~60자만
export function matchTerm(raw: string): string | null {
  const t = raw
    .normalize("NFC")
    .replace(/[^\p{L}\p{N}\s&'-]/gu, " ")
    .replace(/'/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
  return t.length >= 2 ? t : null;
}

// 비교용으로 이름 다듬기 (공백·기호·대소문자 무시)
export const nameKey = (s: string) => s.normalize("NFC").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

// 같은 숙소로 볼 만큼 이름이 같은지: 다듬은 이름이 같거나, 한쪽이 다른 쪽을 통째로 품고 6자 이상
export function sameHotelName(a: string, b: string): boolean {
  const x = nameKey(a);
  const y = nameKey(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  return short.length >= 6 && long.includes(short);
}

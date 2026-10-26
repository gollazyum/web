// 아고다 링크 변환 설정. 링크 속 cid 값만 경로별로 바꿔 준다.

// 초록님 제휴 CID. 비어 있으면 추천 링크 카드는 숨긴다.
export const AFFILIATE_CID = "";

export type RouteGroup = "카드사" | "항공사" | "검색·지도" | "기타";

// 경로 이름과 CID. 확인된 목록만 넣는다.
export const routes: { name: string; group: RouteGroup; cid: string }[] = [];

export const groupOrder: RouteGroup[] = ["카드사", "항공사", "검색·지도", "기타"];

// 아고다 호텔 페이지 주소인지 확인하고 URL 객체로 돌려준다
export function parseAgodaUrl(input: string): URL | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  if (host !== "agoda.com" && !host.endsWith(".agoda.com")) return null;
  return url;
}

// 같은 호텔·날짜·인원을 유지한 채 cid만 바꾼 주소
export function withCid(url: URL, cid: string): string {
  const next = new URL(url.toString());
  next.searchParams.set("cid", cid);
  return next.toString();
}

// 주소의 /hotel-name/hotel/ 부분으로 호텔 이름을 짐작한다
export function hotelNameFromUrl(url: URL): string | null {
  const parts = url.pathname.split("/").filter(Boolean);
  const i = parts.indexOf("hotel");
  const slug = i > 0 ? parts[i - 1] : null;
  if (!slug || /^[a-z]{2}-[a-z]{2}$/.test(slug)) return null;
  return decodeURIComponent(slug)
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

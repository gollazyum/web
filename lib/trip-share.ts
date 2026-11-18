// 마이의 담아 둔 여행을 로그인 없이 다시 여는 공유 링크.
// 서버에 아무것도 저장하지 않고, 목적지·날짜·인원·숙소(이름·토큰·공유할 때 금액)를 주소(/my?trip=…)에 담는다
export type SharedHotel = { token: string; name: string; price: number | null; verified: boolean };
export type SharedTrip = { place: string; checkIn: string; checkOut: string; adults: number; hotels: SharedHotel[] };

const DATE = /^\d{4}-\d{2}-\d{2}$/;
export const SHARE_MAX_HOTELS = 10;

function toB64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64Url(s: string): string {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

// 짧은 키로 줄여 담는다: p 장소, i 체크인, o 체크아웃, a 인원, h [토큰, 이름, 금액, 확인 총액이면 1]
export function encodeTrip(t: SharedTrip): string {
  const h = t.hotels.slice(0, SHARE_MAX_HOTELS).map((x) => [x.token, x.name.slice(0, 80), x.price ?? 0, x.verified ? 1 : 0]);
  return toB64Url(JSON.stringify({ p: t.place.slice(0, 100), i: t.checkIn, o: t.checkOut, a: t.adults, h }));
}

// 모양이 틀린 링크는 null (화면에 아무것도 띄우지 않는다)
export function decodeTrip(code: string | null | undefined): SharedTrip | null {
  if (!code || code.length > 6000 || !/^[A-Za-z0-9_-]+$/.test(code)) return null;
  try {
    const d = JSON.parse(fromB64Url(code)) as { p?: unknown; i?: unknown; o?: unknown; a?: unknown; h?: unknown };
    const place = typeof d.p === "string" ? d.p.trim().slice(0, 100) : "";
    const checkIn = typeof d.i === "string" ? d.i : "";
    const checkOut = typeof d.o === "string" ? d.o : "";
    const adults = Number(d.a);
    if (!place || !DATE.test(checkIn) || !DATE.test(checkOut) || checkOut <= checkIn) return null;
    if (!Number.isInteger(adults) || adults < 1 || adults > 9) return null;
    if (!Array.isArray(d.h)) return null;
    const hotels: SharedHotel[] = [];
    for (const row of d.h.slice(0, SHARE_MAX_HOTELS)) {
      if (!Array.isArray(row)) continue;
      const [token, name, price, v] = row as unknown[];
      if (typeof token !== "string" || !token || token.length > 500 || typeof name !== "string" || !name.trim()) continue;
      const n = Number(price);
      hotels.push({ token, name: name.trim().slice(0, 80), price: Number.isFinite(n) && n > 0 ? Math.round(n) : null, verified: v === 1 });
    }
    return hotels.length ? { place, checkIn, checkOut, adults, hotels } : null;
  } catch {
    return null;
  }
}

export const sharePath = (t: SharedTrip) => `/my?trip=${encodeTrip(t)}`;

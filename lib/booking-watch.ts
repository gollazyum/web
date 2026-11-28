// 가격 지킴이 (예약한 숙소 가격 지켜보기) 규칙. 화면·서버·크론이 같이 쓴다. 시간은 모두 한국 시간(KST, UTC+9) 기준
import type { SellerRow } from "./hotels";

const H = 3_600_000;
const KST = 9 * H;
export const DEADLINE_GAP_MS = 6 * H; // 무료 취소 마감 6시간 전까지만 지켜본다
export const START_MIN_MS = 6 * H; // 지켜보기 끝까지 6시간도 안 남았으면 등록하지 않는다
export const FAR_DAYS = 30; // 체크인까지 이보다 멀면 3.5일에 한 번, 가까우면 하루 한 번
export const FAR_EVERY_MS = 84 * H;
export const NEAR_EVERY_MS = 24 * H;
// 가격 하락 알림 기준 금액 (원). 서버 환경변수 PRICE_DROP_ALERT_MIN_WON으로 바꿀 수 있다 (화면에는 목록 응답으로 같은 값을 보낸다)
export const ALERT_MIN_WON = 5000;
export function alertMinWon(): number {
  const n = Number(process.env.PRICE_DROP_ALERT_MIN_WON);
  return Number.isInteger(n) && n > 0 ? n : ALERT_MIN_WON;
}
export const DEVICE_MAX = 5; // 한 기기에서 함께 지켜보는 예약 수
// 하루 유료 가격 조회 상한은 lib/paid-usage.ts (dailyCap)
export const RECHECK_COOLDOWN_MS = 10 * 60_000;
export const CAP_MESSAGE = "오늘 확인 가능 횟수를 다 썼어요. 내일 다시 확인할게요";
export const LATE_MESSAGE = "무료취소 마감이 가까워 가격을 지켜보기 어려워요 (마감 6시간 전까지만 등록할 수 있어요)";

export function kstDate(now: number): string {
  return new Date(now + KST).toISOString().slice(0, 10);
}

// "2026-12-20T18:00" (한국 시간 입력값) → 시각(ms). 못 읽으면 null
export function kstLocalToMs(v: string): number | null {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(v);
  if (!m) return null;
  const t = Date.parse(`${m[1]}T${m[2]}:${m[3]}:00Z`) - KST;
  return Number.isFinite(t) ? t : null;
}

// 지켜보기 끝: 무료 취소 마감 6시간 전. 마감을 모르면 체크인 전날 18시(한국)
export function watchUntil(checkIn: string, freeCancelUntil: number | null): number {
  if (freeCancelUntil !== null) return freeCancelUntil - DEADLINE_GAP_MS;
  return Date.parse(`${checkIn}T18:00:00Z`) - KST - 24 * H;
}

export function tooLate(checkIn: string, until: number, now: number): boolean {
  return checkIn <= kstDate(now) || until - now < START_MIN_MS;
}

export function nextCheckAt(checkIn: string, now: number): number {
  const days = (Date.parse(`${checkIn}T00:00:00Z`) - Date.parse(`${kstDate(now)}T00:00:00Z`)) / (24 * H);
  return now + (days > FAR_DAYS ? FAR_EVERY_MS : NEAR_EVERY_MS);
}

// 알림: '이전 가격 − 현재 가격 ≥ 기준 금액'일 때만 (비율 조건 없음).
// 이전 가격 = 전에 알렸다면 그때 알린 가격, 아니면 예약한 가격
export function shouldAlert(booked: number, latest: number | null, lastAlerted: number | null, minWon = ALERT_MIN_WON): boolean {
  if (latest === null || latest <= 0) return false;
  const prev = lastAlerted ?? booked;
  return prev - latest >= minWon;
}

// 견줄 가격: 무료 취소로 확인된 요금 중 가장 낮은 것. 없으면 전체 최저 (무료 취소 여부 모름 → null)
export function bestForRefundable(rows: SellerRow[]): { price: number; vendor: string; freeCancel: true | null } | null {
  const fc = rows.filter((r) => r.freeCancel).sort((a, b) => a.cost - b.cost)[0];
  if (fc) return { price: Math.round(fc.cost), vendor: fc.key, freeCancel: true };
  const any = [...rows].sort((a, b) => a.cost - b.cost)[0];
  return any ? { price: Math.round(any.cost), vendor: any.key, freeCancel: null } : null;
}

// ---------- 등록 입력 검사 ----------
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DEVICE = /^[A-Za-z0-9-]{16,64}$/;
export type WatchInput = {
  device: string;
  token: string;
  name: string;
  place: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  bookedPrice: number;
  bookedVendor: string | null;
  freeCancelUntil: string | null; // "YYYY-MM-DDTHH:MM" 한국 시간
};

export const validDevice = (v: unknown): v is string => typeof v === "string" && DEVICE.test(v);

export function parseWatchInput(body: unknown): WatchInput | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const str = (v: unknown, max: number) => (typeof v === "string" && v.trim() && v.length <= max ? v.trim() : null);
  const device = validDevice(b.device) ? b.device : null;
  const token = str(b.token, 500);
  const name = str(b.name, 200);
  const place = str(b.place, 100) ?? "";
  const checkIn = typeof b.checkIn === "string" && DATE.test(b.checkIn) ? b.checkIn : null;
  const checkOut = typeof b.checkOut === "string" && DATE.test(b.checkOut) ? b.checkOut : null;
  const adults = Number.isInteger(b.adults) && (b.adults as number) >= 1 && (b.adults as number) <= 9 ? (b.adults as number) : null;
  const bookedPrice = Number.isInteger(b.bookedPrice) && (b.bookedPrice as number) >= 1000 && (b.bookedPrice as number) <= 100_000_000 ? (b.bookedPrice as number) : null;
  const bookedVendor = str(b.bookedVendor, 40);
  const fcu = b.freeCancelUntil == null || b.freeCancelUntil === "" ? null : typeof b.freeCancelUntil === "string" && kstLocalToMs(b.freeCancelUntil) !== null ? b.freeCancelUntil : undefined;
  if (!device || !token || !name || !checkIn || !checkOut || checkOut <= checkIn || adults === null || bookedPrice === null || fcu === undefined) return null;
  return { device, token, name, place, checkIn, checkOut, adults, bookedPrice, bookedVendor, freeCancelUntil: fcu };
}

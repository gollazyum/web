import { addDays, daysBetween } from "./dates";
import type { FlightQuery, StayQuery } from "./trip";

// 탭 주소와 홈 검색 주소.
// 홈 검색 결과는 주소에 조건을 담아(/?q=오사카&checkin=…) 그대로 공유하고, 뒤로 가기로 검색 화면에 돌아올 수 있다.
// 이름은 예전 /hotels, /flights 주소와 같게 둬서 옛 링크도 그대로 열린다
// 2026-11-25 4탭(돈 아끼는 예약에 집중): 홈 · AI 추천 · 내 여행 · 마이. 예전 /explore, /now 주소는 AI 추천(/chat)으로 보낸다
// hotel: 전용 숙소 상세 페이지 (/hotels/[propertyToken]). 아래 메뉴에는 없고, 상세를 보는 동안 메뉴는 아무것도 눌리지 않은 상태
export type Tab = "home" | "chat" | "trips" | "my" | "hotel";

export const TAB_PATH: Record<Tab, string> = { home: "/", chat: "/chat", trips: "/trips", my: "/my", hotel: "/hotels" };

export function tabOf(pathname: string): Tab {
  if (pathname.startsWith("/chat")) return "chat";
  if (pathname.startsWith("/trips")) return "trips";
  if (pathname.startsWith("/my")) return "my";
  if (pathname.startsWith("/hotels/")) return "hotel";
  return "home";
}

export function stayHref(q: StayQuery): string {
  const p = new URLSearchParams({ q: q.place, checkin: q.checkIn, checkout: q.checkOut, adults: String(q.adults) });
  if ((q.rooms ?? 1) > 1) p.set("rooms", String(q.rooms));
  if (q.childAges?.length) p.set("ages", q.childAges.join(","));
  if (q.budget > 0) p.set("budget", String(q.budget));
  if (q.taste) p.set("taste", q.taste);
  return `/?${p}`;
}

export function flightHref(q: FlightQuery): string {
  const p = new URLSearchParams({ from: q.from, to: q.to, depart: q.depart });
  if (q.ret) p.set("return", q.ret);
  p.set("adults", String(q.adults));
  if (q.children) p.set("children", String(q.children));
  if (q.cabin && q.cabin !== "y") p.set("cabin", q.cabin);
  if (q.taste) p.set("taste", q.taste);
  return `/?${p}`;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

// fixed: 날짜를 고친 이유. past 지난 날짜, order 오는 날이 가는 날보다 빠름(또는 같음), invalid 없는 날짜
export type DateFix = "past" | "order" | "invalid";
export type HomeSearch =
  | { kind: "stay"; query: StayQuery; fixed?: DateFix }
  | { kind: "flight"; query: Omit<FlightQuery, "fromLabel" | "toLabel">; fixed?: DateFix; same?: true }
  | null;

// 날짜를 고친 이유와 실제로 바꾼 날짜를 한 줄로 (검색 칸 아래에 보여 준다)
export function dateFixText(fix: DateFix, a: string, b?: string): string {
  const md = (x: string) => `${Number(x.slice(5, 7))}월 ${Number(x.slice(8, 10))}일`;
  const range = !b ? md(a) : a.slice(5, 7) === b.slice(5, 7) ? `${md(a)}–${Number(b.slice(8, 10))}일` : `${md(a)}–${md(b)}`;
  const why = fix === "past" ? "날짜가 지나서" : fix === "order" ? "오는 날이 가는 날보다 빨라서" : "주소의 날짜를 읽을 수 없어서";
  return `${why} ${range}로 바꿨어요`;
}

// 실제로 있는 날짜인지 (2026-02-30 같은 건 아니다)
const realDate = (s: string) => {
  if (!DATE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

// 주소의 검색 조건 읽기. 모양이 틀리면 null (그때는 빈 검색 화면)
// today를 주면 지났거나 틀린 날짜를 고쳐서 돌려준다 (fixed: 고친 이유). 출발·도착 공항이 같으면 same: true (검색하지 않고 안내)
export function parseHomeSearch(search: string, today?: string): HomeSearch {
  const sp = new URLSearchParams(search);
  const one = (k: string) => (sp.get(k) ?? "").trim();
  // P1-4 인원: 틀린 값은 버리고 기본값(객실 1, 아동·소아 0, 일반석)
  const rooms = Number(one("rooms") || 1);
  const roomsOk = Number.isInteger(rooms) && rooms >= 1 && rooms <= 9 && rooms > 1 ? { rooms } : {};
  const ages = one("ages") ? one("ages").split(",").map(Number) : [];
  const agesOk = ages.length && ages.length <= 6 && ages.every((a) => Number.isInteger(a) && a >= 0 && a <= 17) ? { childAges: ages } : {};
  const children = Number(one("children") || 0);
  const childOk = Number.isInteger(children) && children > 0 && children <= 8 ? { children } : {};
  const cabin = one("cabin");
  const cabinOk = cabin === "s" || cabin === "c" || cabin === "f" ? { cabin: cabin as "s" | "c" | "f" } : {};
  const taste = one("taste").slice(0, 200);
  if (sp.has("from") || sp.has("to")) {
    const from = one("from").toUpperCase();
    const to = one("to").toUpperCase();
    const depart = one("depart");
    const ret = one("return");
    const adults = Number(one("adults") || 1);
    if (!/^[A-Z]{3}$/.test(from) || !/^[A-Z]{3}$/.test(to)) return null;
    if (!Number.isInteger(adults) || adults < 1 || adults > 9) return null;
    if (from === to) {
      if (!today) return null;
      const d0 = realDate(depart) && depart >= today ? depart : "";
      const r0 = d0 && realDate(ret) && ret > d0 ? ret : "";
      return { kind: "flight", query: { from, to, depart: d0, ret: r0, adults, taste }, same: true };
    }
    if (!today) {
      if (!DATE.test(depart) || (ret && (!DATE.test(ret) || ret < depart))) return null;
      return { kind: "flight", query: { from, to, depart, ret, adults, taste, ...childOk, ...cabinOk } };
    }
    // P1-3: 지났거나 틀린 날짜는 도시는 그대로 두고 날짜만 고친다 (화면에 한 줄 알린다)
    let d = depart;
    let r = ret;
    let fixed: DateFix | undefined;
    if (!realDate(d) || d < today) {
      const gap = realDate(ret) && realDate(depart) && ret >= depart ? Math.min(daysBetween(depart, ret), 30) : 4;
      d = addDays(today, 21);
      r = ret ? addDays(d, gap) : "";
      fixed = realDate(depart) ? "past" : "invalid";
    } else if (ret && (!realDate(ret) || ret < d)) {
      r = addDays(d, 4);
      fixed = realDate(ret) ? "order" : "invalid";
    }
    return { kind: "flight", query: { from, to, depart: d, ret: r, adults, taste, ...childOk, ...cabinOk }, ...(fixed ? { fixed } : {}) };
  }
  const place = one("q");
  const checkIn = one("checkin");
  const checkOut = one("checkout");
  const adults = Number(one("adults") || 2);
  const budget = Number(one("budget") || 0);
  if (!place || place.length > 100) return null;
  if (!Number.isInteger(adults) || adults < 1 || adults > 9) return null;
  const b = Number.isFinite(budget) && budget > 0 ? Math.floor(budget) : 0;
  if (!today) {
    if (!DATE.test(checkIn) || !DATE.test(checkOut) || checkOut <= checkIn) return null;
    return { kind: "stay", query: { place, checkIn, checkOut, adults, budget: b, taste, ...roomsOk, ...agesOk } };
  }
  let ci = checkIn;
  let co = checkOut;
  let fixed: DateFix | undefined;
  if (!realDate(ci) || ci < today) {
    const n = realDate(checkIn) && realDate(checkOut) && checkOut > checkIn ? Math.min(daysBetween(checkIn, checkOut), 30) : 2;
    ci = addDays(today, 21);
    co = addDays(ci, n);
    fixed = realDate(checkIn) ? "past" : "invalid";
  } else if (!realDate(co) || co <= ci) {
    co = addDays(ci, 2);
    fixed = realDate(checkOut) ? "order" : "invalid";
  }
  return { kind: "stay", query: { place, checkIn: ci, checkOut: co, adults, budget: b, taste, ...roomsOk, ...agesOk }, ...(fixed ? { fixed } : {}) };
}

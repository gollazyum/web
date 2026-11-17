import { addDays, daysBetween } from "./dates";
import type { FlightQuery, StayQuery } from "./trip";

// 탭 주소와 홈 검색 주소.
// 홈 검색 결과는 주소에 조건을 담아(/?q=오사카&checkin=…) 그대로 공유하고, 뒤로 가기로 검색 화면에 돌아올 수 있다.
// 이름은 예전 /hotels, /flights 주소와 같게 둬서 옛 링크도 그대로 열린다
export type Tab = "home" | "chat" | "now" | "my";

export const TAB_PATH: Record<Tab, string> = { home: "/", chat: "/chat", now: "/now", my: "/my" };

export function tabOf(pathname: string): Tab {
  if (pathname.startsWith("/chat")) return "chat";
  if (pathname.startsWith("/now")) return "now";
  if (pathname.startsWith("/my")) return "my";
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

export type HomeSearch =
  | { kind: "stay"; query: StayQuery; fixed?: boolean }
  | { kind: "flight"; query: Omit<FlightQuery, "fromLabel" | "toLabel">; fixed?: boolean }
  | null;

// 실제로 있는 날짜인지 (2026-02-30 같은 건 아니다)
const realDate = (s: string) => {
  if (!DATE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

// 주소의 검색 조건 읽기. 모양이 틀리면 null (그때는 빈 검색 화면)
// today를 주면 지났거나 틀린 날짜를 고쳐서 돌려준다 (fixed: true)
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
    if (!/^[A-Z]{3}$/.test(from) || !/^[A-Z]{3}$/.test(to) || from === to) return null;
    if (!Number.isInteger(adults) || adults < 1 || adults > 9) return null;
    if (!today) {
      if (!DATE.test(depart) || (ret && (!DATE.test(ret) || ret < depart))) return null;
      return { kind: "flight", query: { from, to, depart, ret, adults, taste, ...childOk, ...cabinOk } };
    }
    // P1-3: 지났거나 틀린 날짜는 도시는 그대로 두고 날짜만 고친다 (화면에 한 줄 알린다)
    let d = depart;
    let r = ret;
    let fixed = false;
    if (!realDate(d) || d < today) {
      const gap = realDate(ret) && realDate(depart) && ret >= depart ? Math.min(daysBetween(depart, ret), 30) : 4;
      d = addDays(today, 21);
      r = ret ? addDays(d, gap) : "";
      fixed = true;
    } else if (ret && (!realDate(ret) || ret < d)) {
      r = addDays(d, 4);
      fixed = true;
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
  let fixed = false;
  if (!realDate(ci) || ci < today) {
    const n = realDate(checkIn) && realDate(checkOut) && checkOut > checkIn ? Math.min(daysBetween(checkIn, checkOut), 30) : 2;
    ci = addDays(today, 21);
    co = addDays(ci, n);
    fixed = true;
  } else if (!realDate(co) || co <= ci) {
    co = addDays(ci, 2);
    fixed = true;
  }
  return { kind: "stay", query: { place, checkIn: ci, checkOut: co, adults, budget: b, taste, ...roomsOk, ...agesOk }, ...(fixed ? { fixed } : {}) };
}

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
  if (q.budget > 0) p.set("budget", String(q.budget));
  if (q.taste) p.set("taste", q.taste);
  return `/?${p}`;
}

export function flightHref(q: FlightQuery): string {
  const p = new URLSearchParams({ from: q.from, to: q.to, depart: q.depart });
  if (q.ret) p.set("return", q.ret);
  p.set("adults", String(q.adults));
  if (q.taste) p.set("taste", q.taste);
  return `/?${p}`;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export type HomeSearch =
  | { kind: "stay"; query: StayQuery }
  | { kind: "flight"; query: Omit<FlightQuery, "fromLabel" | "toLabel"> }
  | null;

// 주소의 검색 조건 읽기. 모양이 틀리면 null (그때는 빈 검색 화면)
export function parseHomeSearch(search: string): HomeSearch {
  const sp = new URLSearchParams(search);
  const one = (k: string) => (sp.get(k) ?? "").trim();
  const taste = one("taste").slice(0, 200);
  if (sp.has("from") || sp.has("to")) {
    const from = one("from").toUpperCase();
    const to = one("to").toUpperCase();
    const depart = one("depart");
    const ret = one("return");
    const adults = Number(one("adults") || 1);
    if (!/^[A-Z]{3}$/.test(from) || !/^[A-Z]{3}$/.test(to) || from === to || !DATE.test(depart)) return null;
    if (ret && (!DATE.test(ret) || ret < depart)) return null;
    if (!Number.isInteger(adults) || adults < 1 || adults > 9) return null;
    return { kind: "flight", query: { from, to, depart, ret, adults, taste } };
  }
  const place = one("q");
  const checkIn = one("checkin");
  const checkOut = one("checkout");
  const adults = Number(one("adults") || 2);
  const budget = Number(one("budget") || 0);
  if (!place || place.length > 100 || !DATE.test(checkIn) || !DATE.test(checkOut) || checkOut <= checkIn) return null;
  if (!Number.isInteger(adults) || adults < 1 || adults > 9) return null;
  return { kind: "stay", query: { place, checkIn, checkOut, adults, budget: Number.isFinite(budget) && budget > 0 ? Math.floor(budget) : 0, taste } };
}

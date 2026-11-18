"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { labelForCode, loadAirports, searchCities, searchPlaces } from "@/lib/airports";
import { unknownPlace } from "@/lib/place-check";
import { brand, BRAND_AI_NAME, BRAND_NAME } from "@/lib/brand";
import { today as localToday } from "@/lib/dates";
import { HOTEL_SELLERS_SHOWN, sellerDef, sellerSearchUrl } from "@/lib/hotel-sellers";
import type { HotelOption } from "@/lib/hotels";
import { criteriaWeights, EMPTY_PROFILE, profileLines, readSaved, TASTE_KEY, withProfile, type TasteProfile, type TasteSaved, type TasteStatus } from "@/lib/taste";
import { site } from "@/lib/site";
import { HOME_HERO_PHOTO, HOME_PLACES, photoUrl } from "@/lib/home-places";
import { HOME_FAQ, HOME_TRUST } from "@/lib/home-info";
import type { FlightOption } from "@/lib/flights";
import { searchErrorMessage, SEARCH_RETRY_LABEL } from "@/lib/search-error";
import { dateFixText, flightHref, parseHomeSearch, stayHref, TAB_PATH, tabOf, type Tab } from "@/lib/trip-url";
import {
  fallbackFlightPicks,
  fallbackStayPicks,
  FLIGHT_REFINES,
  flightFactReason,
  flightReady,
  guestText,
  paxOf,
  paxText,
  mergePicks,
  nightsOf,
  refineFlights,
  refineStays,
  STAY_REFINES,
  stayFactReason,
  isPlainReason,
  stayReady,
  withinBudget,
  won,
  type AskOption,
  type AskQuestion,
  type FlightQuery,
  type FlightRefineId,
  type StayRefineId,
  type StayQuery,
} from "@/lib/trip";
import { parseText, pickFlights, pickStays, searchFlights, searchStays, searchStaysPage } from "./api";
import { FlightBrowser, FlightCard, flightLink } from "./Flights";
import { FlightSheet, StaySheet } from "./InputSheets";
import { SearchCard, type SearchCardHandle, type SearchKind } from "./SearchCard";
import { SellerBody, SellerSheet } from "./SellerSheet";
import { Sheet } from "./Sheet";
import { Onboarding } from "./Onboarding";
import { SharedTripView } from "./TripRecheck";
import { PhotoStrip, PriceBlock, RankLines, StayList, StayRow, type StayPick } from "./StayList";
import { rankNotes, stayFactLine, type RankNote } from "@/lib/stay-facts";
import { getVerified, prefetchPrices, shownPrice, useLazyPrice, usePriceVersion } from "./prices";
import { setSavedList, type SavedBase } from "./saved-price";
import { MyTrips } from "./MyTrips";
import { ClearHistory } from "./ClearHistory";
import type { Trip } from "@/lib/trips";
import { IconBack, IconBed, IconChatStar, IconClose, IconHeart, IconHome, IconOut, IconPlane, IconPlus, IconSpark, IconUp, IconUser } from "./icons";

type Status = "loading" | "done" | "error";

type Msg =
  | { id: string; t: "user"; text: string }
  | { id: string; t: "ai"; text: string }
  | {
      id: string;
      t: "ask";
      kind: "stay" | "flight";
      reply: string;
      stay: Partial<StayQuery>;
      flight: Partial<FlightQuery>;
      questions: AskQuestion[];
      answers: Record<number, AskOption>;
      done: boolean;
    }
  // home: 홈 검색 카드에서 찾은 결과 (대화에는 보이지 않는다). aiPending: 규칙으로 먼저 보여 주고 AI 결과를 기다리는 중
  // next·pages·more: 스크롤 끝에서 다음 쪽 더 불러오기 (next가 없으면 끝)
  | { id: string; t: "stay"; home?: boolean; query: StayQuery; status: Status; err?: number | null; options?: HotelOption[]; picks?: StayPick[]; aiPending?: boolean; note?: string; unknown?: boolean; next?: string | null; pages?: number; more?: "loading" | "error"; cls?: string; base?: { options: HotelOption[]; next: string | null; pages: number } }
  | { id: string; t: "flight"; home?: boolean; query: FlightQuery; status: Status; err?: number | null; options?: FlightOption[]; picks?: { n: number; reason: string }[]; aiPending?: boolean; note?: string };

type StayMsg = Extract<Msg, { t: "stay" }>;
type FlightMsg = Extract<Msg, { t: "flight" }>;
type AskMsg = Extract<Msg, { t: "ask" }>;
type Saved = { hotel: HotelOption; query: StayQuery; base?: SavedBase }; // base: 담을 때 보이던 금액 (가격 알림용)

const uid = () => Math.random().toString(36).slice(2, 10);
const SAVED_KEY = "tb-saved-v1";
const UPGRADE_MS = 30 * 60 * 1000;
const MORE_PAGES = 5; // 스크롤로 더 불러오는 쪽 수 상한 (검색 한 번당 최대 5번 더, 약 100곳)
const EXAMPLES = ["부모님이랑 조용한 온천 숙소", "12월 오사카 2박, 역 가까운 곳", "인천에서 다낭 왕복, 오전 출발 직항"];

const md = (iso: string) => `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`;
const DOW = ["일", "월", "화", "수", "목", "금", "토"];
const mdw = (iso: string) => `${md(iso)}(${DOW[new Date(`${iso}T00:00:00`).getDay()]})`;

// PC(1024px 이상)에서는 결과 옆에 예약처 패널을 고정해 둔다
function useWide() {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const on = () => setWide(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return wide;
}

// 취향 설문 결과. 끝까지 답했거나(done) '나중에 하기'를 눌렀으면(skipped) 다시 묻지 않는다.
// need: 저장값을 다 읽었는데 아무 기록이 없을 때만 true → AI 채팅에 처음 들어갈 때 설문을 띄운다
function useTaste() {
  const [state, setState] = useState<{ loaded: boolean; saved: TasteSaved | null }>({ loaded: false, saved: null });
  useEffect(() => {
    let saved: TasteSaved | null = null;
    try {
      saved = readSaved(localStorage.getItem(TASTE_KEY));
    } catch {
      saved = { profile: EMPTY_PROFILE, status: "skipped" }; // 저장소를 못 쓰면 매번 묻지 않는다
    }
    setState({ loaded: true, saved });
  }, []);
  const set = useCallback((profile: TasteProfile, status: TasteStatus) => {
    const saved = { profile, status };
    try {
      localStorage.setItem(TASTE_KEY, JSON.stringify(saved));
    } catch {
      // 저장 실패는 조용히 넘긴다
    }
    setState({ loaded: true, saved });
  }, []);
  return { profile: state.saved?.profile ?? null, need: state.loaded && !state.saved, set };
}

function useSaved() {
  const [saved, setSaved] = useState<Saved[]>([]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SAVED_KEY);
      if (raw) setSaved(JSON.parse(raw) as Saved[]);
    } catch {
      // 저장소를 못 쓰면 빈 목록으로 둔다
    }
  }, []);
  const write = (next: Saved[]) => {
    try {
      localStorage.setItem(SAVED_KEY, JSON.stringify(next));
    } catch {
      // 저장 실패는 조용히 넘긴다
    }
    return next;
  };
  const toggle = useCallback((hotel: HotelOption, query: StayQuery, base?: SavedBase) => {
    setSaved((list) => write(list.some((s) => s.hotel.token === hotel.token) ? list.filter((s) => s.hotel.token !== hotel.token) : [{ hotel, query, base }, ...list].slice(0, 50)));
  }, []);
  // 예상 총액으로 담은 직후(30분 안)에 같은 조건의 예약처 1위 총액을 받으면, 담을 때 금액을 그 확인 총액으로 바꿔 둔다.
  // 그래야 나중에 상세에서 확인 총액끼리 견줄 수 있다
  const upgrade = useCallback(() => {
    setSaved((list) => {
      let changed = false;
      const next = list.map((s) => {
        if (!s.base || s.base.verified || Date.now() - s.base.at > UPGRADE_MS) return s;
        const v = getVerified(s.hotel.token, s.query);
        if (!v || v.total === null) return s;
        changed = true;
        return { ...s, base: { price: v.total, verified: true, at: s.base.at } };
      });
      return changed ? write(next) : list;
    });
  }, []);
  return { saved, toggle, upgrade };
}

function contextOf(m: Msg | undefined): string {
  if (!m) return "";
  if (m.t === "stay") {
    const q = m.query;
    return `숙소 · 장소 ${q.place} · ${q.checkIn}~${q.checkOut} · ${guestText(q)}${q.budget ? ` · 총액 예산 ${q.budget}원` : ""}${q.taste ? ` · 취향 ${q.taste}` : ""}`;
  }
  if (m.t === "flight") {
    const q = m.query;
    return `항공 · ${q.from}(${q.fromLabel})→${q.to}(${q.toLabel}) · ${q.depart}${q.ret ? `~${q.ret}` : " 편도"} · ${paxText(q)}${q.taste ? ` · 취향 ${q.taste}` : ""}`;
  }
  return "";
}

function joinTaste(a: string, b: string): string {
  if (!a) return b;
  if (!b || a.includes(b)) return a;
  return `${a}, ${b}`.slice(0, 200);
}

// 홈 결과 하나의 주소 (공유·뒤로 가기용)
const homeHrefOf = (m: { t: "stay"; query: StayQuery } | { t: "flight"; query: FlightQuery }) => (m.t === "stay" ? stayHref(m.query) : flightHref(m.query));

const cityOf = (label: string) => label.replace(/\s*\([A-Z]{3}\)\s*$/, "");

// AI 표시: 유리 구슬 (v7)
// calm: AI 채팅 첫 화면처럼 크게 보일 때 움직임을 줄인다 (P2)
const Orb = ({ size = 32, calm }: { size?: number; calm?: boolean }) => <span className={calm ? "tb-orb calm" : "tb-orb"} style={{ width: size, height: size }} aria-hidden />;

export function TripApp() {
  // 탭은 주소가 정한다 (/ 홈, /chat AI 채팅, /now 지금, /my 마이). 뒤로 가기·새로 고침·공유가 그대로 된다
  const pathname = usePathname();
  const router = useRouter();
  const tab = tabOf(pathname);
  // 홈 주소 뒤의 검색 조건 (?q=…). 홈에서 찾으면 주소에 담고, 뒤로 가기로 빼면 검색 화면으로 돌아간다
  const [search, setSearch] = useState("");
  const setTab = useCallback(
    (t: Exclude<Tab, "home">) => {
      if (tabOf(window.location.pathname) !== t) router.push(TAB_PATH[t], { scroll: false });
    },
    [router],
  );
  // 홈으로 (href: "/" 또는 검색 조건이 붙은 홈 주소). 이미 홈이면 화면을 다시 받지 않고 주소만 바꾼다
  const goHome = useCallback(
    (href: string) => {
      if (window.location.pathname !== "/") return router.push(href, { scroll: false });
      if (window.location.pathname + window.location.search === href) return;
      window.history.pushState(null, "", href);
      setSearch(new URL(href, window.location.origin).search);
    },
    [router],
  );
  const [kind, setKind] = useState<SearchKind>("stay");
  const [prefStay, setPrefStay] = useState<Partial<StayQuery>>({});
  const [prefFlight, setPrefFlight] = useState<Partial<FlightQuery>>({});
  const [homeId, setHomeId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  const [staySheet, setStaySheet] = useState<Partial<StayQuery> | null>(null);
  const [flightSheet, setFlightSheet] = useState<Partial<FlightQuery> | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const wide = useWide();
  const taste = useTaste();
  const [onb, setOnb] = useState(false);
  const profileRef = useRef<TasteProfile | null>(null);
  profileRef.current = taste.profile;
  const [seller, setSeller] = useState<{ hotel: HotelOption; query: StayQuery } | null>(null);
  const [toast, setToast] = useState<{ text: string; go?: boolean } | null>(null);
  // 주소의 날짜를 고쳤을 때 결과의 검색 칸 아래 한 줄 (그 검색 주소에서만)
  const [dateFix, setDateFix] = useState<{ href: string; text: string } | null>(null);
  const [listId, setListId] = useState<string | null>(null); // AI 채팅: 전체 목록 바텀시트
  const { saved, toggle, upgrade } = useSaved();
  setSavedList(saved); // 카드·상세가 담을 때 금액을 찾아볼 수 있게
  const priceVersion = usePriceVersion();
  useEffect(() => {
    if (saved.some((s) => s.base && !s.base.verified)) upgrade();
  }, [priceVersion, saved, upgrade]);
  const savedSet = new Set(saved.map((s) => s.hotel.token));
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<SearchCardHandle>(null);
  const msgsRef = useRef(msgs);
  msgsRef.current = msgs;
  const clsRef = useRef(new Map<string, string>()); // 결과별 지금 고른 성급 (응답이 늦게 와도 바로 비교하려고)

  const patch = useCallback((id: string, p: Partial<Msg>) => setMsgs((list) => list.map((m) => (m.id === id ? ({ ...m, ...p } as Msg) : m))), []);
  const push = useCallback((m: Msg) => setMsgs((list) => [...list, m]), []);

  // 다른 페이지 메뉴에서 /?tab=stay, /?tab=flight 로 오면 그 검색 탭을 연다
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t === "flight") setKind("flight");
  }, []);
  useEffect(() => {
    const on = () => setSearch(window.location.pathname === "/" ? window.location.search : "");
    on();
    window.addEventListener("popstate", on);
    return () => window.removeEventListener("popstate", on);
  }, [pathname]);

  const chatLen = msgs.filter((m) => !("home" in m && m.home)).length;
  useEffect(() => {
    if (tab === "chat") endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chatLen, tab]);
  // 대화의 마지막 추천 결과가 나오면 그 결과의 맨 위(추천 3곳)가 보이게 올린다
  const lastChat = [...msgs].reverse().find((m) => !("home" in m && m.home));
  const lastDone = lastChat && (lastChat.t === "stay" || lastChat.t === "flight") && lastChat.status === "done" ? lastChat.id : "";
  useEffect(() => {
    if (tab !== "chat" || !lastDone) return;
    const r = requestAnimationFrame(() => {
      const list = document.querySelectorAll(".tb-msgs .tb-result");
      list[list.length - 1]?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => cancelAnimationFrame(r);
  }, [lastDone, tab]);

  // 화면(탭·홈 결과)마다 스크롤 위치를 기억해 두고, 돌아오면 그 자리로 되돌린다
  const view = `${tab}:${homeId ?? ""}`;
  const viewRef = useRef(view);
  const scrolls = useRef<Record<string, number>>({});
  useEffect(() => {
    const on = () => {
      scrolls.current[viewRef.current] = window.scrollY;
    };
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  // 화면이 바뀐 직후(그리기 전)에 표시를 옮겨야, 짧아진 새 화면 때문에 생긴 스크롤 이벤트가 앞 화면 위치를 덮어쓰지 않는다
  useLayoutEffect(() => {
    viewRef.current = view;
    const y = scrolls.current[view] ?? 0;
    requestAnimationFrame(() => window.scrollTo({ top: y, behavior: "instant" }));
    setSeller(null); // 다른 화면으로 가면 열려 있던 예약처 패널도 닫는다
  }, [view]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.go ? 1600 : toast.text.length > 30 ? 5000 : 3000);
    return () => clearTimeout(t);
  }, [toast]);

  // ---------- 숙소: 찾기 → 규칙으로 3곳 먼저 → AI가 다시 정리하면 바꾼다 ----------
  const runStay = useCallback(
    // local: 받은 목록 안에서 거른 결과. 검색·AI를 부르지 않고 규칙(sorted면 그 순서)으로만 3곳을 정한다
    async (query: StayQuery, o: { reuse?: HotelOption[]; home?: boolean; local?: boolean; sorted?: boolean } = {}) => {
      const id = uid();
      push({ id, t: "stay", home: o.home, query, status: "loading" });
      if (o.home) setHomeId(id);
      let options = o.reuse;
      let next: string | null = null;
      if (!options) {
        const r = await searchStays(query);
        if (!r.ok) return patch(id, { status: "error", err: r.status });
        options = r.data.options;
        next = r.data.next;
        // 없는 도시(예: asdfqwer)면 엉뚱한 지역 숙소가 오므로 목록 대신 안내를 보여 준다
        if (unknownPlace(query.place, options, await isKnownPlace(query.place))) return patch(id, { status: "done", options: [], picks: [], unknown: true });
      }
      if (!options.length) return patch(id, { status: "done", options: [], picks: [] });
      patch(id, { next, pages: 0 });
      const nights = nightsOf(query);
      const { list: pool, over } = withinBudget(options, query.budget, nights);
      const head = pool.slice(0, 40);
      const toPicks = (ps: { n: number; reason: string }[]) => ps.map((p) => ({ token: head[p.n - 1].token, reason: p.reason }));
      const want = withProfile(query.taste, profileRef.current, "stay"); // 그때 적은 말 + 온보딩 취향
      const fb = o.sorted ? head.slice(0, 3).map((h, i) => ({ n: i + 1, reason: stayFactReason(h, want) })) : fallbackStayPicks(head, want, query.budget, nights, criteriaWeights(profileRef.current));
      const overNote = over ? `예산(${Math.round(query.budget / 10000)}만 원) 안의 숙소가 없어서 가장 가까운 곳을 보여 드려요.` : "";
      patch(id, { status: "done", options, picks: toPicks(fb), aiPending: !o.local, note: overNote });
      setActiveId(id);
      if (o.local) return; // 받은 목록 안에서 다시 거른 결과는 예약처 가격도 새로 부르지 않는다 (이미 받은 금액만 씀)
      const ai = await pickStays(head, want, query.budget);
      const picks = mergePicks(ai.ok ? ai.data.picks : [], fb, head.length, (n) => stayFactReason(head[n - 1], want));
      patch(id, { picks: toPicks(picks), aiPending: false, note: [overNote, ai.ok ? ai.data.note : ""].filter(Boolean).join(" ") });
      // AI 추천 1위만 예약처 가격을 미리 받아 카드 금액을 시트 1위 총액과 맞춰 둔다.
      // 2·3위는 카드가 화면에 보이거나 눌렀을 때 받는다 (검색 한 번당 가격 조회를 줄이기 위해)
      prefetchPrices(picks.slice(0, 1).map((p) => head[p.n - 1]), query);
    },
    [patch, push],
  );

  // 스크롤 끝: 다음 쪽(20곳 안팎)을 붙인다. 검색 한 번당 최대 MORE_PAGES쪽 (검색 비용 보호). AI 추천 3곳은 그대로
  const loadMore = useCallback(
    async (id: string) => {
      const m = msgsRef.current.find((x) => x.id === id);
      if (!m || m.t !== "stay" || !m.next || m.more === "loading" || (m.pages ?? 0) >= MORE_PAGES) return;
      patch(id, { more: "loading" });
      const r = await searchStaysPage(m.query, m.next, m.cls);
      const cur = msgsRef.current.find((x) => x.id === id) as StayMsg | undefined;
      if ((clsRef.current.get(id) ?? "") !== (m.cls ?? "")) return; // 그사이 성급을 바꿨으면 버린다
      if (!r.ok) return patch(id, { more: "error" });
      const have = new Set((cur?.options ?? []).map((h) => h.token));
      const add = r.data.options.filter((h) => !have.has(h.token));
      patch(id, { options: [...(cur?.options ?? []), ...add], next: add.length ? r.data.next : null, pages: (cur?.pages ?? 0) + 1, more: undefined });
    },
    [patch],
  );

  // 성급 필터: 고른 성급(2~5성)만 한 번 새로 찾아 목록을 채운다. 누른 사람만 검색 1번, 같은 조건은 30분 저장.
  // 처음 받은 목록은 base에 두고 새로 받은 곳을 뒤에 붙인다 (다른 성급도 계속 고를 수 있게). 성급을 모두 풀면 처음 목록으로.
  // 1성만 고르면 검색이 1성을 받지 않아 받은 목록 안에서만 거른다
  const byStars = useCallback(
    async (id: string, stars: number[]) => {
      const m = msgsRef.current.find((x) => x.id === id);
      if (!m || m.t !== "stay" || m.status !== "done" || !m.options?.length) return;
      const cls = [...new Set(stars.filter((n) => n >= 2 && n <= 5))].sort().join(",");
      if ((clsRef.current.get(id) ?? "") === cls) return;
      clsRef.current.set(id, cls);
      const base = m.base ?? { options: m.options, next: m.next ?? null, pages: m.pages ?? 0 };
      if (!cls) return patch(id, { cls: undefined, base: undefined, options: base.options, next: base.next, pages: base.pages, more: undefined });
      patch(id, { cls, base, options: base.options, next: null, more: "loading" });
      const r = await searchStays(m.query, cls);
      if (clsRef.current.get(id) !== cls) return;
      // 실패하면 받은 목록 안에서만 거른다
      if (!r.ok) return patch(id, { options: base.options, next: null, pages: 0, more: undefined });
      const have = new Set(base.options.map((h) => h.token));
      patch(id, { options: [...base.options, ...r.data.options.filter((h) => !have.has(h.token))], next: r.data.next, pages: 0, more: undefined });
    },
    [patch],
  );

  // ---------- 항공 ----------
  const runFlight = useCallback(
    async (query: FlightQuery, o: { reuse?: FlightOption[]; home?: boolean; local?: boolean; sorted?: boolean } = {}) => {
      const id = uid();
      push({ id, t: "flight", home: o.home, query, status: "loading" });
      if (o.home) setHomeId(id);
      let options = o.reuse;
      if (!options) {
        const r = await searchFlights(query);
        if (!r.ok) return patch(id, { status: "error", err: r.status });
        options = r.data.options;
      }
      if (!options.length) return patch(id, { status: "done", options: [], picks: [] });
      const want = withProfile(query.taste, profileRef.current, "flight");
      const fb = o.sorted ? options.slice(0, 3).map((f, i) => ({ n: i + 1, reason: flightFactReason(f, want) })) : fallbackFlightPicks(options, want);
      patch(id, { status: "done", options, picks: fb, aiPending: !o.local });
      setActiveId(id);
      if (o.local) return;
      const list = options;
      const ai = await pickFlights(options, want);
      const picks = mergePicks(ai.ok ? ai.data.picks : [], fb, list.length, (n) => flightFactReason(list[n - 1], want));
      patch(id, { picks, aiPending: false, note: ai.ok ? ai.data.note : "" });
    },
    [patch, push],
  );

  // 조건이 다 모이면 바로 찾고, 모자라면 입력 시트를 채워서 연다
  const goStay = useCallback(
    (q: Partial<StayQuery>, base?: StayMsg) => {
      if (!stayReady(q, localToday())) return setStaySheet(q);
      const same = base?.options && base.query.place === q.place && base.query.checkIn === q.checkIn && base.query.checkOut === q.checkOut && base.query.adults === q.adults && guestText(base.query) === guestText(q as StayQuery) && (base.query.childAges ?? []).join() === (q.childAges ?? []).join();
      runStay({ ...q, budget: q.budget ?? 0, taste: q.taste ?? "" } as StayQuery, { reuse: same ? base.options : undefined });
    },
    [runStay],
  );

  // 주소의 검색 조건 → 홈 결과. 같은 조건의 결과가 이미 있으면 그걸 다시 보여 주고(검색 없음),
  // 없으면 그때 찾는다 (공유 링크·새로 고침·옛 /hotels·/flights 링크). 지난 날짜면 검색 칸만 채운다
  useEffect(() => {
    if (tab !== "home" || window.location.pathname !== "/") return;
    const hs = parseHomeSearch(window.location.search, localToday()); // search 상태는 바뀐 걸 알리는 용도 (탭을 옮긴 직후엔 한 박자 늦다)
    // 결과(또는 검색 화면)를 그린 다음 프레임에 감춘 것을 푼다
    requestAnimationFrame(() => requestAnimationFrame(() => document.documentElement.classList.remove("tb-has-q")));
    if (!hs) return setHomeId(null);
    // 출발과 도착이 같은 주소: 찾지 않고 항공 검색 카드에 그대로 채운다 (카드가 '출발지와 도착지가 같아요' 한 줄을 보여 준다)
    if (hs.kind === "flight" && hs.same) {
      setHomeId(null);
      setKind("flight");
      const q = hs.query;
      loadAirports()
        .then((d) => setPrefFlight({ ...q, fromLabel: labelForCode(d, q.from), toLabel: labelForCode(d, q.to), ...(q.depart ? {} : { depart: undefined }) }))
        .catch(() => setPrefFlight({ from: q.from, to: q.to }));
      return;
    }
    const key = hs.kind === "stay" ? stayHref(hs.query) : flightHref({ ...hs.query, fromLabel: "", toLabel: "" });
    const have = [...msgsRef.current].reverse().find((m) => (m.t === "stay" || m.t === "flight") && m.home && homeHrefOf(m) === key);
    if (have) return setHomeId(have.id);
    // P1-3: 지났거나 틀린 날짜는 고쳐서 찾고, 주소도 고친 날짜로 바꾼 뒤 한 줄로 알린다 (도시는 그대로)
    if (hs.fixed) {
      const fixedHref = hs.kind === "stay" ? stayHref(hs.query) : flightHref({ ...hs.query, fromLabel: "", toLabel: "" });
      window.history.replaceState(null, "", fixedHref);
      const a = hs.kind === "stay" ? hs.query.checkIn : hs.query.depart;
      const b = hs.kind === "stay" ? hs.query.checkOut : hs.query.ret;
      setDateFix({ href: fixedHref, text: dateFixText(hs.fixed, a, b || undefined) });
    }
    if (hs.kind === "stay") {
      setKind("stay");
      setPrefStay(hs.query);
      runStay(hs.query, { home: true });
    } else {
      setKind("flight");
      const q = hs.query;
      loadAirports()
        .then((d) => ({ fromLabel: labelForCode(d, q.from), toLabel: labelForCode(d, q.to) }))
        .catch(() => ({ fromLabel: q.from, toLabel: q.to }))
        .then((labels) => {
          setPrefFlight({ ...q, ...labels });
          runFlight({ ...q, ...labels }, { home: true });
        });
    }
  }, [tab, search, runStay, runFlight]);

  const goFlight = useCallback(
    (q: Partial<FlightQuery>, base?: FlightMsg) => {
      if (!flightReady(q, localToday())) return setFlightSheet(q);
      const same = base?.options && base.query.from === q.from && base.query.to === q.to && base.query.depart === q.depart && base.query.ret === q.ret && base.query.adults === q.adults && paxText(base.query) === paxText(q as FlightQuery);
      runFlight(q as FlightQuery, { reuse: same ? base.options : undefined });
    },
    [runFlight],
  );

  // ---------- AI 채팅: 자유 문장 ----------
  async function send(raw: string) {
    const said = raw.trim();
    if (!said || busy) return;
    setText("");
    setTab("chat");
    push({ id: uid(), t: "user", text: said });
    const base = msgsRef.current.find((m) => m.id === activeId && !(("home" in m) && m.home)) as StayMsg | FlightMsg | undefined;
    setBusy(true);
    const r = await parseText(said, localToday(), contextOf(base));
    setBusy(false);
    if (!r.ok) {
      // AI를 못 쓰면: 보고 있는 결과가 있으면 같은 목록 안에서 취향만 더해 다시 정리하고(검색 없음), 없으면 입력 시트로 이어 준다
      if (base?.t === "stay" && base.options) return runStay({ ...base.query, taste: joinTaste(base.query.taste, said.slice(0, 100)) }, { reuse: base.options });
      if (base?.t === "flight" && base.options) return runFlight({ ...base.query, taste: joinTaste(base.query.taste, said.slice(0, 100)) }, { reuse: base.options });
      const flightish = /항공|비행|왕복|편도|출국/.test(said);
      push({ id: uid(), t: "ai", text: r.status === 429 ? "질문이 많아서 잠시 쉬어야 해요. 조건을 직접 넣어 주시면 바로 찾아볼게요." : "조건을 직접 넣어 주시면 바로 찾아볼게요." });
      if (flightish) setFlightSheet({ taste: said.slice(0, 200) });
      else setStaySheet({ taste: said.slice(0, 200) });
      return;
    }
    const p = r.data;
    if (p.kind === "other") {
      push({ id: uid(), t: "ai", text: p.reply || "숙소나 항공편이라면 바로 찾아 드릴게요. 어디로, 언제 가시는지 알려 주세요." });
      return;
    }
    const keep = <T extends object>(o: T) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== "" && v !== 0 && v !== undefined)) as Partial<T>;
    if (p.kind === "stay") {
      const b = base?.t === "stay" ? base : undefined;
      const parsed = keep(p.stay);
      const stay: Partial<StayQuery> = { ...(b ? b.query : {}), ...parsed, taste: b && !parsed.place ? joinTaste(b.query.taste, parsed.taste ?? "") : (parsed.taste ?? "") };
      if (p.questions.length) return push({ id: uid(), t: "ask", kind: "stay", reply: p.reply, stay, flight: {}, questions: p.questions, answers: {}, done: false });
      if (p.reply) push({ id: uid(), t: "ai", text: p.reply });
      return goStay(stay, b);
    }
    const b = base?.t === "flight" ? base : undefined;
    const parsed = keep(p.flight);
    const flight: Partial<FlightQuery> = { ...(b ? b.query : {}), ...parsed, ret: p.flight.ret ?? b?.query.ret ?? "", taste: b && !parsed.to ? joinTaste(b.query.taste, parsed.taste ?? "") : (parsed.taste ?? "") };
    if (p.questions.length) return push({ id: uid(), t: "ask", kind: "flight", reply: p.reply, stay: {}, flight, questions: p.questions, answers: {}, done: false });
    if (p.reply) push({ id: uid(), t: "ai", text: p.reply });
    return goFlight(flight, b);
  }

  function applyAsk(m: AskMsg, edit = false) {
    const stay = { ...m.stay };
    const flight = { ...m.flight };
    m.questions.forEach((q, i) => {
      const a = m.answers[i];
      if (!a) return;
      const v = a.value.trim();
      if (q.slot === "place") {
        if (m.kind === "stay") stay.place = v;
        else if (/^[A-Za-z]{3}$/.test(v)) Object.assign(flight, { to: v.toUpperCase(), toLabel: a.label });
      } else if (q.slot === "to" && /^[A-Za-z]{3}$/.test(v)) Object.assign(flight, { to: v.toUpperCase(), toLabel: a.label });
      else if (q.slot === "from" && /^[A-Za-z]{3}$/.test(v)) Object.assign(flight, { from: v.toUpperCase(), fromLabel: a.label });
      else if (q.slot === "dates") {
        const [d1, d2 = ""] = v.split("~").map((s) => s.trim());
        Object.assign(stay, { checkIn: d1, checkOut: d2 });
        Object.assign(flight, { depart: d1, ret: d2 });
      } else if (q.slot === "adults" && Number(v) >= 1) {
        stay.adults = flight.adults = Math.min(9, Math.floor(Number(v)));
      } else if (q.slot === "budget" && Number(v) > 0) stay.budget = Math.floor(Number(v));
      else if (q.slot === "taste") {
        stay.taste = joinTaste(stay.taste ?? "", a.label);
        flight.taste = joinTaste(flight.taste ?? "", a.label);
      }
    });
    patch(m.id, { done: true });
    if (m.kind === "stay") {
      if (edit) return setStaySheet(stay);
      push({ id: uid(), t: "user", text: Object.values(m.answers).map((a) => a.label).join(" · ") });
      goStay(stay);
    } else {
      if (edit) return setFlightSheet(flight);
      push({ id: uid(), t: "user", text: Object.values(m.answers).map((a) => a.label).join(" · ") });
      goFlight(flight);
    }
  }

  // 대화 안의 입력 시트에서 낸 조건
  function submitStay(q: StayQuery) {
    setStaySheet(null);
    setTab("chat");
    push({ id: uid(), t: "user", text: [q.taste, `${q.place} · ${mdw(q.checkIn)}–${mdw(q.checkOut)} · ${q.adults}명`, q.budget ? `${Math.round(q.budget / 10000)}만 원 아래` : ""].filter(Boolean).join(" · ") });
    runStay(q);
  }

  function submitFlight(q: FlightQuery) {
    setFlightSheet(null);
    setTab("chat");
    push({ id: uid(), t: "user", text: [q.taste, `${q.fromLabel} → ${q.toLabel} · ${mdw(q.depart)}${q.ret ? `–${mdw(q.ret)}` : " 편도"} · ${q.adults}명`].filter(Boolean).join(" · ") });
    runFlight(q);
  }

  // 후속 조건·정렬: 이미 받은 목록 안에서만 거른다 (검색·AI 호출 없음). 지금 말한 조건이 취향보다 먼저다
  function refine(m: StayMsg | FlightMsg, id: StayRefineId | FlightRefineId, label: string) {
    if (!m.options) return;
    push({ id: uid(), t: "user", text: label });
    const sorted = id === "cheap" || id === "rating";
    if (m.t === "stay") {
      const list = refineStays(m.options, id as StayRefineId, nightsOf(m.query));
      if (!list.length) return push({ id: uid(), t: "ai", text: `받은 ${m.options.length}곳 중에는 ${label} 숙소가 없어요. 다른 조건을 눌러 보세요.` });
      return runStay({ ...m.query, taste: sorted ? m.query.taste : joinTaste(m.query.taste, label) }, { reuse: list, local: true, sorted });
    }
    const list = refineFlights(m.options, id as FlightRefineId);
    if (!list.length) return push({ id: uid(), t: "ai", text: `받은 ${m.options.length}편 중에는 ${label} 항공편이 없어요. 다른 조건을 눌러 보세요.` });
    return runFlight({ ...m.query, taste: sorted ? m.query.taste : joinTaste(m.query.taste, label) }, { reuse: list, local: true, sorted });
  }

  // AI 채팅으로 가기. 취향 기록이 없으면 이때 한 번만 설문을 띄운다
  function openChat(focus = false) {
    setTab("chat");
    if (focus) setTimeout(() => inputRef.current?.focus(), 50);
  }
  // P2: AI 채팅은 대화부터 보여 주고, 취향 설문은 첫 답 아래 「30초 취향 설정」 카드로 권한다 (자동으로 띄우지 않는다)
  const tasteCard = taste.need ? (
    <div className="tb-taste-card">
      <span>
        <strong>30초 취향 설정</strong>
        <small>누구와, 어떤 여행을 좋아하는지 알려 주시면 AI 추천을 취향에 맞춰 드려요.</small>
      </span>
      <span className="tb-taste-card-go">
        <button type="button" className="tb-btn dark" onClick={() => setOnb(true)}>
          설정하기
        </button>
        <button type="button" className="tb-taste-card-x" onClick={() => taste.set(EMPTY_PROFILE, "skipped")}>
          괜찮아요
        </button>
      </span>
    </div>
  ) : null;

  function save(hotel: HotelOption, query: StayQuery) {
    const was = savedSet.has(hotel.token);
    const now = shownPrice(hotel, query);
    toggle(hotel, query, was ? undefined : { price: now.none ? null : now.value, verified: now.verified, at: Date.now() });
    setToast(was ? null : { text: `${query.place} 숙소를 담았어요` });
  }

  // 홈 검색 칸을 채워서 보여 주기 (인기 여행지·대화의 '이제 항공편 찾기')
  function prefill(k: SearchKind, q: Partial<StayQuery> | Partial<FlightQuery>) {
    setKind(k);
    if (k === "stay") setPrefStay({ ...(q as Partial<StayQuery>) });
    else setPrefFlight({ ...(q as Partial<FlightQuery>) });
    goHome("/");
  }

  // 마이 여행의 '항공편 찾기': 같은 날짜·인원으로 홈 항공 검색 칸을 채운다 (도착지는 도시 이름으로 공항 코드를 찾고, 못 찾으면 비워 둔다)
  function tripFlight(t: Trip) {
    const base = { depart: t.checkIn, ret: t.checkOut, adults: t.adults };
    loadAirports()
      .then((d) => searchPlaces(d, t.city, 1)[0])
      .catch(() => undefined)
      .then((p) => prefill("flight", p ? { ...base, to: p.code, toLabel: p.label } : base));
  }

  const homeMsg = msgs.find((m) => m.id === homeId) as StayMsg | FlightMsg | undefined;
  const chatMsgs = msgs.filter((m) => !("home" in m && m.home));
  const firstReply = chatMsgs.findIndex((m) => m.t !== "user");
  // 추천 결과가 나온 뒤에는 '30초 취향 설정' 카드를 맨 아래로 (추천 3곳을 밀어내지 않게)
  const chatHasResult = chatMsgs.some((m) => (m.t === "stay" || m.t === "flight") && m.status !== "loading");
  const homeHref = homeMsg ? homeHrefOf(homeMsg) : "/";
  // PC 2열: 홈 숙소 결과와 AI 채팅은 왼쪽 목록 + 오른쪽 예약처 패널
  const split = wide && ((tab === "home" && homeMsg?.t === "stay") || tab === "chat");
  const activeToken = seller?.hotel.token;
  // 열려 있는 숙소가 AI 추천 3곳 중 하나면 그 이유를 상세에도 보여 준다 (가장 최근 결과 기준)
  const sellerReason = seller ? [...msgs].reverse().flatMap((m) => (m.t === "stay" && m.query.place === seller.query.place ? (m.picks ?? []) : [])).find((p) => p.token === seller.hotel.token)?.reason : undefined;
  // PC: 결과가 있으면 오른쪽 패널이 비지 않게 맨 위 숙소(AI 추천 1위)를 먼저 열어 둔다
  const panelMsg = (tab === "home" ? homeMsg : [...chatMsgs].reverse().find((x) => x.t === "stay")) as StayMsg | FlightMsg | undefined;
  // AI 답이 온 뒤에 추천 1번을 연다 (그 전에 규칙으로 정한 곳을 열었다가 바뀌지 않게)
  const firstStay = split && panelMsg?.t === "stay" && panelMsg.status === "done" && !panelMsg.aiPending && panelMsg.options?.length ? (panelMsg.options.find((o) => o.token === panelMsg.picks?.[0]?.token) ?? panelMsg.options[0]) : null;
  useEffect(() => {
    if (!seller && firstStay && panelMsg?.t === "stay") setSeller({ hotel: firstStay, query: panelMsg.query });
  }, [seller, firstStay, panelMsg]);

  return (
    <div className="tb-app">
      <div className={`tb-main${split ? " split" : ""}`}>
        {tab === "home" &&
          (homeMsg ? (
            <HomeResult
              m={homeMsg}
              saved={savedSet}
              onBack={() => goHome("/")}
              onSave={(h) => homeMsg.t === "stay" && save(h, homeMsg.query)}
              onOpen={(h) => homeMsg.t === "stay" && setSeller({ hotel: h, query: homeMsg.query })}
              active={activeToken}
              onRetry={() => (homeMsg.t === "stay" ? runStay(homeMsg.query, { home: true }) : runFlight(homeMsg.query, { home: true }))}
              fixNote={dateFix && homeHrefOf(homeMsg) === dateFix.href ? dateFix.text : ""}
              onPlace={(place) => {
                if (homeMsg.t !== "stay") return;
                const q = { ...homeMsg.query, place };
                runStay(q, { home: true });
                goHome(stayHref(q));
              }}
              onMore={() => loadMore(homeMsg.id)}
              onStars={(s) => byStars(homeMsg.id, s)}
            />
          ) : (
            <main className="tb-home">
              <header className="tb-top">
                <span className="tb-logo">
                  <Orb size={30} />
                  <strong>{BRAND_NAME}</strong>
                  {brand.tentative && <em>가칭</em>}
                </span>
              </header>
              <div className="tb-hero" style={{ "--tb-hero-img": `url(${photoUrl(HOME_HERO_PHOTO, 2000, 760)})` } as React.CSSProperties}>
                <h1 className="tb-hero-title">
                  다음 여행, 어디가 좋을까요?
                  <small>숙소와 항공권을 한 번에 찾아 드려요</small>
                </h1>
                <SearchCard
                  ref={searchRef}
                  kind={kind}
                  onKind={setKind}
                  stay={prefStay}
                  flight={prefFlight}
                  onStay={(q) => {
                    runStay(q, { home: true });
                    goHome(stayHref(q));
                  }}
                  onFlight={(q) => {
                    runFlight(q, { home: true });
                    goHome(flightHref(q));
                  }}
                />
              </div>
              <button
                type="button"
                className="tb-askbar"
                onClick={() => openChat(true)}
              >
                <Orb size={46} />
                <span>
                  <strong>{BRAND_AI_NAME}에게 물어보기</strong>
                  <small>“부모님이랑 조용한 온천 숙소”</small>
                </span>
                <i aria-hidden>
                  <IconChatStar size={22} />
                </i>
              </button>
              <ul className="tb-trust" aria-label="이용 안내">
                {HOME_TRUST.map((t) => (
                  <li key={t.title}>
                    <strong>{t.title}</strong>
                    <span>{t.text}</span>
                  </li>
                ))}
              </ul>
              {/* 실제로 가격을 받아 견주는 예약처 (lib/hotel-sellers.ts 허용 목록과 같다) */}
              <p className="tb-trust-sellers">비교하는 예약처: {HOTEL_SELLERS_SHOWN.map((k) => sellerDef(k).ko).join(" · ")}</p>
              <section className="tb-sec">
                <h2>인기 여행지</h2>
                <div className="tb-places">
                  {HOME_PLACES.map((p) => (
                    <button key={p.name} type="button" onClick={() => searchRef.current?.searchStay(p.name)}>
                      <img
                        src={photoUrl(p.photo, 400, 520)}
                        alt=""
                        loading="lazy"
                        // 사진을 못 받으면 깨진 그림 표시 대신 카드 바탕색만 보인다 (화면이 열리기 전에 이미 실패한 경우도)
                        ref={(el) => {
                          if (el && el.complete && !el.naturalWidth) el.style.visibility = "hidden";
                        }}
                        onError={(e) => (e.currentTarget.style.visibility = "hidden")}
                      />
                      <span>
                        <strong>{p.name}</strong>
                        <small>{p.country}</small>
                      </span>
                    </button>
                  ))}
                </div>
              </section>
              <section className="tb-sec tb-faq">
                <h2>자주 묻는 질문</h2>
                {HOME_FAQ.map((f) => (
                  <details key={f.q}>
                    <summary>{f.q}</summary>
                    <p>{f.a}</p>
                  </details>
                ))}
                <p className="tb-faq-more">
                  더 자세한 내용은 <Link href="/terms">이용약관</Link>에 있어요.
                </p>
              </section>
              <TripFooter />
            </main>
          ))}

        {tab === "chat" && (
          <main className="tb-chat">
            <header className="tb-chat-top">
              <Orb size={40} />
              <span>
                <strong>{BRAND_AI_NAME}</strong>
                <small>숙소·항공편을 같이 찾아요</small>
              </span>
              {chatMsgs.length > 0 && (
                <button
                  type="button"
                  className="tb-ib"
                  onClick={() => {
                    setMsgs((l) => l.filter((m) => "home" in m && m.home));
                    setActiveId(null);
                  }}
                  aria-label="새 대화"
                >
                  <IconPlus size={20} />
                </button>
              )}
            </header>
            {chatMsgs.length === 0 ? (
              <div className="tb-chat-empty">
                <Orb size={56} calm />
                <h1>어디로, 언제, 누구와 가는지 편하게 말해 주세요</h1>
                <p>취향에 맞는 곳을 3곳만 먼저 보여드릴게요.</p>
                <div className="tb-examples">
                  {EXAMPLES.map((e) => (
                    <button key={e} type="button" onClick={() => send(e)}>
                      {e}
                    </button>
                  ))}
                </div>
                {tasteCard}
              </div>
            ) : (
              <div className="tb-msgs" aria-live="polite">
                {chatMsgs.map((m, i) => (
                  <Fragment key={m.id}>
                  <MsgView
                    m={m}
                    saved={savedSet}
                    onAnswer={(i, a) => m.t === "ask" && patch(m.id, { answers: { ...m.answers, [i]: a } })}
                    onApply={(edit) => m.t === "ask" && applyAsk(m, edit)}
                    onOpenHotel={(hotel) => m.t === "stay" && setSeller({ hotel, query: m.query })}
                    active={activeToken}
                    onSave={(hotel) => m.t === "stay" && save(hotel, m.query)}
                    onAll={() => setListId(m.id)}
                    onRefine={(id, label) => (m.t === "stay" || m.t === "flight") && refine(m, id, label)}
                    onRetry={() => (m.t === "stay" ? runStay(m.query) : m.t === "flight" ? runFlight(m.query) : undefined)}
                    onSay={send}
                    onPrefill={prefill}
                  />
                  {i === firstReply && !chatHasResult && tasteCard}
                  </Fragment>
                ))}
                {chatHasResult && tasteCard}
                {busy && <Typing />}
                <div ref={endRef} />
              </div>
            )}
            <div className="tb-dock">
              <form
                className="tb-composer"
                onSubmit={(e) => {
                  e.preventDefault();
                  send(text);
                }}
              >
                <input ref={inputRef} value={text} maxLength={500} onChange={(e) => setText(e.target.value)} placeholder={`${BRAND_AI_NAME}에게 물어보기`} aria-label="AI에게 말하기" enterKeyHint="send" />
                <button type="submit" className="tb-send" disabled={!text.trim() || busy} aria-label="보내기">
                  <IconUp size={20} />
                </button>
              </form>
            </div>
          </main>
        )}

        {tab === "now" && (
          <Soon
            title="지금"
            lead="여행 중에 쓰는 도구를 준비하고 있어요."
            items={["오늘 날씨와 다음 일정을 한눈에", "메뉴판을 찍으면 우리말로 풀어 보기", "현지 가격을 원화로 바로 보기"]}
          />
        )}
        {tab === "my" && <My saved={saved} profile={taste.profile} onTaste={() => setOnb(true)} onOpen={(s) => setSeller(s)} onSave={(s) => save(s.hotel, s.query)} onHome={() => goHome("/")} onFlight={tripFlight} onMoreStays={(t) => goHome(stayHref({ place: t.city, checkIn: t.checkIn, checkOut: t.checkOut, adults: t.adults, budget: 0, taste: "" }))} />}

        {split && (
          <aside className="tb-panel" aria-label="숙소 상세">
            {seller ? (
              <>
                <SellerBody hotel={seller.hotel} query={seller.query} reason={sellerReason} saved={savedSet.has(seller.hotel.token)} onSave={() => save(seller.hotel, seller.query)} onGo={(text) => setToast({ text, go: true })} />
              </>
            ) : (
              <div className="tb-panel-empty">
                <IconBed size={28} />
                <strong>숙소를 누르면 여기에 예약처별 총액이 보여요</strong>
                <p>세금·수수료까지 더한 금액을 예약처마다 나란히 보여드려요.</p>
              </div>
            )}
          </aside>
        )}

        <nav className="tb-tabbar" aria-label="메뉴">
          <span className="tb-logo tb-tabbar-logo">
            <Orb size={28} />
            <strong>{BRAND_NAME}</strong>
            {brand.tentative && <em>가칭</em>}
          </span>
          {(
            [
              { id: "home", label: "홈", icon: <IconHome size={24} /> },
              { id: "chat", label: "AI 채팅", icon: <IconChatStar size={24} /> },
              // P2: '지금' 탭은 여행 중 기능이 준비될 때까지 숨긴다 (/now 는 홈으로 보낸다)
              { id: "my", label: "마이", icon: <IconUser size={24} /> },
            ] as { id: Tab; label: string; icon: React.ReactNode; soon?: boolean }[]
          ).map((it) => (
            <Link
              key={it.id}
              href={it.id === "home" ? (tab === "home" ? "/" : homeHref) : TAB_PATH[it.id]}
              scroll={false}
              className={`tb-tab${it.id === "chat" ? " ai" : ""}`}
              aria-current={tab === it.id ? "page" : undefined}
              onClick={(e) => {
                // 홈에서 홈을 누르면 검색 화면으로 (화면을 다시 받지 않고 주소만 바꾼다)
                if (it.id === "home" && tab === "home") {
                  e.preventDefault();
                  goHome("/");
                }
              }}
            >
              {it.icon}
              <span>{it.label}</span>
              {it.soon && <em className="tb-soon-dot">곧</em>}
            </Link>
          ))}
        </nav>
      </div>

      {toast &&
        (toast.go ? (
          <div className="tb-toast go" role="status">
            <span>{toast.text}</span>
          </div>
        ) : (
          <div className="tb-toast" role="status">
            <IconHeart size={18} on />
            <span>{toast.text}</span>
            <button
              type="button"
              onClick={() => {
                setToast(null);
                setTab("my");
              }}
            >
              보기
            </button>
          </div>
        ))}

      {onb && (
        <Onboarding
          init={taste.profile ?? EMPTY_PROFILE}
          onDone={(p) => {
            taste.set(p, "done");
            setOnb(false);
          }}
          onSkip={(p) => {
            taste.set(p, "skipped"); // 그때까지 선택한 것만 남긴다. 아무것도 안 해도 다시 묻지 않는다
            setOnb(false);
          }}
        />
      )}

      <AllList
        m={msgs.find((x) => x.id === listId) as StayMsg | FlightMsg | undefined}
        saved={savedSet}
        onSave={(h, q) => save(h, q)}
        onOpen={(h, q) => setSeller({ hotel: h, query: q })}
        onClose={() => setListId(null)}
        onMore={(id) => loadMore(id)}
        onStars={byStars}
      />

      <StaySheet open={!!staySheet} init={staySheet ?? {}} onClose={() => setStaySheet(null)} onSubmit={submitStay} />
      <FlightSheet open={!!flightSheet} init={flightSheet ?? {}} onClose={() => setFlightSheet(null)} onSubmit={submitFlight} />
      <SellerSheet
        hotel={split ? null : (seller?.hotel ?? null)}
        query={seller?.query ?? EMPTY_QUERY}
        saved={!!seller && savedSet.has(seller.hotel.token)}
        onSave={() => seller && save(seller.hotel, seller.query)}
        onClose={() => setSeller(null)}
        onGo={(text) => setToast({ text, go: true })}
        reason={sellerReason}
      />
    </div>
  );
}

// AI 채팅의 '전체 N곳 보기': 받은 목록 전체를 바텀시트로. 정렬·조건은 이 안에서만 거른다 (지도는 두지 않는다)
function AllList({ m, saved, onSave, onOpen, onClose, onMore, onStars }: { m: StayMsg | FlightMsg | undefined; saved: Set<string>; onSave: (h: HotelOption, q: StayQuery) => void; onOpen: (h: HotelOption, q: StayQuery) => void; onClose: () => void; onMore: (id: string) => void; onStars: (id: string, s: number[]) => void }) {
  const open = !!m && m.status === "done" && !!m.options?.length;
  return (
    <Sheet open={open} onClose={onClose} label="전체 목록" tall>
      {open && m.t === "stay" && (
        <StayList bare query={m.query} options={m.options ?? []} picks={m.picks ?? []} aiPending={!!m.aiPending} saved={saved} onSave={(h) => onSave(h, m.query)} onOpen={(h) => onOpen(h, m.query)} onBack={onClose} more={moreOf(m)} onMore={() => onMore(m.id)} onStars={(s) => onStars(m.id, s)} />
      )}
      {open && m.t === "flight" && <FlightBrowser bare data={{ query: m.query, options: m.options ?? [], picks: m.picks ?? [] }} aiPending={m.aiPending} onBack={onClose} />}
    </Sheet>
  );
}

// 공항·도시 목록, 인기 여행지, 나라 이름에 있는 말이면 '아는 곳'
const COUNTRY = /일본|한국|대만|태국|베트남|중국|홍콩|마카오|필리핀|싱가포르|말레이시아|인도네시아|미국|괌|사이판|하와이|호주|유럽|몽골/;
async function isKnownPlace(place: string): Promise<boolean> {
  const p = place.normalize("NFC").trim();
  if (HOME_PLACES.some((x) => p.includes(x.name)) || COUNTRY.test(p)) return true;
  const d = await loadAirports().catch(() => null);
  return !!d && p.split(/\s+/).some((t) => t.length >= 2 && searchCities(d, t, 1).length > 0);
}

// 없는 도시로 찾았을 때: 목록 대신 안내와 실제로 있는 인기 여행지
function UnknownPlace({ onPlace }: { onPlace: (name: string) => void }) {
  return (
    <div className="tb-unknown">
      <p>찾는 도시를 몰라요. 이렇게 검색해 보세요.</p>
      <div className="tb-pop-row" role="group" aria-label="인기 여행지">
        {HOME_PLACES.map((x) => (
          <button key={x.name} type="button" onClick={() => onPlace(x.name)}>
            {x.name}
          </button>
        ))}
      </div>
    </div>
  );
}

// 홈·마이 아래 같은 푸터 (자리 표시 [상호] 등은 lib/site.ts 값 그대로)
function TripFooter() {
  return (
    <footer className="tb-foot">
      <p>
        {site.footerIntro} {site.footerAffiliate}
      </p>
      <p>
        상호 {site.business.name} · 대표자 {site.business.ceo}
        <br />
        사업자등록번호 {site.business.registrationNo}
        <br />
        문의 <a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a>
      </p>
      <nav className="tb-foot-links" aria-label="약관과 정책">
        <Link href="/terms">이용약관</Link>
        <Link href="/privacy">
          <b>개인정보처리방침</b>
        </Link>
      </nav>
      <p>{site.footerNotice}</p>
    </footer>
  );
}

const EMPTY_QUERY: StayQuery = { place: "", checkIn: "2000-01-01", checkOut: "2000-01-02", adults: 2, budget: 0, taste: "" };

// ---------- 홈 검색 결과 ----------
// 목록 끝 상태: 더 불러올 수 있음 / 불러오는 중 / 실패 / 끝
const moreOf = (m: StayMsg): "more" | "loading" | "error" | "end" => (m.more === "loading" ? "loading" : m.more === "error" ? "error" : m.next && (m.pages ?? 0) < MORE_PAGES ? "more" : "end");

function HomeResult({ m, saved, onBack, onSave, onOpen, onRetry, onPlace, onMore, onStars, active, fixNote }: { fixNote?: string; m: StayMsg | FlightMsg; saved: Set<string>; onBack: () => void; onSave: (h: HotelOption) => void; onOpen: (h: HotelOption) => void; onRetry: () => void; onPlace: (name: string) => void; onMore: () => void; onStars: (s: number[]) => void; active?: string }) {
  const title = m.t === "stay" ? m.query.place : `${cityOf(m.query.fromLabel || m.query.from)} → ${cityOf(m.query.toLabel || m.query.to)}`;
  if (m.status !== "done" || !m.options?.length)
    return (
      <main className="tb-results">
        <div className="tb-results-top">
          <button type="button" className="tb-ib" onClick={onBack} aria-label="검색으로 돌아가기">
            <IconBack size={20} />
          </button>
          <button type="button" className="tb-qpill" onClick={onBack}>
            <strong>{title}</strong>
            <span>{m.status === "loading" ? "찾고 있어요…" : "검색 조건 바꾸기"}</span>
          </button>
        </div>
        {fixNote && (
          <p className="tb-fixnote" role="status">
            {fixNote}
          </p>
        )}
        {m.status === "loading" ? (
          <div className="tb-rlist">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="tb-srow skel" />
            ))}
          </div>
        ) : m.status === "error" ? (
          <div className="tb-rlist pad">
            <p className="tb-note">{searchErrorMessage(m.err ?? null)}</p>
            <div className="tb-ask-go">
              <button type="button" className="tb-cta small" onClick={onRetry}>
                {SEARCH_RETRY_LABEL}
              </button>
              <a className="tb-btn tb-err-sub" href={m.t === "stay" ? sellerSearchUrl("agoda", m.query.place, m.query) : flightLink(m.query)} target="_blank" rel="noopener noreferrer">
                {m.t === "stay" ? "아고다에서 보기" : "트립닷컴에서 보기"} <IconOut />
              </a>
            </div>
          </div>
        ) : m.t === "stay" && m.unknown ? (
          <UnknownPlace onPlace={onPlace} />
        ) : (
          <p className="tb-note pad">{m.t === "stay" ? "이 조건으로는 숙소를 찾지 못했어요. 지역 이름을 조금 넓게(예: “오사카”) 적거나 날짜를 바꿔 보세요." : "이 날짜에는 항공편을 찾지 못했어요. 날짜나 공항을 바꿔 보세요."}</p>
        )}
      </main>
    );
  if (m.t === "stay")
    return (
      <main>
        <StayList query={m.query} options={m.options} picks={m.picks ?? []} aiPending={!!m.aiPending} saved={saved} onSave={onSave} onOpen={onOpen} onBack={onBack} active={active} more={moreOf(m)} onMore={onMore} onStars={onStars} notice={fixNote} />
      </main>
    );
  return (
    <main>
      <FlightBrowser data={{ query: m.query, options: m.options, picks: m.picks ?? [] }} aiPending={m.aiPending} onBack={onBack} notice={fixNote} />
    </main>
  );
}

// ---------- AI 채팅 ----------
function AiSay({ children }: { children: React.ReactNode }) {
  return (
    <div className="tb-ai">
      <span className="tb-ai-name">
        <Orb size={24} />
        <b>{BRAND_AI_NAME}</b>
      </span>
      <div className="tb-ai-text">{children}</div>
    </div>
  );
}

function Typing() {
  return (
    <AiSay>
      <span className="tb-typing" aria-label="생각하는 중">
        <i />
        <i />
        <i />
      </span>
    </AiSay>
  );
}

type MsgProps = {
  m: Msg;
  saved: Set<string>;
  onAnswer: (i: number, a: AskOption) => void;
  onApply: (edit: boolean) => void;
  onOpenHotel: (h: HotelOption) => void;
  onSave: (h: HotelOption) => void;
  onAll: () => void;
  onRefine: (id: StayRefineId | FlightRefineId, label: string) => void;
  onRetry: () => void;
  onSay: (t: string) => void;
  onPrefill: (k: SearchKind, q: Partial<StayQuery> | Partial<FlightQuery>) => void;
  active?: string; // PC 패널에 열려 있는 숙소
};

function MsgView(props: MsgProps) {
  const { m, onAnswer, onApply } = props;
  if (m.t === "user") return <div className="tb-user">{m.text}</div>;
  if (m.t === "ai") return <AiSay>{m.text}</AiSay>;
  if (m.t === "ask") return <AskCard m={m} onAnswer={onAnswer} onApply={onApply} />;
  if (m.t === "stay") return <StayResult {...props} m={m} />;
  return <FlightResult {...props} m={m} />;
}

// 질문 카드. 답을 정하고 찾은 뒤에는 '12/11–13 (금–일) · 2명 · 30만 원 이하'처럼 한 줄로 접고, 누르면 다시 펼친다
function AskCard({ m, onAnswer, onApply }: { m: AskMsg; onAnswer: (i: number, a: AskOption) => void; onApply: (edit: boolean) => void }) {
  const [open, setOpen] = useState(false);
  const all = m.questions.every((_, i) => m.answers[i]);
  const summary = m.questions.map((_, i) => m.answers[i]?.label).filter(Boolean).join(" · ");
  if (m.done && !open)
    return (
      <button type="button" className="tb-ask-fold" aria-expanded={false} onClick={() => setOpen(true)}>
        <span>정한 조건</span>
        <b>{summary || "조건"}</b>
        <i className="tb-caret" aria-hidden />
      </button>
    );
  return (
    <div className="tb-col">
      <AiSay>{m.reply || "딱 맞게 찾으려고 몇 가지만 여쭤볼게요. 눌러서 답해 주세요."}</AiSay>
      <div className="tb-ask">
        {m.questions.map((q, i) => (
          <div key={i} className="tb-askq">
            <p>
              <b>{i + 1}</b>
              {q.q}
            </p>
            <div className="tb-chips">
              {q.options.map((o) => (
                <button key={o.label} type="button" className="tb-chip" aria-pressed={m.answers[i]?.label === o.label} disabled={m.done} onClick={() => onAnswer(i, o)}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        ))}
        {!m.done ? (
          <div className="tb-ask-go">
            <button type="button" className="tb-cta small" disabled={!all} onClick={() => onApply(false)}>
              이 조건으로 찾기
            </button>
            <button type="button" className="tb-link" onClick={() => onApply(true)}>
              직접 고치기
            </button>
          </div>
        ) : (
          <button type="button" className="tb-link" onClick={() => setOpen(false)}>
            조건 접기
          </button>
        )}
      </div>
    </div>
  );
}

function Searching({ text }: { text: string }) {
  return (
    <AiSay>
      <span className="tb-searching">
        {text}
        <span className="tb-typing" aria-hidden>
          <i />
          <i />
          <i />
        </span>
      </span>
    </AiSay>
  );
}

// P2: 오류 화면은 '다시 시도'가 주 버튼, 예약처 링크는 보조 (숙소는 아고다, 항공은 트립닷컴)
function ErrorBox({ status, onRetry, fallbackHref, fallbackLabel }: { status: number | null | undefined; onRetry: () => void; fallbackHref: string; fallbackLabel: string }) {
  return (
    <div className="tb-col">
      <AiSay>{searchErrorMessage(status ?? null)}</AiSay>
      <div className="tb-ask-go">
        <button type="button" className="tb-cta small" onClick={onRetry}>
          {SEARCH_RETRY_LABEL}
        </button>
        <a className="tb-btn tb-err-sub" href={fallbackHref} target="_blank" rel="noopener noreferrer">
          {fallbackLabel} <IconOut />
        </a>
      </div>
    </div>
  );
}

// AI 추천 카드 한 장. 화면에 보이면 예약처 가격을 받아 금액을 시트 1위 총액과 맞춘다
function PickCard({ p, i, of, note, t, isLow, q, nights, saved: on, active, onSave, onOpenHotel }: { p: { token: string; reason: string; h: HotelOption }; i: number; of: number; note?: RankNote; t: ReturnType<typeof shownPrice>; isLow: boolean; q: StayQuery; nights: number; saved: boolean; active: boolean; onSave: (h: HotelOption) => void; onOpenHotel: (h: HotelOption) => void }) {
  const ref = useLazyPrice<HTMLElement>(p.h, q, true);
  return (
    <article ref={ref} className={`tb-hcard${active ? " on" : ""}`}>
      <div className="tb-hcard-img">
        <PhotoStrip images={p.h.image ? [p.h.image] : []} name={p.h.name} max={1} />
        <em className="tb-tag wt">{isLow && of > 1 && t.verified ? `${i + 1} · 최저가` : `${i + 1}`}</em>
        <button type="button" className={`tb-love${on ? " on" : ""}`} aria-pressed={on} aria-label={on ? "내 여행에서 빼기" : "내 여행에 담기"} onClick={() => onSave(p.h)}>
          <IconHeart size={18} on={on} />
        </button>
      </div>
      <button type="button" className="tb-hcard-body" onClick={() => onOpenHotel(p.h)} aria-label={`${p.h.name} 예약처별 총액 보기`}>
        <strong>{p.h.name}</strong>
        <span className="tb-hcard-meta">{[p.h.rating ? `★ ${p.h.rating.toFixed(1)}` : "", p.h.stars ? `${p.h.stars}성급` : p.h.kind].filter(Boolean).join(" · ")}</span>
        {stayFactLine(p.h, t.fc) && <span className="tb-fact">{stayFactLine(p.h, t.fc)}</span>}
        {!isPlainReason(p.reason) && (
          <span className="tb-why">
            <IconSpark size={14} /> {p.reason}
          </span>
        )}
        {note && <RankLines note={note} />}
        <PriceBlock p={t} nights={nights} />
      </button>
    </article>
  );
}

function StayResult({ m, saved, onOpenHotel, onSave, onAll, onRefine, onRetry, onPrefill, active }: MsgProps & { m: StayMsg }) {
  usePriceVersion(); // 예약처 시트·미리 조회로 맞춘 금액이 오면 다시 그린다
  const q = m.query;
  if (m.status === "loading") return <Searching text={`${q.place} 숙소를 찾고 있어요`} />;
  if (m.status === "error") return <ErrorBox status={m.err} onRetry={onRetry} fallbackHref={sellerSearchUrl("agoda", q.place, q)} fallbackLabel="아고다에서 보기" />;
  const options = m.options ?? [];
  const nights = nightsOf(q);
  if (m.unknown) return <AiSay>찾는 도시를 몰라요. “오사카”, “후쿠오카”, “도쿄”, “다낭”처럼 도시 이름으로 다시 물어봐 주세요.</AiSay>;
  if (!options.length) return <AiSay>이 조건으로는 숙소를 찾지 못했어요. 지역 이름을 조금 넓게(예: “오사카”) 적거나 날짜를 바꿔 보세요.</AiSay>;
  const picks = (m.picks ?? []).map((p) => ({ ...p, h: options.find((o) => o.token === p.token)! })).filter((p) => p.h);
  const prices = picks.map((p) => shownPrice(p.h, q));
  // 비교표·'최저가'는 예약처에서 확인한 금액만 (확인 전 예상 금액은 넣지 않는다)
  const totals = prices.map((p) => (p.verified && p.value !== null ? p.value : Infinity));
  const low = Math.min(...totals);
  const lowOnce = Number.isFinite(low) && totals.filter((x) => x === low).length === 1;
  const notes = rankNotes(picks.map((p) => p.h), q.taste ?? "", prices);
  const bestRating = Math.max(...picks.map((p) => p.h.rating ?? 0));
  const short = (n: string) => (n.length > 9 ? `${n.slice(0, 8)}…` : n);
  return (
    <div className="tb-result">
      <AiSay>
        {options.length}곳 중에 말씀하신 조건에 맞는 <b>{picks.length}곳</b>을 먼저 보여드릴게요.{m.aiPending ? " 더 맞는 곳이 있는지 살펴보는 중이에요." : ""}
        {m.note ? ` ${m.note}` : ""}
      </AiSay>
      <div className="tb-hcards">
        {picks.map((p, i) => (
          <PickCard key={p.token} p={p} i={i} of={picks.length} note={notes[i]} t={prices[i]} isLow={lowOnce && totals[i] === low} q={q} nights={nights} saved={saved.has(p.token)} active={active === p.token} onSave={onSave} onOpenHotel={onOpenHotel} />
        ))}
      </div>
      {picks.length > 1 && (
        <table className="tb-compare">
          <thead>
            <tr>
              <th>한눈에 보기</th>
              {picks.map((p) => (
                <th key={p.token}>{short(p.h.name)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{nights}박 총액</td>
              {picks.map((p, i) => (
                <td key={p.token} className={lowOnce && totals[i] === low ? "best" : undefined}>
                  {Number.isFinite(totals[i]) ? won(totals[i]) : "확인 전"}
                </td>
              ))}
            </tr>
            <tr>
              <td>평점</td>
              {picks.map((p) => (
                <td key={p.token} className={p.h.rating && p.h.rating === bestRating ? "best" : undefined}>
                  {p.h.rating ? p.h.rating.toFixed(1) : "–"}
                </td>
              ))}
            </tr>
            <tr>
              <td>등급</td>
              {picks.map((p) => (
                <td key={p.token}>{p.h.stars ? `${p.h.stars}성급` : p.h.kind || "–"}</td>
              ))}
            </tr>
          </tbody>
        </table>
      )}
      <div className="tb-follow">
        {options.length > picks.length && (
          <button type="button" className="all" onClick={onAll}>
            전체 {options.length}곳 보기
          </button>
        )}
        {STAY_REFINES.filter((r) => refineStays(options, r.id, nights).length > 0).map((r) => (
          <button key={r.id} type="button" onClick={() => onRefine(r.id, r.label)}>
            {r.label}
          </button>
        ))}
        <button type="button" onClick={() => onPrefill("flight", { depart: q.checkIn, ret: q.checkOut, adults: q.adults })}>
          <IconPlane size={16} /> 이제 항공권 찾기
        </button>
      </div>
    </div>
  );
}

function FlightResult({ m, onAll, onRefine, onRetry, onPrefill }: MsgProps & { m: FlightMsg }) {
  const q = m.query;
  const route = `${cityOf(q.fromLabel || q.from)} → ${cityOf(q.toLabel || q.to)}`;
  if (m.status === "loading") return <Searching text={`${route} 항공편을 찾고 있어요`} />;
  if (m.status === "error") return <ErrorBox status={m.err} onRetry={onRetry} fallbackHref={flightLink(q)} fallbackLabel="트립닷컴에서 보기" />;
  const options = m.options ?? [];
  if (!options.length) return <AiSay>이 날짜에는 항공편을 찾지 못했어요. 날짜나 공항을 바꿔 보세요.</AiSay>;
  const picks = (m.picks ?? []).map((p) => ({ ...p, o: options[p.n - 1] })).filter((p) => p.o);
  return (
    <div className="tb-result">
      <AiSay>
        {route} {options.length}편 중에 <b>{picks.length}편</b>을 먼저 보여드릴게요. 가격은 {paxOf(q)}명 {q.ret ? "왕복" : "편도"} 총액이에요.{m.note ? ` ${m.note}` : ""}
      </AiSay>
      <div className="tb-cards">
        {picks.map((p, i) => (
          <FlightCard key={`${p.n}`} o={p.o} q={q} reason={p.reason} rank={i + 1} />
        ))}
      </div>
      <div className="tb-follow">
        {options.length > picks.length && (
          <button type="button" className="all" onClick={onAll}>
            전체 {options.length}편 보기
          </button>
        )}
        {FLIGHT_REFINES.filter((r) => refineFlights(options, r.id).length > 0).map((r) => (
          <button key={r.id} type="button" onClick={() => onRefine(r.id, r.label)}>
            {r.label}
          </button>
        ))}
        <button type="button" onClick={() => onPrefill("stay", { place: cityOf(q.toLabel || ""), checkIn: q.depart, checkOut: q.ret || undefined, adults: q.adults })}>
          <IconBed size={16} /> 이제 숙소 찾기
        </button>
      </div>
    </div>
  );
}

// ---------- 지금 · 마이 ----------
function Soon({ title, lead, items }: { title: string; lead: string; items: string[] }) {
  return (
    <main className="tb-page">
      <h1>{title}</h1>
      <span className="tb-tag ac">곧 열려요</span>
      <p className="tb-lead">{lead}</p>
      <ul className="tb-soon-list">
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </main>
  );
}

function My({ saved, profile, onTaste, onOpen, onSave, onHome, onFlight, onMoreStays }: { saved: Saved[]; profile: TasteProfile | null; onTaste: () => void; onOpen: (s: Saved) => void; onSave: (s: Saved) => void; onHome: () => void; onFlight: (t: Trip) => void; onMoreStays: (t: Trip) => void }) {
  const summary = profileLines(profile).join("\n");
  const [shared, setShared] = useState<string | null>(null);
  useEffect(() => setShared(new URLSearchParams(window.location.search).get("trip")), []);
  return (
    <main className="tb-page">
      <h1>마이</h1>
      <SharedTripView code={shared} />
      <section className="tb-taste-box">
        <h2 className="tb-h2">내 여행 취향</h2>
        <p>{summary || "아직 알려 주신 취향이 없어요. 설정하면 AI 추천 3곳이 취향에 맞춰져요."}</p>
        <button type="button" className="tb-btn" onClick={onTaste}>
          {summary ? "취향 다시 설정하기" : "취향 설정하기"}
        </button>
      </section>
      <MyTrips saved={saved} onOpen={onOpen} onSave={onSave} onHome={onHome} onFlight={onFlight} onMoreStays={onMoreStays} />
      <ClearHistory />
      <TripFooter />
    </main>
  );
}

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { labelForCode, loadAirports, searchCities, searchPlaces } from "@/lib/airports";
import { unknownPlace } from "@/lib/place-check";
import { brand, BRAND_AI_NAME, BRAND_NAME } from "@/lib/brand";
import { today as localToday } from "@/lib/dates";
import { HOTEL_SELLERS_LIVE, HOTEL_SELLERS_PENDING, sellerDef, sellerSearchUrl } from "@/lib/hotel-sellers";
import type { HotelOption } from "@/lib/hotels";
import { criteriaWeights, EMPTY_PROFILE, profileLines, readSaved, TASTE_KEY, withProfile, type TasteProfile, type TasteSaved, type TasteStatus } from "@/lib/taste";
import { site } from "@/lib/site";
import { HOME_PLACES, photoUrl } from "@/lib/home-places";
import { hotelFromPreview, hotelFromSeed, hotelHref, hotelQueryOf, hotelTokenOf, readPreview, savePreview, type HotelSeed } from "@/lib/hotel-link";
import { HomeWatchCard } from "./HomeWatchCard";
import { HomeGuard } from "./HomeGuard";
import type { CityLow } from "@/lib/home-cities";

// PC 홈 대표 사진: 인기 여행지 카드와 같은 도쿄 사진
import { HOME_STEPS, HOME_TRUST } from "@/lib/home-info";
import type { FlightOption } from "@/lib/flights";
import { searchErrorMessage, SEARCH_RETRY_LABEL } from "@/lib/search-error";
import { dateFixText, flightHref, parseHomeSearch, stayHref, TAB_PATH, tabOf, type Tab } from "@/lib/trip-url";
import { maxWait, TOO_LONG_WAIT, waitText } from "@/lib/flight-legs";
import { adultsIn, datesIn, placeIn } from "@/lib/chat-parse";
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
import { FlightSheet, StaySheet } from "./InputSheets";
import type { SearchKind } from "./SearchCard";
import { HomeSearch } from "./HomeSheet";
import { HomeLows } from "./HomeLows";
import { flightFilterOf, optsParam, readOpts, stayFilterOf } from "@/lib/home-opts";
import { agoText, readActive, readSnaps, saveActive, writeSnap, type Snapshot } from "@/lib/home-snapshot";
import { addRecent } from "@/lib/recent-search";
import { defaultDates } from "./InputSheets";
import { Sheet } from "./Sheet";
import type { StayPick } from "./StayList";
import { fitsParty } from "@/lib/room-fit";
import { requestSimilar } from "./similar";
import { AiOffNote } from "./AiOffNote";
import { checkInput, priceState, type Checkpoints } from "@/lib/checkpoints";
import { hasFreeCancel } from "@/lib/stay-filters";
import { CheckLine } from "./CheckBox";
import { useCheckpoints } from "./useCheckpoints";
import { rankNotes, stayFactLine, type RankNote } from "@/lib/stay-facts";
import { getVerified, prefetchPrices, shownPrice, useLazyPrice, usePriceVersion, verifiedCost } from "./prices";
import { setSavedList, type SavedBase } from "./saved-price";
import type { Trip } from "@/lib/trips";
import { flightLink } from "@/lib/flights";
import type { FlightInsights } from "./FlightTrend";
import type { Peer } from "@/lib/usual-price";
import dynamic from "next/dynamic";

// 홈 첫 화면(검색 칸·인기 여행지)에 필요 없는 코드는 따로 나눠, 처음 열 때 받는 자바스크립트를 줄인다 (C12).
// 결과 목록·상세·마이 화면 코드는 그 화면을 처음 그릴 때 받고, 사람이 화면을 만지면 미리 받아 둔다 (warmChunks)
const lazy = <P,>(load: () => Promise<React.ComponentType<P>>) => dynamic(load, { ssr: false });
const loadStayList = () => import("./StayList");
const loadFlights = () => import("./Flights");
const loadSeller = () => import("./SellerSheet");
const StayList = lazy(() => loadStayList().then((m) => m.StayList));
const PhotoStrip = lazy(() => loadStayList().then((m) => m.PhotoStrip));
const PriceBlock = lazy(() => loadStayList().then((m) => m.PriceBlock));
const RankLines = lazy(() => loadStayList().then((m) => m.RankLines));
const FlightBrowser = lazy(() => loadFlights().then((m) => m.FlightBrowser));
const FlightCard = lazy(() => loadFlights().then((m) => m.FlightCard));
const SellerBody = lazy(() => loadSeller().then((m) => m.SellerBody));
const SellerSheet = lazy(() => loadSeller().then((m) => m.SellerSheet));
const Onboarding = lazy(() => import("./Onboarding").then((m) => m.Onboarding));
const SharedTripView = lazy(() => import("./TripRecheck").then((m) => m.SharedTripView));
const MapPanel = lazy(() => import("./MapPanel").then((m) => m.MapPanel));
const MyTrips = lazy(() => import("./MyTrips").then((m) => m.MyTrips));
const ClearHistory = lazy(() => import("./ClearHistory").then((m) => m.ClearHistory));
const HotelPage = lazy(() => import("./HotelPage").then((m) => m.HotelPage));
let warmed = false;
function warmChunks() {
  if (warmed) return;
  warmed = true;
  void loadStayList();
  void loadFlights();
  void loadSeller();
}
import { IconBack, IconBed, IconChatStar, IconClose, IconCompass, IconHeart, IconHome, IconOut, IconPlane, IconPlus, IconSpark, IconUp, IconUser } from "./icons";
import { PriceWatchBox, useDrops } from "./PriceWatch";
import { BookingWatchBox, RegisterHint } from "./BookingWatch";
import { MySettings } from "./MySettings";
import { bumpAiCount } from "@/lib/ui-prefs";

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
  | { id: string; t: "stay"; home?: boolean; query: StayQuery; status: Status; err?: number | null; options?: HotelOption[]; picks?: StayPick[]; aiPending?: boolean; note?: string; unknown?: boolean; next?: string | null; pages?: number; more?: "loading" | "error"; cls?: string; base?: { options: HotelOption[]; next: string | null; pages: number }; aiOff?: boolean }
  | { id: string; t: "flight"; home?: boolean; query: FlightQuery; status: Status; err?: number | null; options?: FlightOption[]; insights?: FlightInsights; picks?: { n: number; reason: string }[]; aiPending?: boolean; note?: string; aiOff?: boolean }; // aiOff: AI가 두 번 다 실패해 가격순 3편을 보여 줌

type StayMsg = Extract<Msg, { t: "stay" }>;
type FlightMsg = Extract<Msg, { t: "flight" }>;
type AskMsg = Extract<Msg, { t: "ask" }>;
type Saved = { hotel: HotelOption; query: StayQuery; base?: SavedBase }; // base: 담을 때 보이던 금액 (가격 알림용)

const uid = () => Math.random().toString(36).slice(2, 10);
const SAVED_KEY = "tb-saved-v1";
const UPGRADE_MS = 30 * 60 * 1000;
const MORE_PAGES = 5; // 스크롤로 더 불러오는 쪽 수 상한 (검색 한 번당 최대 5번 더, 약 100곳)
// 돈 아끼는 질문 위주 (2026-11-25)
const EXAMPLES = ["12월 오사카 2박, 30만 원 안에서 역 가까운 곳", "후쿠오카 2박, 무료 취소 되는 곳 중 낮은 순", "인천에서 다낭 왕복, 직항 중 총액 낮은 편"];

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
    // 다른 탭(PC에서 새 탭으로 연 숙소 상세)에서 찜하면 이 탭의 홈 '내 가격 지킴이'·내 여행에도 바로 반영
    const on = (e: StorageEvent) => {
      if (e.key !== SAVED_KEY) return;
      try {
        setSaved(e.newValue ? (JSON.parse(e.newValue) as Saved[]) : []);
      } catch {
        // 깨진 값은 무시
      }
    };
    window.addEventListener("storage", on);
    return () => window.removeEventListener("storage", on);
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
  // 탭은 주소가 정한다 (/ 홈, /chat AI 추천, /trips 내 여행, /my 마이). 뒤로 가기·새로 고침·공유가 그대로 된다
  const pathname = usePathname();
  const router = useRouter();
  // 홈 검색 칸 (내 가격 지킴이 빈 상태 버튼이 여기로 옮겨 준다)
  const homeSearchRef = useRef<HTMLDivElement>(null);
  // 홈 도시 카드 "2박 총액 ○원부터": 서버에 쌓인 가격 기록만 (유료 검색 0회)
  const [cityLow, setCityLow] = useState<Map<string, CityLow>>(new Map());
  useEffect(() => {
    let live = true;
    fetch("/api/home/cities")
      .then((r) => (r.ok ? (r.json() as Promise<{ items: CityLow[] }>) : { items: [] }))
      .then((d) => live && Array.isArray(d.items) && setCityLow(new Map(d.items.map((x) => [x.place, x]))))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);
  // 사람이 화면을 처음 만지면(누르기·입력·스크롤) 결과 화면 코드를 미리 받아 둔다. 첫 화면을 그리는 동안에는 받지 않는다
  useEffect(() => {
    const go = () => warmChunks();
    const opts = { once: true, passive: true } as const;
    const evs = ["pointerdown", "keydown", "touchstart", "scroll"] as const;
    evs.forEach((e) => window.addEventListener(e, go, opts));
    if (/[?&](q|from)=/.test(window.location.search) || window.location.pathname !== "/") warmChunks();
    return () => evs.forEach((e) => window.removeEventListener(e, go));
  }, []);
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
  // 가격 핀 지도를 연 결과 (null이면 닫힘). 휴대폰은 전체 화면, PC는 오른쪽 패널. 지도는 이때만 불러온다 (Mapbox 지도 로드 과금)
  const [mapFor, setMapFor] = useState<string | null>(null);
  const [mapSel, setMapSel] = useState<string | null>(null); // 지도를 열 때 골라 둘 숙소 (상세의 [크게 보기])
  // PC 홈 숙소 결과: [목록 | 목록+지도 | 지도만]. 기본은 목록+지도. 큰 지도는 처음 보일 때 한 번만 만들고, 목록만 볼 때는 숨겨 둔다 (Mapbox 지도 로드 1번)
  const [rview, setRview] = useState<"list" | "split" | "map">("split");
  const [bigMapOn, setBigMapOn] = useState(false);
  const [shownList, setShownList] = useState<HotelOption[] | null>(null); // 목록에서 정렬·필터를 거친 숙소 (지도 핀)
  const [hoverTok, setHoverTok] = useState<string | null>(null);
  const [areaOnly, setAreaOnly] = useState<Set<string> | null>(null); // [이 지역에서 다시 검색]: 지도 범위 안 숙소만
  // 상세 페이지에 앱 안에서 들어왔는지 (휴대폰: 뒤로 가기로 목록·지도와 스크롤 위치를 그대로 되돌린다)
  const inAppHotel = useRef(false);
  const { saved, toggle, upgrade } = useSaved();
  const drops = useDrops(saved); // 찜한 숙소 중 가격이 내려간 곳 (내 여행 탭에서 하루 한 번 확인한 결과)
  setSavedList(saved); // 카드·상세가 담을 때 금액을 찾아볼 수 있게
  const priceVersion = usePriceVersion();
  useEffect(() => {
    if (saved.some((s) => s.base && !s.base.verified)) upgrade();
  }, [priceVersion, saved, upgrade]);
  const savedSet = new Set(saved.map((s) => s.hotel.token));
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // 홈 검색 주소별 빠른 조건 칩 (결과 필터의 처음 값). 탭을 옮겼다 돌아와도 같은 조건으로 보인다
  const optsRef = useRef(new Map<string, string[]>());
  // 홈 '최근 확인한 최저 가격'
  const [snaps, setSnaps] = useState<Snapshot[]>([]);
  useEffect(() => setSnaps(readSnaps()), []);
  const msgsRef = useRef(msgs);
  msgsRef.current = msgs;
  const clsRef = useRef(new Map<string, string>()); // 결과별 지금 고른 성급 (응답이 늦게 와도 바로 비교하려고)

  const patch = useCallback((id: string, p: Partial<Msg>) => setMsgs((list) => list.map((m) => (m.id === id ? ({ ...m, ...p } as Msg) : m))), []);
  const push = useCallback((m: Msg) => setMsgs((list) => [...list, m]), []);
  // AI가 두 번 다 실패한 결과마다 'AI만 다시 부르기' (검색은 다시 하지 않는다)
  const aiRetry = useRef(new Map<string, () => void>());
  const retryAi = useCallback((id: string) => aiRetry.current.get(id)?.(), []);

  // 예전 공유 링크(/my?trip=…)는 담은 숙소가 옮겨 간 내 여행 탭으로 보낸다
  useEffect(() => {
    if (tab === "my" && /[?&]trip=/.test(window.location.search)) router.replace(`${TAB_PATH.trips}${window.location.search}`, { scroll: false });
  }, [tab, router]);
  // 다른 페이지 메뉴에서 /?tab=stay, /?tab=flight 로 오면 그 검색 탭을 연다
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t === "flight" || t === "stay") setKind(t);
  }, []);
  useEffect(() => {
    const on = () => setSearch(window.location.pathname === "/" ? window.location.search : "");
    on();
    window.addEventListener("popstate", on);
    return () => window.removeEventListener("popstate", on);
  }, [pathname]);

  const chatLen = msgs.filter((m) => !("home" in m && m.home)).length;
  // 입력창이 화면 아래를 가리는 높이를 재서 CSS 변수로 둔다 (대화 아래 여백·scroll-margin-bottom에 같은 값)
  // 휴대폰: 탭 막대 위에 떠 있는 입력창 → 화면 아래에서 입력창 윗변까지. PC: 아래에 붙는 입력창 높이
  useEffect(() => {
    if (tab !== "chat") return;
    const dock = document.querySelector<HTMLElement>(".tb-dock");
    if (!dock) return;
    const set = () => {
      const fixed = getComputedStyle(dock).position === "fixed";
      const h = Math.round(fixed ? window.innerHeight - dock.getBoundingClientRect().top : dock.offsetHeight);
      document.documentElement.style.setProperty("--tb-dock-h", `${Math.max(0, h)}px`);
    };
    set();
    const ro = new ResizeObserver(set);
    ro.observe(dock);
    window.addEventListener("resize", set);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", set);
    };
  }, [tab]);
  useEffect(() => {
    if (tab === "chat") endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chatLen, tab]);
  // 대화의 마지막 추천 결과가 나오면: 결과 전체(추천 3곳 + 한눈에 보기)가 입력창 위에 다 들어가면 결과 끝을 입력창 위에 맞추고,
  // 다 안 들어가면 결과 맨 위(추천 3곳)부터 보이게 올린다
  const lastChat = [...msgs].reverse().find((m) => !("home" in m && m.home));
  const lastDone = lastChat && (lastChat.t === "stay" || lastChat.t === "flight") && lastChat.status === "done" ? `${lastChat.id}:${lastChat.aiPending ? 1 : 0}` : "";
  useEffect(() => {
    if (tab !== "chat" || !lastDone) return;
    const r = requestAnimationFrame(() => {
      const list = document.querySelectorAll<HTMLElement>(".tb-msgs .tb-result");
      const el = list[list.length - 1];
      if (!el) return;
      const css = getComputedStyle(el);
      const room = window.innerHeight - (parseFloat(css.scrollMarginTop) || 0) - (parseFloat(css.scrollMarginBottom) || 0);
      el.scrollIntoView({ behavior: "smooth", block: el.offsetHeight <= room ? "end" : "start" });
    });
    return () => cancelAnimationFrame(r);
  }, [lastDone, tab]);

  // 화면(탭·홈 결과)마다 스크롤 위치를 기억해 두고, 돌아오면 그 자리로 되돌린다
  const view = tab === "hotel" ? `hotel:${pathname}` : `${tab}:${homeId ?? ""}`;
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
    setMapFor(null); // 지도도 닫는다
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
      // 성인 2명 이상이면 캡슐·도미토리는 AI 추천 후보에서 뺀다 (목록에는 남는다). 모두 빠지면 원래 목록 그대로
      const fit = pool.filter((h) => fitsParty(h, query.adults));
      const head = (fit.length ? fit : pool).slice(0, 40);
      const toPicks = (ps: { n: number; reason: string }[]) => ps.map((p) => ({ token: head[p.n - 1].token, reason: p.reason }));
      const want = withProfile(query.taste, profileRef.current, "stay"); // 그때 적은 말 + 온보딩 취향
      const fb = o.sorted ? head.slice(0, 3).map((h, i) => ({ n: i + 1, reason: stayFactReason(h, want) })) : fallbackStayPicks(head, want, query.budget, nights, criteriaWeights(profileRef.current));
      const overNote = over ? `예산(${Math.round(query.budget / 10000)}만 원) 안의 숙소가 없어서 가장 가까운 곳을 보여 드려요.` : "";
      patch(id, { status: "done", options, picks: toPicks(fb), aiPending: !o.local, note: overNote });
      setActiveId(id);
      if (o.local) return; // 받은 목록 안에서 다시 거른 결과는 예약처 가격도 새로 부르지 않는다 (이미 받은 금액만 씀)
      // 같은 조건(도시·날짜·인원·취향·예산)이면 저장해 둔 AI 결과를 그대로 써서 다시 열어도 순위가 바뀌지 않게 한다
      const memo = readPickMemo(query, want);
      const memoPicks = memo?.picks.map((p) => ({ n: head.findIndex((h) => h.token === p.token) + 1, reason: p.reason })).filter((p) => p.n > 0);
      if (memo && memoPicks && memoPicks.length === memo.picks.length) {
        patch(id, { picks: toPicks(memoPicks), aiPending: false, note: [overNote, memo.note].filter(Boolean).join(" ") });
        prefetchPrices(memoPicks.slice(0, 1).map((p) => head[p.n - 1]), query);
        return;
      }
      const askAi = async () => {
        const ai = await pickStays(head, want, query.budget); // 실패하면 api 쪽에서 한 번 다시 부른다
        if (!ai.ok) {
          // 그래도 실패: AI 없이 검색 때 받은 총액이 낮은 3곳 (총액이 없는 곳은 뒤로). '다시 시도'는 AI만 다시 부른다
          const cheap = head.map((h, i) => ({ i, v: h.total && h.total > 0 ? h.total : Infinity })).sort((a, b) => a.v - b.v).slice(0, 3);
          aiRetry.current.set(id, () => {
            patch(id, { aiPending: true, aiOff: false });
            void askAi();
          });
          patch(id, { picks: toPicks(cheap.map((c) => ({ n: c.i + 1, reason: stayFactReason(head[c.i], want) }))), aiPending: false, aiOff: true, note: overNote });
          prefetchPrices(cheap.slice(0, 1).map((c) => head[c.i]), query);
          return;
        }
        aiRetry.current.delete(id);
        const picks = mergePicks(ai.data.picks, fb, head.length, (n) => stayFactReason(head[n - 1], want));
        writePickMemo(query, want, { picks: toPicks(picks), note: ai.data.note ?? "" });
        patch(id, { picks: toPicks(picks), aiPending: false, aiOff: false, note: [overNote, ai.data.note].filter(Boolean).join(" ") });
        // AI 추천 1위만 예약처 가격을 미리 받아 카드 금액을 시트 1위 총액과 맞춰 둔다.
        // 2·3위는 카드가 화면에 보이거나 눌렀을 때 받는다 (검색 한 번당 가격 조회를 줄이기 위해)
        prefetchPrices(picks.slice(0, 1).map((p) => head[p.n - 1]), query);
      };
      await askAi();
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
        // 가격 흐름 카드: 응답에 온 가격 정보만 (받은 목록 안에서 다시 거른 결과에는 붙이지 않는다)
        patch(id, { insights: { level: r.data.level, typical: r.data.typical, history: r.data.history ?? null } });
      }
      if (!options.length) return patch(id, { status: "done", options: [], picks: [] });
      const want = withProfile(query.taste, profileRef.current, "flight");
      const fb = o.sorted ? options.slice(0, 3).map((f, i) => ({ n: i + 1, reason: flightFactReason(f, want) })) : fallbackFlightPicks(options, want);
      patch(id, { status: "done", options, picks: fb, aiPending: !o.local });
      setActiveId(id);
      if (o.local) return;
      const list = options;
      // 12시간 넘게 기다리는 항공편은 AI 후보에서 뺀다 (모두 그렇다면 그대로). 받은 번호는 원래 목록 번호로 되돌린다
      const okIdx = list.map((f, i) => (maxWait(f) <= TOO_LONG_WAIT ? i : -1)).filter((i) => i >= 0);
      const idx = okIdx.length ? okIdx : list.map((_, i) => i);
      const askAi = async () => {
      const ai = await pickFlights(idx.map((i) => list[i]), want);
      if (!ai.ok) {
        // 다시 불러도 실패하면 AI 요약 없이 낮은 가격순 3편. '다시 시도'는 AI만 다시 부른다
        const cheap = [...idx].sort((a, b) => list[a].price - list[b].price).slice(0, 3);
        aiRetry.current.set(id, () => {
          patch(id, { aiPending: true, aiOff: false });
          void askAi();
        });
        return patch(id, { picks: cheap.map((i) => ({ n: i + 1, reason: flightFactReason(list[i], want) })), aiPending: false, aiOff: true, note: "" });
      }
      aiRetry.current.delete(id);
      const aiPicks = ai.data.picks.map((p) => ({ ...p, n: Number.isInteger(p.n) && p.n >= 1 && p.n <= idx.length ? idx[p.n - 1] + 1 : 0 }));
      // AI 이유 끝에 경유 대기 시간을 붙인다 (이미 말했으면 그대로)
      const picks = mergePicks(aiPicks, fb, list.length, (n) => flightFactReason(list[n - 1], want)).map((p) => {
        const w = maxWait(list[p.n - 1]);
        return w > 0 && !/대기/.test(p.reason) ? { ...p, reason: `${p.reason} · 대기 ${waitText(w)}` } : p;
      });
      patch(id, { picks, aiPending: false, aiOff: false, note: ai.data.note });
      };
      await askAi();
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
    const urlOpts = readOpts(window.location.search);
    if (urlOpts.length) optsRef.current.set(key, urlOpts);
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

  // 문장에서 바로 뽑은 숙소 조건 (AI 응답을 기다리지 않고 쓸 수 있는 것만)
  function localStay(said: string): Partial<StayQuery> {
    const place = placeIn(said);
    const d = datesIn(said, localToday());
    const adults = adultsIn(said);
    return { ...(place ? { place } : {}), ...(d?.checkIn && d.checkOut ? d : {}), adults: adults || 2, budget: 0, taste: place ? said.replace(place, "").replace(/\d{1,2}\s*월(\s*\d{1,2}\s*일)?|\d{1,2}\s*박|[,·]/g, " ").replace(/\s+/g, " ").trim().slice(0, 100) : said.slice(0, 200) };
  }

  // ---------- AI 채팅: 자유 문장 ----------
  // help: 둘러보기 도움 카드에서 온 질문 (AI를 못 쓰면 숙소 입력 시트 대신 다시 눌러 달라고만 한다)
  async function send(raw: string, help = false) {
    const said = raw.trim();
    if (!said || busy) return;
    bumpAiCount(localToday()); // 마이 '오늘 AI 상담 이용 현황'
    setText("");
    setTab("chat");
    push({ id: uid(), t: "user", text: said });
    const base = msgsRef.current.find((m) => m.id === activeId && !(("home" in m) && m.home)) as StayMsg | FlightMsg | undefined;
    setBusy(true);
    // 채팅에 보고 있는 결과가 없으면 홈에서 방금 찾은 조건(도시·날짜·예산)을 이어받는다
    const r = await parseText(said, localToday(), contextOf(base) || readActive());
    setBusy(false);
    if (!r.ok && help) {
      push({ id: uid(), t: "ai", text: r.status === 429 ? "질문이 많아서 잠시 쉬어야 해요. 조금 뒤에 다시 물어봐 주세요." : "지금은 답을 불러오지 못했어요. 잠시 뒤에 다시 물어봐 주세요." });
      return;
    }
    if (!r.ok) {
      // AI를 못 쓰면: 보고 있는 결과가 있으면 같은 목록 안에서 취향만 더해 다시 정리하고(검색 없음), 없으면 입력 시트로 이어 준다
      if (base?.t === "stay" && base.options) return runStay({ ...base.query, taste: joinTaste(base.query.taste, said.slice(0, 100)) }, { reuse: base.options });
      if (base?.t === "flight" && base.options) return runFlight({ ...base.query, taste: joinTaste(base.query.taste, said.slice(0, 100)) }, { reuse: base.options });
      const flightish = /항공|비행|왕복|편도|출국/.test(said);
      // 숙소: 문장에서 도시·날짜를 뽑아 둘 다 있으면 바로 찾고, 모자라면 뽑은 값을 채운 입력 시트를 연다
      const local = localStay(said);
      if (!flightish && stayReady(local, localToday())) {
        push({ id: uid(), t: "ai", text: `${local.place} ${mdw(local.checkIn)}–${mdw(local.checkOut)} 조건으로 찾아볼게요.` });
        return goStay(local);
      }
      push({ id: uid(), t: "ai", text: r.status === 429 ? "질문이 많아서 잠시 쉬어야 해요. 조건을 직접 넣어 주시면 바로 찾아볼게요." : "조건을 직접 넣어 주시면 바로 찾아볼게요." });
      if (flightish) setFlightSheet({ taste: said.slice(0, 200) });
      else setStaySheet(local);
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
      // AI가 도시·날짜를 빠뜨렸으면 문장에서 직접 뽑은 값으로 채운다 (이어서 말할 때는 보고 있는 검색 조건이 먼저)
      const local = b ? {} : keep(localStay(said));
      const stay: Partial<StayQuery> = { ...(b ? b.query : {}), ...local, ...parsed, taste: b && !parsed.place ? joinTaste(b.query.taste, parsed.taste ?? "") : (parsed.taste ?? local.taste ?? "") };
      if (!stay.adults) stay.adults = 2;
      // 도시·날짜가 다 있으면 되묻지 않고 바로 찾는다 (취향·예산 질문은 결과를 본 뒤 칩으로 다듬을 수 있다)
      const ready = stayReady(stay, localToday());
      const questions = p.questions.filter((q) => !(q.slot === "place" && stay.place) && !(q.slot === "dates" && stay.checkIn && stay.checkOut) && !(q.slot === "adults" && stay.adults));
      if (questions.length && !ready) return push({ id: uid(), t: "ask", kind: "stay", reply: p.reply, stay, flight: {}, questions, answers: {}, done: false });
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
    setToast(was ? null : { text: `${query.place} 숙소를 찜했어요` });
  }

  // 홈 검색 칸을 채워서 보여 주기 (인기 여행지·대화의 '이제 항공편 찾기')
  function prefill(k: SearchKind, q: Partial<StayQuery> | Partial<FlightQuery>) {
    setKind(k);
    if (k === "stay") setPrefStay({ ...(q as Partial<StayQuery>) });
    else setPrefFlight({ ...(q as Partial<FlightQuery>) });
    goHome("/");
    // 홈 검색 칸이 맨 위에 있으니 화면을 맨 위로 (탭을 옮긴 뒤 스크롤 복원이 끝난 다음에)
    setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 120);
  }

  // 홈 입력 시트에서 찾기: 검색 1번 (같은 탭 30분 안 같은 조건이면 저장된 결과), 빠른 조건은 결과 필터의 처음 값으로
  function homeStay(q: StayQuery, opts: string[]) {
    setPrefStay(q);
    const href = stayHref(q);
    optsRef.current.set(href, opts);
    saveActive(contextOf({ id: "", t: "stay", query: q } as StayMsg));
    runStay(q, { home: true });
    goHome(href + optsParam(opts));
  }
  function homeFlight(q: FlightQuery, opts: string[]) {
    setPrefFlight(q);
    const href = flightHref(q);
    optsRef.current.set(href, opts);
    saveActive(contextOf({ id: "", t: "flight", query: q } as FlightMsg));
    runFlight(q, { home: true });
    goHome(href + optsParam(opts));
  }
  // 관심 여행지 카드: 기본 날짜(3주 뒤 2박)·성인 2명으로 바로 숙소를 찾는다
  function placeStay(place: string) {
    const [checkIn, checkOut] = defaultDates();
    const q: StayQuery = { place, checkIn, checkOut, adults: 2, budget: 0, taste: "" };
    addRecent({ kind: "stay", q });
    homeStay(q, []);
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
  // 홈 결과가 오면 '최근 확인한 최저 가격'에 남긴다. 숙소는 예약처에서 확인한 총액이 생길 때마다 다시 본다
  useEffect(() => {
    if (!homeMsg || homeMsg.status !== "done" || !homeMsg.options?.length) return;
    let low: number | null;
    let sub: string;
    if (homeMsg.t === "stay") {
      const q = homeMsg.query;
      const v = homeMsg.options.map((h) => verifiedCost(h, q)).filter((x) => Number.isFinite(x));
      low = v.length ? Math.min(...v) : null;
      sub = `${md(q.checkIn)}–${md(q.checkOut)} · ${guestText(q)}`;
    } else {
      const q = homeMsg.query;
      low = Math.min(...homeMsg.options.map((o) => o.price));
      sub = `${md(q.depart)}${q.ret ? `–${md(q.ret)}` : " 편도"} · ${paxText(q)}`;
    }
    const title = homeMsg.t === "stay" ? homeMsg.query.place : `${cityOf(homeMsg.query.fromLabel || homeMsg.query.from)} → ${cityOf(homeMsg.query.toLabel || homeMsg.query.to)}`;
    const href = homeHrefOf(homeMsg) + optsParam(optsRef.current.get(homeHrefOf(homeMsg)) ?? []);
    if (writeSnap({ kind: homeMsg.t, href, title, sub, low, at: Date.now() })) setSnaps(readSnaps());
  }, [homeMsg, priceVersion]);
  const homeOpts = homeMsg ? (optsRef.current.get(homeHrefOf(homeMsg)) ?? []) : [];
  const homeHref = homeMsg ? homeHrefOf(homeMsg) + optsParam(homeOpts) : "/";

  // ---------- 전용 숙소 상세 페이지 (/hotels/[propertyToken]) ----------
  // 목록 행·지도 요약 카드·AI 추천에서 숙소를 고르면: PC는 새 탭(지금 탭의 지도·필터·스크롤은 그대로), 휴대폰은 이 창에서 이동.
  // 새 탭은 이 탭의 화면 상태를 못 쓰므로 이 기기 localStorage에 미리 보기를 남겨 사진·제목을 바로 그린다
  const openHotel = useCallback(
    (h: HotelOption, q: StayQuery) => {
      const p = shownPrice(h, q);
      savePreview(h, p.none ? null : p.value);
      const href = hotelHref(h.token, q);
      if (wide) {
        const w = window.open(href, "_blank", "noopener,noreferrer");
        if (w) w.opener = null;
        return;
      }
      inAppHotel.current = true;
      router.push(href, { scroll: false });
    },
    [wide, router],
  );
  const hotelToken = tab === "hotel" ? hotelTokenOf(pathname) : null;
  // 상세 주소의 날짜·인원 (없거나 틀리면 3주 뒤 2박)
  const [hotelQ, setHotelQ] = useState<StayQuery | null>(null);
  const [seed, setSeed] = useState<HotelSeed | null>(null);
  useEffect(() => {
    if (!hotelToken) return;
    const q = hotelQueryOf(window.location.search);
    if (q) setHotelQ(q);
    else {
      const [a, b] = defaultDates();
      setHotelQ({ place: new URLSearchParams(window.location.search).get("q")?.slice(0, 100) ?? "", checkIn: a, checkOut: b, adults: 2, budget: 0, taste: "" });
    }
    // 공유 링크로 바로 들어오면 서버가 넣어 둔 기본 정보 (hotels_master, 유료 검색 0회)
    try {
      const el = document.getElementById("tb-hotel-seed");
      const v = el?.textContent ? (JSON.parse(el.textContent) as HotelSeed) : null;
      setSeed(v && v.token === hotelToken ? v : null);
    } catch {
      setSeed(null);
    }
  }, [hotelToken]);
  // 이 탭의 검색 결과 → 이 기기 미리 보기 → 서버 기본 정보 순서로 먼저 그릴 숙소
  const hotelBase = (() => {
    if (!hotelToken) return null;
    for (const m of [...msgs].reverse()) if (m.t === "stay") {
      const h = m.options?.find((o) => o.token === hotelToken);
      if (h) return h;
    }
    const pv = readPreview(hotelToken);
    if (pv) return hotelFromPreview(pv);
    return seed ? hotelFromSeed(seed) : null;
  })();
  // 같은 조건 검색 결과가 이 탭에 있으면 '평소 가격과 비교'·'동네 대비 가격'에 같이 쓴다 (검색은 새로 하지 않는다)
  const hotelFrom = hotelToken && hotelQ ? [...msgs].reverse().find((x): x is StayMsg => x.t === "stay" && !!x.options?.some((h) => h.token === hotelToken) && x.query.checkIn === hotelQ.checkIn && x.query.checkOut === hotelQ.checkOut && x.query.adults === hotelQ.adults) : undefined;
  const hotelPeers: Peer[] = (hotelFrom?.options ?? []).map((h) => {
    const p = shownPrice(h, hotelFrom!.query);
    return { token: h.token, stars: h.stars, total: p.none ? null : p.value, verified: p.verified };
  });
  const hotelSpots = (hotelFrom?.options ?? []).map((h) => {
    const p = shownPrice(h, hotelFrom!.query);
    return { token: h.token, gps: h.gps, price: p.verified && !p.none ? p.value : null };
  });
  const hotelReason = hotelToken ? [...msgs].reverse().flatMap((m) => (m.t === "stay" && !m.aiOff && !m.aiPending ? (m.picks ?? []) : [])).find((p) => p.token === hotelToken)?.reason : undefined;
  const hotelBack = () => {
    if (inAppHotel.current && window.history.length > 1) {
      inAppHotel.current = false;
      return router.back();
    }
    if (hotelQ?.place) return goHome(stayHref(hotelQ));
    goHome("/");
  };
  // 새 검색 결과가 오면 지도 범위 거르기는 푼다
  useEffect(() => {
    setAreaOnly(null);
    setShownList(null);
  }, [homeId]);
  const bigMapNow = wide && tab === "home" && homeMsg?.t === "stay" && homeMsg.status === "done" && !!homeMsg.options?.length && rview !== "list";
  useEffect(() => {
    if (bigMapNow) setBigMapOn(true);
  }, [bigMapNow]);
  const mapview = wide && tab === "home" && homeMsg?.t === "stay" && homeMsg.status === "done" && !!homeMsg.options?.length;
  // PC 2열: 홈 숙소 결과와 AI 채팅은 왼쪽 목록 + 오른쪽 예약처 패널
  // PC 2열: AI 채팅만 (왼쪽 대화 · 오른쪽 AI 추천 3곳). 홈 숙소 결과는 목록 + 큰 지도 (mapview)
  const split = wide && tab === "chat";
  const activeToken = seller?.hotel.token;
  // 열려 있는 숙소가 AI 추천 3곳 중 하나면 그 이유를 상세에도 보여 준다 (가장 최근 결과 기준)
  // 예약처 0곳 숙소의 '비슷한 숙소 보기': 같은 검색(같은 지역) 목록에서 같은 성급만 보여 준다. 목록이 없는 탭이면 그 지역 검색을 연다
  const similar = () => {
    if (!seller) return;
    const { hotel, query } = seller;
    setSeller(null);
    requestSimilar(hotel.stars ? Math.round(hotel.stars) : 0);
    const shown = (tab === "home" && homeMsg?.t === "stay" && homeMsg.query.place === query.place) || (tab === "chat" && !!listId);
    if (!shown) goHome(stayHref(query));
  };
  // '평소 가격과 비교'의 동급 평균: 열린 숙소가 들어 있는 가장 최근 같은 조건 검색 결과 (검색을 새로 하지 않는다)
  const sellerPeers: Peer[] = (() => {
    if (!seller) return [];
    const key = stayHref(seller.query);
    const m = [...msgs].reverse().find((x): x is StayMsg => x.t === "stay" && !!x.options?.some((h) => h.token === seller.hotel.token) && stayHref(x.query) === key);
    return (m?.options ?? []).map((h) => {
      const p = shownPrice(h, m!.query);
      return { token: h.token, stars: h.stars, total: p.none ? null : p.value, verified: p.verified };
    });
  })();
  const sellerReason = seller ? [...msgs].reverse().flatMap((m) => (m.t === "stay" && !m.aiOff && m.query.place === seller.query.place ? (m.picks ?? []) : [])).find((p) => p.token === seller.hotel.token)?.reason : undefined;
  // PC AI 추천 탭: 결과가 있으면 오른쪽 패널이 비지 않게 AI 추천 1위를 먼저 열어 둔다 (홈 결과는 StayList onTop이 목록 맨 위 숙소를 연다)
  const panelMsg = (tab === "home" ? homeMsg : [...chatMsgs].reverse().find((x) => x.t === "stay")) as StayMsg | FlightMsg | undefined;
  // PC AI 추천 탭 오른쪽: 가장 최근 숙소 답의 추천 3곳 (답이 다 나온 뒤에만)
  const chatStay = tab === "chat" && panelMsg?.t === "stay" && panelMsg.status === "done" && !!panelMsg.options?.length && !!panelMsg.picks?.length ? panelMsg : undefined;
  // AI 답이 온 뒤에 추천 1번을 연다 (그 전에 규칙으로 정한 곳을 열었다가 바뀌지 않게)
  // (2026-11-27) PC 오른쪽 상세 패널은 없어졌다: 숙소는 전용 상세 페이지에서 본다
  const firstStay: HotelOption | null = null;
  // 새 검색 결과가 오면(아동·객실이 다른 조건 포함) 이전 검색에서 열어 둔 숙소 대신 새 결과의 1번을 연다 (패널 머리 인원이 결과 머리와 같게).
  // 같은 결과 안에서 사람이 연 숙소는 그대로 둔다
  const panelFor = useRef<string | null>(null);
  useEffect(() => {
    if (panelMsg?.t !== "stay" || !firstStay) return;
    const fresh = panelFor.current !== panelMsg.id;
    if (!seller || (fresh && split && stayHref(seller.query) !== stayHref(panelMsg.query))) setSeller({ hotel: firstStay, query: panelMsg.query });
    panelFor.current = panelMsg.id;
  }, [seller, firstStay, panelMsg, split]);

  // 지도: PC는 오른쪽 패널(지금 패널이 보여 주는 결과의 숙소), 휴대폰은 전체 화면
  const mapMsg = msgs.find((x): x is StayMsg => x.id === mapFor && x.t === "stay" && x.status === "done" && !!x.options?.length);
  const closeMap = () => {
    setMapFor(null);
    setMapSel(null);
  };
  // 숙소 상세의 작은 지도 [크게 보기]: 그 숙소가 들어 있는 같은 조건 검색 결과를 지도로 열고 그 숙소를 골라 둔다
  const bigMap = () => {
    if (!seller) return;
    const key = stayHref(seller.query);
    const m = [...msgs].reverse().find((x): x is StayMsg => x.t === "stay" && x.status === "done" && !!x.options?.some((h) => h.token === seller.hotel.token) && stayHref(x.query) === key);
    if (!m) return;
    setMapSel(seller.hotel.token);
    if (!wide) setSeller(null);
    setMapFor(m.id);
  };

  return (
    <div className="tb-app">
      <div className={`tb-main${split ? " split aichat ai3" : ""}${split && !chatStay ? " nopanel" : ""}${tab === "home" && !homeMsg ? " home" : ""}${tab === "home" && homeMsg?.t === "flight" ? " flight" : ""}${mapview ? ` mapview v-${rview}` : ""}${tab === "hotel" ? " hotelpage" : ""}`}>
        {tab === "home" &&
          (homeMsg ? (
            <HomeResult
              key={homeMsg.id}
              opts={homeOpts}
              m={homeMsg}
              saved={savedSet}
              onBack={() => goHome("/")}
              onSave={(h) => homeMsg.t === "stay" && save(h, homeMsg.query)}
              onOpen={(h) => homeMsg.t === "stay" && openHotel(h, homeMsg.query)}
              active={activeToken}
              onRetry={() => (homeMsg.t === "stay" ? runStay(homeMsg.query, { home: true }) : runFlight(homeMsg.query, { home: true }))}
              onAiRetry={() => retryAi(homeMsg.id)}
              fixNote={dateFix && homeHrefOf(homeMsg) === dateFix.href ? dateFix.text : ""}
              onPlace={(place) => {
                if (homeMsg.t !== "stay") return;
                const q = { ...homeMsg.query, place };
                runStay(q, { home: true });
                goHome(stayHref(q));
              }}
              onMore={() => loadMore(homeMsg.id)}
              onStars={(s) => byStars(homeMsg.id, s)}
              onMap={() => setMapFor(homeMsg.id)}
              onShown={mapview ? setShownList : undefined}
              onHover={mapview && rview === "split" ? setHoverTok : undefined}
              only={mapview && rview === "split" ? areaOnly : null}
              onAllArea={() => setAreaOnly(null)}
              viewSwitch={mapview ? <ViewSwitch3 v={rview} set={setRview} /> : undefined}
            />
          ) : (
            <main className="tb-home">
              <header className="tb-top">
                <span className="tb-logo">
                  <Orb size={30} />
                  <strong>{BRAND_NAME}</strong>
                  {brand.tentative && <em className="tb-provisional">가칭</em>}
                </span>
              </header>
              {/* 2026-11-27 PR 2/3: 히어로 2단. PC(768px+) 왼쪽 헤드라인·설명 / 오른쪽 가격 지킴이 카드, 아래 검색 바.
                  휴대폰은 헤드라인 → 검색 바(예시 칩·신뢰 문구) → 카드 순서로 첫 화면에서 바로 검색한다. 홈에 들어올 때 유료 검색 0회 */}
              <section className="tb-hh">
                <div className="tb-hh-copy">
                  <h1 className="tb-hh-title">예약하고 끝나지 않아요</h1>
                  <p className="tb-hh-sub">주요 예약처의 세금 포함 총액을 한 번에 비교하고, 예약한 뒤에도 체크인 날까지 가격을 지켜봐요. 더 싸지면 무료 취소 기한 안에 알려드려요.</p>
                </div>
                <div className="tb-hh-search" ref={homeSearchRef}>
                  <RegisterHint />
                  <HomeSearch kind={kind} onKind={setKind} stay={prefStay} flight={prefFlight} onStay={homeStay} onFlight={homeFlight} onTalk={(t) => send(t)} />
                </div>
                <div className="tb-hh-card">
                  <HomeWatchCard onGo={(href) => router.push(href)} onTrips={() => setTab("trips")} onExampleCity={() => placeStay("도쿄")} />
                </div>
              </section>
              <HomeGuard
                saved={saved}
                onOpenSaved={(s) => openHotel(s.hotel, s.query)}
                onGo={(token, q) => router.push(hotelHref(token, q))}
                onTrips={() => setTab("trips")}
                onSearch={() => {
                  homeSearchRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                  homeSearchRef.current?.querySelector("input")?.focus({ preventScroll: true });
                }}
              />
              {snaps.length > 0 && (
                <section className="tb-sec">
                  <h2>최근 확인한 최저 가격</h2>
                  <div className="tb-snaps">
                    {snaps.map((x) => (
                      <button key={x.href} type="button" className="tb-snap" onClick={() => goHome(x.href)}>
                        <span className="tb-snap-icon" aria-hidden>
                          {x.kind === "stay" ? <IconBed size={20} /> : <IconPlane size={20} />}
                        </span>
                        <span className="tb-snap-text">
                          <strong>{x.title}</strong>
                          <small>{x.sub}</small>
                        </span>
                        <span className="tb-snap-price">
                          {x.low ? (
                            <>
                              <b>{x.low.toLocaleString("ko-KR")}원</b>
                              <small>{x.kind === "stay" ? "숙박 총액" : "항공 총액"} · {agoText(x.at)}</small>
                            </>
                          ) : (
                            <small>결과에서 확인</small>
                          )}
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
              )}
              <HomeLows
                onPick={(q) => {
                  addRecent({ kind: "stay", q });
                  homeStay(q, []);
                }}
              />
              <section className="tb-sec">
                <h2>지금 많이 찾는 관심 여행지</h2>
                <div className="tb-places r43">
                  {HOME_PLACES.map((p) => (
                    <button key={p.name} type="button" onClick={() => placeStay(p.name)}>
                      <img
                        src={photoUrl(p.photo, 480, 360)}
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
                        {/* 이미 쌓인 가격 기록이 있는 도시만 (없으면 금액을 쓰지 않는다) */}
                        {cityLow.get(p.name) && (
                          <em className="tb-place-price">
                            2박 총액 {won(cityLow.get(p.name)!.from)}부터
                            {cityLow.get(p.name)!.pct ? <i> · 지난주보다 {cityLow.get(p.name)!.pct}% ↓</i> : null}
                          </em>
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
              {/* 3단계 가격 방어: 상자 없이 먹색 1px 선 + 3열 글자. 아래 숫자는 설명용 예시라 캡션을 꼭 붙인다 */}
              <section className="tb-sec tb-steps" aria-label="가격을 지키는 3단계">
                <h2>단 한 번의 검색으로 끝내고, 체크인까지 지키는 가격</h2>
                <ol>
                  {HOME_STEPS.map((st) => (
                    <li key={st.n}>
                      <span className="tb-steps-n">{st.n}</span>
                      <strong>{st.title}</strong>
                      <p>{st.text}</p>
                    </li>
                  ))}
                </ol>
                <p className="tb-steps-ex">
                  <span>
                    예약 당시 총액 <b>342,000원</b> → 다시 확인한 최저가 <b>298,000원</b> · <b>44,000원</b> 절약 가능
                  </span>
                  <small>이해를 돕기 위한 예시 화면이에요</small>
                </p>
              </section>
              <ul className="tb-trust" aria-label="이용 안내">
                {HOME_TRUST.map((t) => (
                  <li key={t.title}>
                    <strong>{t.title}</strong>
                    <span>{t.text}</span>
                  </li>
                ))}
              </ul>
              {/* 실제로 가격을 받아 견주는 예약처 (lib/hotel-sellers.ts 허용 목록과 같다) */}
              <p className="tb-trust-sellers">비교하는 예약처: {HOTEL_SELLERS_LIVE.map((k) => sellerDef(k).ko).join(" · ")}</p>
              {HOTEL_SELLERS_PENDING.length > 0 && <p className="tb-trust-sellers sub">국내 예약처는 준비 중이에요</p>}
              <TripFooter />
            </main>
          ))}

        {tab === "chat" && (
          <main className={`tb-chat${chatMsgs.length === 0 ? " empty" : ""}`}>
            <header className="tb-chat-top">
              <Orb size={40} />
              <span>
                <strong>{BRAND_AI_NAME}</strong>
                <small>예산 안에서 아끼는 쪽으로 추천해요</small>
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
                {/* PC: 구슬 대신 8px 먹색 점 + AI 이름 */}
                <p className="tb-ai-mark">
                  <i aria-hidden />
                  {BRAND_AI_NAME}
                </p>
                <h1>예산과 원하는 조건을 편하게 말해 주세요</h1>
                <p>예약처 총액을 견줘서 아끼는 쪽으로 3곳만 먼저 추천해 드려요.</p>
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
                    onOpenHotel={(hotel) => m.t === "stay" && openHotel(hotel, m.query)}
                    active={activeToken}
                    onSave={(hotel) => m.t === "stay" && save(hotel, m.query)}
                    onAll={() => setListId(m.id)}
                    onRefine={(id, label) => (m.t === "stay" || m.t === "flight") && refine(m, id, label)}
                    onRetry={() => (m.t === "stay" ? runStay(m.query) : m.t === "flight" ? runFlight(m.query) : undefined)}
                    onAiRetry={() => retryAi(m.id)}
                    onSay={send}
                    onPrefill={prefill}
                    onMap={() => setMapFor(m.id)}
                    side={split && m.id === chatStay?.id}
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

        {tab === "trips" && <MyTripsTab onRegister={() => prefill("stay", {})} saved={saved} onOpen={(s) => setSeller(s)} onSave={(s) => save(s.hotel, s.query)} onHome={() => goHome("/")} onFlight={tripFlight} onMoreStays={(t) => goHome(stayHref({ place: t.city, checkIn: t.checkIn, checkOut: t.checkOut, adults: t.adults, budget: 0, taste: "" }))} />}
        {tab === "my" && <My profile={taste.profile} onTaste={() => setOnb(true)} onTrips={() => setTab("trips")} />}
        {tab === "hotel" && hotelToken && hotelQ && (
          <HotelPage
            key={`${hotelToken}:${stayHref(hotelQ)}`}
            token={hotelToken}
            hotel={hotelBase}
            query={hotelQ}
            saved={savedSet.has(hotelToken)}
            onSave={(h) => save(h, hotelQ)}
            onBack={hotelBack}
            backLabel={hotelQ.place ? "목록·지도로 돌아가기" : "홈으로"}
            onGo={(text) => setToast({ text, go: true })}
            onToast={(text) => setToast({ text, go: true })}
            reason={hotelReason}
            peers={hotelPeers}
            spots={hotelSpots}
          />
        )}

        {split && chatStay && <ChatPicks m={chatStay} saved={savedSet} onSave={(h) => save(h, chatStay.query)} onOpen={(h) => openHotel(h, chatStay.query)} />}

        {/* PC 홈 숙소 결과 오른쪽 큰 지도 (목록+지도 52% · 지도만). 한 번 만든 지도는 목록만 볼 때도 숨겨 두고 다시 쓴다 */}
        {wide && bigMapOn && (
          <aside className="tb-bigmap" hidden={!bigMapNow} aria-label="숙소 지도">
            {homeMsg?.t === "stay" && homeMsg.options?.length ? (
              <MapPanel
                side
                query={homeMsg.query}
                options={shownList ?? homeMsg.options}
                fitKey={homeMsg.id}
                hover={hoverTok}
                saved={savedSet}
                onSave={(h) => save(h, homeMsg.query)}
                onOpen={(h) => openHotel(h, homeMsg.query)}
                onList={() => setRview("list")}
                onArea={(tokens) => {
                  setAreaOnly(new Set(tokens));
                  if (rview === "map") setRview("split");
                }}
              />
            ) : null}
          </aside>
        )}

        <nav className="tb-tabbar" aria-label="메뉴">
          {/* PC 머리글 왼쪽 글자 로고 (구슬은 파비콘·앱 아이콘에만) */}
          <span className="tb-logo tb-tabbar-logo">
            <strong>{BRAND_NAME}</strong>
            {brand.tentative && <em className="tb-provisional">가칭</em>}
          </span>
          {/* 4탭 (2026-11-25 돈 아끼는 예약에 집중): 홈 · AI 추천 · 내 여행 · 마이. 모두 같은 크기. PC에서는 위쪽 머리글 메뉴가 된다 */}
          {(
            [
              { id: "home", label: "홈", icon: <IconHome size={24} /> },
              { id: "chat", label: "AI 추천", icon: <IconCompass size={24} /> },
              { id: "trips", label: "내 여행", icon: <IconHeart size={24} /> },
              { id: "my", label: "마이", icon: <IconUser size={24} /> },
            ] as { id: Tab; label: string; icon: React.ReactNode; soon?: boolean }[]
          ).map((it) => (
            <Link
              key={it.id}
              href={it.id === "home" ? (tab === "home" ? "/" : homeHref) : TAB_PATH[it.id]}
              scroll={false}
              /* away: 검색 결과(/hotels, /?q=)·숙소 상세(/hotels/[token])는 홈 첫 화면이 아니라 PC 머리글의 '홈' 밑줄을 그리지 않는다 (휴대폰 아래 탭은 홈 그대로) */
              className={`tb-tab${it.id === "home" && (tab === "hotel" || (tab === "home" && !!homeMsg)) ? " away" : ""}`}
              aria-current={tab === it.id || (tab === "hotel" && it.id === "home") ? "page" : undefined}
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
              {it.id === "trips" && drops.length > 0 && tab !== "trips" && <i className="tb-tab-dot" aria-label={`가격이 내려간 숙소 ${drops.length}곳`} />}
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
                setTab("trips");
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

      {!wide && mapMsg && (
        <div className="tb-map-wrap">
          <MapPanel key={mapMsg.id} query={mapMsg.query} options={mapMsg.options ?? []} initial={mapSel} onOpen={(h) => openHotel(h, mapMsg.query)} onList={closeMap} />
        </div>
      )}
      {/* PC: [지도로 보기]·패널 [크게 보기] 모두 넓은 지도 창 (94vw × 90vh, 최대 1360px) */}
      {wide && mapMsg && (
        <MapPanel
          key={mapMsg.id}
          modal
          query={mapMsg.query}
          options={mapMsg.options ?? []}
          initial={mapSel ?? (seller && stayHref(seller.query) === stayHref(mapMsg.query) ? seller.hotel.token : null)}
          onOpen={(h) => openHotel(h, mapMsg.query)}
          onList={closeMap}
        />
      )}

      <AllList
        onMap={(id) => {
          setListId(null);
          setMapFor(id);
        }}
        m={msgs.find((x) => x.id === listId) as StayMsg | FlightMsg | undefined}
        saved={savedSet}
        onSave={(h, q) => save(h, q)}
        onOpen={(h, q) => openHotel(h, q)}
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
        onSimilar={similar}
        peers={sellerPeers}
        onBigMap={bigMap}
      />
    </div>
  );
}

// PC 홈 숙소 결과 [목록 | 목록+지도 | 지도만]. 바꿔도 지도는 새로 만들지 않는다 (크기만 다시 잰다)
function ViewSwitch3({ v, set }: { v: "list" | "split" | "map"; set: (v: "list" | "split" | "map") => void }) {
  const items = [
    { id: "list", label: "목록" },
    { id: "split", label: "목록+지도" },
    { id: "map", label: "지도만" },
  ] as const;
  return (
    <div className="tb-viewsw3" role="group" aria-label="보기 방식">
      {items.map((it) => (
        <button key={it.id} type="button" aria-pressed={v === it.id} onClick={() => set(it.id)}>
          {it.label}
        </button>
      ))}
    </div>
  );
}

// PC AI 추천 탭 오른쪽: 'AI 추천 3곳' 목록(기본) 또는 지도. 숙소를 누르면 전용 상세 페이지 (PC 새 탭).
// 지도는 [지도]를 눌렀을 때만 만든다 (Mapbox 지도 로드)
function ChatPicks({ m, saved, onSave, onOpen }: { m: StayMsg; saved: Set<string>; onSave: (h: HotelOption) => void; onOpen: (h: HotelOption) => void }) {
  usePriceVersion();
  const [v, setV] = useState<"list" | "map">("list");
  const q = m.query;
  const nights = nightsOf(q);
  const options = m.options ?? [];
  const picks = (m.picks ?? []).map((p) => ({ ...p, h: options.find((o) => o.token === p.token)! })).filter((p) => p.h).slice(0, 3);
  if (m.aiPending)
    return (
      <aside className="tb-ai3" aria-label="AI 추천 3곳" aria-busy>
        <div className="tb-ai3-head">
          <h2>AI 추천 3곳</h2>
        </div>
        {[0, 1, 2].map((i) => (
          <div key={i} className="tb-ai3-row skel" aria-hidden />
        ))}
      </aside>
    );
  return (
    <aside className="tb-ai3" aria-label={m.aiOff ? "확인한 낮은 가격 3곳" : "AI 추천 3곳"}>
      <div className="tb-ai3-head">
        <h2>{m.aiOff ? "확인한 낮은 가격 3곳" : "AI 추천 3곳"}</h2>
        <small>
          {md(q.checkIn)}–{md(q.checkOut)} {q.place} {nights}박 · {guestText(q)} · {nights}박 세금 포함 총액
        </small>
        <div className="tb-viewsw3 sm" role="group" aria-label="보기 방식">
          <button type="button" aria-pressed={v === "list"} onClick={() => setV("list")}>
            목록
          </button>
          <button type="button" aria-pressed={v === "map"} onClick={() => setV("map")}>
            지도
          </button>
        </div>
      </div>
      {v === "map" ? (
        <div className="tb-ai3-map">
          <MapPanel side query={q} options={picks.map((p) => p.h)} saved={saved} onSave={onSave} onOpen={onOpen} onList={() => setV("list")} />
        </div>
      ) : (
        <ol className="tb-ai3-list">
          {picks.map((p, i) => (
            <ChatPickRow key={p.token} i={i} h={p.h} reason={m.aiOff ? "" : p.reason} q={q} saved={saved.has(p.token)} onSave={() => onSave(p.h)} onOpen={() => onOpen(p.h)} />
          ))}
        </ol>
      )}
    </aside>
  );
}

function ChatPickRow({ i, h, reason, q, saved: on, onSave, onOpen }: { i: number; h: HotelOption; reason: string; q: StayQuery; saved: boolean; onSave: () => void; onOpen: () => void }) {
  const ref = useLazyPrice<HTMLLIElement>(h, q, true);
  const t = shownPrice(h, q);
  const nights = nightsOf(q);
  const v = getVerified(h.token, q);
  return (
    <li ref={ref} className="tb-ai3-row">
      <span className="tb-ai3-n">{i + 1}</span>
      <button type="button" className="tb-ai3-ph" onClick={onOpen} aria-label={`${h.name} 상세 보기`}>
        {h.image ? <img src={h.image} alt="" loading="lazy" onError={(e) => (e.currentTarget.style.visibility = "hidden")} /> : null}
      </button>
      <div className="tb-ai3-body">
        <button type="button" className="tb-ai3-name" onClick={onOpen}>
          {h.name}
        </button>
        <small className="tb-ai3-meta">{[h.stars ? `${h.stars}성급` : h.kind, h.rating ? `후기 ${h.rating.toFixed(1)}${h.reviews ? ` (${h.reviews.toLocaleString("ko-KR")})` : ""}` : "", hasFreeCancel(h) || t.fc ? "무료 취소 요금 있음" : ""].filter(Boolean).join(" · ")}</small>
        {reason && !isPlainReason(reason) && (
          <p className="tb-ai3-why">
            <small>추천 이유</small>
            {reason}
          </p>
        )}
        <div className="tb-ai3-go">
          <button type="button" className="tb-ai3-open" onClick={onOpen}>
            {v?.count ? `예약처 ${v.count}곳 비교 · 상세 보기` : "가격 비교 · 상세 보기"} ↗
          </button>
          <button type="button" className={`tb-ai3-love${on ? " on" : ""}`} aria-pressed={on} onClick={onSave}>
            ♡ 찜
          </button>
        </div>
      </div>
      <div className="tb-ai3-price">
        {t.none ? (
          <small>확인한 예약처 가격 없음</small>
        ) : t.value !== null ? (
          <>
            <small>{t.verified ? `확인한 최저가${t.seller ? ` · ${sellerDef(t.seller).ko}` : ""}` : "예약처 확인 전"}</small>
            <b className={t.verified ? "ok" : "est"}>
              {t.verified ? "" : "~"}
              {won(t.value)}
            </b>
            {nights > 1 && <small>1박 약 {won(Math.round(t.value / nights / 100) * 100)}</small>}
          </>
        ) : (
          <small>가격 확인</small>
        )}
      </div>
    </li>
  );
}

// AI 채팅의 '전체 N곳 보기': 받은 목록 전체를 바텀시트로. 정렬·조건은 이 안에서만 거른다 (지도는 두지 않는다)
function AllList({ m, saved, onSave, onOpen, onClose, onMore, onStars, onMap }: { onMap: (id: string) => void; m: StayMsg | FlightMsg | undefined; saved: Set<string>; onSave: (h: HotelOption, q: StayQuery) => void; onOpen: (h: HotelOption, q: StayQuery) => void; onClose: () => void; onMore: (id: string) => void; onStars: (id: string, s: number[]) => void }) {
  const open = !!m && m.status === "done" && !!m.options?.length;
  return (
    <Sheet open={open} onClose={onClose} label="전체 목록" tall>
      {open && m.t === "stay" && (
        <StayList bare query={m.query} options={m.options ?? []} picks={m.picks ?? []} aiPending={!!m.aiPending} aiOff={m.aiOff} saved={saved} onSave={(h) => onSave(h, m.query)} onOpen={(h) => onOpen(h, m.query)} onBack={onClose} more={moreOf(m)} onMore={() => onMore(m.id)} onStars={(s) => onStars(m.id, s)} onMap={() => onMap(m.id)} />
      )}
      {open && m.t === "flight" && <FlightBrowser bare data={{ query: m.query, options: m.options ?? [], picks: m.picks ?? [] }} aiPending={m.aiPending} aiOff={m.aiOff} onBack={onClose} />}
    </Sheet>
  );
}

// AI 추천 결과를 같은 검색 조건마다 이 브라우저에 하루 저장 (마이 '기록 지우기'로 지워진다)
const PICK_MEMO = "tb-ai-pick-v1:";
const PICK_KEEP_MS = 24 * 60 * 60 * 1000;
type PickMemo = { at: number; picks: StayPick[]; note: string };
const pickMemoKey = (q: StayQuery, want: string) => `${PICK_MEMO}${q.place}|${q.checkIn}|${q.checkOut}|${guestText(q)}|${(q.childAges ?? []).join(".")}|${q.budget}|${want}`;
function readPickMemo(q: StayQuery, want: string): PickMemo | null {
  try {
    const v = JSON.parse(localStorage.getItem(pickMemoKey(q, want)) ?? "null") as PickMemo | null;
    return v && Date.now() - v.at < PICK_KEEP_MS && v.picks?.length ? v : null;
  } catch {
    return null;
  }
}
function writePickMemo(q: StayQuery, want: string, v: Omit<PickMemo, "at">) {
  try {
    localStorage.setItem(pickMemoKey(q, want), JSON.stringify({ ...v, at: Date.now() }));
  } catch {
    // 저장소를 못 쓰면 이번 화면에서만
  }
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
// short: 마이 화면용. 약관 링크와 결제 안내는 바로 위 '고객지원' 카드에 이미 있어 한 번만 보인다
function TripFooter({ short }: { short?: boolean }) {
  return (
    <footer className="tb-foot">
      <p>
        {site.footerIntro} {site.footerAffiliate}
      </p>
      <p>
        상호 {site.business.name} · 대표자 {site.business.ceo}
        <br />
        사업자등록번호 {site.business.registrationNo} · 통신판매업 {site.business.mailOrderNo}
        <br />
        주소 {site.business.address}
        <br />
        문의 <a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a>
      </p>
      {!short && (
        <>
          <nav className="tb-foot-links" aria-label="약관과 정책">
            <Link href="/terms">이용약관</Link>
            <Link href="/privacy">
              <b>개인정보처리방침</b>
            </Link>
          </nav>
          <p>{site.footerNotice}</p>
        </>
      )}
    </footer>
  );
}

const EMPTY_QUERY: StayQuery = { place: "", checkIn: "2000-01-01", checkOut: "2000-01-02", adults: 2, budget: 0, taste: "" };

// ---------- 홈 검색 결과 ----------
// 목록 끝 상태: 더 불러올 수 있음 / 불러오는 중 / 실패 / 끝
const moreOf = (m: StayMsg): "more" | "loading" | "error" | "end" => (m.more === "loading" ? "loading" : m.more === "error" ? "error" : m.next && (m.pages ?? 0) < MORE_PAGES ? "more" : "end");

function HomeResult({ m, saved, onBack, onSave, onOpen, onRetry, onAiRetry, onPlace, onMore, onStars, active, fixNote, opts, onMap, onShown, onHover, only, onAllArea, viewSwitch }: { onShown?: (l: HotelOption[]) => void; onHover?: (t: string | null) => void; only?: Set<string> | null; onAllArea?: () => void; viewSwitch?: React.ReactNode; onMap: () => void; opts: string[]; fixNote?: string; onAiRetry: () => void; m: StayMsg | FlightMsg; saved: Set<string>; onBack: () => void; onSave: (h: HotelOption) => void; onOpen: (h: HotelOption) => void; onRetry: () => void; onPlace: (name: string) => void; onMore: () => void; onStars: (s: number[]) => void; active?: string }) {
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
        <StayList query={m.query} options={m.options} picks={m.picks ?? []} aiPending={!!m.aiPending} aiOff={m.aiOff} onAiRetry={onAiRetry} saved={saved} onSave={onSave} onOpen={onOpen} onBack={onBack} active={active} more={moreOf(m)} onMore={onMore} onStars={onStars} notice={fixNote} initFilter={opts.length ? stayFilterOf(opts) : undefined} onMap={onMap} onShown={onShown} onHover={onHover} only={only} onAllArea={onAllArea} viewSwitch={viewSwitch} />
      </main>
    );
  return (
    <main>
      <FlightBrowser data={{ query: m.query, options: m.options, picks: m.picks ?? [], insights: m.insights }} aiPending={m.aiPending} aiOff={m.aiOff} onAiRetry={onAiRetry} onBack={onBack} notice={fixNote} initFilter={opts.length ? flightFilterOf(opts, m.options) : undefined} />
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
  onAiRetry: () => void; // AI 요약만 다시 부르기
  onSay: (t: string) => void;
  onPrefill: (k: SearchKind, q: Partial<StayQuery> | Partial<FlightQuery>) => void;
  onMap: () => void; // 숙소 결과를 가격 핀 지도로
  active?: string; // PC 패널에 열려 있는 숙소
  side?: boolean; // PC: 이 답의 추천 3곳 카드는 오른쪽 'AI 추천 3곳'에 보여 주므로 대화 안에서는 비교표만
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
// 추천 3곳의 솔직 체크포인트 (3곳을 한 번에 요청). AI가 이미 실패한 결과면 규칙으로만 만든다
function PickChecks({ hotels, q, off, children }: { hotels: HotelOption[]; q: StayQuery; off: boolean; children: (checks: Map<string, Checkpoints>) => React.ReactNode }) {
  const items = hotels.slice(0, 3).map((h) => {
    const p = shownPrice(h, q);
    return { h, input: checkInput(h, q, { fc: p.fc, price: priceState(p) }) };
  });
  const checks = useCheckpoints(items, q, true, off);
  return <>{children(checks)}</>;
}

function PickCard({ p, i, of, off, note, check, t, isLow, q, nights, saved: on, active, onSave, onOpenHotel, tags = [] }: { tags?: string[]; p: { token: string; reason: string; h: HotelOption }; i: number; of: number; off?: boolean; note?: RankNote; check?: Checkpoints; t: ReturnType<typeof shownPrice>; isLow: boolean; q: StayQuery; nights: number; saved: boolean; active: boolean; onSave: (h: HotelOption) => void; onOpenHotel: (h: HotelOption) => void }) {
  const ref = useLazyPrice<HTMLElement>(p.h, q, true);
  return (
    <article ref={ref} className={`tb-hcard${active ? " on" : ""}`}>
      <div className="tb-hcard-img">
        <PhotoStrip images={p.h.image ? [p.h.image] : []} name={p.h.name} max={1} />
        <em className="tb-tag wt">{i + 1}</em>
        {isLow && of > 1 && t.verified && (
          <em className="tb-tag low">
            <span className="full">확인한 가격 중 최저</span>
            <span className="short">확인 최저</span>
          </em>
        )}
        <button type="button" className={`tb-love${on ? " on" : ""}`} aria-pressed={on} aria-label={on ? "찜 빼기" : "찜하기"} onClick={() => onSave(p.h)}>
          <IconHeart size={18} on={on} />
        </button>
      </div>
      <button type="button" className="tb-hcard-body" onClick={() => onOpenHotel(p.h)} aria-label={`${p.h.name} 예약처별 총액 보기`}>
        {/* PC: 사진 위 꼬리표 대신 이름 위 작은 글자 */}
        <span className="tb-srow-badges tb-hcard-cap">
          {!off && <em className="tb-badge ai">AI 추천 {i + 1}</em>}
          {isLow && of > 1 && t.verified && <em className="tb-badge low">확인한 가격 중 최저</em>}
        </span>
        <strong>{p.h.name}</strong>
        <span className="tb-hcard-meta">{[p.h.rating ? `★ ${p.h.rating.toFixed(1)}` : "", p.h.stars ? `${p.h.stars}성급` : p.h.kind].filter(Boolean).join(" · ")}</span>
        {tags.length > 0 && (
          <span className="tb-pick-tags">
            {tags.map((x) => (
              <em key={x}>{x}</em>
            ))}
          </span>
        )}
        {stayFactLine(p.h, t.fc) && <span className="tb-fact">{stayFactLine(p.h, t.fc)}</span>}
        {!off && !isPlainReason(p.reason) && (
          <span className="tb-why">
            <IconSpark size={14} /> {p.reason}
          </span>
        )}
        {note && <RankLines note={note} />}
        <CheckLine c={check} fc={hasFreeCancel(p.h) || !!t.fc} />
        <PriceBlock p={t} nights={nights} />
      </button>
    </article>
  );
}

function StayResult({ m, saved, onOpenHotel, onSave, onAll, onRefine, onRetry, onAiRetry, onPrefill, onMap, active, side }: MsgProps & { m: StayMsg }) {
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
  // 선정 근거 태그: 받은 데이터로 확인되는 것만 (예약처에서 확인한 총액·평점). 무료 취소는 아래 사실 줄에 이미 있다
  const tagsOf = (i: number): string[] => {
    const h = picks[i].h;
    const out: string[] = [];
    if (lowOnce && totals[i] === low) out.push(q.budget && low <= q.budget ? "예산 안 최저" : "3곳 중 최저 총액");
    if (h.rating && h.rating >= 4.3 && h.rating === bestRating && picks.filter((x) => x.h.rating === bestRating).length === 1) out.push("평점 가장 높음");
    return out;
  };
  // AI 응답 전에는 임시 순위를 보여 주지 않고 같은 자리에 회색 카드만 (응답 뒤 다른 숙소로 바뀌며 흔들리지 않게)
  if (m.aiPending)
    return (
      <div className="tb-result">
        <AiSay>{options.length}곳을 찾았어요. 말씀하신 조건에 맞는 3곳을 살펴보는 중이에요.</AiSay>
        <div className="tb-hcards" aria-busy>
          {[0, 1, 2].map((i) => (
            <div key={i} className="tb-hcard skel" aria-hidden />
          ))}
        </div>
      </div>
    );
  return (
    <div className="tb-result">
      {m.aiOff ? (
        <>
          <AiSay>
            조건 일부를 확인하지 못했어요. 확인한 가격 기준으로 <b>{picks.length}곳</b>을 먼저 보여 드릴게요.
            {m.note ? ` ${m.note}` : ""}
          </AiSay>
          <AiOffNote onRetry={onAiRetry} />
        </>
      ) : (
        <AiSay>
          {options.length}곳 중에 말씀하신 조건에 맞는 <b>{picks.length}곳</b>을 먼저 보여드릴게요.
          {m.note ? ` ${m.note}` : ""}
        </AiSay>
      )}
      <div className="tb-hcards" hidden={side}>
        <PickChecks hotels={picks.map((p) => p.h)} q={q} off={!!m.aiOff}>
          {(checks) =>
            picks.map((p, i) => (
              <PickCard key={p.token} tags={tagsOf(i)} p={p} i={i} of={picks.length} off={m.aiOff} note={m.aiOff ? undefined : notes[i]} check={checks.get(p.token)} t={prices[i]} isLow={lowOnce && totals[i] === low} q={q} nights={nights} saved={saved.has(p.token)} active={active === p.token} onSave={onSave} onOpenHotel={onOpenHotel} />
            ))
          }
        </PickChecks>
      </div>
      {picks.length > 1 && (
        <table className="tb-compare">
          <thead>
            <tr>
              <th>한눈에 비교</th>
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
            {picks.some((p) => p.h.near && /역/.test(p.h.near.name)) && (
              <tr>
                <td>역까지</td>
                {picks.map((p) => (
                  <td key={p.token}>{p.h.near && /역/.test(p.h.near.name) ? `${p.h.near.how} ${p.h.near.mins}분` : "–"}</td>
                ))}
              </tr>
            )}
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
            찾은 숙소 {options.length}곳 전체 리스트
          </button>
        )}
        {options.some((h) => h.gps) && (
          <button type="button" className="all" onClick={onMap}>
            지도로 보기
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

function FlightResult({ m, onAll, onRefine, onRetry, onAiRetry, onPrefill }: MsgProps & { m: FlightMsg }) {
  const q = m.query;
  const route = `${cityOf(q.fromLabel || q.from)} → ${cityOf(q.toLabel || q.to)}`;
  if (m.status === "loading") return <Searching text={`${route} 항공편을 찾고 있어요`} />;
  if (m.status === "error") return <ErrorBox status={m.err} onRetry={onRetry} fallbackHref={flightLink(q)} fallbackLabel="트립닷컴에서 보기" />;
  const options = m.options ?? [];
  if (!options.length) return <AiSay>이 날짜에는 항공편을 찾지 못했어요. 날짜나 공항을 바꿔 보세요.</AiSay>;
  const picks = (m.picks ?? []).map((p) => ({ ...p, o: options[p.n - 1] })).filter((p) => p.o);
  if (m.aiPending)
    return (
      <div className="tb-result">
        <AiSay>
          {route} {options.length}편을 찾았어요. 말씀하신 조건에 맞는 3편을 살펴보는 중이에요.
        </AiSay>
        <div className="tb-cards" aria-busy>
          {[0, 1, 2].map((i) => (
            <div key={i} className="tb-srow skel" aria-hidden />
          ))}
        </div>
      </div>
    );
  return (
    <div className="tb-result">
      <AiSay>
        {m.aiOff ? (
          <>
            조건 일부를 확인하지 못했어요. 확인한 가격 기준으로 <b>{picks.length}편</b>을 먼저 보여 드릴게요. 가격은 {paxOf(q)}명 {q.ret ? "왕복" : "편도"} 총액이에요.
          </>
        ) : (
          <>
            {route} {options.length}편 중에 <b>{picks.length}편</b>을 먼저 보여드릴게요. 가격은 {paxOf(q)}명 {q.ret ? "왕복" : "편도"} 총액이에요.{m.note ? ` ${m.note}` : ""}
          </>
        )}
      </AiSay>
      {m.aiOff && <AiOffNote onRetry={onAiRetry} />}
      <div className="tb-cards">
        {picks.map((p, i) => (
          <FlightCard key={`${p.n}`} o={p.o} q={q} reason={m.aiOff ? undefined : p.reason} rank={m.aiOff ? undefined : i + 1} tag={m.aiOff ? p.reason : undefined} eager />
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

// ---------- 내 여행 · 마이 ----------
// 내 여행: 맨 위에 예약 내역 캡처 입구(곧 열려요), 그 아래 공유받은 여행과 담아 둔 숙소
function MyTripsTab({ saved, onOpen, onSave, onHome, onFlight, onMoreStays, onRegister }: { onRegister: () => void; saved: Saved[]; onOpen: (s: Saved) => void; onSave: (s: Saved) => void; onHome: () => void; onFlight: (t: Trip) => void; onMoreStays: (t: Trip) => void }) {
  const [shared, setShared] = useState<string | null>(null);
  useEffect(() => setShared(new URLSearchParams(window.location.search).get("trip")), []);
  // 내 여행 탭: 맨 위에 찜한 숙소 가격 변화(하루 한 번 다시 확인), 그 아래 여행별 찜 목록.
  // 예약 내역 캡처 등록(곧 열려요)은 2026-11-25 돈 아끼는 예약에 집중하며 내렸다
  return (
    <main className="tb-page">
      <h1>내 여행</h1>
      <BookingWatchBox onRegister={onRegister} />
      <PriceWatchBox saved={saved} onOpen={onOpen} />
      <SharedTripView code={shared} />
      <MyTrips saved={saved} onOpen={onOpen} onSave={onSave} onHome={onHome} onFlight={onFlight} onMoreStays={onMoreStays} />
    </main>
  );
}

// PC 마이 왼쪽 메뉴: 누르면 오른쪽 그 묶음으로 옮겨 간다 (휴대폰에서는 숨김)
const MY_MENU = [
  { id: "my-taste", label: "취향과 알림" },
  { id: "my-size", label: "화면 설정" },
  { id: "my-ai", label: "AI 상담 이용" },
  { id: "my-help", label: "고객지원" },
  { id: "my-clear", label: "이 기기에 저장된 기록" },
];
function MyNav() {
  const [on, setOn] = useState(MY_MENU[0].id);
  return (
    <nav className="tb-my-nav" aria-label="마이 메뉴">
      {MY_MENU.map((m) => (
        <a
          key={m.id}
          href={`#${m.id}`}
          aria-current={on === m.id ? "true" : undefined}
          onClick={(e) => {
            e.preventDefault();
            setOn(m.id);
            document.getElementById(m.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        >
          {m.label}
        </a>
      ))}
    </nav>
  );
}

function My({ profile, onTaste, onTrips }: { profile: TasteProfile | null; onTaste: () => void; onTrips: () => void }) {
  return (
    <main className="tb-page tb-my">
      <h1>마이</h1>
      <MyNav />
      <MySettings tasteSummary={profileLines(profile).join("\n")} onTaste={onTaste} onTrips={onTrips} />
      <ClearHistory />
      <TripFooter short />
    </main>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { brand } from "@/lib/brand";
import { today as localToday } from "@/lib/dates";
import { sellerSearchUrl } from "@/lib/hotel-sellers";
import type { HotelOption } from "@/lib/hotels";
import { cleanProfile, criteriaWeights, EMPTY_PROFILE, TASTE_KEY, withProfile, type TasteProfile } from "@/lib/taste";
import type { FlightOption } from "@/lib/flights";
import { searchErrorMessage, SEARCH_RETRY_LABEL } from "@/lib/search-error";
import {
  fallbackFlightPicks,
  fallbackStayPicks,
  flightFactReason,
  flightReady,
  mergePicks,
  nightsOf,
  stayFactReason,
  stayReady,
  stayTotal,
  withinBudget,
  won,
  type AskOption,
  type AskQuestion,
  type FlightQuery,
  type StayQuery,
} from "@/lib/trip";
import { parseText, pickFlights, pickStays, searchFlights, searchStays } from "./api";
import { FlightBrowser, FlightCard, flightLink } from "./Flights";
import { FlightSheet, StaySheet } from "./InputSheets";
import { SearchCard, type SearchKind } from "./SearchCard";
import { SellerBody, SellerSheet } from "./SellerSheet";
import { Onboarding, profileSummary } from "./Onboarding";
import { StayList, StayRow, type StayPick } from "./StayList";
import { IconBack, IconBed, IconChatStar, IconClose, IconCompass, IconHeart, IconHome, IconOut, IconPlane, IconPlus, IconSpark, IconUp, IconUser } from "./icons";

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
  | { id: string; t: "stay"; home?: boolean; query: StayQuery; status: Status; err?: number | null; options?: HotelOption[]; picks?: StayPick[]; aiPending?: boolean; note?: string }
  | { id: string; t: "flight"; home?: boolean; query: FlightQuery; status: Status; err?: number | null; options?: FlightOption[]; picks?: { n: number; reason: string }[]; aiPending?: boolean; note?: string };

type StayMsg = Extract<Msg, { t: "stay" }>;
type FlightMsg = Extract<Msg, { t: "flight" }>;
type AskMsg = Extract<Msg, { t: "ask" }>;
type Tab = "home" | "chat" | "now" | "my";
type Saved = { hotel: HotelOption; query: StayQuery };

const uid = () => Math.random().toString(36).slice(2, 10);
const SAVED_KEY = "tb-saved-v1";
const PLACES = ["오사카", "후쿠오카", "도쿄", "삿포로", "오키나와", "다낭", "방콕", "타이베이"];
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

// 취향 온보딩 결과. 한 번도 고르거나 건너뛴 적이 없으면 asked=false → 온보딩을 연다
function useTaste() {
  const [state, setState] = useState<{ loaded: boolean; profile: TasteProfile | null }>({ loaded: false, profile: null });
  useEffect(() => {
    let profile: TasteProfile | null = null;
    try {
      const raw = localStorage.getItem(TASTE_KEY);
      profile = raw ? cleanProfile(JSON.parse(raw)) : null;
    } catch {
      profile = EMPTY_PROFILE; // 저장소를 못 쓰면 매번 묻지 않는다
    }
    setState({ loaded: true, profile });
  }, []);
  const set = useCallback((p: TasteProfile) => {
    try {
      localStorage.setItem(TASTE_KEY, JSON.stringify(p));
    } catch {
      // 저장 실패는 조용히 넘긴다
    }
    setState({ loaded: true, profile: p });
  }, []);
  return { profile: state.profile, asked: !state.loaded || !!state.profile, set };
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
  const toggle = useCallback((hotel: HotelOption, query: StayQuery) => {
    setSaved((list) => {
      const next = list.some((s) => s.hotel.token === hotel.token) ? list.filter((s) => s.hotel.token !== hotel.token) : [{ hotel, query }, ...list].slice(0, 50);
      try {
        localStorage.setItem(SAVED_KEY, JSON.stringify(next));
      } catch {
        // 저장 실패는 조용히 넘긴다
      }
      return next;
    });
  }, []);
  return { saved, toggle };
}

function contextOf(m: Msg | undefined): string {
  if (!m) return "";
  if (m.t === "stay") {
    const q = m.query;
    return `숙소 · 장소 ${q.place} · ${q.checkIn}~${q.checkOut} · ${q.adults}명${q.budget ? ` · 총액 예산 ${q.budget}원` : ""}${q.taste ? ` · 취향 ${q.taste}` : ""}`;
  }
  if (m.t === "flight") {
    const q = m.query;
    return `항공 · ${q.from}(${q.fromLabel})→${q.to}(${q.toLabel}) · ${q.depart}${q.ret ? `~${q.ret}` : " 편도"} · ${q.adults}명${q.taste ? ` · 취향 ${q.taste}` : ""}`;
  }
  return "";
}

function joinTaste(a: string, b: string): string {
  if (!a) return b;
  if (!b || a.includes(b)) return a;
  return `${a}, ${b}`.slice(0, 200);
}

const cityOf = (label: string) => label.replace(/\s*\([A-Z]{3}\)\s*$/, "");

// AI 표시: 유리 구슬 (v7)
const Orb = ({ size = 32 }: { size?: number }) => <span className="tb-orb" style={{ width: size, height: size }} aria-hidden />;

export function TripApp() {
  const [tab, setTab] = useState<Tab>("home");
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
  const [toast, setToast] = useState<string | null>(null);
  const { saved, toggle } = useSaved();
  const savedSet = new Set(saved.map((s) => s.hotel.token));
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const msgsRef = useRef(msgs);
  msgsRef.current = msgs;

  const patch = useCallback((id: string, p: Partial<Msg>) => setMsgs((list) => list.map((m) => (m.id === id ? ({ ...m, ...p } as Msg) : m))), []);
  const push = useCallback((m: Msg) => setMsgs((list) => [...list, m]), []);

  // 다른 페이지 메뉴에서 /?tab=stay, /?tab=flight 로 오면 그 검색 탭을 연다
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t === "flight") setKind("flight");
  }, []);

  const chatLen = msgs.filter((m) => !("home" in m && m.home)).length;
  useEffect(() => {
    if (tab === "chat") endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chatLen, tab]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
    setSeller(null); // 다른 화면으로 가면 열려 있던 예약처 패널도 닫는다
  }, [tab, homeId]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  // ---------- 숙소: 찾기 → 규칙으로 3곳 먼저 → AI가 다시 정리하면 바꾼다 ----------
  const runStay = useCallback(
    async (query: StayQuery, o: { reuse?: HotelOption[]; home?: boolean } = {}) => {
      const id = uid();
      push({ id, t: "stay", home: o.home, query, status: "loading" });
      if (o.home) setHomeId(id);
      let options = o.reuse;
      if (!options) {
        const r = await searchStays(query);
        if (!r.ok) return patch(id, { status: "error", err: r.status });
        options = r.data.options;
      }
      if (!options.length) return patch(id, { status: "done", options: [], picks: [] });
      const nights = nightsOf(query);
      const { list: pool, over } = withinBudget(options, query.budget, nights);
      const head = pool.slice(0, 40);
      const toPicks = (ps: { n: number; reason: string }[]) => ps.map((p) => ({ token: head[p.n - 1].token, reason: p.reason }));
      const want = withProfile(query.taste, profileRef.current, "stay"); // 그때 적은 말 + 온보딩 취향
      const fb = fallbackStayPicks(head, want, query.budget, nights, criteriaWeights(profileRef.current));
      const overNote = over ? `예산(${Math.round(query.budget / 10000)}만 원) 안의 숙소가 없어서 가장 가까운 곳을 보여 드려요.` : "";
      patch(id, { status: "done", options, picks: toPicks(fb), aiPending: true, note: overNote });
      setActiveId(id);
      const ai = await pickStays(head, want, query.budget);
      const picks = mergePicks(ai.ok ? ai.data.picks : [], fb, head.length, (n) => stayFactReason(head[n - 1], want));
      patch(id, { picks: toPicks(picks), aiPending: false, note: [overNote, ai.ok ? ai.data.note : ""].filter(Boolean).join(" ") });
    },
    [patch, push],
  );

  // ---------- 항공 ----------
  const runFlight = useCallback(
    async (query: FlightQuery, o: { reuse?: FlightOption[]; home?: boolean } = {}) => {
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
      const fb = fallbackFlightPicks(options, want);
      patch(id, { status: "done", options, picks: fb, aiPending: true });
      setActiveId(id);
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
      const same = base?.options && base.query.place === q.place && base.query.checkIn === q.checkIn && base.query.checkOut === q.checkOut && base.query.adults === q.adults;
      runStay({ ...q, budget: q.budget ?? 0, taste: q.taste ?? "" } as StayQuery, { reuse: same ? base.options : undefined });
    },
    [runStay],
  );

  const goFlight = useCallback(
    (q: Partial<FlightQuery>, base?: FlightMsg) => {
      if (!flightReady(q, localToday())) return setFlightSheet(q);
      const same = base?.options && base.query.from === q.from && base.query.to === q.to && base.query.depart === q.depart && base.query.ret === q.ret && base.query.adults === q.adults;
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

  function save(hotel: HotelOption, query: StayQuery) {
    const was = savedSet.has(hotel.token);
    toggle(hotel, query);
    setToast(was ? null : `${query.place} 숙소를 담았어요`);
  }

  // 대화 결과를 홈의 전체 목록으로 열기
  function openAll(id: string) {
    setHomeId(id);
    setTab("home");
  }

  // 홈 검색 칸을 채워서 보여 주기 (인기 여행지·대화의 '이제 항공편 찾기')
  function prefill(k: SearchKind, q: Partial<StayQuery> | Partial<FlightQuery>) {
    setKind(k);
    if (k === "stay") setPrefStay({ ...(q as Partial<StayQuery>) });
    else setPrefFlight({ ...(q as Partial<FlightQuery>) });
    setHomeId(null);
    setTab("home");
  }

  const homeMsg = msgs.find((m) => m.id === homeId) as StayMsg | FlightMsg | undefined;
  const chatMsgs = msgs.filter((m) => !("home" in m && m.home));
  // PC 2열: 홈 숙소 결과와 AI 채팅은 왼쪽 목록 + 오른쪽 예약처 패널
  const split = wide && ((tab === "home" && homeMsg?.t === "stay") || tab === "chat");
  const activeToken = seller?.hotel.token;

  return (
    <div className="tb-app">
      <div className={`tb-main${split ? " split" : ""}`}>
        {tab === "home" &&
          (homeMsg ? (
            <HomeResult
              m={homeMsg}
              saved={savedSet}
              onBack={() => setHomeId(null)}
              onSave={(h) => homeMsg.t === "stay" && save(h, homeMsg.query)}
              onOpen={(h) => homeMsg.t === "stay" && setSeller({ hotel: h, query: homeMsg.query })}
              active={activeToken}
              onRetry={() => (homeMsg.t === "stay" ? runStay(homeMsg.query, { home: true }) : runFlight(homeMsg.query, { home: true }))}
            />
          ) : (
            <main className="tb-home">
              <header className="tb-top">
                <span className="tb-logo">
                  <Orb size={30} />
                  <strong>{brand.appName}</strong>
                  {brand.tentative && <em>가칭</em>}
                </span>
              </header>
              <SearchCard
                kind={kind}
                onKind={setKind}
                stay={prefStay}
                flight={prefFlight}
                onStay={(q) => runStay(q, { home: true })}
                onFlight={(q) => runFlight(q, { home: true })}
              />
              <button
                type="button"
                className="tb-askbar"
                onClick={() => {
                  setTab("chat");
                  setTimeout(() => inputRef.current?.focus(), 50);
                }}
              >
                <Orb size={46} />
                <span>
                  <strong>{brand.aiName}에게 물어보기</strong>
                  <small>“부모님이랑 조용한 온천 숙소”</small>
                </span>
                <i aria-hidden>
                  <IconChatStar size={22} />
                </i>
              </button>
              <section className="tb-sec">
                <h2>인기 여행지</h2>
                <div className="tb-places">
                  {PLACES.map((p) => (
                    <button key={p} type="button" onClick={() => prefill("stay", { place: p })}>
                      {p}
                    </button>
                  ))}
                </div>
              </section>
            </main>
          ))}

        {tab === "chat" && (
          <main className="tb-chat">
            <header className="tb-chat-top">
              <Orb size={40} />
              <span>
                <strong>{brand.aiName}</strong>
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
                <Orb size={88} />
                <h1>어디로, 언제, 누구와 가는지 편하게 말해 주세요</h1>
                <p>취향에 맞는 곳을 3곳만 먼저 보여드릴게요.</p>
                <div className="tb-examples">
                  {EXAMPLES.map((e) => (
                    <button key={e} type="button" onClick={() => send(e)}>
                      {e}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="tb-msgs" aria-live="polite">
                {chatMsgs.map((m) => (
                  <MsgView
                    key={m.id}
                    m={m}
                    saved={savedSet}
                    onAnswer={(i, a) => m.t === "ask" && patch(m.id, { answers: { ...m.answers, [i]: a } })}
                    onApply={(edit) => m.t === "ask" && applyAsk(m, edit)}
                    onOpenHotel={(hotel) => m.t === "stay" && setSeller({ hotel, query: m.query })}
                    active={activeToken}
                    onSave={(hotel) => m.t === "stay" && save(hotel, m.query)}
                    onAll={() => openAll(m.id)}
                    onRetry={() => (m.t === "stay" ? runStay(m.query) : m.t === "flight" ? runFlight(m.query) : undefined)}
                    onSay={send}
                    onPrefill={prefill}
                  />
                ))}
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
                <input ref={inputRef} value={text} maxLength={500} onChange={(e) => setText(e.target.value)} placeholder={`${brand.aiName}에게 물어보기`} aria-label="AI에게 말하기" enterKeyHint="send" />
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
        {tab === "my" && <My saved={saved} profile={taste.profile} onTaste={() => setOnb(true)} onOpen={(s) => setSeller(s)} onSave={(s) => save(s.hotel, s.query)} onHome={() => setTab("home")} />}

        {split && (
          <aside className="tb-panel" aria-label="예약처별 결제 총액">
            {seller ? (
              <>
                <button type="button" className="tb-round tb-panel-x" onClick={() => setSeller(null)} aria-label="닫기">
                  <IconClose size={20} />
                </button>
                <SellerBody hotel={seller.hotel} query={seller.query} saved={savedSet.has(seller.hotel.token)} onSave={() => save(seller.hotel, seller.query)} />
              </>
            ) : (
              <div className="tb-panel-empty">
                <IconBed size={28} />
                <strong>숙소를 고르면 여기에 예약처별 총액이 보여요</strong>
                <p>세금·수수료까지 더한 금액을 예약처마다 나란히 보여드려요.</p>
              </div>
            )}
          </aside>
        )}

        <nav className="tb-tabbar" aria-label="메뉴">
          <span className="tb-logo tb-tabbar-logo">
            <Orb size={28} />
            <strong>{brand.appName}</strong>
            {brand.tentative && <em>가칭</em>}
          </span>
          {(
            [
              { id: "home", label: "홈", icon: <IconHome size={24} /> },
              { id: "chat", label: "AI 채팅", icon: <IconChatStar size={24} /> },
              { id: "now", label: "지금", icon: <IconCompass size={24} />, soon: true },
              { id: "my", label: "마이", icon: <IconUser size={24} /> },
            ] as { id: Tab; label: string; icon: React.ReactNode; soon?: boolean }[]
          ).map((it) => (
            <button
              key={it.id}
              type="button"
              className={`tb-tab${it.id === "chat" ? " ai" : ""}`}
              aria-current={tab === it.id ? "page" : undefined}
              onClick={() => {
                if (it.id === "home" && tab === "home") setHomeId(null);
                setTab(it.id);
              }}
            >
              {it.icon}
              <span>{it.label}</span>
              {it.soon && <em className="tb-soon-dot">곧</em>}
            </button>
          ))}
        </nav>
      </div>

      {toast && (
        <div className="tb-toast" role="status">
          <IconHeart size={18} on />
          <span>{toast}</span>
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
      )}

      {(onb || !taste.asked) && (
        <Onboarding
          init={taste.profile ?? EMPTY_PROFILE}
          onDone={(p) => {
            taste.set(p);
            setOnb(false);
          }}
          onSkip={() => {
            if (!taste.profile) taste.set(EMPTY_PROFILE);
            setOnb(false);
          }}
        />
      )}

      <StaySheet open={!!staySheet} init={staySheet ?? {}} onClose={() => setStaySheet(null)} onSubmit={submitStay} />
      <FlightSheet open={!!flightSheet} init={flightSheet ?? {}} onClose={() => setFlightSheet(null)} onSubmit={submitFlight} />
      <SellerSheet
        hotel={split ? null : (seller?.hotel ?? null)}
        query={seller?.query ?? EMPTY_QUERY}
        saved={!!seller && savedSet.has(seller.hotel.token)}
        onSave={() => seller && save(seller.hotel, seller.query)}
        onClose={() => setSeller(null)}
      />
    </div>
  );
}

const EMPTY_QUERY: StayQuery = { place: "", checkIn: "2000-01-01", checkOut: "2000-01-02", adults: 2, budget: 0, taste: "" };

// ---------- 홈 검색 결과 ----------
function HomeResult({ m, saved, onBack, onSave, onOpen, onRetry, active }: { m: StayMsg | FlightMsg; saved: Set<string>; onBack: () => void; onSave: (h: HotelOption) => void; onOpen: (h: HotelOption) => void; onRetry: () => void; active?: string }) {
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
              <a className="tb-link" href={m.t === "stay" ? sellerSearchUrl("trip", m.query.place, m.query) : flightLink(m.query)} target="_blank" rel="noopener noreferrer">
                트립닷컴에서 바로 보기 <IconOut />
              </a>
            </div>
          </div>
        ) : (
          <p className="tb-note pad">{m.t === "stay" ? "이 조건으로는 숙소를 찾지 못했어요. 지역 이름을 조금 넓게(예: “오사카”) 적거나 날짜를 바꿔 보세요." : "이 날짜에는 항공편을 찾지 못했어요. 날짜나 공항을 바꿔 보세요."}</p>
        )}
      </main>
    );
  if (m.t === "stay")
    return (
      <main>
        <StayList query={m.query} options={m.options} picks={m.picks ?? []} aiPending={!!m.aiPending} saved={saved} onSave={onSave} onOpen={onOpen} onBack={onBack} active={active} />
      </main>
    );
  return (
    <main>
      <FlightBrowser data={{ query: m.query, options: m.options, picks: m.picks ?? [] }} aiPending={m.aiPending} onBack={onBack} />
    </main>
  );
}

// ---------- AI 채팅 ----------
function AiSay({ children }: { children: React.ReactNode }) {
  return (
    <div className="tb-ai">
      <span className="tb-ai-name">
        <Orb size={24} />
        <b>{brand.aiName}</b>
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
  onRetry: () => void;
  onSay: (t: string) => void;
  onPrefill: (k: SearchKind, q: Partial<StayQuery> | Partial<FlightQuery>) => void;
  active?: string; // PC 패널에 열려 있는 숙소
};

function MsgView(props: MsgProps) {
  const { m, onAnswer, onApply } = props;
  if (m.t === "user") return <div className="tb-user">{m.text}</div>;
  if (m.t === "ai") return <AiSay>{m.text}</AiSay>;
  if (m.t === "ask") {
    const all = m.questions.every((_, i) => m.answers[i]);
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
          {!m.done && (
            <div className="tb-ask-go">
              <button type="button" className="tb-cta small" disabled={!all} onClick={() => onApply(false)}>
                이 조건으로 찾기
              </button>
              <button type="button" className="tb-link" onClick={() => onApply(true)}>
                직접 고치기
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }
  if (m.t === "stay") return <StayResult {...props} m={m} />;
  return <FlightResult {...props} m={m} />;
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

function ErrorBox({ status, onRetry, fallbackHref }: { status: number | null | undefined; onRetry: () => void; fallbackHref: string }) {
  return (
    <div className="tb-col">
      <AiSay>{searchErrorMessage(status ?? null)}</AiSay>
      <div className="tb-ask-go">
        <button type="button" className="tb-cta small" onClick={onRetry}>
          {SEARCH_RETRY_LABEL}
        </button>
        <a className="tb-link" href={fallbackHref} target="_blank" rel="noopener noreferrer">
          트립닷컴에서 바로 보기 <IconOut />
        </a>
      </div>
    </div>
  );
}

function StayResult({ m, saved, onOpenHotel, onSave, onAll, onRetry, onSay, onPrefill, active }: MsgProps & { m: StayMsg }) {
  const q = m.query;
  if (m.status === "loading") return <Searching text={`${q.place} 숙소를 찾고 있어요`} />;
  if (m.status === "error") return <ErrorBox status={m.err} onRetry={onRetry} fallbackHref={sellerSearchUrl("trip", q.place, q)} />;
  const options = m.options ?? [];
  const nights = nightsOf(q);
  if (!options.length) return <AiSay>이 조건으로는 숙소를 찾지 못했어요. 지역 이름을 조금 넓게(예: “오사카”) 적거나 날짜를 바꿔 보세요.</AiSay>;
  const picks = (m.picks ?? []).map((p) => ({ ...p, h: options.find((o) => o.token === p.token)! })).filter((p) => p.h);
  const totals = picks.map((p) => stayTotal(p.h, nights)?.value ?? Infinity);
  const low = Math.min(...totals);
  const bestRating = Math.max(...picks.map((p) => p.h.rating ?? 0));
  const short = (n: string) => (n.length > 9 ? `${n.slice(0, 8)}…` : n);
  return (
    <div className="tb-result">
      <AiSay>
        {options.length}곳 중에 말씀하신 조건에 맞는 <b>{picks.length}곳</b>을 먼저 보여드릴게요.{m.aiPending ? " 더 맞는 곳이 있는지 살펴보는 중이에요." : ""}
        {m.note ? ` ${m.note}` : ""}
      </AiSay>
      <div className="tb-hcards">
        {picks.map((p, i) => {
          const t = stayTotal(p.h, nights);
          const on = saved.has(p.token);
          return (
            <article key={p.token} className={`tb-hcard${active === p.token ? " on" : ""}`}>
              <div className="tb-hcard-img">
                {p.h.image ? <img src={p.h.image} alt="" loading="lazy" onError={(e) => (e.currentTarget.style.visibility = "hidden")} /> : null}
                <em className="tb-tag wt">{totals[i] === low ? `최저가 ${t ? won(t.value) : ""}` : `${i + 1}`}</em>
                <button type="button" className={`tb-love${on ? " on" : ""}`} aria-pressed={on} aria-label={on ? "내 여행에서 빼기" : "내 여행에 담기"} onClick={() => onSave(p.h)}>
                  <IconHeart size={18} on={on} />
                </button>
              </div>
              <button type="button" className="tb-hcard-body" onClick={() => onOpenHotel(p.h)} aria-label={`${p.h.name} 예약처별 총액 보기`}>
                <strong>{p.h.name}</strong>
                <span className="tb-hcard-meta">{[p.h.rating ? `★ ${p.h.rating.toFixed(1)}` : "", p.h.stars ? `${p.h.stars}성급` : p.h.kind].filter(Boolean).join(" · ")}</span>
                <span className="tb-why">
                  <IconSpark size={14} /> {p.reason}
                </span>
                <div className="tb-hcard-foot">
                  <span>
                    <b>{t ? won(t.value) : "가격 확인"}</b> <small>{nights}박</small>
                  </span>
                  <span className="tb-btn dark">예약</span>
                </div>
              </button>
            </article>
          );
        })}
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
                <td key={p.token} className={totals[i] === low ? "best" : undefined}>
                  {Number.isFinite(totals[i]) ? won(totals[i]) : "–"}
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
          <button type="button" onClick={onAll}>
            {options.length}곳 모두 보기
          </button>
        )}
        <button type="button" onClick={() => onSay("조식 포함인 곳만")}>
          조식 포함만
        </button>
        <button type="button" onClick={() => onSay("더 조용한 곳")}>
          더 조용한 곳
        </button>
        <button type="button" onClick={() => onPrefill("flight", { depart: q.checkIn, ret: q.checkOut, adults: q.adults })}>
          <IconPlane size={16} /> 이제 항공권 찾기
        </button>
      </div>
    </div>
  );
}

function FlightResult({ m, onAll, onRetry, onSay, onPrefill }: MsgProps & { m: FlightMsg }) {
  const q = m.query;
  const route = `${cityOf(q.fromLabel || q.from)} → ${cityOf(q.toLabel || q.to)}`;
  if (m.status === "loading") return <Searching text={`${route} 항공편을 찾고 있어요`} />;
  if (m.status === "error") return <ErrorBox status={m.err} onRetry={onRetry} fallbackHref={flightLink(q)} />;
  const options = m.options ?? [];
  if (!options.length) return <AiSay>이 날짜에는 항공편을 찾지 못했어요. 날짜나 공항을 바꿔 보세요.</AiSay>;
  const picks = (m.picks ?? []).map((p) => ({ ...p, o: options[p.n - 1] })).filter((p) => p.o);
  return (
    <div className="tb-result">
      <AiSay>
        {route} {options.length}편 중에 <b>{picks.length}편</b>을 먼저 보여드릴게요. 가격은 {q.adults}명 {q.ret ? "왕복" : "편도"} 총액이에요.{m.note ? ` ${m.note}` : ""}
      </AiSay>
      <div className="tb-cards">
        {picks.map((p, i) => (
          <FlightCard key={`${p.n}`} o={p.o} q={q} reason={p.reason} rank={i + 1} />
        ))}
      </div>
      <div className="tb-follow">
        {options.length > picks.length && (
          <button type="button" onClick={onAll}>
            {options.length}편 모두 보기
          </button>
        )}
        <button type="button" onClick={() => onSay("직항만")}>
          직항만
        </button>
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

function My({ saved, profile, onTaste, onOpen, onSave, onHome }: { saved: Saved[]; profile: TasteProfile | null; onTaste: () => void; onOpen: (s: Saved) => void; onSave: (s: Saved) => void; onHome: () => void }) {
  const summary = profileSummary(profile);
  return (
    <main className="tb-page">
      <h1>마이</h1>
      <section className="tb-taste-box">
        <h2 className="tb-h2">내 여행 취향</h2>
        <p>{summary || "아직 고른 취향이 없어요. 고르면 AI 추천 3곳이 취향에 맞춰져요."}</p>
        <button type="button" className="tb-btn" onClick={onTaste}>
          {summary ? "취향 다시 고르기" : "취향 고르기"}
        </button>
      </section>
      <h2 className="tb-h2">담아 둔 숙소</h2>
      {saved.length ? (
        <div className="tb-rlist flat">
          {saved.map((s) => (
            <div key={s.hotel.token}>
              <StayRow h={s.hotel} nights={nightsOf(s.query)} saved onSave={() => onSave(s)} onOpen={() => onOpen(s)} />
              <p className="tb-saved-q">
                {s.query.place} · {md(s.query.checkIn)}–{md(s.query.checkOut)} · 성인 {s.query.adults}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="tb-empty">
          <p>마음에 드는 숙소의 ♡를 누르면 여기에 모여요.</p>
          <button type="button" className="tb-cta small" onClick={onHome}>
            숙소 찾으러 가기
          </button>
        </div>
      )}
      <div className="tb-soon-box">
        <span className="tb-tag ac">곧 열려요</span>
        <p>다가오는 여행 일정, 지난 여행 사진 모아 보기를 준비하고 있어요.</p>
      </div>
    </main>
  );
}

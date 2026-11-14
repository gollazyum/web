"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { brand } from "@/lib/brand";
import { today as localToday } from "@/lib/dates";
import { sellerSearchUrl } from "@/lib/hotel-sellers";
import type { HotelOption } from "@/lib/hotels";
import type { FlightOption } from "@/lib/flights";
import { searchErrorMessage, SEARCH_RETRY_LABEL } from "@/lib/search-error";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { useSheet } from "@/lib/useSheet";
import {
  fallbackFlightPicks,
  fallbackStayPicks,
  flightFactReason,
  flightReady,
  man,
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
  type PickResult,
  type StayQuery,
} from "@/lib/trip";
import { parseText, pickFlights, pickStays, searchFlights, searchStays, type Res } from "./api";
import { FlightBrowser, FlightCard, flightLink } from "./Flights";
import { FlightSheet, StaySheet } from "./InputSheets";
import { Mascot } from "./Mascot";
import { SellerSheet } from "./SellerSheet";
import { HotelRow, StayBrowser, type BrowseFocus } from "./StayBrowser";
import { IconBack, IconBag, IconBed, IconChat, IconCheck, IconHeart, IconList, IconMap, IconOut, IconPin, IconPlane, IconPlus, IconSpark, IconUp, IconWifi } from "./icons";

type StayPick = { token: string; reason: string };
type Status = "loading" | "done" | "error";
type Stage = "search" | "pick";

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
  | { id: string; t: "stay"; query: StayQuery; status: Status; stage?: Stage; err?: number | null; options?: HotelOption[]; picks?: StayPick[]; note?: string; checked?: number }
  | { id: string; t: "flight"; query: FlightQuery; status: Status; stage?: Stage; err?: number | null; options?: FlightOption[]; picks?: { n: number; reason: string }[]; note?: string; checked?: number };

type StayMsg = Extract<Msg, { t: "stay" }>;
type FlightMsg = Extract<Msg, { t: "flight" }>;
type AskMsg = Extract<Msg, { t: "ask" }>;
type Tab = "explore" | "now" | "trips";
type Saved = { hotel: HotelOption; query: StayQuery };

const uid = () => Math.random().toString(36).slice(2, 10);
const SAVED_KEY = "tb-saved-v1";
// 첫 화면 빠른 답 (v5 시안)
const QUICK = ["따뜻한 데 가고 싶어", "부모님이랑 온천 3박 4일", "12월 오사카, 둘이서"];

const md = (iso: string) => `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`;
const DOW = ["일", "월", "화", "수", "목", "금", "토"];
const mdw = (iso: string) => `${md(iso)}(${DOW[new Date(`${iso}T00:00:00`).getDay()]})`;
// "12/5–7", 달이 바뀌면 "12/30–1/2"
const span = (a?: string, b?: string) => (!a ? "" : !b ? md(a) : a.slice(5, 7) === b.slice(5, 7) ? `${md(a)}–${Number(b.slice(8, 10))}` : `${md(a)}–${md(b)}`);

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

// 휴대폰에서 목록/지도를 전체 화면으로 띄우는 층. 뒤로가기로 닫힌다
function PhoneLayer({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  useSheet(open, onClose);
  if (!open) return null;
  return <div className="tb-layer">{children}</div>;
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

// 위쪽 여행 조건 칩: 어디로 / 언제 / 누구와 / 예산 (대화에서 채워진다)
type Chip = { label: string; empty: boolean; pin?: boolean };
function chipsOf(m: StayMsg | FlightMsg | AskMsg | undefined): Chip[] {
  const c = (label: string | undefined, fallback: string, pin = false): Chip => ({ label: label || fallback, empty: !label, pin });
  if (m?.t === "flight" || (m?.t === "ask" && m.kind === "flight")) {
    const q: Partial<FlightQuery> = m.t === "flight" ? m.query : m.flight;
    const to = q.toLabel || q.to;
    return [c(to ? `${cityOf(q.fromLabel || q.from || "")}→${cityOf(to)}` : "", "어디로", true), c(span(q.depart, q.ret), "언제"), c(q.adults ? `${q.adults}명` : "", "누구와")];
  }
  const q: Partial<StayQuery> = m?.t === "stay" ? m.query : m?.t === "ask" ? m.stay : {};
  return [c(q.place, "어디로", true), c(span(q.checkIn, q.checkOut), "언제"), c(q.adults ? `${q.adults}명` : "", "누구와"), c(q.budget ? `${man(q.budget)}↓` : "", "예산")];
}

export function TripApp() {
  const [tab, setTab] = useState<Tab>("explore");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  const [plus, setPlus] = useState(false);
  const [staySheet, setStaySheet] = useState<Partial<StayQuery> | null>(null);
  const [flightSheet, setFlightSheet] = useState<Partial<FlightQuery> | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [focus, setFocus] = useState<BrowseFocus>({ view: "map", token: null, n: 0 });
  const [layerOpen, setLayerOpen] = useState(false);
  const [seller, setSeller] = useState<{ hotel: HotelOption; query: StayQuery } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const desktop = useMediaQuery("(min-width: 1024px)");
  const { saved, toggle } = useSaved();
  const savedSet = useMemo(() => new Set(saved.map((s) => s.hotel.token)), [saved]);
  const endRef = useRef<HTMLDivElement>(null);
  const msgsRef = useRef(msgs);
  msgsRef.current = msgs;
  // '기다리지 않고 건너뛰기': AI 정리를 기다리지 않고 규칙으로 바로 보여 준다
  const skips = useRef(new Map<string, () => void>());

  const patch = useCallback((id: string, p: Partial<Msg>) => setMsgs((list) => list.map((m) => (m.id === id ? ({ ...m, ...p } as Msg) : m))), []);
  const push = useCallback((m: Msg) => setMsgs((list) => [...list, m]), []);

  // 다른 페이지 메뉴에서 /?tab=stay, /?tab=flight 로 오면 그 입력 시트를 바로 연다
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t === "stay") setStaySheet({});
    else if (t === "flight") setFlightSheet({});
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs.length]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const active = msgs.find((m) => m.id === activeId && (m.t === "stay" || m.t === "flight") && m.status === "done") as StayMsg | FlightMsg | undefined;
  const current = [...msgs].reverse().find((m) => m.t === "stay" || m.t === "flight" || (m.t === "ask" && !m.done)) as StayMsg | FlightMsg | AskMsg | undefined;
  const trip = active ?? current;

  function withSkip<T>(id: string, p: Promise<Res<T>>): Promise<Res<T>> {
    const skip = new Promise<Res<T>>((res) => skips.current.set(id, () => res({ ok: false, status: 0 })));
    return Promise.race([p, skip]).finally(() => skips.current.delete(id));
  }

  // ---------- 숙소 ----------
  const pickForStays = useCallback(
    async (id: string, query: StayQuery, options: HotelOption[]) => {
      const nights = nightsOf(query);
      const { list: pool, over } = withinBudget(options, query.budget, nights);
      const head = pool.slice(0, 40);
      const fb = fallbackStayPicks(head, query.taste, query.budget, nights);
      const ai = await withSkip<PickResult>(id, pickStays(head, query.taste, query.budget));
      const picks = mergePicks(ai.ok ? ai.data.picks : [], fb, head.length, (n) => stayFactReason(head[n - 1], query.taste));
      const notes = [over ? `예산(${Math.round(query.budget / 10000)}만 원) 안의 숙소가 없어서 가장 가까운 곳을 보여 드려요.` : "", ai.ok ? ai.data.note : ""].filter(Boolean);
      patch(id, { status: "done", options, picks: picks.map((p) => ({ token: head[p.n - 1].token, reason: p.reason })), note: notes.join(" ") });
      setActiveId(id);
      setFocus((f) => ({ view: "map", token: head[picks[0]?.n - 1]?.token ?? null, n: f.n + 1 }));
    },
    [patch],
  );

  const runStay = useCallback(
    async (query: StayQuery, reuse?: HotelOption[]) => {
      const id = uid();
      push({ id, t: "stay", query, status: "loading", stage: reuse ? "pick" : "search", checked: reuse?.length });
      if (reuse) return pickForStays(id, query, reuse);
      const r = await searchStays(query);
      if (!r.ok) return patch(id, { status: "error", err: r.status });
      if (!r.data.options.length) return patch(id, { status: "done", options: [], picks: [] });
      patch(id, { checked: r.data.options.length, stage: "pick" });
      return pickForStays(id, query, r.data.options);
    },
    [patch, push, pickForStays],
  );

  // ---------- 항공 ----------
  const runFlight = useCallback(
    async (query: FlightQuery, reuse?: FlightOption[]) => {
      const id = uid();
      push({ id, t: "flight", query, status: "loading", stage: reuse ? "pick" : "search", checked: reuse?.length });
      let options = reuse;
      if (!options) {
        const r = await searchFlights(query);
        if (!r.ok) return patch(id, { status: "error", err: r.status });
        options = r.data.options;
        patch(id, { checked: options.length, stage: "pick" });
      }
      if (!options.length) return patch(id, { status: "done", options: [], picks: [] });
      const fb = fallbackFlightPicks(options, query.taste);
      const ai = await withSkip<PickResult>(id, pickFlights(options, query.taste));
      const list = options;
      const picks = mergePicks(ai.ok ? ai.data.picks : [], fb, list.length, (n) => flightFactReason(list[n - 1], query.taste));
      patch(id, { status: "done", options, picks, note: ai.ok ? ai.data.note : "" });
      setActiveId(id);
    },
    [patch, push],
  );

  // 조건이 다 모이면 바로 찾고, 모자라면 입력 시트를 채워서 연다
  const goStay = useCallback(
    (q: Partial<StayQuery>, base?: StayMsg) => {
      const t = localToday();
      if (!stayReady(q, t)) {
        setStaySheet(q);
        return;
      }
      const sameSearch = base?.options && base.query.place === q.place && base.query.checkIn === q.checkIn && base.query.checkOut === q.checkOut && base.query.adults === q.adults;
      runStay({ ...q, budget: q.budget ?? 0, taste: q.taste ?? "" } as StayQuery, sameSearch ? base.options : undefined);
    },
    [runStay],
  );

  const goFlight = useCallback(
    (q: Partial<FlightQuery>, base?: FlightMsg) => {
      const t = localToday();
      if (!flightReady(q, t)) {
        setFlightSheet(q);
        return;
      }
      const same = base?.options && base.query.from === q.from && base.query.to === q.to && base.query.depart === q.depart && base.query.ret === q.ret && base.query.adults === q.adults;
      runFlight(q as FlightQuery, same ? base.options : undefined);
    },
    [runFlight],
  );

  // ---------- 자유 문장 ----------
  async function send(raw: string) {
    const said = raw.trim();
    if (!said || busy) return;
    setText("");
    setPlus(false);
    setTab("explore");
    push({ id: uid(), t: "user", text: said });
    const base = msgsRef.current.find((m) => m.id === activeId) as StayMsg | FlightMsg | undefined;
    setBusy(true);
    const r = await parseText(said, localToday(), contextOf(base));
    setBusy(false);
    if (!r.ok) {
      // AI를 못 쓰면: 보고 있는 결과가 있으면 같은 목록 안에서 취향만 더해 다시 정리하고(검색 없음), 없으면 입력 시트로 이어 준다
      if (base?.t === "stay" && base.options) return runStay({ ...base.query, taste: joinTaste(base.query.taste, said.slice(0, 100)) }, base.options);
      if (base?.t === "flight" && base.options) return runFlight({ ...base.query, taste: joinTaste(base.query.taste, said.slice(0, 100)) }, base.options);
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

  function submitStay(q: StayQuery) {
    setStaySheet(null);
    setTab("explore");
    push({ id: uid(), t: "user", text: [q.taste, `${q.place} · ${mdw(q.checkIn)}–${mdw(q.checkOut)} · ${q.adults}명`, q.budget ? `${Math.round(q.budget / 10000)}만 원 아래` : ""].filter(Boolean).join(" · ") });
    runStay(q);
  }

  function submitFlight(q: FlightQuery) {
    setFlightSheet(null);
    setTab("explore");
    push({ id: uid(), t: "user", text: [q.taste, `${q.fromLabel} → ${q.toLabel} · ${mdw(q.depart)}${q.ret ? `–${mdw(q.ret)}` : " 편도"} · ${q.adults}명`].filter(Boolean).join(" · ") });
    runFlight(q);
  }

  // 목록/지도 열기. 휴대폰은 전체 화면, PC는 오른쪽 패널이 바뀐다
  function openAll(id: string, view: "list" | "map" = "list", token: string | null = null) {
    setActiveId(id);
    setFocus((f) => ({ view, token, n: f.n + 1 }));
    if (!desktop) setLayerOpen(true);
  }

  function save(hotel: HotelOption, query: StayQuery) {
    const was = savedSet.has(hotel.token);
    toggle(hotel, query);
    setToast(was ? null : `${query.place} 여행에 담았어요`);
  }

  // 위쪽 조건 칩을 누르면 지금 조건이 채워진 입력 시트가 열린다
  function editTrip() {
    if (trip?.t === "flight") return setFlightSheet(trip.query);
    if (trip?.t === "ask") return trip.kind === "flight" ? setFlightSheet(trip.flight) : setStaySheet(trip.stay);
    setStaySheet(trip?.t === "stay" ? trip.query : {});
  }

  function reset() {
    setMsgs([]);
    setActiveId(null);
    setTab("explore");
  }

  const home = msgs.length === 0;
  const loading = msgs.some((m) => (m.t === "stay" || m.t === "flight") && m.status === "loading");
  const chips = chipsOf(trip);
  const title = trip?.t === "flight" || (trip?.t === "ask" && trip.kind === "flight") ? `${chips[0].empty ? "" : `${chips[0].label} `}항공편 찾기` : `${chips[0].empty ? "" : `${chips[0].label} `}숙소 찾기`;

  const browser =
    active?.t === "stay" && active.options?.length ? (
      <StayBrowser
        key={active.id}
        data={{ query: active.query, options: active.options, picks: (active.picks ?? []).map((p) => p.token) }}
        saved={savedSet}
        focus={focus}
        onSave={(hotel) => save(hotel, active.query)}
        onOpen={(hotel) => setSeller({ hotel, query: active.query })}
        onClose={desktop ? undefined : () => setLayerOpen(false)}
      />
    ) : active?.t === "flight" && active.options?.length ? (
      <FlightBrowser key={active.id} data={{ query: active.query, options: active.options, picks: active.picks ?? [] }} onClose={desktop ? undefined : () => setLayerOpen(false)} />
    ) : null;

  const tripBar = (
    <button type="button" className="tb-trip" onClick={editTrip} aria-label="여행 조건 바꾸기">
      {chips.map((c, i) => (
        <span key={i} className={c.empty ? "empty" : undefined}>
          {c.pin && <IconPin size={17} />}
          {c.label}
        </span>
      ))}
    </button>
  );

  return (
    <div className="tb-app">
      <nav className="tb-rail" aria-label="메뉴">
        <button type="button" className="tb-rail-logo" onClick={reset} aria-label={`${brand.appName} 처음 화면`} title={brand.appName}>
          <Mascot size={44} mood="happy" />
        </button>
        <TabButtons tab={tab} setTab={setTab} rail />
        <button type="button" className="tb-tab" onClick={reset} aria-label="새로 시작" title="새로 시작">
          <IconPlus />
        </button>
      </nav>

      <div className="tb-main">
        <header className="tb-head">
          <div className="tb-head-pc">
            {home || tab !== "explore" ? (
              <strong className="tb-logo">
                {brand.appName}
                {brand.tentative && <em>가칭</em>}
              </strong>
            ) : (
              <strong className="tb-title">{title}</strong>
            )}
          </div>
          {tab === "explore" && (
            <div className="tb-head-m">
              {home ? (
                <span className="tb-round ghost" aria-hidden />
              ) : (
                <button type="button" className="tb-round" onClick={reset} aria-label="처음으로">
                  <IconBack size={22} />
                </button>
              )}
              {tripBar}
            </div>
          )}
        </header>

        {tab === "explore" ? (
          <main className="tb-chat">
            {home ? (
              <Home onSay={send} onStay={() => setStaySheet({})} onFlight={() => setFlightSheet({})} />
            ) : (
              <div className="tb-msgs" aria-live="polite">
                {msgs.map((m) => (
                  <MsgView
                    key={m.id}
                    m={m}
                    saved={savedSet}
                    onAnswer={(i, a) => m.t === "ask" && patch(m.id, { answers: { ...m.answers, [i]: a } })}
                    onApply={(edit) => m.t === "ask" && applyAsk(m, edit)}
                    onOpenHotel={(hotel) => m.t === "stay" && setSeller({ hotel, query: m.query })}
                    onSave={(hotel) => m.t === "stay" && save(hotel, m.query)}
                    onAll={(view, token) => openAll(m.id, view, token)}
                    onRetry={() => (m.t === "stay" ? runStay(m.query) : m.t === "flight" ? runFlight(m.query) : undefined)}
                    onSkip={() => skips.current.get(m.id)?.()}
                    onSay={send}
                    onStaySheet={setStaySheet}
                    onFlightSheet={setFlightSheet}
                  />
                ))}
                {busy && <Typing />}
                <div ref={endRef} />
              </div>
            )}
          </main>
        ) : tab === "now" ? (
          <Soon
            title="지금 여기"
            lead="여행 중에 쓰는 도구를 준비하고 있어요."
            items={["오늘 날씨와 다음 일정을 한눈에", "메뉴판을 찍으면 우리말로 풀어 보기, 점원에게 보여 줄 주문 문장", "현지 가격을 원화로 바로 보기"]}
          />
        ) : (
          <Trips saved={saved} onOpen={(s) => setSeller(s)} onExplore={() => setTab("explore")} />
        )}

        {tab === "explore" && (
          <div className="tb-dock">
            {plus && (
              <div className="tb-plus" role="menu">
                <button type="button" role="menuitem" onClick={() => (setPlus(false), setStaySheet(trip?.t === "stay" ? trip.query : {}))}>
                  <IconBed size={20} /> 숙소 조건 넣기
                </button>
                <button type="button" role="menuitem" onClick={() => (setPlus(false), setFlightSheet(trip?.t === "flight" ? trip.query : {}))}>
                  <IconPlane size={20} /> 항공편 조건 넣기
                </button>
                <span>
                  <IconSpark size={20} /> 체험 <em className="tb-badge">곧 열려요</em>
                </span>
                <span>
                  <IconWifi size={20} /> eSIM <em className="tb-badge">곧 열려요</em>
                </span>
              </div>
            )}
            <form
              className="tb-composer"
              onSubmit={(e) => {
                e.preventDefault();
                send(text);
              }}
            >
              <button type="button" className="tb-plus-btn" aria-label="조건 직접 넣기" aria-expanded={plus} onClick={() => setPlus((v) => !v)}>
                <IconPlus size={22} />
              </button>
              <input
                value={text}
                maxLength={500}
                onChange={(e) => setText(e.target.value)}
                placeholder={home ? "여기에 편하게 적어 주세요" : loading ? "찾는 동안 더 말해도 돼요" : active?.t === "flight" ? '"직항만"처럼 말해요' : '"더 조용한 곳"처럼 말해요'}
                aria-label="AI에게 말하기"
                enterKeyHint="send"
              />
              <button type="submit" className="tb-send" disabled={!text.trim() || busy} aria-label="보내기">
                <IconUp size={22} />
              </button>
            </form>
          </div>
        )}

        <nav className="tb-tabbar" aria-label="메뉴">
          <TabButtons tab={tab} setTab={setTab} />
        </nav>
      </div>

      {desktop && (
        <aside className="tb-side" aria-label="지도와 목록">
          <div className="tb-side-top">
            <span />
            {tab === "explore" && !home ? tripBar : <span />}
            <button type="button" className="tb-side-trips" onClick={() => setTab("trips")}>
              <IconHeart size={18} on={saved.length > 0} /> 내 여행{saved.length ? ` ${saved.length}` : ""}
            </button>
          </div>
          {browser ?? (
            <div className="tb-side-empty">
              <Mascot size={88} />
              <strong>여기에 숙소 지도가 보여요</strong>
              <span>왼쪽에서 어디로, 언제 가는지 말해 주세요.</span>
            </div>
          )}
        </aside>
      )}
      {!desktop && (
        <PhoneLayer open={layerOpen && !!browser} onClose={() => setLayerOpen(false)}>
          {browser}
        </PhoneLayer>
      )}

      {toast && (
        <div className="tb-toast" role="status">
          <span className="tb-toast-ico">
            <IconHeart size={18} on />
          </span>
          <span>{toast}</span>
          <button
            type="button"
            onClick={() => {
              setToast(null);
              setLayerOpen(false);
              setTab("trips");
            }}
          >
            보기
          </button>
        </div>
      )}

      <StaySheet open={!!staySheet} init={staySheet ?? {}} onClose={() => setStaySheet(null)} onSubmit={submitStay} />
      <FlightSheet open={!!flightSheet} init={flightSheet ?? {}} onClose={() => setFlightSheet(null)} onSubmit={submitFlight} />
      <SellerSheet
        hotel={seller?.hotel ?? null}
        query={seller?.query ?? EMPTY_QUERY}
        saved={!!seller && savedSet.has(seller.hotel.token)}
        onSave={() => seller && save(seller.hotel, seller.query)}
        onClose={() => setSeller(null)}
      />
    </div>
  );
}

const EMPTY_QUERY: StayQuery = { place: "", checkIn: "2000-01-01", checkOut: "2000-01-02", adults: 2, budget: 0, taste: "" };

function TabButtons({ tab, setTab, rail }: { tab: Tab; setTab: (t: Tab) => void; rail?: boolean }) {
  const items: { id: Tab; label: string; icon: React.ReactNode; soon?: boolean }[] = [
    { id: "explore", label: "여행 찾기", icon: <IconChat /> },
    { id: "now", label: "지금 여기", icon: <IconPin />, soon: true },
    { id: "trips", label: "내 여행", icon: <IconBag /> },
  ];
  return (
    <>
      {items.map((it) => (
        <button key={it.id} type="button" className="tb-tab" aria-current={tab === it.id ? "page" : undefined} onClick={() => setTab(it.id)} aria-label={rail ? it.label : undefined} title={rail ? it.label : undefined}>
          {it.icon}
          {!rail && <span>{it.label}</span>}
          {it.soon && <em className="tb-soon-dot">곧</em>}
        </button>
      ))}
    </>
  );
}

function Home({ onSay, onStay, onFlight }: { onSay: (t: string) => void; onStay: () => void; onFlight: () => void }) {
  return (
    <div className="tb-home">
      <div className="tb-hello">
        <p className="tb-hello-bubble">
          {brand.greeting[0]}
          <br />
          {brand.greeting[1]}
        </p>
        <Mascot size={124} mood="happy" />
        <p className="tb-hello-sub">
          말로 하듯 적어 주면 돼요.
          <br />
          생각나는 대로 편하게요.
        </p>
      </div>
      <div className="tb-quick">
        {QUICK.map((q) => (
          <button key={q} type="button" onClick={() => onSay(q)}>
            {q}
          </button>
        ))}
      </div>
      <div className="tb-direct">
        <span>조건을 직접 넣어도 돼요</span>
        <button type="button" onClick={onStay}>
          <IconBed size={18} /> 숙소
        </button>
        <button type="button" onClick={onFlight}>
          <IconPlane size={18} /> 항공편
        </button>
      </div>
    </div>
  );
}

function AiSay({ children }: { children: React.ReactNode }) {
  return (
    <div className="tb-ai">
      <Mascot size={38} />
      <div className="tb-bubble">{children}</div>
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
  onAll: (view?: "list" | "map", token?: string | null) => void;
  onRetry: () => void;
  onSkip: () => void;
  onSay: (t: string) => void;
  onStaySheet: (q: Partial<StayQuery>) => void;
  onFlightSheet: (q: Partial<FlightQuery>) => void;
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

// v5 '열심히 찾는 중이에요' 카드
function Working({ kind, taste, what, checked, stage, onSkip }: { kind: "stay" | "flight"; taste: string; what: string; checked?: number; stage?: Stage; onSkip: () => void }) {
  const pick = stage === "pick";
  const friend = kind === "stay" ? "숙소" : "항공";
  return (
    <div className="tb-work" aria-live="polite">
      <div className="tb-work-head">
        <Mascot size={48} mood="search" />
        <strong>열심히 찾는 중이에요</strong>
      </div>
      <ul>
        <li className="done">
          <span className="tb-work-ico">
            <IconCheck />
          </span>
          <span>
            원하는 걸 정리했어요{taste ? <small> · {taste}</small> : null}
          </span>
        </li>
        <li className={pick ? "done" : "now"}>
          <span className="tb-work-ico">{pick ? <IconCheck /> : kind === "stay" ? <IconBed size={18} /> : <IconPlane size={18} />}</span>
          <span>
            {pick ? `${what} ${checked ?? ""}${kind === "stay" ? "곳" : "편"}을 살펴봤어요` : `${friend} 담당 친구에게 넘겼어요`}
            {!pick && <Dots />}
            {!pick && <small className="tb-work-sub">{what} 살펴보는 중</small>}
          </span>
        </li>
        <li className={pick ? "now" : "wait"}>
          <span className="tb-work-ico">
            <IconSpark size={18} />
          </span>
          <span>
            말씀하신 조건에 맞는 3{kind === "stay" ? "곳" : "편"} 추리는 {pick ? "중" : "건 다음 차례예요"}
            {pick && <Dots />}
          </span>
        </li>
      </ul>
      {pick && (
        <div className="tb-work-foot">
          <button type="button" className="tb-link" onClick={onSkip}>
            기다리지 않고 건너뛰기
          </button>
        </div>
      )}
    </div>
  );
}

const Dots = () => (
  <i className="tb-dots" aria-hidden>
    <b />
    <b />
    <b />
  </i>
);

function ErrorBox({ status, onRetry, fallbackHref, fallbackLabel }: { status: number | null | undefined; onRetry: () => void; fallbackHref: string; fallbackLabel: string }) {
  return (
    <div className="tb-col">
      <AiSay>{searchErrorMessage(status ?? null)}</AiSay>
      <div className="tb-ask-go">
        <button type="button" className="tb-cta small" onClick={onRetry}>
          {SEARCH_RETRY_LABEL}
        </button>
        <a className="tb-link" href={fallbackHref} target="_blank" rel="noopener noreferrer">
          {fallbackLabel} <IconOut />
        </a>
      </div>
    </div>
  );
}

function StayResult({ m, saved, onOpenHotel, onSave, onAll, onRetry, onSkip, onSay, onFlightSheet }: MsgProps & { m: StayMsg }) {
  const q = m.query;
  if (m.status === "loading") return <Working kind="stay" taste={q.taste} what={`${span(q.checkIn, q.checkOut)} ${q.place} 숙소`} checked={m.checked} stage={m.stage} onSkip={onSkip} />;
  if (m.status === "error")
    return <ErrorBox status={m.err} onRetry={onRetry} fallbackHref={sellerSearchUrl("trip", q.place, q)} fallbackLabel="트립닷컴에서 바로 보기" />;
  const options = m.options ?? [];
  const nights = nightsOf(q);
  if (!options.length) return <AiSay>이 조건으로는 숙소를 찾지 못했어요. 지역 이름을 조금 넓게(예: “오사카”) 적거나 날짜를 바꿔 보세요.</AiSay>;
  const picks = (m.picks ?? []).map((p) => ({ ...p, h: options.find((o) => o.token === p.token)! })).filter((p) => p.h);
  const hasBreakfast = options.some((h) => h.amenities.some((a) => /조식|아침/.test(a)));
  return (
    <div className="tb-result">
      <AiSay>
        찾았어요! {options.length}곳 중에 <b>딱 {picks.length}곳</b>만 먼저 보여드릴게요.{m.note ? ` ${m.note}` : ""}
      </AiSay>
      <div className="tb-cards">
        {picks.map((p, i) => {
          const t = stayTotal(p.h, nights);
          const on = saved.has(p.token);
          return (
            <article key={p.token} className="tb-card">
              <div className="tb-card-img">
                {p.h.image ? <img src={p.h.image} alt="" loading="lazy" onError={(e) => (e.currentTarget.style.display = "none")} /> : null}
                <b>{i + 1}</b>
                <button type="button" className={`tb-love${on ? " on" : ""}`} aria-pressed={on} aria-label={on ? "여행에서 빼기" : "여행에 담기"} onClick={() => onSave(p.h)}>
                  <IconHeart size={24} on={on} />
                </button>
              </div>
              <div className="tb-card-body">
                <div className="tb-card-name">
                  <strong>{p.h.name}</strong>
                  {p.h.rating ? <span>★ {p.h.rating.toFixed(1)}</span> : null}
                </div>
                <p className="tb-card-why">
                  <Mascot size={24} />
                  {p.reason}
                </p>
                <div className="tb-card-foot">
                  <span>
                    <small>
                      {nights}박 {t?.approx ? "어림 총액" : "총액 · 세금 포함"}
                    </small>
                    <strong>{t ? won(t.value) : "가격 확인"}</strong>
                  </span>
                  {p.h.gps && (
                    <button type="button" className="tb-btn soft" onClick={() => onAll("map", p.token)}>
                      <IconMap size={18} /> 지도
                    </button>
                  )}
                  <button type="button" className="tb-btn dark" onClick={() => onOpenHotel(p.h)}>
                    예약 <IconOut />
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      <div className="tb-follow">
        {options.length > picks.length && (
          <button type="button" onClick={() => onAll("list")}>
            <IconList size={18} /> {options.length}곳 모두 보기
          </button>
        )}
        {hasBreakfast && !/조식/.test(q.taste) && (
          <button type="button" onClick={() => onSay("조식 포함인 곳만")}>
            조식 포함만
          </button>
        )}
        <button type="button" onClick={() => onSay("더 조용한 곳")}>
          더 조용한 곳
        </button>
        <button type="button" onClick={() => onFlightSheet({ depart: q.checkIn, ret: q.checkOut, adults: q.adults })}>
          <IconPlane size={18} /> 이제 항공편 찾기
        </button>
      </div>
    </div>
  );
}

function FlightResult({ m, onAll, onRetry, onSkip, onSay, onStaySheet }: MsgProps & { m: FlightMsg }) {
  const q = m.query;
  const route = `${cityOf(q.fromLabel || q.from)} → ${cityOf(q.toLabel || q.to)}`;
  if (m.status === "loading") return <Working kind="flight" taste={q.taste} what={`${span(q.depart, q.ret)} ${route} 항공편`} checked={m.checked} stage={m.stage} onSkip={onSkip} />;
  if (m.status === "error") return <ErrorBox status={m.err} onRetry={onRetry} fallbackHref={flightLink(q)} fallbackLabel="트립닷컴에서 바로 보기" />;
  const options = m.options ?? [];
  if (!options.length) return <AiSay>이 날짜에는 항공편을 찾지 못했어요. 날짜나 공항을 바꿔 보세요.</AiSay>;
  const picks = (m.picks ?? []).map((p) => ({ ...p, o: options[p.n - 1] })).filter((p) => p.o);
  return (
    <div className="tb-result">
      <AiSay>
        찾았어요! {route} {options.length}편 중에 <b>딱 {picks.length}편</b>만 먼저 보여드릴게요. 가격은 {q.adults}명 {q.ret ? "왕복" : "편도"} 총액이에요.{m.note ? ` ${m.note}` : ""}
      </AiSay>
      <div className="tb-cards">
        {picks.map((p, i) => (
          <FlightCard key={`${p.n}`} o={p.o} q={q} reason={p.reason} rank={i + 1} />
        ))}
      </div>
      <div className="tb-follow">
        {options.length > picks.length && (
          <button type="button" onClick={() => onAll("list")}>
            <IconList size={18} /> {options.length}편 모두 보기
          </button>
        )}
        <button type="button" onClick={() => onSay("직항만")}>
          직항만
        </button>
        <button type="button" onClick={() => onStaySheet({ place: cityOf(q.toLabel || ""), checkIn: q.depart, checkOut: q.ret || undefined, adults: q.adults })}>
          <IconBed size={18} /> 이제 숙소 찾기
        </button>
      </div>
    </div>
  );
}

function Soon({ title, lead, items }: { title: string; lead: string; items: string[] }) {
  return (
    <main className="tb-soon">
      <span className="tb-badge">곧 열려요</span>
      <h1>{title}</h1>
      <p>{lead}</p>
      <ul>
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </main>
  );
}

function Trips({ saved, onOpen, onExplore }: { saved: Saved[]; onOpen: (s: Saved) => void; onExplore: () => void }) {
  return (
    <main className="tb-soon">
      <h1>내 여행</h1>
      <h2 className="tb-sub">담아 둔 숙소</h2>
      {saved.length ? (
        <div className="tb-hlist">
          {saved.map((s) => (
            <div key={s.hotel.token}>
              <HotelRow h={s.hotel} nights={nightsOf(s.query)} pick={false} saved onOpen={() => onOpen(s)} />
              <p className="tb-saved-q">
                {s.query.place} · {md(s.query.checkIn)}–{md(s.query.checkOut)} · {s.query.adults}명
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="tb-empty">
          <Mascot size={64} mood="happy" />
          <p>마음에 드는 숙소의 ♡를 누르면 여기에 모여요.</p>
          <button type="button" className="tb-cta small" onClick={onExplore}>
            숙소 찾으러 가기
          </button>
        </div>
      )}
      <div className="tb-soon-box">
        <span className="tb-badge">곧 열려요</span>
        <p>다가오는 여행 일정, 지난 여행 지도 영상과 사진 모아 보기를 준비하고 있어요.</p>
      </div>
    </main>
  );
}


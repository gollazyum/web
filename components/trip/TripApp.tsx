"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { brand } from "@/lib/brand";
import { site } from "@/lib/site";
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
import { SellerSheet } from "./SellerSheet";
import { HotelRow, StayBrowser } from "./StayBrowser";
import { IconBag, IconBed, IconCheck, IconCompass, IconOut, IconPin, IconPlane, IconPlus, IconSpark, IconUp, IconWifi } from "./icons";

type StayPick = { token: string; reason: string };
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
  | { id: string; t: "stay"; query: StayQuery; status: Status; err?: number | null; options?: HotelOption[]; picks?: StayPick[]; note?: string; checked?: number }
  | { id: string; t: "flight"; query: FlightQuery; status: Status; err?: number | null; options?: FlightOption[]; picks?: { n: number; reason: string }[]; note?: string };

type StayMsg = Extract<Msg, { t: "stay" }>;
type FlightMsg = Extract<Msg, { t: "flight" }>;
type Tab = "explore" | "now" | "trips";
type Saved = { hotel: HotelOption; query: StayQuery };

const uid = () => Math.random().toString(36).slice(2, 10);
const SAVED_KEY = "tb-saved-v1";
const EXAMPLES = ["부모님 모시고 12월에 따뜻한 온천, 걷는 건 적게 3박 4일", "후쿠오카 2박, 하카타역 근처 조식 되는 곳", "인천에서 다낭 왕복, 오전 출발 직항"];

const md = (iso: string) => `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`;
const DOW = ["일", "월", "화", "수", "목", "금", "토"];
const mdw = (iso: string) => `${md(iso)}(${DOW[new Date(`${iso}T00:00:00`).getDay()]})`;

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

export function TripApp() {
  const [tab, setTab] = useState<Tab>("explore");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  const [staySheet, setStaySheet] = useState<Partial<StayQuery> | null>(null);
  const [flightSheet, setFlightSheet] = useState<Partial<FlightQuery> | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [layerOpen, setLayerOpen] = useState(false);
  const [seller, setSeller] = useState<{ hotel: HotelOption; query: StayQuery } | null>(null);
  const desktop = useMediaQuery("(min-width: 1024px)");
  const { saved, toggle } = useSaved();
  const savedSet = useMemo(() => new Set(saved.map((s) => s.hotel.token)), [saved]);
  const endRef = useRef<HTMLDivElement>(null);
  const msgsRef = useRef(msgs);
  msgsRef.current = msgs;

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

  const active = msgs.find((m) => m.id === activeId && (m.t === "stay" || m.t === "flight") && m.status === "done") as StayMsg | FlightMsg | undefined;

  // ---------- 숙소 ----------
  const pickForStays = useCallback(
    async (id: string, query: StayQuery, options: HotelOption[]) => {
      const nights = nightsOf(query);
      const { list: pool, over } = withinBudget(options, query.budget, nights);
      const head = pool.slice(0, 40);
      const fb = fallbackStayPicks(head, query.taste, query.budget, nights);
      const ai = await pickStays(head, query.taste, query.budget);
      const picks = mergePicks(ai.ok ? ai.data.picks : [], fb, head.length, (n) => stayFactReason(head[n - 1], query.taste));
      const notes = [over ? `예산(${Math.round(query.budget / 10000)}만 원) 안의 숙소가 없어서 가장 가까운 곳을 보여 드려요.` : "", ai.ok ? ai.data.note : ""].filter(Boolean);
      patch(id, { status: "done", options, picks: picks.map((p) => ({ token: head[p.n - 1].token, reason: p.reason })), note: notes.join(" ") });
      setActiveId(id);
    },
    [patch],
  );

  const runStay = useCallback(
    async (query: StayQuery, reuse?: HotelOption[]) => {
      const id = uid();
      push({ id, t: "stay", query, status: "loading" });
      if (reuse) return pickForStays(id, query, reuse);
      const r = await searchStays(query);
      if (!r.ok) return patch(id, { status: "error", err: r.status });
      if (!r.data.options.length) return patch(id, { status: "done", options: [], picks: [] });
      patch(id, { checked: r.data.options.length });
      return pickForStays(id, query, r.data.options);
    },
    [patch, push, pickForStays],
  );

  // ---------- 항공 ----------
  const runFlight = useCallback(
    async (query: FlightQuery, reuse?: FlightOption[]) => {
      const id = uid();
      push({ id, t: "flight", query, status: "loading" });
      let options = reuse;
      if (!options) {
        const r = await searchFlights(query);
        if (!r.ok) return patch(id, { status: "error", err: r.status });
        options = r.data.options;
      }
      if (!options.length) return patch(id, { status: "done", options: [], picks: [] });
      const fb = fallbackFlightPicks(options, query.taste);
      const ai = await pickFlights(options, query.taste);
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

  function applyAsk(m: Extract<Msg, { t: "ask" }>, edit = false) {
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

  function openAll(id: string) {
    setActiveId(id);
    if (!desktop) setLayerOpen(true);
  }

  function reset() {
    setMsgs([]);
    setActiveId(null);
    setTab("explore");
  }

  const home = msgs.length === 0;

  const browser =
    active?.t === "stay" && active.options?.length ? (
      <StayBrowser
        key={active.id}
        data={{ query: active.query, options: active.options, picks: (active.picks ?? []).map((p) => p.token) }}
        saved={savedSet}
        onOpen={(hotel) => setSeller({ hotel, query: active.query })}
        onClose={desktop ? undefined : () => setLayerOpen(false)}
      />
    ) : active?.t === "flight" && active.options?.length ? (
      <FlightBrowser key={active.id} data={{ query: active.query, options: active.options, picks: active.picks ?? [] }} onClose={desktop ? undefined : () => setLayerOpen(false)} />
    ) : null;

  return (
    <div className="tb-app">
      <div className="tb-main">
        <header className="tb-head">
          <button type="button" className="tb-logo" onClick={reset} aria-label={`${brand.appName} 처음 화면`}>
            <span className="tb-mark" aria-hidden />
            <strong>{brand.appName}</strong>
            {brand.tentative && <em>가칭</em>}
          </button>
          <nav className="tb-toptabs" aria-label="메뉴">
            <TabButtons tab={tab} setTab={setTab} />
          </nav>
          {!home && tab === "explore" && (
            <button type="button" className="tb-round" onClick={reset} aria-label="새로 시작">
              <IconPlus size={20} />
            </button>
          )}
        </header>

        {tab === "explore" ? (
          <main className="tb-chat">
            {home ? (
              <Home onStay={() => setStaySheet({})} onFlight={() => setFlightSheet({})} onExample={send} />
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
                    onAll={() => openAll(m.id)}
                    onRetry={() => (m.t === "stay" ? runStay(m.query) : m.t === "flight" ? runFlight(m.query) : undefined)}
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
            <form
              className="tb-composer"
              onSubmit={(e) => {
                e.preventDefault();
                send(text);
              }}
            >
              <input value={text} maxLength={500} onChange={(e) => setText(e.target.value)} placeholder={home ? "무엇이든 물어보세요" : active?.t === "flight" ? '"직항만"처럼 말해 보세요' : '"조식 있는 곳만"처럼 말해 보세요'} aria-label="AI에게 물어보기" enterKeyHint="send" />
              <button type="submit" className="tb-send" disabled={!text.trim() || busy} aria-label="보내기">
                <IconUp size={20} />
              </button>
            </form>
            {home && (
              <p className="tb-privacy">
                AI 대화 내용은 답변을 만들기 위해 외부 AI 서비스로 전송돼요. 이름·연락처 같은 개인정보는 넣지 마세요. <Link href="/privacy">개인정보처리방침</Link>
              </p>
            )}
          </div>
        )}

        <nav className="tb-tabbar" aria-label="메뉴">
          <TabButtons tab={tab} setTab={setTab} />
        </nav>
      </div>

      {desktop && (
        <aside className="tb-side" aria-label="지도와 목록">
          {browser ?? (
            <div className="tb-side-empty">
              <IconMap2 />
              <strong>여기에 숙소 지도와 목록이 보여요</strong>
              <span>왼쪽에서 숙소나 항공편을 찾아보세요.</span>
            </div>
          )}
        </aside>
      )}
      {!desktop && (
        <PhoneLayer open={layerOpen && !!browser} onClose={() => setLayerOpen(false)}>
          {browser}
        </PhoneLayer>
      )}

      <StaySheet open={!!staySheet} init={staySheet ?? {}} onClose={() => setStaySheet(null)} onSubmit={submitStay} />
      <FlightSheet open={!!flightSheet} init={flightSheet ?? {}} onClose={() => setFlightSheet(null)} onSubmit={submitFlight} />
      <SellerSheet
        hotel={seller?.hotel ?? null}
        query={seller?.query ?? EMPTY_QUERY}
        saved={!!seller && savedSet.has(seller.hotel.token)}
        onSave={() => seller && toggle(seller.hotel, seller.query)}
        onClose={() => setSeller(null)}
      />
    </div>
  );
}

const EMPTY_QUERY: StayQuery = { place: "", checkIn: "2000-01-01", checkOut: "2000-01-02", adults: 2, budget: 0, taste: "" };

function IconMap2() {
  return (
    <span className="tb-side-icon" aria-hidden>
      <IconPin size={30} />
    </span>
  );
}

function TabButtons({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const items: { id: Tab; label: string; icon: React.ReactNode; soon?: boolean }[] = [
    { id: "explore", label: "탐색", icon: <IconCompass /> },
    { id: "now", label: "지금 여기", icon: <IconPin />, soon: true },
    { id: "trips", label: "내 여행", icon: <IconBag /> },
  ];
  return (
    <>
      {items.map((it) => (
        <button key={it.id} type="button" className="tb-tab" aria-current={tab === it.id ? "page" : undefined} onClick={() => setTab(it.id)}>
          {it.icon}
          <span>{it.label}</span>
          {it.soon && <em className="tb-soon-dot">곧</em>}
        </button>
      ))}
    </>
  );
}

function Home({ onStay, onFlight, onExample }: { onStay: () => void; onFlight: () => void; onExample: (t: string) => void }) {
  return (
    <div className="tb-home">
      <h1>
        이번 여행,
        <br />
        무엇을 찾아볼까요?
      </h1>
      <div className="tb-tiles">
        <button type="button" className="tb-tile" onClick={onStay}>
          <IconBed size={34} />
          <strong>숙소</strong>
        </button>
        <button type="button" className="tb-tile" onClick={onFlight}>
          <IconPlane size={34} />
          <strong>항공편</strong>
        </button>
        <div className="tb-tile off" aria-disabled>
          <IconSpark size={30} />
          <strong>체험</strong>
          <em>곧 열려요</em>
        </div>
        <div className="tb-tile off" aria-disabled>
          <IconWifi size={30} />
          <strong>eSIM</strong>
          <em>곧 열려요</em>
        </div>
      </div>
      <div className="tb-examples">
        <p>이렇게 말해도 돼요</p>
        {EXAMPLES.map((e) => (
          <button key={e} type="button" onClick={() => onExample(e)}>
            “{e}”
          </button>
        ))}
      </div>
      <footer className="tb-foot">
        <p>
          예약과 결제는 이동한 예약 사이트에서 진행돼요. 가격은 찾은 시점 기준이며 바뀔 수 있어요. 예약 링크로 이동하면 {site.name}이 제휴 수수료를 받을 수 있어요.
        </p>
        <p>
          <Link href="/terms">이용약관</Link> · <Link href="/privacy">개인정보처리방침</Link> · 문의 <a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a>
        </p>
        <p>
          상호 {site.business.name} · 대표자 {site.business.ceo} · 사업자등록번호 {site.business.registrationNo}
        </p>
      </footer>
    </div>
  );
}

function Typing() {
  return (
    <div className="tb-ai">
      <span className="tb-mark sm" aria-hidden />
      <span className="tb-typing" aria-label="생각하는 중">
        <i />
        <i />
        <i />
      </span>
    </div>
  );
}

type MsgProps = {
  m: Msg;
  saved: Set<string>;
  onAnswer: (i: number, a: AskOption) => void;
  onApply: (edit: boolean) => void;
  onOpenHotel: (h: HotelOption) => void;
  onAll: () => void;
  onRetry: () => void;
};

function MsgView({ m, saved, onAnswer, onApply, onOpenHotel, onAll, onRetry }: MsgProps) {
  if (m.t === "user") return <div className="tb-user">{m.text}</div>;
  if (m.t === "ai")
    return (
      <div className="tb-ai">
        <span className="tb-mark sm" aria-hidden />
        <p>{m.text}</p>
      </div>
    );
  if (m.t === "ask") {
    const all = m.questions.every((_, i) => m.answers[i]);
    return (
      <div className="tb-ai col">
        <div className="tb-ai">
          <span className="tb-mark sm" aria-hidden />
          <p>{m.reply || "딱 맞게 찾으려고 몇 가지만 여쭤볼게요. 눌러서 답해 주세요."}</p>
        </div>
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
  if (m.t === "stay") return <StayResult m={m} saved={saved} onOpenHotel={onOpenHotel} onAll={onAll} onRetry={onRetry} />;
  return <FlightResult m={m} onAll={onAll} onRetry={onRetry} />;
}

function Steps({ lines }: { lines: string[] }) {
  return (
    <details className="tb-steps">
      <summary>
        <IconSpark size={16} /> 이렇게 찾았어요
      </summary>
      <ul>
        {lines.map((l) => (
          <li key={l}>
            <span>
              <IconCheck />
            </span>
            {l}
          </li>
        ))}
      </ul>
    </details>
  );
}

function Loading({ text }: { text: string }) {
  return (
    <div className="tb-ai col">
      <div className="tb-ai">
        <span className="tb-mark sm" aria-hidden />
        <p className="tb-loading">{text}</p>
      </div>
      <div className="tb-skel-cards">
        <span />
        <span />
      </div>
    </div>
  );
}

function ErrorBox({ status, onRetry, fallbackHref, fallbackLabel }: { status: number | null | undefined; onRetry: () => void; fallbackHref: string; fallbackLabel: string }) {
  return (
    <div className="tb-ai col">
      <div className="tb-ai">
        <span className="tb-mark sm" aria-hidden />
        <p>{searchErrorMessage(status ?? null)}</p>
      </div>
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

function StayResult({ m, saved, onOpenHotel, onAll, onRetry }: { m: StayMsg; saved: Set<string>; onOpenHotel: (h: HotelOption) => void; onAll: () => void; onRetry: () => void }) {
  const q = m.query;
  if (m.status === "loading") return <Loading text={`${q.place} 숙소를 찾고 있어요…`} />;
  if (m.status === "error")
    return <ErrorBox status={m.err} onRetry={onRetry} fallbackHref={sellerSearchUrl("trip", q.place, q)} fallbackLabel="트립닷컴에서 바로 보기" />;
  const options = m.options ?? [];
  const nights = nightsOf(q);
  if (!options.length)
    return (
      <div className="tb-ai">
        <span className="tb-mark sm" aria-hidden />
        <p>이 조건으로는 숙소를 찾지 못했어요. 지역 이름을 조금 넓게(예: “오사카”) 적거나 날짜를 바꿔 보세요.</p>
      </div>
    );
  const picks = (m.picks ?? []).map((p) => ({ ...p, h: options.find((o) => o.token === p.token)! })).filter((p) => p.h);
  return (
    <div className="tb-result">
      <div className="tb-result-head">
        <strong>
          {q.place} · {md(q.checkIn)}–{md(q.checkOut)} · {q.adults}명
        </strong>
        <span>숙소 {options.length}곳 중</span>
      </div>
      <Steps lines={[`${q.place} 숙소 ${m.checked ?? options.length}곳 확인`, `${md(q.checkIn)}~${md(q.checkOut)} 가격이 나온 곳만`, `세금·수수료 더해 ${nights}박 총액 계산`]} />
      <div className="tb-ai">
        <span className="tb-mark sm" aria-hidden />
        <p>
          조건에 맞는 곳을 <b>{picks.length}곳 먼저</b> 보여 드릴게요.{m.note ? ` ${m.note}` : ""}
        </p>
      </div>
      <div className="tb-cards">
        {picks.map((p, i) => {
          const t = stayTotal(p.h, nights);
          return (
            <div key={p.token} className="tb-card">
              <div className="tb-card-img">
                {p.h.image ? <img src={p.h.image} alt="" loading="lazy" /> : null}
                <b>{i + 1}</b>
              </div>
              <div className="tb-card-body">
                <strong className="tb-card-name">
                  {p.h.name}
                  {saved.has(p.token) && <span className="tb-heart">♥</span>}
                </strong>
                <p>{p.reason}</p>
                <div className="tb-card-foot">
                  <span>
                    <strong>{t ? won(t.value) : "가격 확인"}</strong>
                    <small>
                      {nights}박 총액{t?.approx ? "(어림)" : ""}
                    </small>
                  </span>
                  <button type="button" className="tb-book" onClick={() => onOpenHotel(p.h)}>
                    예약 <IconOut />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {options.length > picks.length && (
        <button type="button" className="tb-more" onClick={onAll}>
          숙소 {options.length}곳 모두 보기 · 지도
        </button>
      )}
    </div>
  );
}

function FlightResult({ m, onAll, onRetry }: { m: FlightMsg; onAll: () => void; onRetry: () => void }) {
  const q = m.query;
  if (m.status === "loading") return <Loading text={`${q.fromLabel || q.from} → ${q.toLabel || q.to} 항공편을 찾고 있어요…`} />;
  if (m.status === "error") return <ErrorBox status={m.err} onRetry={onRetry} fallbackHref={flightLink(q)} fallbackLabel="트립닷컴에서 바로 보기" />;
  const options = m.options ?? [];
  if (!options.length)
    return (
      <div className="tb-ai">
        <span className="tb-mark sm" aria-hidden />
        <p>이 날짜에는 항공편을 찾지 못했어요. 날짜나 공항을 바꿔 보세요.</p>
      </div>
    );
  const picks = (m.picks ?? []).map((p) => ({ ...p, o: options[p.n - 1] })).filter((p) => p.o);
  return (
    <div className="tb-result">
      <div className="tb-result-head">
        <strong>
          {q.fromLabel || q.from} → {q.toLabel || q.to}
        </strong>
        <span>
          {q.ret ? "왕복" : "편도"} · {q.adults}명 · 총액(세금 포함) · {options.length}편 중
        </span>
      </div>
      <div className="tb-ai">
        <span className="tb-mark sm" aria-hidden />
        <p>
          말씀하신 조건에 맞는 <b>{picks.length}편 먼저</b> 보여 드릴게요.{m.note ? ` ${m.note}` : ""}
        </p>
      </div>
      <div className="tb-cards">
        {picks.map((p, i) => (
          <FlightCard key={`${p.n}`} o={p.o} q={q} reason={p.reason} rank={i + 1} />
        ))}
      </div>
      {options.length > picks.length && (
        <button type="button" className="tb-more" onClick={onAll}>
          항공편 {options.length}편 모두 보기
        </button>
      )}
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
          <p>마음에 드는 숙소의 하트를 누르면 여기에 모여요.</p>
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

"use client";

import { useEffect, useRef, useState } from "react";
import { LiveMochi } from "./LiveMochi";
import { addDays, today } from "@/lib/dates";
import { hotelsPath, type HotelOption, type HotelQuery } from "@/lib/hotels";
import { hotelNameKo } from "@/lib/hotelText";

// 호텔 결과 화면 오른쪽에 붙어 다니는 로보티 숙소 도우미.
// 무엇이 중요한지 고르면 지금 불러온 호텔 목록 안에서 골라 주고, 답 속 [[번호]]는 그 호텔 카드로 가는 버튼이 된다
type Msg = { role: "user" | "assistant"; content: string };

const PREFS = ["💰 가성비", "✨ 후기 좋은 곳", "👑 4~5성급 고급", "🥐 조식", "🏊 수영장", "💪 피트니스", "💑 커플 여행", "👨‍👩‍👧‍👦 가족 여행", "🎒 혼자 여행"];
// 칩 앞 이모지를 뗀 말 (질문 문장에 넣을 때)
const plain = (p: string) => p.replace(/^\S+\s/, "");

// 원클릭 질문의 예산: 지금 목록의 1박 평균가 하위 35% 지점을 만 원 단위로 올린다.
// 그 값 아래 후기 4.0 이상인 곳이 없으면 그런 곳이 생길 때까지 올려서, 누르면 늘 답이 나오게 한다
function quickBudget(hotels: HotelOption[]): number | null {
  const prices = hotels.map((h) => h.perNight).filter((p): p is number => p !== null).sort((a, b) => a - b);
  if (prices.length < 3) return null;
  const good = hotels.filter((h) => (h.rating ?? 0) >= 4 && h.perNight !== null).map((h) => h.perNight as number);
  const at = Math.max(prices[Math.floor((prices.length - 1) * 0.35)], good.length ? Math.min(...good) : 0);
  return Math.ceil(at / 10000);
}

// 답 끝의 {{필터:…}} 표시를 화면 필터 값으로 바꾼 것
export type AdvisorFilter = { maxPrice?: number; minRating?: number; stars?: number[]; amenities?: string[] };

function parseFilter(spec: string): AdvisorFilter | null {
  const f: AdvisorFilter = {};
  for (const pair of spec.split(",")) {
    const [k, v = ""] = pair.split("=").map((x) => x.trim());
    const nums = v.split("|").map(Number).filter((n) => Number.isFinite(n) && n > 0);
    if (k === "예산" && nums[0]) f.maxPrice = nums[0];
    if (k === "점수" && nums[0] && nums[0] <= 5) f.minRating = nums[0];
    if (k === "등급" && nums.length) f.stars = nums.filter((n) => n <= 5);
    if (k === "편의" && v) f.amenities = v.split("|").map((a) => a.trim()).filter(Boolean);
  }
  return Object.keys(f).length ? f : null;
}

// 답 속 {{…}} 표시: 다시 묻기 버튼, 더 찾기 버튼, 필터 적용 버튼
type Action = { kind: "again"; text: string } | { kind: "more" } | { kind: "filter"; filter: AdvisorFilter };
const MARK = /\{\{([^{}]*)\}\}/g;
function actionsOf(text: string): Action[] {
  const out: Action[] = [];
  for (const [, body] of text.matchAll(MARK)) {
    const [kind, ...rest] = body.split(":");
    const arg = rest.join(":").trim();
    if (kind.trim() === "다시" && arg) out.push({ kind: "again", text: arg.slice(0, 80) });
    else if (kind.trim() === "더찾기" && !out.some((a) => a.kind === "more")) out.push({ kind: "more" });
    else if (kind.trim() === "필터") {
      const filter = parseFilter(arg);
      if (filter && !out.some((a) => a.kind === "filter")) out.push({ kind: "filter", filter });
    }
  }
  return out.slice(0, 6);
}

type Props = {
  hotels: HotelOption[];
  hasMore?: boolean; // 다음 쪽 결과가 있는지
  onMore?: () => Promise<boolean>; // 다음 쪽을 불러온다 (검색 1번 요금)
  onFilter?: (f: AdvisorFilter) => void;
  query: HotelQuery;
  open: boolean;
  onClose: () => void;
  onPick: (token: string) => void;
  ask?: { text: string; id: number } | null; // 'n곳 비교하기'처럼 밖에서 바로 물어볼 때
  compare?: HotelOption[]; // 비교함에 담은 호텔 (위에 작은 비교표)
  nights?: number;
  onRecommend?: (tokens: string[]) => void; // 답에 나온 호텔 ([[번호]])
};

export function HotelAdvisor({ hotels, hasMore, onMore, onFilter, query, open, onClose, onPick, ask, compare = [], nights = 1, onRecommend }: Props) {
  // 더 불러온 뒤 같은 질문을 다시 보낼 때 새 목록을 쓰도록
  const hotelsRef = useRef(hotels);
  hotelsRef.current = hotels;
  const [loadingMore, setLoadingMore] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [prefs, setPrefs] = useState<Set<string>>(new Set([PREFS[0]]));
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);
  useEffect(() => () => abortRef.current?.abort(), []);

  const asked = useRef(0);
  useEffect(() => {
    if (!ask || ask.id === asked.current || busy) return;
    asked.current = ask.id;
    send(ask.text);
    // ask가 바뀔 때만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ask]);

  // 다 받은 답에서 고른 호텔을 알려 준다 (카드에 '로보티 추천' 배지)
  useEffect(() => {
    if (busy || !onRecommend) return;
    const tokens = messages
      .filter((m) => m.role === "assistant")
      .flatMap((m) => [...m.content.matchAll(/\[\[(\d+)\]\]/g)].map((x) => hotels[Number(x[1]) - 1]?.token))
      .filter((t): t is string => !!t);
    if (tokens.length) onRecommend(tokens);
    // 답이 끝났을 때만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy, messages.length]);

  async function send(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    const history: Msg[] = [...messages, { role: "user", content: question }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);

    const controller = new AbortController();
    abortRef.current = controller;
    const write = (content: string) => setMessages((prev) => [...prev.slice(0, -1), { role: "assistant", content }]);
    try {
      const res = await fetch("/api/advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history,
          place: query.q,
          checkIn: query.checkIn,
          checkOut: query.checkOut,
          adults: query.adults,
          hotels: hotelsRef.current.map((h) => ({
            name: hotelNameKo(h.name),
            stars: h.stars,
            rating: h.rating,
            reviews: h.reviews,
            perNight: h.perNight,
            total: h.total,
            amenities: h.amenities,
            deal: h.deal,
          })),
        }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        write(
          res.status === 503
            ? "숙소 도우미는 곧 열려요. 그동안 왼쪽 필터로 탐색해 보세요!"
            : res.status === 429
              ? "질문이 조금 많았어요. 잠시 쉬었다가 다시 물어봐 주세요."
              : "앗, 잠깐 문제가 생겼어요. 다시 시도해 주세요.",
        );
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let answer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        answer += decoder.decode(value, { stream: true });
        write(answer);
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") write("앗, 연결이 끊겼어요. 다시 시도해 주세요.");
    } finally {
      if (abortRef.current === controller) setBusy(false);
    }
  }

  // 혼잣말은 지금 목록을 보고 만든다
  const good = hotels.filter((h) => (h.rating ?? 0) >= 4.5).length;
  const breakfast = hotels.filter((h) => h.amenities.some((a) => /조식|breakfast/i.test(a))).length;
  const talks = [
    `👀 ${query.q} 숙소 ${hotels.length}곳을 훑어봤어요!`,
    good ? `⭐ 후기 4.5점 넘는 곳이 ${good}곳 있어요` : "💡 중요한 조건을 알려 주면 딱 맞게 정리해 드려요",
    breakfast ? `🍳 조식 되는 곳도 ${breakfast}곳 찾았어요` : "🔍 가성비 좋은 곳도 찾아 드릴 수 있어요",
    "💡 아래에서 중요한 조건을 눌러 보세요",
    "🙌 저를 세 번 콕콕콕 눌러 보세요!",
  ];

  function askWithPrefs() {
    if (!prefs.size) return;
    send(`제가 중요하게 보는 건 ${[...prefs].map(plain).join(", ")} 쪽이에요. 이 조건으로 정리해 주세요.`);
  }

  const budget = quickBudget(hotels);
  const quick = budget ? `${query.q}에서 1박 ${budget}만 원 이하 후기 좋은 곳 알려줘` : "";

  // 답 속 [[번호]]를 호텔 이름 버튼으로 바꾼다. 번호는 보낸 목록 순서(1부터)
  function render(text: string) {
    // 답을 받는 중에 반쯤 온 {{… 표시는 숨긴다
    const clean = text.replace(MARK, "").replace(/\{\{[^}]*$/, "").trimEnd();
    return clean.split(/(\[\[\d+\]\])/g).map((part, i) => {
      const m = part.match(/^\[\[(\d+)\]\]$/);
      const hotel = m ? hotels[Number(m[1]) - 1] : null;
      if (!m) return part;
      if (!hotel) return "";
      return (
        <button key={i} type="button" className="advisor-pick" onClick={() => onPick(hotel.token)}>
          {hotelNameKo(hotel.name)}
        </button>
      );
    });
  }

  // 다음 쪽을 불러온 뒤 마지막 질문을 새 목록으로 다시 묻는다
  async function findMore() {
    if (!onMore || loadingMore || busy) return;
    const last = [...messages].reverse().find((m) => m.role === "user")?.content;
    setLoadingMore(true);
    const ok = await onMore();
    setLoadingMore(false);
    if (ok && last) setTimeout(() => send(`결과를 더 불러왔어요. 다시 정리해 주세요: ${last}`), 80);
  }

  function actionRow(actions: Action[]) {
    const shift = (d: number) => hotelsPath({ ...query, checkIn: addDays(query.checkIn, d), checkOut: addDays(query.checkOut, d) });
    return (
      <div className="advisor-actions">
        {actions.map((a, i) =>
          a.kind === "again" ? (
            <button key={i} type="button" onClick={() => send(a.text)} disabled={busy}>
              {a.text}
            </button>
          ) : a.kind === "filter" ? (
            <button key={i} type="button" className="is-filter" onClick={() => onFilter?.(a.filter)}>
              🔎 이 조건으로 목록 거르기
            </button>
          ) : (
            <span key={i} className="advisor-more">
              {hasMore && onMore && (
                <button type="button" onClick={findMore} disabled={busy || loadingMore}>
                  {loadingMore ? "더 찾는 중..." : "🔍 더 찾아볼게요 (다음 결과)"}
                </button>
              )}
              {addDays(query.checkIn, -1) >= today() && <a href={shift(-1)}>📅 하루 앞 날짜로 찾기</a>}
              <a href={shift(1)}>📅 하루 뒤 날짜로 찾기</a>
            </span>
          ),
        )}
      </div>
    );
  }

  return (
    <aside className={`advisor${open ? " open" : ""}`} aria-label="Gollazyum 숙소 도우미">
      <div className="advisor-head">
        <div>
          <strong>Gollazyum AI에게 물어보세요</strong>
          <span>
            <i className="online" /> 여행 예약 도우미 AI
          </span>
        </div>
        <button type="button" className="filters-close advisor-close" onClick={onClose} aria-label="도우미 닫기">
          ✕
        </button>
      </div>

      <div className="advisor-list" ref={listRef} aria-live="polite">
        <LiveMochi compact thinking={busy} talks={talks} greeting={`🍡 ${query.q} 숙소, 같이 살펴볼까요?`} />
        {compare.length > 0 && (
          <table className="advisor-compare">
            <caption>보관함 {compare.length}곳</caption>
            <thead>
              <tr>
                <th scope="col">호텔</th>
                <th scope="col">{nights}박 총액</th>
                <th scope="col">후기</th>
              </tr>
            </thead>
            <tbody>
              {compare.map((h) => {
                const total = h.total ?? (h.perNight !== null ? h.perNight * nights : null);
                return (
                  <tr key={h.token}>
                    <th scope="row">
                      <button type="button" className="advisor-pick" onClick={() => onPick(h.token)}>
                        {hotelNameKo(h.name)}
                      </button>
                      {h.stars ? <small>{h.stars}성급</small> : null}
                    </th>
                    <td>{total !== null ? `${total.toLocaleString("ko-KR")}원` : "-"}</td>
                    <td>{h.rating !== null ? h.rating.toFixed(1) : "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {!messages.length && (
          <div className="advisor-prefs">
            <p>호텔 볼 때 뭐가 제일 중요하세요?</p>
            {PREFS.map((p) => (
              <button
                key={p}
                type="button"
                className={prefs.has(p) ? "on" : undefined}
                onClick={() => {
                  const next = new Set(prefs);
                  if (next.has(p)) next.delete(p);
                  else next.add(p);
                  setPrefs(next);
                }}
              >
                {p}
              </button>
            ))}
            <button type="button" className="advisor-go" disabled={!prefs.size} onClick={askWithPrefs}>
              {prefs.size === 1 ? `${plain([...prefs][0])} 기준으로 AI 분석 ✨` : prefs.size ? `${prefs.size}가지 조건으로 AI 분석 ✨` : "중요한 조건을 눌러 주세요"}
            </button>
          </div>
        )}
        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="bubble-row me">
              <p className="bubble">{m.content}</p>
            </div>
          ) : (
            <div key={i} className="bubble-row bot">
              {m.content ? (
                <div className="bubble-wrap">
                  <p className="bubble">{render(m.content)}</p>
                  {!(busy && i === messages.length - 1) && actionsOf(m.content).length > 0 && actionRow(actionsOf(m.content))}
                </div>
              ) : (
                <p className="bubble typing" aria-label="Gollazyum AI가 정리하고 있어요">
                  <span />
                  <span />
                  <span />
                </p>
              )}
            </div>
          ),
        )}
      </div>

      {quick && !busy && !messages.some((m) => m.content === quick) && (
        <button type="button" className="advisor-quick" onClick={() => send(quick)}>
          💬 &quot;{quick}&quot;
        </button>
      )}
      <form
        className="chat-input"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="예: 15만 원 이하, 조식 있는 곳"
          maxLength={500}
          aria-label="Gollazyum AI에게 보낼 메시지"
        />
        <button type="submit" disabled={busy || !input.trim()} aria-label="보내기">
          ↑
        </button>
      </form>
      <p className="chat-note">AI 답변은 참고용이에요. 가격과 조건은 예약 사이트에서 꼭 확인해 주세요.</p>
    </aside>
  );
}

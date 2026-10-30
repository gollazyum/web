"use client";

import { useEffect, useRef, useState } from "react";
import { LiveMochi } from "./LiveMochi";
import type { FlightOption, FlightQuery } from "@/lib/flights";

// 항공권 결과 화면(휴대폰)의 로보티 항공권 도우미. 숙소 도우미(HotelAdvisor)와 같은 모양이고,
// 지금 불러온 항공편 목록 안에서만 골라 준다. 답 속 [[번호]]는 그 항공편 카드로 가는 버튼이 된다
type Msg = { role: "user" | "assistant"; content: string };

// 수하물·좌석은 받아 오는 데이터에 없어서 고르는 칩에 넣지 않는다
const PREFS = ["낮은 가격", "직항", "오전 출발", "오후·저녁 출발", "짧은 비행 시간", "항공사 상관없이 싼 곳"];

type Props = {
  flights: FlightOption[];
  query: FlightQuery;
  open: boolean;
  onClose: () => void;
  onPick: (index: number) => void;
};

const hhmm = (t: string) => t.slice(11, 16);

export function FlightAdvisor({ flights, query, open, onClose, onPick }: Props) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [prefs, setPrefs] = useState<Set<string>>(new Set());
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);
  useEffect(() => () => abortRef.current?.abort(), []);

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
      const res = await fetch("/api/flight-advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history,
          from: query.from,
          to: query.to,
          depart: query.depart,
          ret: query.ret,
          adults: query.adults,
          flights: flights.map((f) => ({
            price: f.price,
            airlines: f.airlines,
            departTime: f.departTime,
            arriveTime: f.arriveTime,
            fromId: f.fromId,
            toId: f.toId,
            minutes: f.minutes,
            stops: f.stops,
          })),
        }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        write(
          res.status === 503
            ? "항공권 도우미는 곧 열려요. 그동안 필터로 직항이나 시간대를 탐색해 보세요!"
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
  const direct = flights.filter((f) => !f.stops.length).length;
  const talks = [
    `👀 ${query.from} → ${query.to} 항공편 ${flights.length}개를 훑어봤어요!`,
    direct ? `✈️ 직항이 ${direct}개 있어요` : "💡 경유편만 있어요. 대기 시간도 같이 볼게요",
    "💡 아래에서 중요한 조건을 눌러 보세요",
  ];

  // 답 속 [[번호]]를 항공편 버튼으로 바꾼다. 번호는 보낸 목록 순서(1부터)
  function render(text: string) {
    return text.split(/(\[\[\d+\]\])/g).map((part, i) => {
      const m = part.match(/^\[\[(\d+)\]\]$/);
      if (!m) return part;
      const n = Number(m[1]) - 1;
      const f = flights[n];
      if (!f) return "";
      return (
        <button key={i} type="button" className="advisor-pick" onClick={() => onPick(n)}>
          {f.airlines[0] ?? "항공편"} {hhmm(f.departTime)}
        </button>
      );
    });
  }

  return (
    <aside className={`advisor flight-advisor${open ? " open" : ""}`} aria-label="로보티 항공권 도우미">
      <div className="advisor-head">
        <div>
          <strong>로보티에게 물어보세요</strong>
          <span>
            <i className="online" /> 항공권 도우미 AI
          </span>
        </div>
        <button type="button" className="filters-close advisor-close" onClick={onClose} aria-label="도우미 닫기">
          ✕
        </button>
      </div>

      <div className="advisor-list" ref={listRef} aria-live="polite">
        <LiveMochi compact thinking={busy} talks={talks} greeting={`🍡 ${query.to} 항공권, 같이 살펴볼까요?`} />
        {!messages.length && (
          <div className="advisor-prefs">
            <p>항공권 볼 때 뭐가 제일 중요하세요?</p>
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
            <button
              type="button"
              className="advisor-go"
              disabled={!prefs.size}
              onClick={() => send(`제가 중요하게 생각하는 건 ${[...prefs].join(", ")}이에요. 이 조건으로 정리해 주세요.`)}
            >
              {prefs.size ? `${prefs.size}개 조건으로 AI 분석` : "중요한 조건을 눌러 주세요"}
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
                <p className="bubble">{render(m.content)}</p>
              ) : (
                <p className="bubble typing" aria-label="로보티가 정리하고 있어요">
                  <span />
                  <span />
                  <span />
                </p>
              )}
            </div>
          ),
        )}
      </div>

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
          placeholder="예: 직항 중에 오전 출발"
          maxLength={500}
          aria-label="로보티에게 보낼 메시지"
        />
        <button type="submit" disabled={busy || !input.trim()} aria-label="보내기">
          ↑
        </button>
      </form>
      <p className="chat-note">AI 답변은 참고용이에요. 가격과 수하물 조건은 예약 사이트에서 꼭 확인해 주세요.</p>
    </aside>
  );
}

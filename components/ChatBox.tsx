"use client";

import { useEffect, useRef, useState } from "react";
import { LiveMochi } from "./LiveMochi";

type Msg = { role: "user" | "assistant"; content: string };

const greeting = "안녕하세요, 로보티예요! 여행 계획이나 숙소 고르는 법, 예약 꿀팁까지 편하게 물어보세요.";

const suggestions = [
  "도쿄 3박 숙소, 어떤 기준으로 고르면 좋을까?",
  "호텔 예약할 때 총액에서 꼭 확인할 건?",
  "무료 취소 요금, 꼭 골라야 할까?",
  "로보티는 어떻게 쓰는 거야?",
];

export function ChatBox() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  function reset() {
    abortRef.current?.abort();
    setMessages([]);
    setInput("");
    setBusy(false);
  }

  async function send(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    const history: Msg[] = [...messages, { role: "user", content: question }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);

    const controller = new AbortController();
    abortRef.current = controller;
    const write = (content: string) =>
      setMessages((prev) => [...prev.slice(0, -1), { role: "assistant", content }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        write(
          res.status === 503
            ? "AI 채팅은 지금 마무리 준비 중이에요. 곧 대화할 수 있어요!"
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

  return (
    <div className="chat">
      <div className="chat-head">
        <div className="chat-title">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/lowboti-mark.svg" alt="" />
          <div>
            <strong>로보티에게 물어보기</strong>
            <span>
              <i className="online" /> AI 여행 도우미
            </span>
          </div>
        </div>
        <button type="button" className="chat-new" onClick={reset} disabled={!messages.length}>
          + 새 채팅
        </button>
      </div>

      <div className="chat-list" ref={listRef} aria-live="polite">
        <LiveMochi thinking={busy} />
        <div className="bubble-row bot">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/lowboti-mark.svg" alt="" className="avatar" />
          <p className="bubble">{greeting}</p>
        </div>
        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="bubble-row me">
              <p className="bubble">{m.content}</p>
            </div>
          ) : (
            <div key={i} className="bubble-row bot">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/lowboti-mark.svg" alt="" className="avatar" />
              {m.content ? (
                <p className="bubble">{m.content}</p>
              ) : (
                <p className="bubble typing" aria-label="로보티가 답을 쓰고 있어요">
                  <span />
                  <span />
                  <span />
                </p>
              )}
            </div>
          ),
        )}
        {!messages.length && (
          <div className="chips">
            {suggestions.map((s) => (
              <button key={s} type="button" onClick={() => send(s)}>
                {s}
              </button>
            ))}
          </div>
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
          placeholder="여행, 숙소, 예약 무엇이든 물어보세요"
          maxLength={1500}
          aria-label="로보티에게 보낼 메시지"
        />
        <button type="submit" disabled={busy || !input.trim()} aria-label="보내기">
          ↑
        </button>
      </form>
      <p className="chat-note">AI 답변은 참고용이에요. 가격과 예약 조건은 예약 사이트에서 꼭 확인해 주세요.</p>
    </div>
  );
}

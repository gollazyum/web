"use client";

import { useEffect, useRef, useState } from "react";
import { LiveMochi } from "./LiveMochi";
import type { HotelOption, HotelQuery } from "@/lib/hotels";

// 호텔 결과 화면 오른쪽에 붙어 다니는 로보티 숙소 도우미.
// 무엇이 중요한지 고르면 지금 불러온 호텔 목록 안에서 골라 주고, 답 속 [[번호]]는 그 호텔 카드로 가는 버튼이 된다
type Msg = { role: "user" | "assistant"; content: string };

const PREFS = ["가성비", "후기 좋은 곳", "4~5성급 고급", "조식", "수영장", "피트니스", "커플 여행", "가족 여행", "혼자 여행"];

type Props = {
  hotels: HotelOption[];
  query: HotelQuery;
  open: boolean;
  onClose: () => void;
  onPick: (token: string) => void;
};

export function HotelAdvisor({ hotels, query, open, onClose, onPick }: Props) {
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
      const res = await fetch("/api/advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history,
          place: query.q,
          checkIn: query.checkIn,
          checkOut: query.checkOut,
          adults: query.adults,
          hotels: hotels.map((h) => ({
            name: h.name,
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
            ? "숙소 도우미는 곧 열려요. 그동안 왼쪽 필터로 골라 보세요!"
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
    good ? `⭐ 후기 4.5점 넘는 곳이 ${good}곳 있어요` : "💡 중요한 걸 골라 주면 딱 맞게 골라 드려요",
    breakfast ? `🍳 조식 되는 곳도 ${breakfast}곳 찾았어요` : "🔍 가성비 좋은 곳도 찾아 드릴 수 있어요",
    "💡 아래에서 중요한 걸 골라 보세요",
    "🙌 저를 세 번 콕콕콕 눌러 보세요!",
  ];

  function askWithPrefs() {
    if (!prefs.size) return;
    send(`제가 중요하게 생각하는 건 ${[...prefs].join(", ")}이에요. 이 중에서 골라 주세요.`);
  }

  // 답 속 [[번호]]를 호텔 이름 버튼으로 바꾼다. 번호는 보낸 목록 순서(1부터)
  function render(text: string) {
    return text.split(/(\[\[\d+\]\])/g).map((part, i) => {
      const m = part.match(/^\[\[(\d+)\]\]$/);
      const hotel = m ? hotels[Number(m[1]) - 1] : null;
      if (!m) return part;
      if (!hotel) return "";
      return (
        <button key={i} type="button" className="advisor-pick" onClick={() => onPick(hotel.token)}>
          {hotel.name}
        </button>
      );
    });
  }

  return (
    <aside className={`advisor${open ? " open" : ""}`} aria-label="로보티 숙소 도우미">
      <div className="advisor-head">
        <div>
          <strong>로보티에게 물어보세요</strong>
          <span>
            <i className="online" /> 여행 예약 도우미 AI
          </span>
        </div>
        <button type="button" className="filters-close advisor-close" onClick={onClose} aria-label="도우미 닫기">
          ✕
        </button>
      </div>

      <div className="advisor-list" ref={listRef} aria-live="polite">
        <LiveMochi compact thinking={busy} talks={talks} greeting={`🍡 ${query.q} 숙소, 같이 골라 볼까요?`} />
        {!messages.length && (
          <div className="advisor-prefs">
            <p>호텔 고를 때 뭐가 제일 중요하세요?</p>
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
              {prefs.size ? `${prefs.size}개 조건으로 추천받기` : "중요한 걸 골라 주세요"}
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
                <p className="bubble typing" aria-label="로보티가 고르고 있어요">
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
          placeholder="예: 15만 원 이하, 조식 있는 곳"
          maxLength={500}
          aria-label="로보티에게 보낼 메시지"
        />
        <button type="submit" disabled={busy || !input.trim()} aria-label="보내기">
          ↑
        </button>
      </form>
      <p className="chat-note">AI 추천은 참고용이에요. 가격과 조건은 예약 사이트에서 꼭 확인해 주세요.</p>
    </aside>
  );
}

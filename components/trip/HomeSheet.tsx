"use client";

import { useEffect, useRef, useState } from "react";
import { FLIGHT_OPTS, STAY_OPTS, stayTasteOf } from "@/lib/home-opts";
import type { FlightQuery, StayQuery } from "@/lib/trip";
import { SearchCard, type SearchKind } from "./SearchCard";
import { Sheet } from "./Sheet";
import { IconBed, IconPlane } from "./icons";

// 숙박 총액 상한 (원). 0 = 상관없음
const BUDGETS = [0, 200_000, 300_000, 500_000, 800_000, 1_200_000];
const budgetText = (b: number) => (b ? `${b / 10000}만 원 아래` : "상관없음");

type Props = {
  kind: SearchKind | null; // null이면 닫힘
  stay: Partial<StayQuery>;
  flight: Partial<FlightQuery>;
  onClose: () => void;
  onStay: (q: StayQuery, opts: string[]) => void;
  onFlight: (q: FlightQuery, opts: string[]) => void;
};

// 홈 '숙소 총액 비교'·'항공권 최저가' 타일을 누르면 올라오는 조건 입력 시트.
// 여행지·일정·인원(검색 카드 그대로) + 예산(숙소) + 빠른 조건 칩 + 한 줄 요청 → 검색 1번
export function HomeSheet({ kind, stay, flight, onClose, onStay, onFlight }: Props) {
  const [budget, setBudget] = useState(0);
  const [opts, setOpts] = useState<string[]>([]);
  const [wish, setWish] = useState("");
  // 열 때마다 지난번 칩·요청은 비우고, 예산은 넘어온 값으로
  useEffect(() => {
    if (!kind) return;
    setOpts([]);
    setWish("");
    setBudget(kind === "stay" ? (stay.budget ?? 0) : 0);
  }, [kind]); // eslint-disable-line react-hooks/exhaustive-deps

  const list = kind === "flight" ? FLIGHT_OPTS : STAY_OPTS;
  const flip = (id: string) => setOpts((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]));
  const taste = (base: string, extra: string) => [base, extra, wish.trim()].filter(Boolean).join(", ").slice(0, 200);

  return (
    <Sheet
      open={!!kind}
      onClose={onClose}
      label={kind === "flight" ? "항공권 최저가 조건 입력" : "숙소 총액 비교 조건 입력"}
      tall
      title={
        <>
          {kind === "flight" ? <IconPlane size={20} /> : <IconBed size={20} />}
          {kind === "flight" ? "항공권 최저가" : "숙소 총액 비교"}
        </>
      }
    >
      {kind && (
        <SearchCard
          fixed
          kind={kind}
          onKind={() => undefined}
          stay={stay}
          flight={flight}
          cta="예약처별 최저가 비교하기"
          onStay={(q) => onStay({ ...q, budget, taste: taste(q.taste, stayTasteOf(opts)) }, opts)}
          onFlight={(q) => onFlight({ ...q, taste: taste(q.taste, "") }, opts)}
        >
          {kind === "stay" && (
            <fieldset className="tb-hs-group">
              <legend>예산 (숙박 총액)</legend>
              <div className="tb-hs-chips">
                {BUDGETS.map((b) => (
                  <button key={b} type="button" className="tb-chip" aria-pressed={budget === b} onClick={() => setBudget(b)}>
                    {budgetText(b)}
                  </button>
                ))}
              </div>
            </fieldset>
          )}
          <fieldset className="tb-hs-group">
            <legend>빠른 조건</legend>
            <div className="tb-hs-chips">
              {list.map((o) => (
                <button key={o.id} type="button" className="tb-chip" aria-pressed={opts.includes(o.id)} onClick={() => flip(o.id)}>
                  {o.label}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="tb-hs-wish">
            <span>한 줄 요청 (선택)</span>
            <input value={wish} maxLength={100} onChange={(e) => setWish(e.target.value)} placeholder={kind === "flight" ? "예: 아이와 함께라 너무 이른 출발은 피하고 싶어요" : "예: 부모님 모시고 가니 조용하고 깨끗한 곳"} enterKeyHint="done" />
          </label>
        </SearchCard>
      )}
    </Sheet>
  );
}

// 검색 바 아래 예시 칩: 누르면 '한 줄로 말하기'로 바뀌고 입력창에 채워진다
export const TALK_EXAMPLES = ["부모님과 온천 2박, 1박 20만 원 이하", "신주쿠역 도보 10분 이내, 조식 포함", "오사카 난바 대욕장 있는 깔끔한 호텔"];
const TRUST = ["검색과 비교는 바로 무료", "예약과 결제는 공식 예약처에서", "수수료 추가 없는 정직한 금액"];

// 홈 첫 화면 검색 칸: [숙소 | 항공권 | 한 줄로 말하기].
// '한 줄로 말하기'는 자연어 입력창 하나만 열고, 보내면 기존 AI 추천(/chat) 흐름으로 이어진다 (보낼 때만 AI 1회)
export function HomeSearch({ kind, onKind, stay, flight, onStay, onFlight, onTalk }: { kind: SearchKind; onKind: (k: SearchKind) => void; stay: Partial<StayQuery>; flight: Partial<FlightQuery>; onStay: (q: StayQuery, opts: string[]) => void; onFlight: (q: FlightQuery, opts: string[]) => void; onTalk: (text: string) => void }) {
  const [talk, setTalk] = useState(false);
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const budget = stay.budget ?? 0;
  const openTalk = (fill?: string) => {
    setTalk(true);
    if (fill !== undefined) setText(fill);
    requestAnimationFrame(() => inputRef.current?.focus());
  };
  const pickKind = (k: SearchKind) => {
    setTalk(false);
    onKind(k);
  };
  return (
    <>
      {talk ? (
        <form
          className="tb-search talk"
          onSubmit={(e) => {
            e.preventDefault();
            const t = text.trim();
            if (t) onTalk(t.slice(0, 200));
          }}
        >
          <div className="tb-search-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={false} onClick={() => pickKind("stay")}>
              <IconBed size={20} /> 숙소
            </button>
            <button type="button" role="tab" aria-selected={false} onClick={() => pickKind("flight")}>
              <IconPlane size={20} /> 항공권
            </button>
            <button type="button" role="tab" aria-selected>
              한 줄로 말하기
            </button>
          </div>
          <label className="tb-sf tb-talk-in">
            <small>원하는 여행을 한 줄로 말해 주세요</small>
            <input ref={inputRef} value={text} maxLength={200} onChange={(e) => setText(e.target.value)} placeholder="예: 12월 둘째 주 오사카 2박, 난바역 가깝고 30만 원 이하" enterKeyHint="send" aria-label="원하는 여행을 한 줄로 말하기" />
          </label>
          <button type="submit" className="tb-cta" disabled={!text.trim()}>
            AI에게 찾기
          </button>
        </form>
      ) : (
        <SearchCard
          kind={kind}
          onKind={pickKind}
          stay={stay}
          flight={flight}
          cta="총액으로 찾기"
          onTalk={() => openTalk()}
          onStay={(q) => onStay({ ...q, budget, taste: q.taste }, [])}
          onFlight={(q) => onFlight(q, [])}
        />
      )}
      <div className="tb-hs-under">
        <div className="tb-talk-chips" role="group" aria-label="한 줄로 말하기 예시">
          {TALK_EXAMPLES.map((x) => (
            <button key={x} type="button" className="tb-chip" onClick={() => openTalk(x)}>
              {x}
            </button>
          ))}
        </div>
        <ul className="tb-hs-trust" aria-label="이용 안내">
          {TRUST.map((t) => (
            <li key={t}>
              <span aria-hidden>✓</span> {t}
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

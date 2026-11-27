"use client";

import { useEffect, useState } from "react";
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

// 홈 첫 화면에 펼쳐 둔 검색 칸 ([숙소 | 항공권] 전환). 예산·빠른 조건·한 줄 요청은 '조건 더하기'를 눌렀을 때만 펼친다 (첫 화면을 짧게)
export function HomeSearch({ kind, onKind, stay, flight, onStay, onFlight }: { kind: SearchKind; onKind: (k: SearchKind) => void; stay: Partial<StayQuery>; flight: Partial<FlightQuery>; onStay: (q: StayQuery, opts: string[]) => void; onFlight: (q: FlightQuery, opts: string[]) => void }) {
  const [budget, setBudget] = useState(stay.budget ?? 0);
  const [opts, setOpts] = useState<string[]>([]);
  const [wish, setWish] = useState("");
  const [more, setMore] = useState(false);
  useEffect(() => {
    setOpts([]);
  }, [kind]);
  useEffect(() => {
    if (stay.budget !== undefined) setBudget(stay.budget);
  }, [stay]);
  const list = kind === "flight" ? FLIGHT_OPTS : STAY_OPTS;
  const flip = (id: string) => setOpts((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]));
  const taste = (base: string, extra: string) => [base, extra, wish.trim()].filter(Boolean).join(", ").slice(0, 200);
  const picked = opts.length + (kind === "stay" && budget ? 1 : 0) + (wish.trim() ? 1 : 0);
  return (
    <SearchCard
      kind={kind}
      onKind={onKind}
      stay={stay}
      flight={flight}
      cta={kind === "stay" ? "세금 포함 총액으로 찾기" : "세금 포함 총액으로 항공권 찾기"}
      onStay={(q) => onStay({ ...q, budget, taste: taste(q.taste, stayTasteOf(opts)) }, opts)}
      onFlight={(q) => onFlight({ ...q, taste: taste(q.taste, "") }, opts)}
    >
      {/* 검색 알약 아래 한 줄: 왼쪽 비교 예약처 안내(PC), 오른쪽 '조건 더하기' */}
      <div className="tb-hs-row">
        {kind === "stay" && <p className="tb-hs-sellers">부킹닷컴 · 아고다 · 익스피디아 · 호텔스닷컴 · 트립닷컴 총액을 한 화면에 나란히 보여 드려요</p>}
        <button type="button" className="tb-hs-more" aria-expanded={more} onClick={() => setMore((v) => !v)}>
          {more ? "조건 접기" : `조건 더하기 (${kind === "stay" ? "예산·" : ""}빠른 조건·한 줄 요청)${picked ? ` · ${picked}개 선택` : ""}`}
        </button>
      </div>
      {more && (
        <>
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
        </>
      )}
    </SearchCard>
  );
}

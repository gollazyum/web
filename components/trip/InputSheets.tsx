"use client";

import { useEffect, useState } from "react";
import { AirportInput } from "@/components/AirportInput";
import { addDays, today as localToday } from "@/lib/dates";
import { nightsOf, type FlightQuery, type StayQuery } from "@/lib/trip";
import { Sheet } from "./Sheet";
import { IconBed, IconPlane } from "./icons";

const BUDGETS = [0, 200_000, 300_000, 500_000, 800_000, 1_200_000];

export function defaultDates(): [string, string] {
  const t = localToday();
  return [addDays(t, 21), addDays(t, 23)];
}

function Stepper({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <span className="tb-stepper">
      <button type="button" onClick={() => onChange(Math.max(1, value - 1))} aria-label="한 명 줄이기" disabled={value <= 1}>
        −
      </button>
      <b>어른 {value}명</b>
      <button type="button" onClick={() => onChange(Math.min(9, value + 1))} aria-label="한 명 늘리기" disabled={value >= 9}>
        +
      </button>
    </span>
  );
}

function Taste({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="tb-taste">
      <textarea value={value} maxLength={500} rows={3} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} aria-label="원하는 것" />
      <span>{value.length}/500</span>
    </div>
  );
}

// v4 03번: 숙소 입력 시트
export function StaySheet({ open, init, onClose, onSubmit }: { open: boolean; init: Partial<StayQuery>; onClose: () => void; onSubmit: (q: StayQuery) => void }) {
  const [q, setQ] = useState<StayQuery>(() => blankStay(init));
  const [err, setErr] = useState("");
  useEffect(() => {
    if (open) {
      setQ(blankStay(init));
      setErr("");
    }
  }, [open, init]);
  const set = (p: Partial<StayQuery>) => setQ((x) => ({ ...x, ...p }));
  const t = localToday();
  const nights = q.checkOut > q.checkIn ? nightsOf(q) : 0;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!q.place.trim()) return setErr("어디로 가시는지 적어 주세요.");
    if (q.checkIn < t || q.checkOut <= q.checkIn) return setErr("날짜를 다시 봐 주세요. 체크아웃은 체크인 다음 날부터예요.");
    onSubmit({ ...q, place: q.place.trim(), taste: q.taste.trim() });
  }

  return (
    <Sheet open={open} onClose={onClose} label="숙소 찾기" tall>
      <form className="tb-form" onSubmit={submit}>
        <h2 className="tb-form-title">
          <IconBed size={28} />
          <span>
            어떤 숙소를
            <br />
            찾고 있나요?
          </span>
        </h2>
        <Taste value={q.taste} onChange={(taste) => set({ taste })} placeholder="조용한 숙소, 역에서 가깝고 대욕장 있으면 좋겠어요" />
        <p className="tb-hint">편하게 적어 주세요. 아는 것만 채워도 괜찮아요.</p>
        <label className="tb-field">
          <span>어디로</span>
          <input value={q.place} maxLength={60} placeholder="예: 오사카 난바, 후쿠오카" onChange={(e) => set({ place: e.target.value })} />
        </label>
        <div className="tb-field">
          <span>언제</span>
          <span className="tb-dates">
            <input type="date" aria-label="체크인" min={t} value={q.checkIn} onChange={(e) => set({ checkIn: e.target.value, checkOut: e.target.value >= q.checkOut ? addDays(e.target.value, 1) : q.checkOut })} />
            <span aria-hidden>–</span>
            <input type="date" aria-label="체크아웃" min={addDays(q.checkIn, 1)} value={q.checkOut} onChange={(e) => set({ checkOut: e.target.value })} />
          </span>
        </div>
        <div className="tb-field">
          <span>누구와</span>
          <Stepper value={q.adults} onChange={(adults) => set({ adults })} />
        </div>
        <label className="tb-field">
          <span>예산 ({nights ? `${nights}박 ` : ""}총액)</span>
          <select value={q.budget} onChange={(e) => set({ budget: Number(e.target.value) })}>
            {BUDGETS.map((b) => (
              <option key={b} value={b}>
                {b ? `${b / 10000}만 원 아래` : "정하지 않음"}
              </option>
            ))}
            {!BUDGETS.includes(q.budget) && <option value={q.budget}>{Math.round(q.budget / 10000)}만 원 아래</option>}
          </select>
        </label>
        {err && <p className="tb-err">{err}</p>}
        <button type="submit" className="tb-cta">
          숙소 찾기
        </button>
      </form>
    </Sheet>
  );
}

function blankStay(init: Partial<StayQuery>): StayQuery {
  const [a, b] = defaultDates();
  return {
    place: init.place ?? "",
    checkIn: init.checkIn || a,
    checkOut: init.checkOut || b,
    adults: init.adults || 2,
    budget: init.budget || 0,
    taste: init.taste ?? "",
  };
}

// v4 04번: 항공편 입력 시트
export function FlightSheet({ open, init, onClose, onSubmit }: { open: boolean; init: Partial<FlightQuery>; onClose: () => void; onSubmit: (q: FlightQuery) => void }) {
  const [q, setQ] = useState<FlightQuery>(() => blankFlight(init));
  const [oneWay, setOneWay] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => {
    if (open) {
      setQ(blankFlight(init));
      setOneWay(init.ret === "" && !!init.depart);
      setErr("");
    }
  }, [open, init]);
  const set = (p: Partial<FlightQuery>) => setQ((x) => ({ ...x, ...p }));
  const t = localToday();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!q.from || !q.to) return setErr("출발·도착은 목록에 뜬 도시나 공항을 눌러 주세요.");
    if (q.from === q.to) return setErr("출발과 도착이 같아요.");
    const ret = oneWay ? "" : q.ret;
    if (q.depart < t || (!oneWay && (!ret || ret < q.depart))) return setErr("날짜를 다시 봐 주세요.");
    onSubmit({ ...q, ret, taste: q.taste.trim() });
  }

  return (
    <Sheet open={open} onClose={onClose} label="항공편 찾기" tall>
      <form className="tb-form" onSubmit={submit}>
        <h2 className="tb-form-title">
          <IconPlane size={28} />
          <span>
            이번 항공편에서
            <br />
            가장 중요한 건 뭔가요?
          </span>
        </h2>
        <Taste value={q.taste} onChange={(taste) => set({ taste })} placeholder="직항, 금요일 오전 출발" />
        <div className="tb-tabs3" role="group" aria-label="여정">
          <button type="button" aria-pressed={!oneWay} onClick={() => setOneWay(false)}>
            왕복
          </button>
          <button type="button" aria-pressed={oneWay} onClick={() => setOneWay(true)}>
            편도
          </button>
          <button type="button" disabled>
            여러 도시 <small>곧 열려요</small>
          </button>
        </div>
        <div className="tb-field tb-air">
          <AirportInput label="출발" placeholder="예: 인천, 서울" text={q.fromLabel} onChange={(text, code) => set({ fromLabel: text, from: code ?? "" })} />
        </div>
        <div className="tb-field tb-air">
          <AirportInput label="도착" placeholder="예: 오사카, 다낭" text={q.toLabel} onChange={(text, code) => set({ toLabel: text, to: code ?? "" })} />
        </div>
        <div className="tb-field">
          <span>언제</span>
          <span className="tb-dates">
            <input type="date" aria-label="가는 날" min={t} value={q.depart} onChange={(e) => set({ depart: e.target.value, ret: q.ret && q.ret < e.target.value ? e.target.value : q.ret })} />
            {!oneWay && (
              <>
                <span aria-hidden>–</span>
                <input type="date" aria-label="오는 날" min={q.depart} value={q.ret} onChange={(e) => set({ ret: e.target.value })} />
              </>
            )}
          </span>
        </div>
        <div className="tb-field">
          <span>누구와</span>
          <Stepper value={q.adults} onChange={(adults) => set({ adults })} />
        </div>
        {err && <p className="tb-err">{err}</p>}
        <button type="submit" className="tb-cta">
          항공편 찾기
        </button>
      </form>
    </Sheet>
  );
}

function blankFlight(init: Partial<FlightQuery>): FlightQuery {
  const [a, b] = defaultDates();
  return {
    from: init.from || "ICN",
    fromLabel: init.fromLabel || (init.from ? init.from : "인천 (ICN)"),
    to: init.to ?? "",
    toLabel: init.toLabel || init.to || "",
    depart: init.depart || a,
    ret: init.ret || b,
    adults: init.adults || 1,
    taste: init.taste ?? "",
  };
}

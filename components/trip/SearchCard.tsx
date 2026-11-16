"use client";

import { useEffect, useImperativeHandle, useState } from "react";
import { AirportInput } from "@/components/AirportInput";
import { addDays, today as localToday } from "@/lib/dates";
import type { FlightQuery, StayQuery } from "@/lib/trip";
import { defaultDates } from "./InputSheets";
import { IconBed, IconCalendar, IconPlane, IconSearch, IconSpark, IconUsers } from "./icons";

export type SearchKind = "stay" | "flight";

type Props = {
  kind: SearchKind;
  onKind: (k: SearchKind) => void;
  stay: Partial<StayQuery>;
  flight: Partial<FlightQuery>;
  onStay: (q: StayQuery) => void;
  onFlight: (q: FlightQuery) => void;
  ref?: React.Ref<SearchCardHandle>;
};

// 바깥(인기 여행지 칩)에서 검색 버튼과 같은 흐름으로 숙소 검색을 시작할 때 쓴다
export type SearchCardHandle = { searchStay: (place: string) => void };

const People = ({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) => (
  <select value={value} onChange={(e) => onChange(Number(e.target.value))} aria-label={label}>
    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
      <option key={n} value={n}>
        성인 {n}
      </option>
    ))}
  </select>
);

const kd = (iso: string) => `${Number(iso.slice(5, 7))}월 ${Number(iso.slice(8, 10))}일`;
// "12월 5일 – 7일", 달이 바뀌면 "12월 30일 – 1월 2일"
const dateText = (a: string, b?: string) => (!b ? kd(a) : a.slice(5, 7) === b.slice(5, 7) ? `${kd(a)} – ${Number(b.slice(8, 10))}일` : `${kd(a)} – ${kd(b)}`);
// 날짜 칸: 보이는 건 글자, 누르면 그 아래 깔린 날짜 입력이 열린다 (왼쪽 절반 = 시작, 오른쪽 절반 = 끝)
const pick = (e: React.MouseEvent<HTMLInputElement>) => {
  try {
    e.currentTarget.showPicker?.();
  } catch {
    // 지원하지 않으면 기본 동작
  }
};

// v7 04: 홈 검색 카드 (숙소 / 항공권 / 투어). 내가 직접 조건을 넣고 찾는 게 기본
export function SearchCard({ kind, onKind, stay, flight, onStay, onFlight, ref }: Props) {
  const [a, b] = defaultDates();
  const t = localToday();
  const [s, setS] = useState<StayQuery>({ place: "", checkIn: a, checkOut: b, adults: 2, budget: 0, taste: "" });
  const [f, setF] = useState<FlightQuery>({ from: "ICN", fromLabel: "인천 (ICN)", to: "", toLabel: "", depart: a, ret: b, adults: 1, taste: "" });
  const [oneWay, setOneWay] = useState(false);
  const [err, setErr] = useState("");

  // 바깥(대화·인기 여행지)에서 조건이 넘어오면 칸을 채운다
  useEffect(() => {
    setS((x) => ({ ...x, ...Object.fromEntries(Object.entries(stay).filter(([, v]) => v !== undefined && v !== "")) }));
  }, [stay]);
  useEffect(() => {
    setF((x) => ({ ...x, ...Object.fromEntries(Object.entries(flight).filter(([, v]) => v !== undefined && v !== "")) }));
    if (flight.ret === "" && flight.depart) setOneWay(true);
  }, [flight]);
  useEffect(() => setErr(""), [kind]);

  // 숙소 검색: 검색 버튼과 인기 여행지 칩이 같이 쓴다 (날짜·인원은 지금 폼 값 그대로)
  function startStay(q: StayQuery) {
    setErr("");
    if (!q.place.trim()) return setErr("어디로 가는지 적어 주세요.");
    if (q.checkIn < t || q.checkOut <= q.checkIn) return setErr("날짜를 다시 봐 주세요.");
    onStay({ ...q, place: q.place.trim() });
  }

  useImperativeHandle(ref, () => ({
    searchStay(place: string) {
      const q = { ...s, place };
      setS(q);
      if (kind !== "stay") onKind("stay");
      startStay(q);
    },
  }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (kind === "stay") return startStay(s);
    if (!f.from || !f.to) return setErr("출발·도착은 목록에 뜬 도시나 공항을 눌러 주세요.");
    if (f.from === f.to) return setErr("출발과 도착이 같아요.");
    const ret = oneWay ? "" : f.ret;
    if (f.depart < t || (!oneWay && (!ret || ret < f.depart))) return setErr("날짜를 다시 봐 주세요.");
    onFlight({ ...f, ret });
  }

  return (
    <form className="tb-search" onSubmit={submit}>
      <div className="tb-search-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={kind === "stay"} onClick={() => onKind("stay")}>
          <IconBed size={20} /> 숙소
        </button>
        <button type="button" role="tab" aria-selected={kind === "flight"} onClick={() => onKind("flight")}>
          <IconPlane size={20} /> 항공권
        </button>
        <button type="button" role="tab" aria-disabled title="곧 열려요">
          <IconSpark size={18} /> 투어 <em>곧</em>
        </button>
      </div>

      {kind === "stay" ? (
        <>
          <label className="tb-sf">
            <IconSearch />
            <span>
              <small>어디로 가세요?</small>
              <input value={s.place} maxLength={60} placeholder="도시, 지역, 숙소 이름" onChange={(e) => setS({ ...s, place: e.target.value })} />
            </span>
          </label>
          <div className="tb-sf-row">
            <div className="tb-sf">
              <IconCalendar />
              <span>
                <small>날짜</small>
                <span className="tb-sf-dates">
                  <b>{dateText(s.checkIn, s.checkOut)}</b>
                  <input type="date" aria-label="체크인" min={t} value={s.checkIn} onClick={pick} onChange={(e) => e.target.value && setS({ ...s, checkIn: e.target.value, checkOut: s.checkOut <= e.target.value ? addDays(e.target.value, 1) : s.checkOut })} />
                  <input type="date" aria-label="체크아웃" min={s.checkIn} value={s.checkOut} onClick={pick} onChange={(e) => e.target.value && setS({ ...s, checkOut: e.target.value })} />
                </span>
              </span>
            </div>
            <div className="tb-sf narrow">
              <IconUsers />
              <span>
                <small>인원</small>
                <People value={s.adults} onChange={(adults) => setS({ ...s, adults })} label="인원" />
              </span>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="tb-sf-trip" role="group" aria-label="여정">
            <button type="button" aria-pressed={!oneWay} onClick={() => setOneWay(false)}>
              왕복
            </button>
            <button type="button" aria-pressed={oneWay} onClick={() => setOneWay(true)}>
              편도
            </button>
          </div>
          <div className="tb-sf tb-sf-air">
            <AirportInput label="출발" placeholder="예: 인천, 서울" text={f.fromLabel} onChange={(text, code) => setF({ ...f, fromLabel: text, from: code ?? "" })} />
          </div>
          <div className="tb-sf tb-sf-air">
            <AirportInput label="도착" placeholder="예: 오사카, 다낭" text={f.toLabel} onChange={(text, code) => setF({ ...f, toLabel: text, to: code ?? "" })} />
          </div>
          <div className="tb-sf-row">
            <div className="tb-sf">
              <IconCalendar />
              <span>
                <small>날짜</small>
                <span className={`tb-sf-dates${oneWay ? " one" : ""}`}>
                  <b>{dateText(f.depart, oneWay ? undefined : f.ret)}</b>
                  <input type="date" aria-label="가는 날" min={t} value={f.depart} onClick={pick} onChange={(e) => e.target.value && setF({ ...f, depart: e.target.value, ret: f.ret && f.ret < e.target.value ? e.target.value : f.ret })} />
                  {!oneWay && <input type="date" aria-label="오는 날" min={f.depart} value={f.ret} onClick={pick} onChange={(e) => e.target.value && setF({ ...f, ret: e.target.value })} />}
                </span>
              </span>
            </div>
            <div className="tb-sf narrow">
              <IconUsers />
              <span>
                <small>인원</small>
                <People value={f.adults} onChange={(adults) => setF({ ...f, adults })} label="인원" />
              </span>
            </div>
          </div>
        </>
      )}
      {err && <p className="tb-err">{err}</p>}
      <button type="submit" className="tb-cta">
        검색
      </button>
    </form>
  );
}

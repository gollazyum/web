"use client";

import { useEffect, useImperativeHandle, useState } from "react";
import { AirportInput } from "@/components/AirportInput";
import { PlaceInput } from "@/components/PlaceInput";
import { addDays, daysBetween, today as localToday } from "@/lib/dates";
import { DateRangePicker } from "@/components/DateRangePicker";
import type { FlightQuery, StayQuery } from "@/lib/trip";
import { HOME_PLACES } from "@/lib/home-places";
import { HOME_ROUTES } from "@/lib/home-info";
import { addRecent, readRecent, recentLabel, RECENT_MAX, type Recent } from "@/lib/recent-search";
import { defaultDates } from "./InputSheets";
import { FlightPaxPicker, StayGuestPicker } from "./GuestPicker";
import { IconBed, IconCalendar, IconPlane } from "./icons";

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
export type SearchCardHandle = { searchStay: (place: string) => void; searchFlightTo: (city: string) => boolean };

const nights = (a: string, b: string) => daysBetween(a, b);
const kd = (iso: string) => `${Number(iso.slice(5, 7))}월 ${Number(iso.slice(8, 10))}일`;
// "12월 5일 – 7일", 달이 바뀌면 "12월 30일 – 1월 2일"
const dateText = (a: string, b?: string) => (!b ? kd(a) : a.slice(5, 7) === b.slice(5, 7) ? `${kd(a)} – ${Number(b.slice(8, 10))}일` : `${kd(a)} – ${kd(b)}`);
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
  // 최근 검색 칩 (브라우저에 저장된 조건). 처음 그릴 때는 인기 칩이고, 화면이 뜬 뒤 최근 검색이 있으면 바꾼다
  const [recent, setRecent] = useState<Recent[]>([]);
  useEffect(() => setRecent(readRecent(kind).slice(0, RECENT_MAX)), [kind]);
  const go = {
    stay: (q: StayQuery) => {
      addRecent({ kind: "stay", q });
      onStay(q);
    },
    flight: (q: FlightQuery) => {
      addRecent({ kind: "flight", q });
      onFlight(q);
    },
  };
  // 최근 검색을 누르면 그 조건으로 바로 찾는다. 날짜가 지났으면 기본 날짜(3주 뒤)로 같은 박 수만큼
  function searchRecent(r: Recent) {
    const [d1] = defaultDates();
    const shift = (from: string, to: string) => (to ? addDays(d1, Math.max(0, daysBetween(from, to))) : "");
    setErr("");
    if (r.kind === "stay") {
      const q = r.q.checkIn < t ? { ...r.q, checkIn: d1, checkOut: shift(r.q.checkIn, r.q.checkOut) } : r.q;
      setS(q);
      return go.stay(q);
    }
    const q = r.q.depart < t ? { ...r.q, depart: d1, ret: shift(r.q.depart, r.q.ret) } : r.q;
    setF(q);
    setOneWay(!q.ret);
    go.flight(q);
  }

  // 숙소 검색: 검색 버튼과 인기 여행지 칩이 같이 쓴다 (날짜·인원은 지금 폼 값 그대로)
  function startStay(q: StayQuery) {
    setErr("");
    if (!q.place.trim()) return setErr("어디로 가는지 적어 주세요.");
    if (q.childAges?.some((a) => a < 0)) return setErr("아동 나이를 알려 주세요. 인원 칸을 누르면 넣을 수 있어요.");
    if (q.checkIn < t) return setErr("체크인 날짜가 지났어요. 오늘 이후 날짜로 바꿔 주세요.");
    if (q.checkOut <= q.checkIn) return setErr("체크아웃은 체크인 다음 날 이후여야 해요.");
    go.stay({ ...q, place: q.place.trim() });
  }

  useImperativeHandle(ref, () => ({
    searchStay(place: string) {
      // 폼 날짜가 지났으면 기본 날짜(3주 뒤 2박)로 바로 찾는다
      const [d1, d2] = defaultDates();
      const q = s.checkIn < t ? { ...s, place, checkIn: d1, checkOut: d2 } : { ...s, place };
      setS(q);
      if (kind !== "stay") onKind("stay");
      startStay(q);
    },
    // 항공 탭의 사진 카드: '인천 → 그 도시' 왕복을 기본 날짜로 찾는다 (노선을 모르는 도시면 false)
    searchFlightTo(city: string) {
      const r = HOME_ROUTES.find((x) => x.name === city);
      if (!r) return false;
      searchRoute(r);
      return true;
    },
  }));

  // 인기 노선: 인천 출발 왕복, 기본 날짜로 바로 찾는다
  function searchRoute(r: (typeof HOME_ROUTES)[number]) {
    const [d1, d2] = defaultDates();
    const q: FlightQuery = { ...f, from: "ICN", fromLabel: "인천 (ICN)", to: r.to, toLabel: r.toLabel, depart: d1, ret: d2 };
    setF(q);
    setOneWay(false);
    setErr("");
    go.flight(q);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (kind === "stay") return startStay(s);
    if (!f.from || !f.to) return setErr("출발·도착은 목록에 뜬 도시나 공항을 눌러 주세요.");
    if (f.from === f.to) return setErr("출발지와 도착지가 같아요. 도착 도시를 바꿔 주세요.");
    const ret = oneWay ? "" : f.ret;
    if (f.depart < t) return setErr("가는 날이 지났어요. 오늘 이후 날짜로 바꿔 주세요.");
    if (!oneWay && !ret) return setErr("오는 날을 넣어 주세요.");
    if (!oneWay && ret < f.depart) return setErr("오는 날이 가는 날보다 빨라요. 날짜를 바꿔 주세요.");
    go.flight({ ...f, ret });
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
      </div>

      {kind === "stay" ? (
        <>
          {/* P1-2: 도시·숙소 이름 추천 (공항 코드도 도시로). 없는 곳이면 「찾는 곳이 없어요」 + 인기 도시 */}
          <div className="tb-sf tb-sf-air">
            <PlaceInput value={s.place} onChange={(place) => setS({ ...s, place: place.slice(0, 60) })} label="어디로 가세요?" placeholder="도시, 지역, 숙소 이름" popular={HOME_PLACES.slice(0, 6).map((p) => p.name)} className="field" />
          </div>
          <div className="tb-sf-row">
            {/* P1-3: 두 달 달력 (휴대폰은 아래 시트), 방향키로 날짜 이동 */}
            <DateRangePicker
              start={s.checkIn}
              end={s.checkOut}
              onChange={(a, b) => setS({ ...s, checkIn: a, checkOut: b })}
              labels={["체크인", "체크아웃"]}
              prompts={["체크인 날짜를 눌러 주세요", "체크아웃 날짜를 눌러 주세요"]}
              endPlaceholder="체크아웃"
              minGap={1}
              unit={(n) => `${n}박`}
              trigger={(openAt, open) => (
                <button type="button" className="tb-sf tb-sf-datebtn" aria-expanded={open} aria-haspopup="dialog" onClick={() => openAt("start")}>
                  <IconCalendar />
                  <span>
                    <small>날짜</small>
                    <b>
                      {s.checkIn && s.checkOut ? (
                        <>
                          {dateText(s.checkIn, s.checkOut)} <em>· {nights(s.checkIn, s.checkOut)}박</em>
                        </>
                      ) : (
                        "날짜를 넣어 주세요"
                      )}
                    </b>
                  </span>
                </button>
              )}
            />
            <StayGuestPicker value={s} onChange={(g) => setS({ ...s, ...g })} />
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
            <DateRangePicker
              start={f.depart}
              end={oneWay ? "" : f.ret}
              single={oneWay}
              onChange={(a, b) => setF({ ...f, depart: a, ret: oneWay ? f.ret : b })}
              labels={["가는 날", "오는 날"]}
              prompts={["가는 날을 눌러 주세요", "오는 날을 눌러 주세요"]}
              endPlaceholder="오는 날"
              minGap={0}
              unit={(n) => `${n + 1}일`}
              trigger={(openAt, open) => (
                <button type="button" className="tb-sf tb-sf-datebtn" aria-expanded={open} aria-haspopup="dialog" onClick={() => openAt("start")}>
                  <IconCalendar />
                  <span>
                    <small>날짜</small>
                    <b>{f.depart && (oneWay || f.ret) ? dateText(f.depart, oneWay ? undefined : f.ret) : "날짜를 넣어 주세요"}</b>
                  </span>
                </button>
              )}
            />
            <FlightPaxPicker value={f} onChange={(g) => setF({ ...f, ...g })} />
          </div>
        </>
      )}
      {(err || (kind === "flight" && f.from && f.from === f.to)) && <p className="tb-err" role="alert">{err || "출발지와 도착지가 같아요. 도착 도시를 바꿔 주세요."}</p>}
      <button type="submit" className="tb-cta">
        검색
      </button>
      {/* 검색칸 아래 칩은 '최근 검색'(이 브라우저에 저장된 조건)만. 인기 여행지는 아래 사진 카드 한 곳에만 둔다 (누르면 바로 검색, 항공 탭이면 인천 출발 항공 검색) */}
      {recent.length > 0 && (
        <div className="tb-pop" aria-label="최근 검색" role="group">
          <small>최근 검색</small>
          <div className="tb-pop-row">
            {recent.map((r) => (
              <button key={recentLabel(r)} type="button" onClick={() => searchRecent(r)}>
                {recentLabel(r)}
              </button>
            ))}
          </div>
        </div>
      )}
    </form>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { daysBetween, isoDate, parseIso, shortLabel, today, weekdays } from "@/lib/dates";
import { isPhone, useSheet } from "@/lib/useSheet";

type Props = {
  start: string;
  end: string;
  onChange: (start: string, end: string) => void;
  labels: [string, string];
  prompts: [string, string]; // 달력 아래 안내 ("체크인 날짜를 골라 주세요")
  endPlaceholder: string;
  minGap: number; // 숙소는 1박 이상(1), 항공권은 당일 왕복 가능(0)
  unit: (days: number) => string; // "2박", "3일"
  quick?: { label: string; end: (start: string) => string }; // "편도"
  openSignal?: number; // 바뀌면 달력을 연다 (휴대폰에서 목적지를 고른 직후)
};

const MONTHS_AHEAD = 11;

// "2026-11-20" → "11.20"
const dot = (s: string) => `${Number(s.slice(5, 7))}.${Number(s.slice(8, 10))}`;

function monthStart(s: string): Date {
  const d = parseIso(s);
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

// 가는 날(체크인)을 고르면 그대로 오는 날(체크아웃) 고르기로 넘어가는 달력 한 장.
// 데스크톱은 두 달을 보여 주고, 휴대폰(640px 이하)은 아래에서 올라오는 시트에 여러 달을 세로로 보여 준다
export function DateRangePicker({ start, end, onChange, labels, prompts, endPlaceholder, minGap, unit, quick, openSignal }: Props) {
  const [open, setOpen] = useState(false);
  const [sheet, setSheet] = useState(false);
  const monthsRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<"start" | "end">("start");
  const [hover, setHover] = useState("");
  const [view, setView] = useState(() => monthStart(today()));
  const wrap = useRef<HTMLDivElement>(null);
  const pop = useRef<HTMLDivElement>(null);

  const first = monthStart(today());
  const canPrev = view > first;
  const canNext = view < addMonths(first, MONTHS_AHEAD);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    // 태블릿에서 달력이 화면 아래로 잘리지 않게 (휴대폰 시트는 화면에 고정이라 필요 없다)
    if (!sheet) pop.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, sheet]);

  useSheet(open && sheet, () => setOpen(false));

  // 시트가 열리면 고른 날(없으면 이번 달)이 있는 달로 스크롤하고, 검색창이 머리글 위로 올라오게 한다
  useEffect(() => {
    if (!open || !sheet) return;
    const focus = (phase === "end" ? end || start : start) || today();
    monthsRef.current?.querySelector<HTMLElement>(`[data-month="${focus.slice(0, 7)}"]`)?.scrollIntoView({ block: "start" });
    document.documentElement.classList.add("layer-open");
    return () => document.documentElement.classList.remove("layer-open");
    // 열릴 때 한 번만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sheet]);

  const signal = useRef(openSignal);
  useEffect(() => {
    if (openSignal === signal.current) return;
    signal.current = openSignal;
    openAt("start");
    // openSignal이 바뀔 때만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openSignal]);

  function openAt(p: "start" | "end") {
    const next = p === "end" && !start ? "start" : p;
    setPhase(next);
    setHover("");
    const focus = next === "end" ? end || start : start;
    setView(focus ? monthStart(focus) : first);
    setSheet(isPhone());
    setOpen(true);
  }

  function pick(day: string) {
    if (phase === "start" || !start || daysBetween(start, day) < minGap) {
      onChange(day, "");
      setPhase("end");
      return;
    }
    onChange(start, day);
    // 휴대폰 시트는 아래 '선택 완료'를 눌러 닫는다
    if (!sheet) setOpen(false);
  }

  const min = today();
  const rangeEnd = end || (phase === "end" && hover && start && daysBetween(start, hover) >= minGap ? hover : "");
  const span = start && end ? daysBetween(start, end) : 0;

  const status =
    phase === "start" || !start
      ? prompts[0]
      : end
        ? `${shortLabel(start)} → ${shortLabel(end)} · ${unit(span)}`
        : `${shortLabel(start)} 입력됨 · ${prompts[1]}`;

  function month(m: Date) {
    const y = m.getFullYear();
    const mo = m.getMonth();
    const blanks = m.getDay();
    const days = new Date(y, mo + 1, 0).getDate();
    const key = `${y}-${String(mo + 1).padStart(2, "0")}`;
    // 휴대폰 시트는 이번 달의 지난 주를 통째로 건너뛴다
    const skip = sheet && min.slice(0, 7) === key ? Math.floor((blanks + Number(min.slice(8, 10)) - 1) / 7) * 7 : 0;
    const from = Math.max(0, skip - blanks);
    return (
      <div className="dp-month" key={`${y}-${mo}`} data-month={key}>
        <strong className="dp-title">
          {y}년 {mo + 1}월
        </strong>
        <div className="dp-grid" role="grid">
          {weekdays.map((w, i) => (
            <span key={w} className={`dp-wd${i === 0 ? " sun" : i === 6 ? " sat" : ""}`}>
              {w}
            </span>
          ))}
          {Array.from({ length: Math.max(0, blanks - skip) }, (_, i) => (
            <span key={`b${i}`} />
          ))}
          {Array.from({ length: days - from }, (_, k) => {
            const i = k + from;
            const day = isoDate(new Date(y, mo, i + 1));
            const wd = (blanks + i) % 7;
            const isStart = day === start;
            const isEnd = day === rangeEnd;
            const inRange = !!(start && rangeEnd && day > start && day < rangeEnd);
            const cls = [
              "dp-day",
              wd === 0 && "sun",
              wd === 6 && "sat",
              day === min && "today",
              isStart && "start",
              isEnd && "end",
              isStart && rangeEnd && rangeEnd !== start && "has-range",
              inRange && "in-range",
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <button
                key={day}
                type="button"
                className={cls}
                disabled={day < min}
                aria-pressed={isStart || day === end}
                aria-label={`${y}년 ${mo + 1}월 ${i + 1}일`}
                onClick={() => pick(day)}
                onMouseEnter={() => setHover(day)}
              >
                <span>{i + 1}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="date-range" ref={wrap}>
      <button type="button" className={`field date-field${open && phase === "start" ? " active" : ""}`} onClick={() => openAt("start")}>
        <span>{labels[0]}</span>
        <b className={start ? undefined : "empty"}>{start ? shortLabel(start) : "날짜 입력"}</b>
      </button>
      <button type="button" className={`field date-field${open && phase === "end" ? " active" : ""}`} onClick={() => openAt("end")}>
        <span>
          {labels[1]}
          {span > 0 && <em> · {unit(span)}</em>}
        </span>
        <b className={end ? undefined : "empty"}>{end ? shortLabel(end) : endPlaceholder}</b>
      </button>

      {open && sheet && <div className="sheet-dim dp-dim" aria-hidden="true" onClick={() => setOpen(false)} />}
      {open && (
        <div ref={pop} className={`dp-pop${sheet ? " dp-sheet" : ""}`} role="dialog" aria-label="날짜 입력" onMouseLeave={() => setHover("")}>
          {sheet ? (
            <>
              <div className="dp-sheet-head">
                <strong>{phase === "start" || !start ? labels[0] : labels[1]} 입력</strong>
                <button type="button" className="filters-close" aria-label="달력 닫기" onClick={() => setOpen(false)}>
                  ✕
                </button>
              </div>
              <div className="dp-weekbar" aria-hidden="true">
                {weekdays.map((w, i) => (
                  <span key={w} className={i === 0 ? "sun" : i === 6 ? "sat" : undefined}>
                    {w}
                  </span>
                ))}
              </div>
              <div className="dp-months" ref={monthsRef}>
                {Array.from({ length: MONTHS_AHEAD + 1 }, (_, i) => month(addMonths(first, i)))}
              </div>
            </>
          ) : (
            <>
              <button type="button" className="dp-nav prev" aria-label="이전 달" disabled={!canPrev} onClick={() => setView(addMonths(view, -1))}>
                ‹
              </button>
              <button type="button" className="dp-nav next" aria-label="다음 달" disabled={!canNext} onClick={() => setView(addMonths(view, 1))}>
                ›
              </button>
              <div className="dp-months">
                {month(view)}
                {month(addMonths(view, 1))}
              </div>
            </>
          )}
          <div className="dp-foot">
            <span className="dp-status">{status}</span>
            <div className="dp-actions">
              {(start || end) && (
                <button type="button" className="dp-ghost" onClick={() => {
                    onChange("", "");
                    setPhase("start");
                  }}>
                  초기화
                </button>
              )}
              {quick && start && (
                <button type="button" className="dp-ghost" onClick={() => {
                    onChange(start, quick.end(start));
                    setOpen(false);
                  }}>
                  {quick.label}
                </button>
              )}
              <button type="button" className="dp-done" onClick={() => setOpen(false)}>
                {sheet && start && end ? `${dot(start)} – ${dot(end)} · ${unit(span)} 입력 완료` : "완료"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

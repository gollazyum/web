"use client";

import { useEffect, useRef, useState } from "react";
import { daysBetween, isoDate, parseIso, shortLabel, today, weekdays } from "@/lib/dates";

type Props = {
  start: string;
  end: string;
  onChange: (start: string, end: string) => void;
  labels: [string, string];
  prompts: [string, string]; // 달력 아래 안내 ("체크인 날짜를 골라 주세요")
  endPlaceholder: string;
  minGap: number; // 숙소는 1박 이상(1), 항공권은 당일 왕복 가능(0)
  unit: (days: number) => string; // "2박", "3일"
  quick?: { label: string; end: (start: string) => string }; // "1박으로", "편도로 검색"
};

const MONTHS_AHEAD = 11;

function monthStart(s: string): Date {
  const d = parseIso(s);
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

// 가는 날(체크인)을 고르면 그대로 오는 날(체크아웃) 고르기로 넘어가는 달력 한 장.
// 데스크톱은 두 달, 휴대폰은 한 달씩 보여 준다
export function DateRangePicker({ start, end, onChange, labels, prompts, endPlaceholder, minGap, unit, quick }: Props) {
  const [open, setOpen] = useState(false);
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
    // 휴대폰에서 달력이 화면 아래로 잘리지 않게
    pop.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function openAt(p: "start" | "end") {
    const next = p === "end" && !start ? "start" : p;
    setPhase(next);
    setHover("");
    const focus = next === "end" ? end || start : start;
    setView(focus ? monthStart(focus) : first);
    setOpen(true);
  }

  function pick(day: string) {
    if (phase === "start" || !start || daysBetween(start, day) < minGap) {
      onChange(day, "");
      setPhase("end");
      return;
    }
    onChange(start, day);
    setOpen(false);
  }

  const min = today();
  const rangeEnd = end || (phase === "end" && hover && start && daysBetween(start, hover) >= minGap ? hover : "");
  const span = start && end ? daysBetween(start, end) : 0;

  const status =
    phase === "start" || !start
      ? prompts[0]
      : end
        ? `${shortLabel(start)} → ${shortLabel(end)} · ${unit(span)}`
        : `${shortLabel(start)} 선택됨 · ${prompts[1]}`;

  function month(m: Date) {
    const y = m.getFullYear();
    const mo = m.getMonth();
    const blanks = m.getDay();
    const days = new Date(y, mo + 1, 0).getDate();
    return (
      <div className="dp-month" key={`${y}-${mo}`}>
        <strong className="dp-title">
          {y}년 {mo + 1}월
        </strong>
        <div className="dp-grid" role="grid">
          {weekdays.map((w, i) => (
            <span key={w} className={`dp-wd${i === 0 ? " sun" : i === 6 ? " sat" : ""}`}>
              {w}
            </span>
          ))}
          {Array.from({ length: blanks }, (_, i) => (
            <span key={`b${i}`} />
          ))}
          {Array.from({ length: days }, (_, i) => {
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
        <b className={start ? undefined : "empty"}>{start ? shortLabel(start) : "날짜 선택"}</b>
      </button>
      <button type="button" className={`field date-field${open && phase === "end" ? " active" : ""}`} onClick={() => openAt("end")}>
        <span>
          {labels[1]}
          {span > 0 && <em> · {unit(span)}</em>}
        </span>
        <b className={end ? undefined : "empty"}>{end ? shortLabel(end) : endPlaceholder}</b>
      </button>

      {open && (
        <div ref={pop} className="dp-pop" role="dialog" aria-label="날짜 선택" onMouseLeave={() => setHover("")}>
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
                완료
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

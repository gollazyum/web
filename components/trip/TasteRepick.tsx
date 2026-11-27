"use client";

import { useEffect, useRef, useState } from "react";
import { choiceLabel, PRIORITIES, WANT_CHIPS, type Priority, type TasteChoice, type Want } from "@/lib/taste-repick";

// 'AI 추천 3곳' 머리 옆 [내 취향 바꾸기] 팝오버. 고르면 이미 받은 목록 안에서 3곳을 바로 다시 고른다 (유료 호출 0회)
export function TasteRepick({ choice, onApply, onReset }: { choice: TasteChoice | null; onApply: (c: TasteChoice) => void; onReset: () => void }) {
  const [open, setOpen] = useState(false);
  const [priority, setPriority] = useState<Priority>(choice?.priority ?? "balance");
  const [wants, setWants] = useState<Want[]>(choice?.wants ?? []);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = (w: Want) => setWants((xs) => (xs.includes(w) ? xs.filter((x) => x !== w) : [...xs, w]));

  return (
    <div className="tb-taste" ref={box}>
      <button type="button" className={`tb-taste-btn${choice ? " on" : ""}`} aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen((o) => !o)}>
        {choice ? `내 취향: ${choiceLabel(choice)}` : "내 취향 바꾸기"}
      </button>
      {open && (
        <div className="tb-taste-pop" role="dialog" aria-label="내 취향 바꾸기">
          <strong>무엇을 먼저 볼까요?</strong>
          <div className="tb-taste-opts" role="radiogroup" aria-label="우선순위">
            {PRIORITIES.map((p) => (
              <button key={p.id} type="button" role="radio" aria-checked={priority === p.id} onClick={() => setPriority(p.id)}>
                {p.label}
              </button>
            ))}
          </div>
          <strong>있으면 좋은 것</strong>
          <div className="tb-taste-opts">
            {WANT_CHIPS.map((w) => (
              <button key={w} type="button" aria-pressed={wants.includes(w)} onClick={() => toggle(w)}>
                {w}
              </button>
            ))}
          </div>
          <p className="tb-taste-note">지금 받은 숙소 안에서 바로 다시 추천해요. 새로 검색하지 않아요.</p>
          <div className="tb-taste-act">
            {choice && (
              <button
                type="button"
                className="tb-link"
                onClick={() => {
                  onReset();
                  setPriority("balance");
                  setWants([]);
                  setOpen(false);
                }}
              >
                처음 추천으로
              </button>
            )}
            <button
              type="button"
              className="tb-cta small"
              onClick={() => {
                onApply({ priority, wants });
                setOpen(false);
              }}
            >
              이 취향으로 다시 추천받기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

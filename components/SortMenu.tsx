"use client";

import { useEffect, useRef, useState } from "react";

// 결과 정렬 고르기. 브라우저 기본 목록 대신 로보티 모양 메뉴로 연다
type Props<T extends string> = { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void };

export function SortMenu<T extends string>({ value, options, onChange }: Props<T>) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const current = options.find((o) => o.id === value) ?? options[0];
  return (
    <div className={`sort-menu${open ? " open" : ""}`} ref={ref}>
      <button type="button" className="sort-btn" onClick={() => setOpen(!open)} aria-haspopup="listbox" aria-expanded={open}>
        <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
          <path d="M6 4v12M6 16l-3-3M6 16l3-3M14 16V4M14 4l-3 3M14 4l3 3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>{current.label}</span>
        <i aria-hidden="true" />
      </button>
      {open && (
        <ul className="sort-list" role="listbox" aria-label="정렬">
          {options.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                role="option"
                aria-selected={o.id === value}
                className={o.id === value ? "on" : undefined}
                onClick={() => {
                  onChange(o.id);
                  setOpen(false);
                }}
              >
                {o.label}
                {o.id === value && <b aria-hidden="true">✓</b>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

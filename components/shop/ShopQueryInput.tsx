"use client";

import { useEffect, useId, useRef, useState } from "react";
import { addRecent, clearRecent, EXAMPLE_QUERIES, readRecent, removeRecent } from "@/lib/shop-recent";

const go = (q: string) => {
  addRecent(q);
  window.location.href = `/shop/product?q=${encodeURIComponent(q)}`;
};

// 쇼핑 검색 입력칸. 누르면 아래에 최근 검색어(삭제 가능)와 예시 칩이 펼쳐진다.
// form 안에 넣어 쓰고, 제출할 때 최근 검색어에 담는다 (name="q")
export function ShopQueryInput({
  defaultValue = "",
  value,
  onChange,
  placeholder,
  className = "",
  ariaLabel = "상품 이름",
  required = true,
  onFocus,
}: {
  defaultValue?: string;
  value?: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
  required?: boolean;
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const box = useRef<HTMLDivElement>(null);
  const id = useId();

  // 바깥을 누르거나 Esc면 닫는다
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // 같은 form이 제출되면 최근 검색어에 담는다
  useEffect(() => {
    const form = box.current?.closest("form");
    if (!form) return;
    const onSubmit = () => {
      const q = (form.elements.namedItem("q") as HTMLInputElement | null)?.value ?? "";
      if (q.trim()) addRecent(q);
      setOpen(false);
    };
    form.addEventListener("submit", onSubmit);
    return () => form.removeEventListener("submit", onSubmit);
  }, []);

  const controlled = value !== undefined;
  return (
    <div className={`sq ${className}`.trim()} ref={box}>
      <input
        name="q"
        type="search"
        enterKeyHint="search"
        maxLength={100}
        required={required}
        autoComplete="off"
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={open ? `${id}-panel` : undefined}
        {...(controlled ? { value, onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange?.(e.target.value) } : { defaultValue })}
        onFocus={(e) => {
          setRecent(readRecent());
          setOpen(true);
          onFocus?.(e);
        }}
      />
      {open && (
        <div className="sq-panel" id={`${id}-panel`}>
          {recent.length > 0 && (
            <div className="sq-sec">
              <div className="sq-head">
                <strong>최근 검색어</strong>
                <button type="button" className="sq-clear" onClick={() => setRecent(clearRecent())}>
                  전체 삭제
                </button>
              </div>
              <ul className="sq-recent">
                {recent.map((q) => (
                  <li key={q}>
                    <button type="button" className="sq-pick" onClick={() => go(q)}>
                      {q}
                    </button>
                    <button type="button" className="sq-del" aria-label={`최근 검색어 ${q} 지우기`} onClick={() => setRecent(removeRecent(q))}>
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="sq-sec">
            <div className="sq-head">
              <strong>이렇게 찾아보세요</strong>
            </div>
            <div className="sq-chips">
              {EXAMPLE_QUERIES.map((q) => (
                <button key={q} type="button" className="sq-chip" onClick={() => go(q)}>
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

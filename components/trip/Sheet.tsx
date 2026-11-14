"use client";

import { useEffect, useRef } from "react";
import { useSheet } from "@/lib/useSheet";
import { IconClose } from "./icons";

type Props = {
  open: boolean;
  onClose: () => void;
  label: string; // 화면 읽기 도구용 제목
  tall?: boolean; // 화면 대부분을 덮는 시트
  children: React.ReactNode;
};

// 휴대폰: 아래에서 올라오는 시트 / PC: 가운데 창. 뒤로가기·Esc로 닫힌다
export function Sheet({ open, onClose, label, tall, children }: Props) {
  useSheet(open, onClose);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    ref.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="tb-sheet-wrap">
      <div className="tb-dim" onClick={onClose} />
      <div ref={ref} className={`tb-sheet${tall ? " tall" : ""}`} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1}>
        <div className="tb-grab" aria-hidden />
        <button type="button" className="tb-round tb-sheet-x" onClick={onClose} aria-label="닫기">
          <IconClose size={20} />
        </button>
        {children}
      </div>
    </div>
  );
}

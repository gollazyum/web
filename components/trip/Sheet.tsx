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
    // 시트가 겹쳐 있으면 맨 위 시트만 닫는다
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const wraps = document.querySelectorAll(".tb-sheet-wrap");
      if (ref.current?.closest(".tb-sheet-wrap") === wraps[wraps.length - 1]) onClose();
    };
    window.addEventListener("keydown", onKey);
    ref.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="tb-sheet-wrap">
      <div className="tb-dim" onClick={onClose} />
      <div ref={ref} className={`tb-sheet${tall ? " tall" : ""}`} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1}>
        {/* 위는 고정(손잡이·닫기), 아래만 스크롤: 내용이 둥근 모서리 밖으로 나가거나 닫기 버튼이 사라지지 않게 */}
        <div className="tb-sheet-head">
          <div className="tb-grab" aria-hidden />
          <button type="button" className="tb-round tb-sheet-x" onClick={onClose} aria-label="닫기">
            <IconClose size={20} />
          </button>
        </div>
        <div className="tb-sheet-body">{children}</div>
      </div>
    </div>
  );
}

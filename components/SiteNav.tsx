"use client";

import { useEffect, useRef, useState } from "react";
import { openSearchTab, type TabId } from "@/components/LinkChecker";

const items: { tab: TabId; label: string }[] = [
  { tab: "stay", label: "숙소" },
  { tab: "flight", label: "항공권" },
  { tab: "ask", label: "로보티에게 물어보기" },
];

// 햄버거 메뉴 항목: 숙소 / 항공권 / 쇼핑·유심
const mobileItems: { tab: TabId; label: string; soon?: boolean }[] = [
  { tab: "stay", label: "숙소" },
  { tab: "flight", label: "항공권" },
  { tab: "shop", label: "쇼핑·유심", soon: true },
];

// 헤더 메뉴: 누르면 첫 화면 검색창의 해당 탭이 열린다. 폰에서는 숨기고 MobileMenu를 쓴다
export function SiteNav() {
  return (
    <nav aria-label="주요 메뉴">
      {items.map((it) => (
        <a
          key={it.tab}
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            openSearchTab(it.tab);
          }}
        >
          {it.label}
        </a>
      ))}
      <a href="#faq">자주 묻는 질문</a>
    </nav>
  );
}

// 폰 전용 햄버거 버튼과 펼침 메뉴
export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  // Esc나 메뉴 바깥을 누르면 닫는다
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDown = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  const go = (tab: TabId) => {
    setOpen(false);
    openSearchTab(tab);
  };

  return (
    <div className="mnav" ref={root}>
      <button
        type="button"
        className={`mnav-toggle${open ? " open" : ""}`}
        aria-label={open ? "메뉴 닫기" : "메뉴 열기"}
        aria-expanded={open}
        aria-controls="mobile-menu"
        onClick={() => setOpen(!open)}
      >
        <span />
        <span />
        <span />
      </button>
      {open && (
        <nav id="mobile-menu" className="mnav-panel" aria-label="모바일 메뉴">
            {mobileItems.map((it) => (
              <button key={it.tab} type="button" className="mnav-item" onClick={() => go(it.tab)}>
                {it.label}
                {it.soon && <span className="badge soon-badge">준비 중</span>}
              </button>
            ))}
            <button type="button" className="mnav-cta" onClick={() => go("stay")}>
              최저가 찾기
            </button>
        </nav>
      )}
    </div>
  );
}

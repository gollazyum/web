"use client";

import { useEffect, useRef, useState } from "react";
import { openSearchTab, type TabId } from "@/components/LinkChecker";

// 헤더 메뉴. 데스크톱 가로 메뉴와 폰 햄버거 메뉴가 같은 목록을 쓴다
type Item = { label: string; ko: string; soon?: boolean } & ({ tab: TabId } | { href: string });
const items: Item[] = [
  { tab: "shop", label: "Shopping", ko: "쇼핑·트렌드" },
  { tab: "stay", label: "Stays", ko: "숙소" },
  { tab: "flight", label: "Flights", ko: "항공" },
  { href: "/#top", label: "Gollazyum App", ko: "앱 다운로드", soon: true },
];

// 첫 화면이면 검색창 탭을 바로 바꾸고, 다른 페이지(약관 등)면 첫 화면의 그 탭으로 이동한다
function goTab(tab: TabId) {
  if (document.getElementById("top")) openSearchTab(tab);
  else window.location.href = `/?tab=${tab}#top`;
}

function MenuLinks({ className, onPick }: { className?: string; onPick?: () => void }) {
  return (
    <>
      {items.map((it) =>
        "href" in it ? (
          <a key={it.label} href={it.href} className={className} onClick={onPick}>
            {it.label}
            <span className="nav-ko">{it.ko}</span>
            {it.soon && <span className="badge soon-badge">준비 중</span>}
          </a>
        ) : (
          <a
            key={it.label}
            href={`/?tab=${it.tab}#top`}
            className={className}
            onClick={(e) => {
              e.preventDefault();
              onPick?.();
              goTab(it.tab);
            }}
          >
            {it.label}
            <span className="nav-ko">{it.ko}</span>
            {it.soon && <span className="badge soon-badge">준비 중</span>}
          </a>
        ),
      )}
    </>
  );
}

// 데스크톱 가로 메뉴
export function SiteNav() {
  return (
    <nav aria-label="주요 메뉴">
      <MenuLinks />
    </nav>
  );
}

// '탐색하기' 버튼: 첫 화면이면 검색창으로 올라가고, 다른 페이지면 첫 화면으로 간다
export function FindCta({ className, onPick }: { className: string; onPick?: () => void }) {
  return (
    <a
      href="/#top"
      className={className}
      onClick={(e) => {
        onPick?.();
        if (document.getElementById("top")) {
          e.preventDefault();
          document.getElementById("top")?.scrollIntoView({ behavior: "smooth" });
        }
      }}
    >
      탐색하기
    </a>
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

  const close = () => setOpen(false);

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
          <MenuLinks className="mnav-item" onPick={close} />
          <FindCta className="mnav-cta" onPick={close} />
        </nav>
      )}
    </div>
  );
}

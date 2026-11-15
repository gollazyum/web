"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { openSearchTab, type TabId } from "@/components/LinkChecker";
import { useSheet } from "@/lib/useSheet";

// 헤더 메뉴. 데스크톱 가로 메뉴와 폰 햄버거 메뉴가 같은 목록을 쓴다
type Item = { label: string; ko: string; review?: boolean } & ({ tab: TabId } | { href: string });
const items: Item[] = [
  // 쇼핑(/shop)은 1차 여행 앱 오픈 동안 숨긴다 (next.config.ts 에서 첫 화면으로 보낸다)
  { tab: "stay", label: "Stays", ko: "숙소" },
  { tab: "flight", label: "Flights", ko: "항공" },
  { href: "/#top", label: "Gollazyum App", ko: "앱 다운로드", review: true },
];

// 첫 화면이면 검색창 탭을 바로 바꾸고, 다른 페이지(약관 등)면 첫 화면의 그 탭으로 이동한다
function goTab(tab: TabId) {
  if (document.getElementById("top")) openSearchTab(tab);
  else window.location.href = `/?tab=${tab}#top`;
}

// 앱 다운로드: 아직 스토어에 나오지 않아 이동하지 않고 작은 안내 시트를 띄운다
function AppSoonSheet({ onClose }: { onClose: () => void }) {
  useSheet(true, onClose);
  // 머리글(blur·애니메이션) 안에서는 fixed 위치가 틀어져 body에 띄운다
  return createPortal(
    <>
      <div className="app-soon-dim" aria-hidden="true" onClick={onClose} />
      <div className="app-soon" role="dialog" aria-modal="true" aria-labelledby="app-soon-title">
        <span className="app-soon-badge">출시 준비 중</span>
        <h2 id="app-soon-title">Gollazyum 앱을 준비하고 있어요</h2>
        <p>앱이 나오면 이 메뉴에서 바로 받을 수 있어요. 지금은 웹에서 똑같이 쇼핑·숙소·항공 가격을 볼 수 있어요.</p>
        <button type="button" onClick={onClose}>
          확인
        </button>
      </div>
    </>,
    document.body,
  );
}

function MenuLinks({ className, onPick }: { className?: string; onPick?: () => void }) {
  const [appSheet, setAppSheet] = useState(false);
  return (
    <>
      {items.map((it) =>
        "href" in it ? (
          <a
            key={it.label}
            href={it.href}
            className={className}
            onClick={(e) => {
              // 앱은 아직 출시 전이라 이동하지 않고 안내 시트를 띄운다 (메뉴는 시트를 닫을 때 같이 닫는다)
              if (it.review) {
                e.preventDefault();
                setAppSheet(true);
                return;
              }
              onPick?.();
            }}
          >
            {it.label}
            <span className="nav-ko">{it.ko}</span>
            {it.review && <span className="app-soon-tag">출시 준비 중</span>}
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
          </a>
        ),
      )}
      {appSheet && (
        <AppSoonSheet
          onClose={() => {
            setAppSheet(false);
            onPick?.();
          }}
        />
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
    // 앱 안내 시트(body에 띄움)를 누를 때는 메뉴를 닫지 않는다 (시트가 닫힐 때 같이 닫힌다)
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element;
      if (root.current?.contains(t) || t.closest?.(".app-soon, .app-soon-dim")) return;
      setOpen(false);
    };
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

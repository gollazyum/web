"use client";

import { openSearchTab, type TabId } from "@/components/LinkChecker";

const items: { tab: TabId; label: string }[] = [
  { tab: "stay", label: "숙소" },
  { tab: "flight", label: "항공권" },
  { tab: "ask", label: "로보티에게 물어보기" },
];

// 헤더 메뉴: 누르면 첫 화면 검색창의 해당 탭이 열린다. 폰에서는 로고 아래 한 줄로 내려간다
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

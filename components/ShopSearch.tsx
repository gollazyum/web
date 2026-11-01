"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// 홈 첫 화면의 쇼핑 탭 검색창. 키워드를 넣으면 상품 데이터 상세(/shop/product?q=…)로 넘어간다
// mode="link"는 스토어 상품 링크를 붙여 넣는 칸이다. 링크 읽기는 아직 없어서 키워드 탐색으로 안내한다
export function ShopSearch({ mode, onUseKeyword }: { mode: "search" | "link"; onUseKeyword: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [link, setLink] = useState("");
  const [note, setNote] = useState("");

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    const keyword = q.trim().slice(0, 100);
    if (!keyword) return setNote("상품명이나 키워드를 넣어 주세요. 예: 무선충전기, 로봇청소기");
    setNote("");
    router.push(`/shop/product?q=${encodeURIComponent(keyword)}`);
  }

  function onLink(e: React.FormEvent) {
    e.preventDefault();
    if (!/^https?:\/\//i.test(link.trim())) return setNote("https:// 로 시작하는 스토어 상품 페이지 주소를 넣어 주세요.");
    setNote("링크 대조는 곧 열려요. 지금은 상품명이나 키워드로 탐색해 주세요.");
  }

  return (
    <>
      {mode === "search" ? (
        <form onSubmit={onSearch} className="search-card shop-card">
          <label className="field field-url">
            <span>어떤 상품을 찾으세요?</span>
            <input
              type="search"
              enterKeyHint="search"
              maxLength={100}
              placeholder="상품명이나 키워드(예: 무선충전기, 로봇청소기)를 입력해 보세요"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </label>
          <button type="submit">데이터 탐색</button>
        </form>
      ) : (
        <form onSubmit={onLink} className="search-card shop-card">
          <label className="field field-url">
            <span>스토어 상품 링크</span>
            <input
              type="url"
              inputMode="url"
              placeholder="쿠팡·네이버·G마켓·11번가 상품 페이지 주소를 붙여넣으세요"
              value={link}
              onChange={(e) => setLink(e.target.value)}
            />
          </label>
          <button type="submit">링크 대조</button>
        </form>
      )}
      {note && (
        <div className="search-result" role="status">
          <span>{note}</span>
          {mode === "link" && note.startsWith("링크 대조는") && (
            <button
              type="button"
              className="shop-switch"
              onClick={() => {
                setNote("");
                onUseKeyword();
              }}
            >
              키워드로 탐색하기 →
            </button>
          )}
        </div>
      )}
    </>
  );
}

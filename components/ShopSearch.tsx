"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LinkPasteHint } from "@/components/shop/LinkPasteHint";
import { ShopQueryInput } from "@/components/shop/ShopQueryInput";
import { LINK_PASTE_HINT, looksLikeUrl } from "@/lib/shop-results";
import { HOME_SHOP_COPY as COPY } from "@/lib/brand-mode";

// 휴대폰에서 키보드가 올라와도 제출 버튼이 보이게, 입력칸을 누르면 버튼까지 화면 안으로 올린다
function keepButtonVisible(btn: HTMLElement | null) {
  if (!btn || !window.matchMedia("(max-width: 640px)").matches) return;
  const show = () => btn.scrollIntoView({ block: "nearest", behavior: "smooth" });
  // 키보드가 다 올라온 뒤(보이는 영역이 줄어든 뒤) 한 번 더
  setTimeout(show, 120);
  const vv = window.visualViewport;
  if (!vv) return;
  const onResize = () => {
    show();
    vv.removeEventListener("resize", onResize);
  };
  vv.addEventListener("resize", onResize);
  setTimeout(() => vv.removeEventListener("resize", onResize), 1500);
}

// 홈 첫 화면의 쇼핑 탭 검색창. 키워드를 넣으면 상품 데이터 상세(/shop/product?q=…)로 넘어간다
// mode="link"는 스토어 상품 링크를 붙여 넣는 칸이다. 링크 읽기는 아직 없어서, 제출하기 전부터 '준비 중'으로 보여 준다
export function ShopSearch({ mode, onUseKeyword }: { mode: "search" | "link"; onUseKeyword: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [note, setNote] = useState("");
  const btn = useRef<HTMLButtonElement>(null);

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    const keyword = q.trim().slice(0, 100);
    if (!keyword) return setNote("상품 이름을 넣어 주세요. 예: 무선충전기, 로봇청소기");
    // 스토어 상품 주소는 아직 읽지 못한다: 결과 없음 화면으로 보내지 않고 안내만
    if (looksLikeUrl(keyword)) return setNote(LINK_PASTE_HINT);
    setNote("");
    router.push(`/shop/product?q=${encodeURIComponent(keyword)}`);
  }

  if (mode === "link") {
    return (
      <>
        <div className="search-card shop-card shop-link-soon" aria-disabled="true">
          <label className="field field-url">
            <span>
              스토어 상품 링크 <span className="soon">준비 중</span>
            </span>
            <input type="url" inputMode="url" disabled placeholder="쿠팡·네이버·G마켓·11번가 상품 페이지 주소 (준비 중)" />
          </label>
          <button type="button" disabled>
            준비 중
          </button>
        </div>
        <div className="search-result" role="note">
          <span>{LINK_PASTE_HINT}</span>
          <button type="button" className="shop-switch" onClick={onUseKeyword}>
            상품 이름으로 찾기 →
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <form onSubmit={onSearch} className="search-card shop-card">
        <label className="field field-url">
          <span>
            <span className="pc-only">{COPY.labelPc}</span>
            <span className="m-only">{COPY.labelM}</span>
          </span>
          <ShopQueryInput
            value={q}
            onChange={setQ}
            required={false}
            ariaLabel="상품 이름"
            placeholder={COPY.placeholder}
            onFocus={() => keepButtonVisible(btn.current)}
          />
        </label>
        <button type="submit" ref={btn}>
          <span className="pc-only">{COPY.buttonPc}</span>
          <span className="m-only">{COPY.buttonM}</span>
        </button>
      </form>
      {note !== LINK_PASTE_HINT && <LinkPasteHint className="home-link-hint" />}
      {note && (
        <div className="search-result" role="status">
          <span>{note}</span>
        </div>
      )}
    </>
  );
}

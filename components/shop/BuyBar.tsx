"use client";

import { useEffect, useState } from "react";
import { COUPANG_LINK_ATTRS, type CoupangLinkType } from "@/lib/coupang-links";
import type { Offer } from "@/lib/shopping";

const COUPANG_LABEL: Record<CoupangLinkType, string> = {
  home: "쿠팡에서 찾아보기",
  search: "쿠팡 검색결과 보기",
  product: "구매하러 가기",
};

function BellIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

// 하단 고정 바: 왼쪽 알림 버튼, 오른쪽 1위 판매처로 가는 큰 버튼. 콘텐츠를 가리지 않게 본문 아래에 같은 높이 여백을 둔다
export function BuyBar({ top }: { top: Offer | null }) {
  const [note, setNote] = useState(false);

  useEffect(() => {
    if (!note) return;
    const t = setTimeout(() => setNote(false), 2500);
    return () => clearTimeout(t);
  }, [note]);

  const label = top?.coupang ? COUPANG_LABEL[top.coupang.type] : "스토어로 이동하기";
  const attrs = top?.coupang ? COUPANG_LINK_ATTRS : { target: "_blank", rel: "nofollow noopener noreferrer" };

  return (
    <div className="pd-buybar">
      <p className="pd-buybar-note" aria-live="polite">
        {note ? "가격 알림은 준비 중이에요." : ""}
      </p>
      <div className="pd-buybar-inner">
        <button type="button" className="pd-bell" aria-label="가격 알림" onClick={() => setNote(true)}>
          <BellIcon />
        </button>
        {top?.link ? (
          <a className="pd-buy" href={top.link} {...attrs}>
            {label}
          </a>
        ) : (
          <span className="pd-buy disabled">{label}</span>
        )}
      </div>
    </div>
  );
}

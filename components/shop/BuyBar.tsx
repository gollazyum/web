"use client";

import { useEffect, useState } from "react";
import { CoupangLabel } from "@/components/shop/CoupangLabel";
import { COUPANG_LINK_ATTRS, type CoupangLink } from "@/lib/coupang-links";
import type { Offer } from "@/lib/shopping";

function BellIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

// 하단 고정 바: 왼쪽 알림 버튼, 오른쪽 1위 판매처로 가는 큰 버튼. 콘텐츠를 가리지 않게 본문 아래에 같은 높이 여백을 둔다
// top이 없으면 쿠팡 링크(getCoupangLink 결과: 상품 주소 또는 상품명 검색결과)를 보여 준다
export function BuyBar({ top, coupang }: { top: Offer | null; coupang?: CoupangLink }) {
  const [note, setNote] = useState(false);

  useEffect(() => {
    if (!note) return;
    const t = setTimeout(() => setNote(false), 2500);
    return () => clearTimeout(t);
  }, [note]);

  const cp = top ? top.coupang : (coupang ?? null);
  const label = cp ? <CoupangLabel link={cp} /> : `${top?.seller.key ?? "스토어"}에서 보기 ↗`;
  const name = cp ? (cp.type === "product" ? "쿠팡에서 구매하러 가기" : `쿠팡에서 '${cp.name}' 검색결과 보기`) : `${top?.seller.key ?? "스토어"}에서 보기`;
  // 판매처로 가는 링크는 모두 새 탭 + sponsored
  const attrs = COUPANG_LINK_ATTRS;
  const href = top ? top.link : cp?.url;

  return (
    <div className="pd-buybar">
      <p className="pd-buybar-note" aria-live="polite">
        {note ? "가격 알림은 준비 중이에요." : ""}
      </p>
      <div className="pd-buybar-inner">
        <button type="button" className="pd-bell" aria-label="가격 알림" onClick={() => setNote(true)}>
          <BellIcon />
        </button>
        {href ? (
          <a className="pd-buy" href={href} {...attrs} aria-label={`${name}, 새 탭에서 열려요`}>
            {label}
          </a>
        ) : (
          <span className="pd-buy disabled">{label}</span>
        )}
      </div>
    </div>
  );
}

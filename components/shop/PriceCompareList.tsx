"use client";

import { useId, useState } from "react";
import { brandCopy } from "@/lib/brand-mode";
import { SellerRow } from "@/components/shop/SellerRow";
import { sellerOrder } from "@/lib/sellers";
import { isNew, type Offer, type OfferView } from "@/lib/shopping";

type Ranked = { offer: Offer; rank: number | null };

// 판매처 탭 + 스토어별 가격 목록. list는 rankOffers 결과(1위 후보 싼 순 → 품절·가격 미확인 → 쿠팡 덧붙임 행).
// 위쪽 칩: 새 상품만 / 중고 포함 / 배송비 포함. 순위는 탭을 바꿔도 전체 기준을 유지한다
export function PriceCompareList({
  offers,
  list,
  view,
  onView,
  hiddenUsed,
  fetchedAt,
}: {
  offers: Offer[];
  list: Ranked[];
  view: OfferView;
  onView: (v: OfferView) => void;
  hiddenUsed: number;
  fetchedAt: string;
}) {
  const [tab, setTab] = useState("all");
  const id = useId();
  if (!offers.length) return null;

  const top = list.find((r) => r.rank === 1)?.offer ?? null;
  const hasUsed = offers.some((o) => !o.placeholder && !isNew(o));
  const hasShipping = offers.some((o) => typeof o.shippingFee === "number" && o.shippingFee > 0);
  // 탭은 주요 4곳만 (그 밖 판매처는 "전체"에서 보인다)
  const tabs = [...new Set(list.filter((r) => r.offer.seller.major).map((r) => r.offer.seller.key))].sort((a, b) => sellerOrder(a) - sellerOrder(b));
  const current = tab === "all" || tabs.includes(tab) ? tab : "all";
  const shown = current === "all" ? list : list.filter((r) => r.offer.seller.key === current);
  const tabId = (k: string) => `${id}-tab-${k}`;
  const panelId = `${id}-panel`;

  return (
    <section className="pd-stores" aria-label="스토어별 가격">
      <div className="pd-view" role="group" aria-label="판매처 보기 조건">
        <button type="button" className={`pd-chip${!view.includeUsed ? " on" : ""}`} aria-pressed={!view.includeUsed} onClick={() => onView({ ...view, includeUsed: false })}>
          새 상품만
        </button>
        <button
          type="button"
          className={`pd-chip${view.includeUsed ? " on" : ""}`}
          aria-pressed={view.includeUsed}
          disabled={!hasUsed && !view.includeUsed}
          onClick={() => onView({ ...view, includeUsed: true })}
        >
          중고 포함
        </button>
        <button type="button" className={`pd-chip${view.withShipping ? " on" : ""}`} aria-pressed={view.withShipping} onClick={() => onView({ ...view, withShipping: !view.withShipping })}>
          배송비 포함{view.withShipping && <span aria-hidden="true"> ✕</span>}
        </button>
      </div>
      {!view.includeUsed && hiddenUsed > 0 && <p className="pd-view-note">중고·리퍼 {hiddenUsed}곳은 &apos;중고 포함&apos;에서 볼 수 있어요</p>}
      {view.withShipping && !hasShipping && <p className="pd-view-note">확인된 배송비가 있는 판매처가 없어 순서는 그대로예요</p>}

      <div className="pd-tabs" role="tablist" aria-label="판매처">
        {["all", ...tabs].map((key) => (
          <button
            key={key}
            id={tabId(key)}
            type="button"
            role="tab"
            aria-selected={current === key}
            aria-controls={panelId}
            tabIndex={current === key ? 0 : -1}
            className={`pd-tab${current === key ? " on" : ""}`}
            onClick={() => setTab(key)}
            onKeyDown={(e) => {
              const keys = ["all", ...tabs];
              const i = keys.indexOf(current);
              const next = e.key === "ArrowRight" ? keys[(i + 1) % keys.length] : e.key === "ArrowLeft" ? keys[(i - 1 + keys.length) % keys.length] : null;
              if (!next) return;
              e.preventDefault();
              setTab(next);
              document.getElementById(tabId(next))?.focus();
            }}
          >
            {key === "all" ? "전체" : key}
            {key === top?.seller.key && <span className="pd-tab-badge">{brandCopy("topTabBadge")}</span>}
          </button>
        ))}
      </div>
      <div className="pd-list" role="tabpanel" id={panelId} aria-labelledby={tabId(current)}>
        {shown.map(({ offer, rank }) => (
          <SellerRow key={offer.seller.key} offer={offer} rank={rank} topPrice={top?.price ?? null} fetchedAt={fetchedAt} />
        ))}
      </div>
    </section>
  );
}

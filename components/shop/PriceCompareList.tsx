"use client";

import { useState } from "react";
import { brandCopy } from "@/lib/brand-mode";
import { SellerRow } from "@/components/shop/SellerRow";
import { sellerOrder } from "@/lib/sellers";
import { rankable, type Offer } from "@/lib/shopping";

// 판매처 탭 + 스토어별 가격 목록. offers는 1위 후보를 싼 순서로, 그 뒤에 품절·가격 미확인이 온다.
// 순위는 탭을 바꿔도 전체 기준을 유지한다
export function PriceCompareList({ offers, fetchedAt }: { offers: Offer[]; fetchedAt: string }) {
  const [tab, setTab] = useState("all");
  if (!offers.length) return null;

  const top = offers.find(rankable) ?? null;
  const tabs = offers.map((o) => o.seller.key).sort((a, b) => sellerOrder(a) - sellerOrder(b));
  const ranked = offers.map((offer, i) => ({ offer, rank: rankable(offer) ? i + 1 : null }));
  const shown = tab === "all" ? ranked : ranked.filter((r) => r.offer.seller.key === tab);

  return (
    <section className="pd-stores" aria-label="스토어별 가격">
      <div className="pd-tabs" role="tablist">
        {["all", ...tabs].map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={`pd-tab${tab === key ? " on" : ""}`}
            onClick={() => setTab(key)}
          >
            {key === "all" ? "전체" : key}
            {key === top?.seller.key && <span className="pd-tab-badge">{brandCopy("topTabBadge")}</span>}
          </button>
        ))}
      </div>
      <div className="pd-list">
        {shown.map(({ offer, rank }) => (
          <SellerRow key={offer.seller.key} offer={offer} rank={rank} topPrice={top?.price ?? null} fetchedAt={fetchedAt} />
        ))}
      </div>
    </section>
  );
}

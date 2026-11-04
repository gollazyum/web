import { brandCopy } from "@/lib/brand-mode";
import { COUPANG_LINK_ATTRS, coupangSearchLabel } from "@/lib/coupang-links";
import { SellerIcon } from "@/components/shop/SellerIcon";
import { fetchedTime, won, type Offer } from "@/lib/shopping";

// 순위 표시: 1~3위는 메달, 4위부터 숫자. 순위는 링크 이름에서 한 번만 읽으므로 여기서는 화면에만 보인다
function Rank({ rank }: { rank: number | null }) {
  if (rank === null) return <span className="pd-rank" aria-hidden="true" />;
  return (
    <span className={rank <= 3 ? `pd-medal pd-medal-${rank}` : "pd-rank"} aria-hidden="true">
      {rank}
    </span>
  );
}

// 상품 상태 꼬리표: "중고 · B+ 등급", "리퍼", 새 상품이면 없음
export function conditionLabel(o: Offer): string {
  if (!o.condition || o.condition === "new") return "";
  const base = o.condition === "refurb" ? "리퍼" : "중고";
  return o.grade ? `${base} · ${o.grade} 등급` : base;
}

// 배송비 한 줄: 무료배송 / 배송비 3,000원 / 배송비 확인 필요
export function shippingLabel(o: Offer): string {
  if (o.shippingFee === 0) return "무료배송";
  if (typeof o.shippingFee === "number") return `배송비 ${won(o.shippingFee)}`;
  return "배송비 확인 필요";
}

const priceText = (o: Offer) =>
  o.placeholder ? "쿠팡에서 가격 확인" : !o.available ? "품절" : o.price !== null ? won(o.price) : "가격 확인 필요";

// 낭독기가 읽는 링크 이름: "가격 1위 폰가비 110,100원, 중고 · B+ 등급, 무료배송, 새 탭에서 열려요"
export function rowLabel(o: Offer, rank: number | null): string {
  if (o.placeholder && o.coupang) return `${coupangSearchLabel(o.coupang.name).replace(/ ↗$/, "")}, 새 탭에서 열려요`;
  const parts = [`${rank !== null ? `가격 ${rank}위 ` : ""}${o.seller.key} ${priceText(o)}`];
  const cond = conditionLabel(o);
  if (cond) parts.push(cond);
  if (!o.placeholder) parts.push(shippingLabel(o));
  if (o.coupang?.type === "search") parts.push(`쿠팡에서 '${o.coupang.name}' 검색결과`);
  parts.push("새 탭에서 열려요");
  return parts.join(", ");
}

// 스토어별 가격 한 줄. 누르면 그 판매처로 간다 (쿠팡이면 getCoupangLink로 만든 상품 주소 또는 상품명 검색결과)
// rank가 null이면 품절이거나 가격을 확인하지 못한 판매처 (1위 후보에서 빠짐)
export function SellerRow({ offer, rank, topPrice, fetchedAt }: { offer: Offer; rank: number | null; topPrice: number | null; fetchedAt: string }) {
  const diff = rank !== null && offer.price !== null && topPrice !== null ? offer.price - topPrice : 0;
  const top = rank === 1;
  const cond = conditionLabel(offer);
  const body = (
    <>
      {top && <span className="pd-top-label">{brandCopy("topCardLabel")}</span>}
      <span className="pd-row-main">
        <Rank rank={rank} />
        <SellerIcon seller={offer.seller} />
        <span className="pd-row-name">
          <strong>{offer.seller.key}</strong>
          {cond && <span className="pd-cond">{cond}</span>}
          {diff > 0 && <em className="pd-diff">+{won(diff)}</em>}
        </span>
        <span className={`pd-row-price${offer.placeholder ? " check" : rank === null ? " none" : ""}`}>
          {priceText(offer)}
          {offer.link && <span className="pd-ext" aria-hidden="true"> ↗</span>}
        </span>
      </span>
      {!offer.placeholder && (
        <span className="pd-row-meta">
          <span className={offer.shippingFee === 0 ? "pd-ship free" : "pd-ship"}>{shippingLabel(offer)}</span>
          <span> · {fetchedTime(fetchedAt)} 기준 · 새 탭</span>
        </span>
      )}
      {offer.coupang?.type === "search" && (
        <span className="pd-row-cp">{coupangSearchLabel(offer.coupang.name)}</span>
      )}
    </>
  );
  const className = `pd-row${top ? " pd-row-top" : ""}`;

  if (!offer.link) return <div className={className}>{body}</div>;
  // 판매처로 가는 링크는 모두 새 탭 + 제휴·광고 표시(sponsored)
  return (
    <a className={className} href={offer.link} {...COUPANG_LINK_ATTRS} aria-label={rowLabel(offer, rank)}>
      {body}
    </a>
  );
}

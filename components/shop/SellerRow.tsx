import { brandCopy } from "@/lib/brand-mode";
import { COUPANG_LINK_ATTRS } from "@/lib/coupang-links";
import { SellerIcon } from "@/components/shop/SellerIcon";
import { fetchedTime, won, type Offer } from "@/lib/shopping";

// 순위 표시: 1~3위는 메달, 4위부터 숫자
function Rank({ rank }: { rank: number | null }) {
  if (rank === null) return <span className="pd-rank" aria-hidden="true" />;
  if (rank <= 3) {
    return (
      <span className={`pd-medal pd-medal-${rank}`} aria-label={`${rank}위`}>
        {rank}
      </span>
    );
  }
  return (
    <span className="pd-rank" aria-label={`${rank}위`}>
      {rank}
    </span>
  );
}

// 스토어별 가격 한 줄. 누르면 그 판매처로 간다 (쿠팡이면 getCoupangLink로 만든 주소)
// rank가 null이면 품절이거나 가격을 확인하지 못한 판매처 (1위 후보에서 빠짐)
export function SellerRow({ offer, rank, topPrice, fetchedAt }: { offer: Offer; rank: number | null; topPrice: number | null; fetchedAt: string }) {
  const diff = rank !== null && offer.price !== null && topPrice !== null ? offer.price - topPrice : 0;
  const top = rank === 1;
  const body = (
    <>
      {top && <span className="pd-top-label">{brandCopy("topCardLabel")}</span>}
      <span className="pd-row-main">
        <Rank rank={rank} />
        <SellerIcon seller={offer.seller} />
        <span className="pd-row-name">
          <strong>{offer.seller.key}</strong>
          {diff > 0 && <em className="pd-diff">+{won(diff)}</em>}
        </span>
        <span className={`pd-row-price${offer.placeholder ? " check" : rank === null ? " none" : ""}`}>
          {offer.placeholder ? "쿠팡에서 가격 확인" : !offer.available ? "품절" : offer.price !== null ? won(offer.price) : "가격 확인 필요"}
        </span>
      </span>
      {!offer.placeholder && <span className="pd-row-meta">{fetchedTime(fetchedAt)} 기준</span>}
    </>
  );
  const className = `pd-row${top ? " pd-row-top" : ""}`;

  if (!offer.link) return <div className={className}>{body}</div>;
  const attrs = offer.coupang ? COUPANG_LINK_ATTRS : { target: "_blank", rel: "nofollow noopener noreferrer" };
  return (
    <a className={className} href={offer.link} {...attrs}>
      {body}
    </a>
  );
}

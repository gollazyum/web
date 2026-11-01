import type { Seller } from "@/lib/sellers";

// 판매처 아이콘. 실제 회사 로고 대신 색 원 안에 첫 글자만 넣는 중립 아이콘
export function SellerIcon({ seller, size = 32 }: { seller: Seller; size?: number }) {
  return (
    <span
      className="seller-icon"
      aria-hidden="true"
      style={{ width: size, height: size, background: seller.color, fontSize: seller.initial.length > 1 ? size * 0.36 : size * 0.44 }}
    >
      {seller.initial}
    </span>
  );
}

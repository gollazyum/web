import type { Metadata } from "next";
import Link from "next/link";
import { StatusScreen } from "@/components/StatusScreen";

// 없는 상품 주소 (상품 번호가 잘못됐거나 검색 결과에서 사라진 상품). 404 + noindex
export const metadata: Metadata = {
  title: "페이지를 찾을 수 없어요",
  robots: { index: false, follow: true },
};

export default function ProductNotFound() {
  return (
    <StatusScreen icon="🛍️" title="상품을 찾을 수 없어요" message="찾으시는 상품 페이지가 없어요. 주소가 바뀌었거나 판매가 끝났을 수 있어요.">
      <Link href="/" className="status-btn">
        홈으로
      </Link>
      <Link href="/shop" className="status-btn primary">
        쇼핑 둘러보기
      </Link>
      <Link href="/hotels" className="status-btn">
        숙소 찾기
      </Link>
    </StatusScreen>
  );
}

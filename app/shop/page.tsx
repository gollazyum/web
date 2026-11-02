import type { Metadata } from "next";
import { CoupangSection } from "@/components/shop/CoupangSection";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { ogBase } from "@/lib/site";

const DESCRIPTION = "상품 이름으로 쿠팡·네이버·G마켓·11번가의 판매 가격 데이터를 한 화면에서 확인하고, 쿠팡에서 여행 준비 상품을 찾아볼 수 있어요.";

export const metadata: Metadata = {
  title: "Shopping 쇼핑",
  description: DESCRIPTION,
  alternates: { canonical: "/shop" },
  openGraph: { title: "Shopping | Gollazyum", description: DESCRIPTION, ...ogBase, url: "/shop" },
};

// 쇼핑 탭. 상품 이름으로 스토어 데이터를 찾는 검색창과 쿠팡 섹션
export default function ShopPage() {
  return (
    <>
      <SiteHeader />
      <main className="shop-page">
        <section className="shop-head">
          <p className="eyebrow">Shopping</p>
          <h1>스토어별 가격 데이터</h1>
          <p className="shop-lead">상품 이름을 입력하면 쿠팡·네이버·G마켓·11번가의 판매 가격 데이터를 한 화면에 모아 보여 드려요.</p>
          <form className="shop-search" action="/shop/product" method="get" role="search">
            <input name="q" type="search" required maxLength={100} placeholder="예: 무선 이어폰, 캐리어 24인치" aria-label="상품 이름" />
            <button type="submit">찾기</button>
          </form>
        </section>
        <CoupangSection />
      </main>
      <SiteFooter variant="shop" />
    </>
  );
}

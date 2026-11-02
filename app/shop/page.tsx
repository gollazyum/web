import type { Metadata } from "next";
import Link from "next/link";
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

// 검색창 아래 예시 칩. 누르면 그 말로 상품 데이터 화면을 연다
const EXAMPLE_KEYWORDS = ["캐리어", "보조배터리", "여행 파우치"];

// 쇼핑 탭. 상품 이름으로 스토어 데이터를 찾는 검색창과 쿠팡 섹션
export default function ShopPage() {
  return (
    <>
      <SiteHeader />
      <main className="shop-page">
        <section className="shop-head">
          <p className="eyebrow">쇼핑</p>
          <h1>쇼핑 가격 비교</h1>
          <p className="shop-lead">상품 이름을 입력하면 쿠팡·네이버·G마켓·11번가의 판매 가격을 한 화면에서 비교해 보여 드려요.</p>
          <form className="shop-search" action="/shop/product" method="get" role="search">
            <input name="q" type="search" required maxLength={100} placeholder="예: 무선 이어폰, 캐리어 24인치" aria-label="상품 이름" />
            <button type="submit">찾기</button>
          </form>
          <div className="shop-examples">
            <span>이렇게 찾아보세요</span>
            {EXAMPLE_KEYWORDS.map((k) => (
              <Link key={k} className="shop-chip" href={`/shop/product?q=${encodeURIComponent(k)}`}>
                {k}
              </Link>
            ))}
          </div>
        </section>
        <CoupangSection />
      </main>
      <SiteFooter variant="shop" />
    </>
  );
}

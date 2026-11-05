import type { Metadata } from "next";
import { brandCopy, SHOP_EXAMPLES } from "@/lib/brand-mode";
import Link from "next/link";
import { CoupangSection } from "@/components/shop/CoupangSection";
import { LinkPasteHint } from "@/components/shop/LinkPasteHint";
import { ShopQueryInput } from "@/components/shop/ShopQueryInput";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { ogBase, ogImage } from "@/lib/site";

const DESCRIPTION = "상품 이름으로 쿠팡·네이버·G마켓·11번가의 판매 가격 데이터를 한 화면에서 확인하고, 쿠팡에서 여행 준비 상품을 찾아볼 수 있어요.";

export const metadata: Metadata = {
  title: "쇼핑",
  description: DESCRIPTION,
  alternates: { canonical: "/shop" },
  openGraph: { title: "쇼핑 | Gollazyum", description: DESCRIPTION, ...ogBase, url: "/shop" },
  // 설정하지 않으면 사이트 공통 설명(여행)이 나가므로 og:description과 같은 쇼핑 설명을 넣는다
  twitter: { card: "summary_large_image", title: "쇼핑 | Gollazyum", description: DESCRIPTION, images: [ogImage] },
};


// 쇼핑 탭. 상품 이름으로 스토어 데이터를 찾는 검색창과 쿠팡 섹션
export default function ShopPage() {
  return (
    <>
      <SiteHeader />
      <main className="shop-page">
        <section className="shop-head">
          <p className="eyebrow">쇼핑</p>
          <h1>{brandCopy("shopHeading")}</h1>
          <p className="shop-lead">{brandCopy("shopLead")}</p>
          <form className="shop-search" action="/shop/product" method="get" role="search">
            <ShopQueryInput placeholder="예: 무선 이어폰, 캐리어 24인치" />
            <button type="submit">찾기</button>
          </form>
          <LinkPasteHint />
          <div className="shop-examples">
            <span>이렇게 찾아보세요</span>
            {SHOP_EXAMPLES.map((k) => (
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

import Link from "next/link";
import { Logo } from "@/components/Logo";
import { site } from "@/lib/site";

// 쇼핑 탭(/shop) 바닥글만 쓰는 면책. 여행 페이지는 아래 기본 문구를 그대로 둔다.
const SHOP_DISCLOSURE =
  "Gollazyum은 상품 정보와 가격을 모아 보여 드리는 서비스로, 판매 당사자가 아닙니다. 상품 구매·배송·환불 등 거래에 관한 책임은 각 판매처에 있으며, 표시된 가격과 재고는 판매처 사정에 따라 달라질 수 있어요.";

// 첫 화면, 약관·개인정보, 호텔·항공 결과가 같이 쓰는 바닥글.
// 쇼핑 탭만 variant="shop"을 넘겨 쇼핑 면책 문구를 보여 준다.
export function SiteFooter({ variant = "travel" }: { variant?: "travel" | "shop" }) {
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="brand">
          <Logo tone="white" height={34} />
        </div>
        <p className="disclosure">
          {variant === "shop" ? (
            SHOP_DISCLOSURE
          ) : (
            <>
              Gollazyum은 글로벌 트래블 데이터와 AI 솔루션을 연결하는 여행·라이프스타일 플랫폼입니다. Gollazyum의 링크를 통해 예약하시면 제휴사로부터 소정의 수수료를 제공받을 수
              있으나, 고객님이 지불하는 최종 금액에는 어떠한 영향도 주지 않습니다. 표시된 가격은 조회 시점 기준이며, 예약 및 결제·환불에 관한
              모든 책임은 해당 예약 사이트에 있습니다.
            </>
          )}
        </p>
        <p className="footer-links">
          <Link href="/terms">이용약관</Link>
          <Link href="/privacy">개인정보처리방침</Link>
          <a href={site.instagramUrl} target="_blank" rel="noopener noreferrer">
            Instagram
          </a>
          <span>
            문의 및 제휴: <a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a>
          </span>
        </p>
        <p className="footer-biz">
          <span>상호 {site.business.name}</span>
          <span>대표자 {site.business.ceo}</span>
          <span>사업자등록번호 {site.business.registrationNo}</span>
        </p>
        <p className="copy">© {new Date().getFullYear()} Gollazyum. All rights reserved.</p>
      </div>
    </footer>
  );
}

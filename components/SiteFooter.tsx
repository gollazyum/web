import Link from "next/link";
import { Logo } from "@/components/Logo";
import { site } from "@/lib/site";

// 첫 화면과 약관·개인정보 페이지가 같이 쓰는 바닥글
export function SiteFooter() {
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="brand">
          <Logo tone="white" height={34} />
        </div>
        <p className="disclosure">
          Lowboti는 여행 가격 비교 플랫폼입니다. Lowboti의 링크를 통해 예약하시면 제휴사로부터 소정의 수수료를 받을 수 있으며, 고객님이
          지불하는 금액에는 영향을 주지 않습니다. 표시된 정보와 가격은 조회 시점 기준이며 실제 결제 금액과 다를 수 있습니다.
          예약·결제·취소·환불은 각 예약 사이트의 약관과 정책을 따릅니다.
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
        <p className="copy">© {new Date().getFullYear()} Lowboti. All rights reserved.</p>
      </div>
    </footer>
  );
}

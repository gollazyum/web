import Link from "next/link";
import { brand, BRAND_NAME } from "@/lib/brand";
import { site } from "@/lib/site";

// 약관·개인정보처리방침·404가 같이 쓰는 새 머리글·바닥글 (여행 앱과 같은 흰 바탕 + 검정 글씨 + 파란 구슬 로고).
// 여행 앱 안(홈)의 바닥글과 같은 문구를 lib/site.ts 에서 가져온다
export function PageHeader() {
  return (
    <header className="pg-head">
      <div className="pg-wrap pg-head-in">
        <Link href="/" className="pg-logo" aria-label={`${BRAND_NAME} 홈`}>
          <span className="pg-orb" aria-hidden />
          <strong>{BRAND_NAME}</strong>
          {brand.tentative && <em>가칭</em>}
        </Link>
        <nav className="pg-nav" aria-label="메뉴">
          <Link href="/">홈</Link>
          <Link href="/explore">둘러보기</Link>
          <Link href="/chat">AI 채팅</Link>
          <Link href="/trips">내 여행</Link>
          <Link href="/my">마이</Link>
        </nav>
      </div>
    </header>
  );
}

export function PageFooter() {
  return (
    <footer className="pg-foot">
      <div className="pg-wrap">
        <p>
          {site.footerIntro} {site.footerAffiliate}
        </p>
        <p>
          상호 {site.business.name} · 대표자 {site.business.ceo} · 사업자등록번호 {site.business.registrationNo}
          <br />
          문의 <a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a>
        </p>
        <nav className="pg-foot-links" aria-label="약관과 정책">
          <Link href="/terms">이용약관</Link>
          <Link href="/privacy">
            <b>개인정보처리방침</b>
          </Link>
        </nav>
        <p>{site.footerNotice}</p>
      </div>
    </footer>
  );
}

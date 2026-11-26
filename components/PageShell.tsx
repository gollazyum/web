import Link from "next/link";
import { brand, brandCssVars, BRAND_NAME } from "@/lib/brand";
import { site } from "@/lib/site";

// 약관·개인정보처리방침·404가 같이 쓰는 머리글·바닥글 (여행 앱과 같은 미색 바탕 + 먹색 글자 + 글자 로고).
// 색은 여행 앱과 같은 lib/brand.ts 값을 .pg 안에서만 CSS 변수로 쓴다
// 여행 앱 안(홈)의 바닥글과 같은 문구를 lib/site.ts 에서 가져온다
export function PageHeader() {
  return (
    <header className="pg-head">
      <style>{`.pg{${brandCssVars()}}`}</style>
      <div className="pg-wrap pg-head-in">
        <Link href="/" className="pg-logo" aria-label={`${BRAND_NAME} 홈`}>
          <strong>{BRAND_NAME}</strong>
          {brand.tentative && <em>가칭</em>}
        </Link>
        <nav className="pg-nav" aria-label="메뉴">
          <Link href="/">홈</Link>
          <Link href="/chat">AI 추천</Link>
          <Link href="/trips">찜·알림</Link>
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

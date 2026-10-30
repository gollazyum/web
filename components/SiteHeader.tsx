import Link from "next/link";
import { Logo } from "@/components/Logo";
import { FindCta, MobileMenu, SiteNav } from "@/components/SiteNav";

// 모든 페이지가 같이 쓰는 머리글. 로고를 누르면 홈으로 간다
// compact는 검색 결과 페이지용: 높이를 줄여 아래 고정 필터와 도우미 위치를 맞춘다
export function SiteHeader({ compact = false }: { compact?: boolean }) {
  return (
    <header className="nav-bar">
      <div className={`nav wrap home-nav${compact ? " results-nav" : ""}`}>
        <Link href="/" className="brand" aria-label="Gollazyum 홈">
          <Logo height={compact ? 34 : 40} />
          <span className="brand-badge" aria-hidden="true">
            AI
          </span>
        </Link>
        <SiteNav />
        <FindCta className="nav-cta" />
        <MobileMenu />
      </div>
    </header>
  );
}

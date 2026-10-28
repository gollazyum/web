import Link from "next/link";
import { Logo } from "@/components/Logo";
import { FindCta, MobileMenu, SiteNav } from "@/components/SiteNav";

// 첫 화면과 약관·개인정보 페이지가 같이 쓰는 머리글. 로고를 누르면 홈으로 간다
export function SiteHeader() {
  return (
    <header className="nav-bar">
      <div className="nav wrap home-nav">
        <Link href="/" className="brand" aria-label="로보티 (Lowboti) 홈">
          <Logo height={40} />
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

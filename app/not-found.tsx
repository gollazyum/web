import type { Metadata } from "next";
import Link from "next/link";
import { StatusScreen } from "@/components/StatusScreen";

// 없는 주소. Next가 404 상태로 보내고 noindex를 붙인다 (아래 robots로 한 번 더 지정)
// 제목은 레이아웃 템플릿 '%s | Gollazyum'을 거쳐 '페이지를 찾을 수 없어요 | Gollazyum'이 된다
export const metadata: Metadata = {
  title: "페이지를 찾을 수 없어요",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <StatusScreen icon="🔍" title="페이지를 찾을 수 없어요" message="찾으시는 페이지가 없어요. 주소가 바뀌었거나 삭제됐을 수 있어요.">
      <Link href="/" className="status-btn primary">
        홈으로
      </Link>
      <Link href="/shop" className="status-btn">
        쇼핑 둘러보기
      </Link>
      <Link href="/hotels" className="status-btn">
        숙소 찾기
      </Link>
    </StatusScreen>
  );
}

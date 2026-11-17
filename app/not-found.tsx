import type { Metadata } from "next";
import Link from "next/link";

// 없는 주소: 한국어 안내 + 홈으로. Next가 상태 코드 404를 그대로 보낸다
export const metadata: Metadata = {
  title: { absolute: "페이지를 찾을 수 없어요" },
  robots: { index: false },
};

export default function NotFound() {
  return (
    <main className="nf">
      <p className="nf-code">404</p>
      <h1>페이지를 찾을 수 없어요</h1>
      <p className="nf-sub">주소가 바뀌었거나 없어진 페이지예요. 홈에서 다시 찾아보세요.</p>
      <Link href="/" className="nf-home">
        홈으로
      </Link>
    </main>
  );
}

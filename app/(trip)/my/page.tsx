import type { Metadata } from "next";

// 마이 탭 (담은 숙소·취향). 이 기기에만 저장된 내용이라 검색에는 노출하지 않는다.
// 화면은 (trip)/layout.tsx 의 앱이 주소를 보고 그린다
export const metadata: Metadata = {
  title: "마이",
  description: "담은 숙소와 여행 취향을 모아 봐요.",
  alternates: { canonical: "/my" },
  robots: { index: false, follow: true },
};

export default function MyPage() {
  return null;
}

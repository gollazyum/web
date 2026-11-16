import type { Metadata } from "next";

// 지금 탭 (여행 중 도구, 준비 중). 화면은 (trip)/layout.tsx 의 앱이 주소를 보고 그린다
export const metadata: Metadata = {
  title: "지금",
  description: "여행 중에 쓰는 도구를 준비하고 있어요.",
  alternates: { canonical: "/now" },
  robots: { index: false, follow: true },
};

export default function NowPage() {
  return null;
}

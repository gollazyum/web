import type { Metadata } from "next";
import { ogBase } from "@/lib/site";

// 둘러보기 탭 (여행 전·중·후 도움 카드). 화면은 (trip)/layout.tsx 의 앱이 주소를 보고 그린다
const DESCRIPTION = "여행 전 준비, 여행 중 문제 해결, 여행 후 정리까지 궁금한 걸 AI에게 바로 물어보세요.";

export const metadata: Metadata = {
  title: "둘러보기",
  description: DESCRIPTION,
  alternates: { canonical: "/explore" },
  openGraph: { title: "여행 도움 둘러보기", description: DESCRIPTION, ...ogBase, url: "/explore" },
};

export default function ExplorePage() {
  return null;
}

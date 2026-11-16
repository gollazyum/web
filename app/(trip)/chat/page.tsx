import type { Metadata } from "next";
import { BRAND_AI_NAME } from "@/lib/brand";
import { ogBase } from "@/lib/site";

// AI 채팅 탭. 화면은 (trip)/layout.tsx 의 앱이 주소를 보고 그린다
const DESCRIPTION = "가고 싶은 여행을 말로 적으면 AI가 조건에 맞는 숙소와 항공편을 찾아 드려요.";

export const metadata: Metadata = {
  title: "AI 채팅",
  description: DESCRIPTION,
  alternates: { canonical: "/chat" },
  openGraph: { title: `${BRAND_AI_NAME}에게 물어보기`, description: DESCRIPTION, ...ogBase, url: "/chat" },
};

export default function ChatPage() {
  return null;
}

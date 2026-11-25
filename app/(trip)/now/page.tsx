import { redirect } from "next/navigation";

// 예전 '지금' 탭 주소 → AI 추천
export default function NowPage() {
  redirect("/chat");
}

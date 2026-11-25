import { redirect } from "next/navigation";

// 예전 둘러보기 탭 주소. 2026-11-25 돈 아끼는 예약에 집중하며 탭을 뺐다 → AI 추천으로 보낸다
export default function ExplorePage() {
  redirect("/chat");
}

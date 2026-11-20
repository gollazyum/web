import { redirect } from "next/navigation";

// 예전 '지금' 탭 주소. 여행 중 도움은 둘러보기 탭(여행 중 해결)으로 옮겼다
export default function NowPage() {
  redirect("/explore");
}

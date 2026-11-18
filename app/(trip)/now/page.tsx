import { redirect } from "next/navigation";

// P2: '지금' 탭(여행 중 도구)은 준비될 때까지 숨긴다. 예전 주소로 오면 홈으로 보낸다
export default function NowPage() {
  redirect("/");
}

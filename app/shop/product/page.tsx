import type { Metadata } from "next";
import { redirect } from "next/navigation";

// 일반 상품 쇼핑 화면은 여행 앱으로 바뀌면서 닫았다 (2026-11-16). 예전 주소로 오면 홈으로 보낸다.
// 상품 검색 코드(components/shop, lib/shopping)는 지우지 않고 남겨 둔다
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function ProductPage() {
  redirect("/");
}

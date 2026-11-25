import type { Metadata } from "next";

// 내 여행 탭 (담아 둔 숙소를 여행별로). 이 기기에만 저장된 내용이라 검색에는 노출하지 않는다.
// 화면은 (trip)/layout.tsx 의 앱이 주소를 보고 그린다
export const metadata: Metadata = {
  title: "찜·알림",
  description: "찜한 숙소의 가격 변화를 모아 봐요.",
  alternates: { canonical: "/trips" },
  robots: { index: false, follow: true },
};

export default function TripsPage() {
  return null;
}

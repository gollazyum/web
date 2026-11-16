import { TripApp } from "@/components/trip/TripApp";
import { brandCssVars } from "@/lib/brand";
import "./trip.css";

// 홈(/)·AI 채팅(/chat)·지금(/now)·마이(/my)는 한 앱의 탭이다.
// 앱은 이 레이아웃에 한 번만 두고, 탭 주소를 옮겨 다녀도 대화·검색 결과가 그대로 남는다 (각 page.tsx는 제목·설명만 정한다)
export default function TripLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* 브랜드 색은 lib/brand.ts 에서만 정한다 */}
      <style>{`:root{${brandCssVars()}}`}</style>
      {children}
      <TripApp />
    </>
  );
}

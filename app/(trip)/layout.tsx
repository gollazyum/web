import { TripApp } from "@/components/trip/TripApp";
import { brandCssVars } from "@/lib/brand";
import { FONT_BOOT } from "@/lib/ui-prefs";
import "./trip.css";

// 홈(/)·AI 추천(/chat)·찜·알림(/trips)·마이(/my)는 한 앱의 탭이다. 예전 /explore·/now 는 /chat 으로 보낸다.
// 앱은 이 레이아웃에 한 번만 두고, 탭 주소를 옮겨 다녀도 대화·검색 결과가 그대로 남는다 (각 page.tsx는 제목·설명만 정한다)
export default function TripLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* 브랜드 색은 lib/brand.ts 에서만 정한다 */}
      <style>{`:root{${brandCssVars()}}`}</style>
      {/* 주소에 검색 조건이 있으면(공유 링크·새로 고침) 앱이 결과 화면을 그릴 때까지 빈 검색 화면을 잠깐 감춘다.
          검색 화면이 먼저 보였다가 결과 화면으로 통째로 바뀌는 흔들림(CLS)을 막는다. 앱이 준비되면 tb-has-q를 지운다 */}
      <script dangerouslySetInnerHTML={{ __html: `if(location.pathname==="/"&&/[?&](q|from)=/.test(location.search)){document.documentElement.classList.add("tb-has-q");setTimeout(function(){document.documentElement.classList.remove("tb-has-q")},4000)}` }} />
      {/* 마이 '큰 글씨 보기'를 화면이 그려지기 전에 적용한다 */}
      <script dangerouslySetInnerHTML={{ __html: FONT_BOOT }} />
      {children}
      <TripApp />
    </>
  );
}

// 쿠팡 파트너스 대가성 문구. 쇼핑 탭은 쿠팡 링크보다 위에, 상품 화면은 헤더 바로 아래(모든 구매 버튼보다 위)에 둔다.
// 쇼핑 탭은 14px, 상품 화면은 헤더 바로 아래 13px 회색 상자(#334155 on #F1F5F9). 접거나 숨기지 않는다
export const COUPANG_DISCLOSURE = "이 게시물은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.";

export function CoupangDisclosure({ className = "" }: { className?: string }) {
  return (
    <p className={`cp-disclosure ${className}`.trim()} role="note">
      {COUPANG_DISCLOSURE}
    </p>
  );
}

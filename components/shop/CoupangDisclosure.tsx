// 쿠팡 파트너스 대가성 문구. 쿠팡 링크가 나오는 모든 화면에서 링크보다 먼저(위에) 둔다.
// 글자는 14px 이상, 배경과 확실히 구분되는 진한 색. 접거나 숨기지 않는다
export const COUPANG_DISCLOSURE = "이 게시물은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.";

export function CoupangDisclosure({ className = "" }: { className?: string }) {
  return (
    <p className={`cp-disclosure ${className}`.trim()} role="note">
      {COUPANG_DISCLOSURE}
    </p>
  );
}

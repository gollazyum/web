"use client";

// Phase 2(카카오·구글 로그인) 자리. 지금은 NEXT_PUBLIC_ENABLE_AUTH가 "true"가 아니면 뜨지 않는다.
// Supabase Auth 키가 준비되면 버튼에 로그인 연결만 붙이면 된다
export const AUTH_ENABLED = process.env.NEXT_PUBLIC_ENABLE_AUTH === "true";

export function RememberPrefsModal({ onClose }: { onClose: () => void }) {
  if (!AUTH_ENABLED) return null;
  return (
    <div className="auth-modal" role="dialog" aria-modal="true" aria-label="이 취향 기억할까요?">
      <div className="auth-card">
        <strong>이 취향 기억할까요?</strong>
        <p>로그인하면 다른 기기에서도 보관함과 선호를 이어서 볼 수 있어요.</p>
        {/* TODO(Phase 2): Supabase Auth signInWithOAuth({ provider: "kakao" | "google" }) */}
        <button type="button" className="auth-kakao" disabled>
          카카오로 계속하기
        </button>
        <button type="button" className="auth-google" disabled>
          Google로 계속하기
        </button>
        <button type="button" className="link-btn" onClick={onClose}>
          괜찮아요
        </button>
      </div>
    </div>
  );
}

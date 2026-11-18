"use client";

// AI 요약이 두 번 다 실패했을 때 결과 위 한 줄 (숙소·항공·채팅 공통). '다시 시도'는 AI만 다시 부른다 (검색은 그대로)
export const AI_OFF_TEXT = "AI 요약을 불러오지 못해, 확인한 가격 기준으로 보여 드려요";

export function AiOffNote({ onRetry }: { onRetry?: () => void }) {
  return (
    <p className="tb-aioff" role="status">
      <span>{AI_OFF_TEXT}</span>
      {onRetry && (
        <button type="button" className="tb-aioff-retry" onClick={onRetry}>
          다시 시도
        </button>
      )}
    </p>
  );
}

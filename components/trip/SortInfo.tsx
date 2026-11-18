"use client";

// PC 정렬 칸: '관련도순'이 무엇인지 ⓘ 한 줄 (모바일은 정렬 시트 위 설명 한 줄)
export function SortInfo({ kind }: { kind: "stay" | "flight" }) {
  return (
    <details className="tb-sortinfo">
      <summary>ⓘ 관련도순은 어떤 순서인가요?</summary>
      <p>
        목적지 검색 결과가 온 순서 그대로예요. 광고나 제휴 수수료로 순서를 바꾸지 않아요. AI 추천 3{kind === "stay" ? "곳" : "편"}은 목록 위에 따로 보여 드려요.
      </p>
    </details>
  );
}

"use client";

import Link from "next/link";

// P2: 'AI 추천순' 옆 ⓘ. 이용약관 제7조(순서와 표시 기준)와 같은 내용만 말한다
export function AiSortInfo({ kind }: { kind: "stay" | "flight" }) {
  return (
    <details className="tb-ainfo">
      <summary>ⓘ AI 추천순은 어떻게 정하나요?</summary>
      <p>
        AI 추천순은 받은 {kind === "stay" ? "숙소의 가격·평점·위치" : "항공편의 가격·시간·경유"}와 알려 주신 취향을 함께 보고 정해요. 광고나 제휴 수수료로 순서를
        바꾸지 않고, 표시 방식이 달라지면 함께 알려 드려요. <Link href="/terms">이용약관 제7조</Link>
      </p>
    </details>
  );
}

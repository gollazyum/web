"use client";

import { useEffect, useState } from "react";
import { EXPLORE_STAGES, type ExploreStage } from "@/lib/explore";
import { IconChatStar } from "./icons";

const STAGE_KEY = "tb-explore-stage";

// 둘러보기 탭: 여행 전·중·후 도움 카드. 카드를 누르면 그 주제로 AI 채팅이 바로 시작된다
export function Explore({ onAsk }: { onAsk: (prompt: string) => void }) {
  const [stage, setStage] = useState<ExploreStage>("before");
  // 마지막으로 본 단계를 이 탭 안에서만 기억한다 (다른 탭에 다녀와도 그대로)
  useEffect(() => {
    try {
      const s = sessionStorage.getItem(STAGE_KEY);
      if (s === "before" || s === "during" || s === "after") setStage(s);
    } catch {
      // 저장소를 못 쓰면 '여행 전'부터
    }
  }, []);
  const pick = (s: ExploreStage) => {
    setStage(s);
    try {
      sessionStorage.setItem(STAGE_KEY, s);
    } catch {
      // 저장 실패는 조용히 넘긴다
    }
  };
  const cur = EXPLORE_STAGES.find((s) => s.id === stage) ?? EXPLORE_STAGES[0];

  return (
    <main className="tb-page tb-explore">
      <h1>둘러보기</h1>
      <p className="tb-lead">궁금한 걸 누르면 AI가 바로 알려 드려요.</p>
      <div className="tb-seg" role="tablist" aria-label="여행 단계">
        {EXPLORE_STAGES.map((s) => (
          <button key={s.id} type="button" role="tab" aria-selected={s.id === stage} onClick={() => pick(s.id)}>
            {s.label}
          </button>
        ))}
      </div>

      {/* Step 2에서 퀵 모드(환율 계산·메뉴판 번역·숙소 주소 보여 주기 등)가 들어갈 자리 */}
      {stage === "during" && (
        <section className="tb-quick-slot" aria-label="퀵 모드">
          <span className="tb-tag ac">곧 열려요</span>
          <strong>퀵 모드</strong>
          <p>환율 계산, 메뉴판 번역, 택시 기사님께 숙소 주소 보여 주기를 큰 버튼 하나로 쓸 수 있게 준비하고 있어요.</p>
        </section>
      )}

      <ul className="tb-help-grid" role="tabpanel" aria-label={cur.label}>
        {cur.cards.map((c) => (
          <li key={c.title}>
            <button type="button" className="tb-help-card" onClick={() => onAsk(c.prompt)}>
              <span className="tb-help-emoji" aria-hidden>
                {c.emoji}
              </span>
              <span className="tb-help-text">
                <strong>{c.title}</strong>
                <small>{c.desc}</small>
              </span>
              <span className="tb-help-go" aria-hidden>
                <IconChatStar size={18} />
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="tb-help-note">AI 답은 참고용이에요. 비자·입국 규정과 긴급 연락처는 출발 전에 공식 안내로 한 번 더 확인해 주세요.</p>
    </main>
  );
}

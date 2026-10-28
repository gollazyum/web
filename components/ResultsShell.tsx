"use client";

import { useState } from "react";
import { LowbotiBot } from "./LowbotiBot";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";

// 호텔·항공권 결과 페이지 공통 틀: 홈과 같은 머리글, 다시 찾는 검색창, 홈과 같은 바닥글
// summary는 휴대폰에서 검색창을 접어 둘 때 보여 주는 한 줄 요약
type Props = { search: React.ReactNode; summary: { title: string; sub: string } | null; children: React.ReactNode };

export function ResultsShell({ search, summary, children }: Props) {
  const [editing, setEditing] = useState(!summary);
  return (
    <>
      <SiteHeader compact />
      <div className={`results-top${editing ? " editing" : ""}`}>
        <div className="wrap">
          {summary && (
            <button type="button" className="results-summary" onClick={() => setEditing(!editing)} aria-expanded={editing}>
              <span>
                <strong>{summary.title}</strong>
                <small>{summary.sub}</small>
              </span>
              <b>{editing ? "닫기" : "변경"}</b>
            </button>
          )}
          <div className="results-form">{search}</div>
        </div>
      </div>
      <main className="results-page wrap">{children}</main>
      <SiteFooter />
    </>
  );
}

// 결과를 못 보여 줄 때: 시무룩한 로보티와 안내, 다른 곳으로 가는 버튼
export function ResultsMessage({ title, children, action }: { title?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="results-message lb-st-sad">
      <div className="result-bot" aria-hidden="true">
        <div className="lb-act">
          <LowbotiBot fx={false} />
        </div>
      </div>
      {title && <h1>{title}</h1>}
      <p>{children}</p>
      {action}
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { Logo } from "./Logo";
import { LowbotiBot } from "./LowbotiBot";

// 호텔·항공권 결과 페이지 공통 틀: 위쪽 머리글, 다시 찾는 검색창, 아래 안내
// summary는 휴대폰에서 검색창을 접어 둘 때 보여 주는 한 줄 요약
type Props = { search: React.ReactNode; summary: { title: string; sub: string } | null; children: React.ReactNode };

export function ResultsShell({ search, summary, children }: Props) {
  const [editing, setEditing] = useState(!summary);
  return (
    <>
      <header className="nav-bar">
        <div className="nav wrap results-nav">
          <Link href="/" className="brand" aria-label="로보티 (Lowboti) 홈">
            <Logo height={34} />
            <span className="brand-badge" aria-hidden="true">
              AI
            </span>
          </Link>
          <Link href="/" className="nav-cta">
            처음으로
          </Link>
        </div>
      </header>
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
      <footer className="results-foot wrap">
        Lowboti는 제휴 마케팅 사이트입니다. 링크를 통해 예약하시면 예약 사이트로부터 수수료를 받을 수 있으며, 고객님이 지불하는 금액에는
        영향이 없습니다. 표시된 가격은 조회 시점 기준이며 최종 가격은 예약 사이트에서 확인해 주세요.
      </footer>
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

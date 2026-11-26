"use client";

import { useState } from "react";
import { clearAllHistory } from "@/lib/clear-history";

// 마이 맨 아래: 이 브라우저에 저장된 기록을 지운다. 한 번 더 확인한 뒤 지우고, 화면을 처음 상태로 다시 연다
export function ClearHistory() {
  const [ask, setAsk] = useState(false);
  return (
    <section className="tb-clear" id="my-clear" aria-label="저장 기록">
      <h2 className="tb-h2">이 기기에 저장된 기록</h2>
      <p>담아 둔 숙소, 여행 취향, 여행 체크, 최근 검색 결과는 이 브라우저에만 저장돼요.</p>
      {ask ? (
        <div className="tb-clear-ask" role="group" aria-label="기록 지우기 확인">
          <p>모두 지우면 되돌릴 수 없어요. 지울까요?</p>
          <div className="tb-trip-actions-row">
            <button
              type="button"
              className="tb-btn"
              onClick={() => {
                clearAllHistory();
                window.location.replace("/my");
              }}
            >
              모두 지우기
            </button>
            <button type="button" className="tb-btn ghost" onClick={() => setAsk(false)}>
              취소
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="tb-btn ghost" onClick={() => setAsk(true)}>
          기록 지우기
        </button>
      )}
    </section>
  );
}

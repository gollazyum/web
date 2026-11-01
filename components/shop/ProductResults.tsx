"use client";

import { useEffect, useState } from "react";
import { errorCode } from "@/lib/apiError";
import { won, type SearchItem, type SearchResponse } from "@/lib/shopping";

type State = { kind: "loading" } | { kind: "error"; code: string } | { kind: "ok"; items: SearchItem[]; sample: boolean };

// 상품 검색 목록. 여기서는 스토어별 가격을 부르지 않고, 상품을 고르면 그 상품만 상세 조회한다
export function ProductResults({ query }: { query: string }) {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`/api/shopping?q=${encodeURIComponent(query)}`, { signal: ctrl.signal })
      .then(async (res) => {
        if (!res.ok) return setState({ kind: "error", code: await errorCode(res) });
        const data = (await res.json()) as SearchResponse;
        setState({ kind: "ok", items: data.items ?? [], sample: !!data.sample });
      })
      .catch((e) => e.name !== "AbortError" && setState({ kind: "error", code: "network" }));
    return () => ctrl.abort();
  }, [query]);

  function back() {
    if (window.history.length > 1) window.history.back();
    else window.location.href = "/shop";
  }

  return (
    <div className="pd-page">
      <header className="pd-topbar">
        <button type="button" className="pd-icon-btn" aria-label="뒤로가기" onClick={back}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <form className="sr-search" action="/shop/product" method="get" role="search">
          <input name="q" type="search" defaultValue={query} maxLength={100} aria-label="상품 이름" required />
        </form>
      </header>

      <main className="pd-main">
        {state.kind === "loading" && (
          <div className="pd-state">
            <span className="pd-spinner" aria-hidden="true" />
            <p>상품을 찾고 있어요</p>
          </div>
        )}
        {state.kind === "error" && (
          <div className="pd-state">
            <p>지금은 상품 데이터를 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.</p>
            <small>오류 {state.code}</small>
          </div>
        )}
        {state.kind === "ok" && !state.items.length && (
          <div className="pd-state">
            <p>“{query}” 상품 데이터를 찾지 못했어요. 상품명을 조금 다르게 입력해 보세요.</p>
          </div>
        )}
        {state.kind === "ok" && state.items.length > 0 && (
          <>
            <p className="sr-head">
              “{query}” 상품 {state.items.length}개 · 상품을 누르면 스토어별 가격을 보여 드려요
              {state.sample && <span className="pd-sample">개발용 예시 데이터</span>}
            </p>
            <ul className="sr-list">
              {state.items.map((item) => (
                <li key={item.token}>
                  <a className="sr-item" href={`/shop/product?q=${encodeURIComponent(query)}&token=${encodeURIComponent(item.token)}`}>
                    <span className="sr-thumb">
                      {item.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.image} alt="" referrerPolicy="no-referrer" loading="lazy" />
                      ) : (
                        <span aria-hidden="true">🛍️</span>
                      )}
                    </span>
                    <span className="sr-body">
                      <strong>{item.title}</strong>
                      <span className="sr-meta">
                        {item.price !== null && <b>{won(item.price)}</b>}
                        {item.seller && <em>{item.seller}</em>}
                      </span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
    </div>
  );
}

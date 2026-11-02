"use client";

import { useEffect, useState } from "react";
import { brandCopy } from "@/lib/brand-mode";
import { BuyBar } from "@/components/shop/BuyBar";
import { COUPANG_DISCLOSURE } from "@/components/shop/CoupangDisclosure";
import { PriceCompareList } from "@/components/shop/PriceCompareList";
import { errorCode } from "@/lib/apiError";
import { rankable, won, type ShoppingCandidate, type ShoppingProduct, type ShoppingResponse } from "@/lib/shopping";
import { site } from "@/lib/site";

type State =
  | { kind: "loading" }
  | { kind: "miss"; candidates: ShoppingCandidate[] }
  | { kind: "error"; code: string }
  | { kind: "ok"; product: ShoppingProduct };

const EXAMPLE_QUERIES = ["에어팟 프로 2 USB-C", "캐리어 24인치", "보조배터리 20000"];

const FAV_KEY = "gollazyum:shop-favs";

function readFavs(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(FAV_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

const reportHref = (q: string) =>
  `mailto:${site.contactEmail}?subject=${encodeURIComponent(`[상품 정보 제보] ${q}`)}`;

// 검색어 그대로 두고, 받침에 맞춰 와/과만 붙인다. 0영 1일 3삼 6육 7칠 8팔은 받침이 있다.
function waGwa(text: string): "와" | "과" {
  const last = [...text.trim()].pop() ?? "";
  const code = last.codePointAt(0) ?? 0;
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 === 0 ? "와" : "과";
  if ("013678".includes(last)) return "과";
  if ("2459".includes(last)) return "와";
  if (/[aeiou]$/i.test(last)) return "와";
  if (/[a-z]$/i.test(last)) return "과";
  return "와";
}

function Icon({ d, label, onClick, active }: { d: string; label: string; onClick: () => void; active?: boolean }) {
  return (
    <button type="button" className={`pd-icon-btn${active ? " on" : ""}`} aria-label={label} aria-pressed={active} onClick={onClick}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={d} />
      </svg>
    </button>
  );
}

const BACK = "M15 18l-6-6 6-6";
const SHARE = "M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7M16 6l-4-4-4 4M12 2v13";
const STAR = "M12 2.8l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.6l-5.8 3.1 1.1-6.5L2.6 9.6l6.5-.9z";

// 상품 데이터 상세 화면 (모바일 우선, 데스크톱은 가운데 좁은 칼럼)
export function ProductDetail({ query }: { query: string }) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [fav, setFav] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    setFav(readFavs().includes(query));
    const ctrl = new AbortController();
    fetch(`/api/shopping?q=${encodeURIComponent(query)}`, { signal: ctrl.signal })
      .then(async (res) => {
        if (!res.ok) return setState({ kind: "error", code: await errorCode(res) });
        const data = (await res.json()) as ShoppingResponse;
        setState(data.product ? { kind: "ok", product: data.product } : { kind: "miss", candidates: data.candidates ?? [] });
      })
      .catch((e) => e.name !== "AbortError" && setState({ kind: "error", code: "network" }));
    return () => ctrl.abort();
  }, [query]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2000);
    return () => clearTimeout(t);
  }, [toast]);

  function back() {
    if (window.history.length > 1) window.history.back();
    else window.location.href = "/shop";
  }

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: query, url });
      else {
        await navigator.clipboard.writeText(url);
        setToast("주소를 복사했어요");
      }
    } catch {
      /* 공유 창을 닫은 경우 */
    }
  }

  function toggleFav() {
    const list = readFavs().filter((q) => q !== query);
    if (!fav) list.unshift(query);
    localStorage.setItem(FAV_KEY, JSON.stringify(list.slice(0, 50)));
    setFav(!fav);
    setToast(fav ? "관심상품에서 뺐어요" : "관심상품에 담았어요");
  }

  const product = state.kind === "ok" ? state.product : null;
  const top = product?.offers.find(rankable) ?? null;
  const hasCoupang = !!product?.offers.some((o) => o.seller.key === "쿠팡");
  const showBuy = !!product && product.offers.length > 0;

  return (
    <div className={`pd-page${showBuy ? "" : " pd-page-nobuy"}`}>
      <header className="pd-topbar">
        <Icon d={BACK} label="뒤로가기" onClick={back} />
        <span className="pd-topbar-space" />
        <Icon d={SHARE} label="공유" onClick={share} />
        <Icon d={STAR} label="관심상품" onClick={toggleFav} active={fav} />
      </header>
      <p className="pd-toast" aria-live="polite">
        {toast}
      </p>
      <QueryBar query={query} />

      {state.kind === "loading" && (
        <div className="pd-state">
          <span className="pd-spinner" aria-hidden="true" />
          <p>스토어별 가격을 불러오고 있어요</p>
        </div>
      )}
      {state.kind === "miss" && <MissState query={query} candidates={state.candidates} />}
      {state.kind === "error" && (
        <div className="pd-state">
          <p>지금은 상품 데이터를 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.</p>
          <small>오류 {state.code}</small>
        </div>
      )}

      {product && (
        <main className="pd-main">
          {top && (
            <div className="pd-banner">
              <span className="pd-banner-dot" aria-hidden="true" />
              {brandCopy("topBanner")}
            </div>
          )}

          <section className="pd-product">
            <div className="pd-thumb">
              {product.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={product.image} alt="" referrerPolicy="no-referrer" />
              ) : (
                <span aria-hidden="true">🛍️</span>
              )}
            </div>
            <div className="pd-product-text">
              <h1>{product.title}</h1>
              {product.option && <p className="pd-option">{product.option}</p>}
              {product.sample && <span className="pd-sample">개발용 예시 데이터</span>}
            </div>
          </section>

          <section className="pd-price">
            {product.price !== null && <strong className="pd-price-now">{won(product.price)}</strong>}
            {product.originalPrice && (
              <span className="pd-price-sub">
                <s>{won(product.originalPrice)}</s>
                {product.changePct ? <em className="pd-change">▼{product.changePct}%</em> : null}
              </span>
            )}
            <a className="pd-wrong" href={reportHref(product.title)}>
              정보가 달라요
            </a>
          </section>

          {product.offers.length ? (
            <PriceCompareList offers={product.offers} fetchedAt={product.fetchedAt} />
          ) : (
            <p className="pd-no-sellers">현재 확인된 판매처가 없어요</p>
          )}

          <ProductNotice subject={product.title} showCoupang={hasCoupang} />
        </main>
      )}

      {showBuy && <BuyBar top={top} />}
    </div>
  );
}

function QueryBar({ query }: { query: string }) {
  return (
    <form className="pd-requery" action="/shop/product" method="get" role="search">
      <input
        key={query}
        name="q"
        type="search"
        required
        maxLength={100}
        defaultValue={query}
        aria-label="상품 이름"
        enterKeyHint="search"
        autoCapitalize="off"
        spellCheck={false}
      />
      <button type="submit">다시 찾기</button>
    </form>
  );
}

function MissState({ query, candidates }: { query: string; candidates: ShoppingCandidate[] }) {
  return (
    <main className="pd-main">
      <section className="pd-miss" role="status">
        <h1 className="pd-miss-title">‘{query}’{waGwa(query)} 이름이 맞는 상품을 못 찾았어요</h1>
        <p className="pd-miss-sub">상품 이름이나 모델명으로 다시 찾아보세요. 쿠팡·네이버 상품 링크를 붙여 넣어도 돼요.</p>
      </section>

      {candidates.length > 0 && (
        <section className="pd-candidates" aria-label="이름이 비슷하지 않지만 가장 가까운 결과">
          <h2 className="pd-miss-label">이름이 비슷하지 않지만 가장 가까운 결과</h2>
          <ul>
            {candidates.map((c, i) => (
              <li key={`${c.title}-${i}`} className="pd-candidate">
                <div className="pd-candidate-thumb">
                  {c.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.image} alt="" referrerPolicy="no-referrer" />
                  ) : (
                    <span aria-hidden="true">🛍️</span>
                  )}
                </div>
                <div className="pd-candidate-body">
                  <strong>{c.title}</strong>
                  <span className="pd-diff-badge">검색어와 이름이 달라요</span>
                </div>
                <a className="pd-candidate-open" href={`/shop/product?q=${encodeURIComponent(c.title)}`}>
                  이 상품 보기
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="pd-examples-block">
        <h2 className="pd-subhead">이렇게 찾아보세요</h2>
        <div className="pd-examples">
          {EXAMPLE_QUERIES.map((q) => (
            <a key={q} className="pd-chip" href={`/shop/product?q=${encodeURIComponent(q)}`}>
              {q}
            </a>
          ))}
        </div>
      </section>

      <ProductNotice subject={query} showCoupang={false} />
    </main>
  );
}

function ProductNotice({ subject, showCoupang }: { subject: string; showCoupang: boolean }) {
  return (
    <aside className="pd-notice">
      <ul>
        <li>
          상품, 가격 정보가 다른 경우 <a href={reportHref(subject)}>여기</a>에 제보해 주세요.
        </li>
        <li>가격은 표시된 시각 기준이며, 판매처에서 바뀔 수 있어요. 최종 금액은 판매처 결제 화면에서 확인해 주세요.</li>
        {/* 쿠팡 대가성 문구: 초록 결정(2026-11-01)으로 상세 화면은 하단 안내 박스에만 둔다 */}
        {showCoupang && <li className="pd-notice-cp">{COUPANG_DISCLOSURE}</li>}
      </ul>
    </aside>
  );
}

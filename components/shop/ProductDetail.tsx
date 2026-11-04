"use client";

import { useEffect, useMemo, useState } from "react";
import { brandCopy } from "@/lib/brand-mode";
import { BuyBar } from "@/components/shop/BuyBar";
import { CoupangDisclosure } from "@/components/shop/CoupangDisclosure";
import { LinkPasteHint } from "@/components/shop/LinkPasteHint";
import { PriceCompareList } from "@/components/shop/PriceCompareList";
import { ReportSheet, type ReportContext } from "@/components/shop/ReportSheet";
import { ShopLoading } from "@/components/shop/ShopLoading";
import { errorCode } from "@/lib/apiError";
import { COUPANG_LINK_ATTRS, coupangLinkLabel, getCoupangLink, type CoupangLink } from "@/lib/coupang-links";
import { favId, isFav, toggleFavId } from "@/lib/shop-favs";
import { DEFAULT_OFFER_VIEW, isNew, rankable, rankOffers, won, type OfferView, type ShoppingProduct, type ShoppingResponse } from "@/lib/shopping";

type State = { kind: "loading" } | { kind: "empty" } | { kind: "error"; code: string } | { kind: "ok"; product: ShoppingProduct };

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

const LOADING_STEPS = ["상품 정보를 확인하고 있어요", "판매처 가격 확인 중이에요", "가격 순서대로 정리하고 있어요"];

// 제보 메일에 넣는 기준 시각 (한국 시간)
const stamp = (iso: string) =>
  new Date(iso).toLocaleString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Seoul" });

// 상품 데이터 상세 화면 (모바일 우선, 데스크톱은 가운데 좁은 칼럼)
export function ProductDetail({ query, token, pid = "" }: { query: string; token: string; pid?: string }) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [fav, setFav] = useState(false);
  const [toast, setToast] = useState("");
  const [view, setView] = useState<OfferView>(DEFAULT_OFFER_VIEW);
  const [report, setReport] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`/api/shopping?${new URLSearchParams({ q: query, token, pid })}`, { signal: ctrl.signal })
      .then(async (res) => {
        if (!res.ok) return setState({ kind: "error", code: await errorCode(res) });
        const data = (await res.json()) as ShoppingResponse;
        if (!data.product) return setState({ kind: "empty" });
        // 새 상품이 하나도 없으면(중고 상품 화면) 처음부터 '중고 포함'으로 보여 준다
        const offers = data.product.offers.filter((o) => !o.placeholder);
        if (offers.length && !offers.some(isNew)) setView((v) => ({ ...v, includeUsed: true }));
        setState({ kind: "ok", product: data.product });
      })
      .catch((e) => e.name !== "AbortError" && setState({ kind: "error", code: "network" }));
    return () => ctrl.abort();
  }, [query, token, pid]);

  // 찜(★)은 상품 ID 단위. 응답을 받기 전에는 주소의 pid로 먼저 확인한다
  const id = favId(state.kind === "ok" ? state.product.productId || pid : pid, token);
  useEffect(() => setFav(isFav(id)), [id]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2000);
    return () => clearTimeout(t);
  }, [toast]);

  function back() {
    if (window.history.length > 1) window.history.back();
    else window.location.href = "/shop";
  }

  const product = state.kind === "ok" ? state.product : null;

  async function share() {
    const url = window.location.href;
    // 공유 제목은 검색어가 아니라 상품명 (가격은 넣지 않는다: 미리보기가 오래 저장된다)
    const title = product?.title || query;
    try {
      if (navigator.share) await navigator.share({ title, url });
      else {
        await navigator.clipboard.writeText(url);
        setToast("주소를 복사했어요");
      }
    } catch {
      /* 공유 창을 닫은 경우 */
    }
  }

  function toggleFav() {
    if (!id) return;
    const on = toggleFavId(id);
    setFav(on);
    setToast(on ? "관심상품에 담았어요" : "관심상품에서 뺐어요");
  }

  const ranked = useMemo(() => (product ? rankOffers(product.offers, view) : null), [product, view]);
  const top = ranked?.top ?? null;
  const realOffers = product?.offers.filter((o) => !o.placeholder) ?? [];
  // 1위가 없으면(확인된 판매처 0곳 포함) 하단 버튼은 쿠팡으로: 상품 주소 또는 상품명 검색결과
  const coupangRow = product?.offers.find((o) => o.placeholder) ?? product?.offers.find((o) => o.coupang) ?? null;
  const coupang = coupangRow?.coupang ?? getCoupangLink({ title: product?.title || query }, query);
  // 하단 버튼: 1위 판매처. 1위가 링크 없는 '가격 참고' 줄이면 다음 순위 중 링크가 있는 판매처로
  const buyTop = ranked?.list.find((r) => r.rank !== null && rankable(r.offer) && r.offer.link)?.offer ?? null;
  // 판매처 0곳: 상품 데이터를 못 찾았거나, 찾았어도 확인된 판매처가 없을 때
  const noSellers = state.kind === "empty" || (!!product && !realOffers.length);
  // 큰 가격: 지금 보기 조건의 1위. 없으면 서버가 정한 대표 가격
  const shownPrice = top?.price ?? product?.price ?? null;

  const reportCtx: ReportContext | null = product
    ? {
        title: product.title,
        url: typeof window !== "undefined" ? window.location.href : "",
        rows: (ranked?.list ?? [])
          .filter((r) => !r.offer.placeholder)
          .map((r) => ({ seller: r.offer.seller.key, price: !r.offer.available ? "품절" : r.offer.price !== null ? won(r.offer.price) : "가격 확인 필요" })),
        fetchedAt: stamp(product.fetchedAt),
      }
    : null;

  return (
    <div className="pd-page">
      <header className="pd-topbar">
        <Icon d={BACK} label="뒤로가기" onClick={back} />
        <span className="pd-topbar-space" />
        <Icon d={SHARE} label="공유" onClick={share} />
        <Icon d={STAR} label="관심상품" onClick={toggleFav} active={fav} />
      </header>
      <p className="pd-toast" aria-live="polite">
        {toast}
      </p>

      {/* 쿠팡 대가성 문구: 헤더 바로 아래, 모든 구매 버튼보다 위 (판매처 0곳 화면은 안내 상자 안 쿠팡 버튼 바로 위) */}
      {!noSellers && <CoupangDisclosure className="pd-disclosure" />}

      {state.kind === "loading" && (
        <main className="pd-main">
          <ShopLoading query={query} steps={LOADING_STEPS} />
        </main>
      )}
      {state.kind === "empty" && (
        <main className="pd-main">
          <NoSellers query={query} coupang={coupang} />
        </main>
      )}
      {state.kind === "error" && (
        <div className="pd-state" role="status">
          <p>지금은 상품 데이터를 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.</p>
          <small>오류 {state.code}</small>
        </div>
      )}

      {product && (
        <main className="pd-main">
          {noSellers && <NoSellers query={query} coupang={coupang} />}

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
            {shownPrice !== null && <strong className="pd-price-now">{won(shownPrice)}</strong>}
            {product.priceFromList && !top && <p className="pd-price-note">판매처에 따라 달라질 수 있어요</p>}
            {product.originalPrice && top && top.price === product.price && (
              <span className="pd-price-sub">
                <s>{won(product.originalPrice)}</s>
                {product.changePct ? <em className="pd-change">▼{product.changePct}%</em> : null}
              </span>
            )}
          </section>

          {realOffers.length > 0 && ranked && (
            <PriceCompareList offers={product.offers} list={ranked.list} view={view} onView={setView} hiddenUsed={ranked.hiddenUsed} fetchedAt={product.fetchedAt} />
          )}

          <button type="button" className="pd-report" onClick={() => setReport(true)} aria-haspopup="dialog">
            상품 정보 제보하기
          </button>

          <aside className="pd-notice">
            <ul>
              <li>Gollazyum은 상품 판매의 직접적인 당사자가 아니며, 모든 상거래의 책임은 구매자와 판매처에게 있습니다.</li>
            </ul>
          </aside>
        </main>
      )}

      {/* 하단 바는 판매처가 0곳이어도, 데이터를 못 찾았어도 항상 보인다 */}
      {state.kind !== "loading" && <BuyBar top={buyTop} coupang={coupang} />}
      {report && reportCtx && <ReportSheet ctx={reportCtx} onClose={() => setReport(false)} />}
    </div>
  );
}

// 판매처 0곳 화면의 쿠팡 버튼 문구. 검색결과 딥링크일 때만 '검색결과'라고 쓴다
const zeroLabel = (cp: CoupangLink) => (cp.type === "search" ? "쿠팡 검색결과에서 가격 보기 ↗" : coupangLinkLabel(cp));

// 판매처 0곳 안내: 제목 → 검색어가 채워진 입력창과 '다시 찾기' → 쿠팡 파트너스 고지 → 쿠팡 검색결과 버튼
function NoSellers({ query, coupang }: { query: string; coupang: CoupangLink }) {
  return (
    <section className="pd-zero" aria-labelledby="pd-zero-title">
      <h2 id="pd-zero-title">아직 스토어별 가격을 못 찾았어요</h2>
      <form className="pd-zero-form" action="/shop/product" method="get" role="search">
        <input name="q" type="search" defaultValue={query} maxLength={100} aria-label="상품 이름" required />
        <button type="submit">다시 찾기</button>
      </form>
      <LinkPasteHint />
      <CoupangDisclosure className="pd-disclosure" />
      <a className="pd-zero-cp" href={coupang.url} {...COUPANG_LINK_ATTRS} aria-label={`${zeroLabel(coupang).replace(/ ↗$/, "")}, 새 탭에서 열려요`}>
        {zeroLabel(coupang)}
      </a>
    </section>
  );
}

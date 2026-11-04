"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { errorCode } from "@/lib/apiError";
import { filterItems, itemKey, LINK_PASTE_HINT, looksLikeUrl, mainOnly, sortItems } from "@/lib/shop-results";
import { detailHref, won, type SearchItem, type SearchResponse } from "@/lib/shopping";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { DesktopResults } from "./DesktopResults";
import { addRecent } from "@/lib/shop-recent";
import { LinkPasteHint } from "./LinkPasteHint";
import { ShopLoading } from "./ShopLoading";
import { ShopQueryInput } from "./ShopQueryInput";
import { DEFAULT_MOBILE_FILTER, MobileFilters, type MobileFilter } from "./MobileFilters";

type State =
  | { kind: "loading" }
  | { kind: "link" }
  | { kind: "error"; code: string }
  | { kind: "unrelated" }
  | { kind: "ok"; items: SearchItem[]; sample: boolean };

// 검색어별 결과와, 상품을 누를 때의 스크롤 위치·필터. 뒤로 오면 목록을 다시 불러오지 않고 그대로 되살린다
const RESULTS_KEY = (q: string) => `gollazyum:shop-results:${q}`;
const VIEW_KEY = "gollazyum:shop-list-view";
const CACHE_MS = 30 * 60 * 1000;
const HIGHLIGHT_MS = 2500;
const memory = new Map<string, { items: SearchItem[]; sample: boolean; at: number }>();

type View = { q: string; y: number; key: string; filter: MobileFilter; at: number };

function readJson<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function writeJson(key: string, v: unknown) {
  try {
    sessionStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* 저장 공간이 없거나 막힌 경우: 캐시 없이 동작 */
  }
}

function cachedResults(q: string) {
  const hit = memory.get(q) ?? readJson<{ items: SearchItem[]; sample: boolean; at: number }>(RESULTS_KEY(q));
  return hit && Array.isArray(hit.items) && Date.now() - hit.at < CACHE_MS ? hit : null;
}

// 이 화면이 뒤로/앞으로 가기로 열렸는지
function isBackForward(): boolean {
  try {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    return nav?.type === "back_forward";
  } catch {
    return false;
  }
}

// 상품 검색 목록. 여기서는 스토어별 가격을 부르지 않고, 상품을 고르면 그 상품만 상세 조회한다
export function ProductResults({ query }: { query: string }) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [filter, setFilter] = useState<MobileFilter>(DEFAULT_MOBILE_FILTER);
  const [recent, setRecent] = useState("");
  const restore = useRef<View | null>(null);
  // PC(1024px 이상)만 그리드 화면. 모바일·태블릿은 아래 목록. 정렬·필터 칩은 640px 이하에서만
  const desktop = useMediaQuery("(min-width: 1024px)");
  const phone = useMediaQuery("(max-width: 640px)");

  // 첫 그리기 전에 캐시를 읽어 목록을 바로 되살린다 (뒤로 오면 다시 부르지 않는다)
  useLayoutEffect(() => {
    if (looksLikeUrl(query)) return setState({ kind: "link" });
    addRecent(query);
    const view = readJson<View>(VIEW_KEY);
    if (view && view.q === query && isBackForward() && Date.now() - view.at < CACHE_MS) {
      restore.current = view;
      setFilter({ ...DEFAULT_MOBILE_FILTER, ...view.filter });
    }
    const hit = cachedResults(query);
    if (hit) return setState({ kind: "ok", items: hit.items, sample: hit.sample });

    const ctrl = new AbortController();
    fetch(`/api/shopping?q=${encodeURIComponent(query)}`, { signal: ctrl.signal })
      .then(async (res) => {
        if (!res.ok) return setState({ kind: "error", code: await errorCode(res) });
        const data = (await res.json()) as SearchResponse;
        if (data.unrelated) return setState({ kind: "unrelated" });
        const entry = { items: data.items ?? [], sample: !!data.sample, at: Date.now() };
        if (entry.items.length) {
          memory.set(query, entry);
          writeJson(RESULTS_KEY(query), entry);
        }
        setState({ kind: "ok", items: entry.items, sample: entry.sample });
      })
      .catch((e) => e.name !== "AbortError" && setState({ kind: "error", code: "network" }));
    return () => ctrl.abort();
  }, [query]);

  // 목록이 그려진 뒤 보던 위치로 스크롤하고, 방금 본 상품 카드를 잠깐 표시한다
  useLayoutEffect(() => {
    const view = restore.current;
    if (state.kind !== "ok" || !view) return;
    restore.current = null;
    setRecent(view.key);
    // 화면 폭 판단(PC·모바일)이 반영된 다음 프레임에 바로 스크롤한다 (사이트 기본 부드러운 스크롤은 쓰지 않는다)
    const id = requestAnimationFrame(() => window.scrollTo({ top: view.y, behavior: "instant" }));
    return () => cancelAnimationFrame(id);
  }, [state]);

  // 뒤로 가기 캐시(bfcache)로 화면이 그대로 돌아온 경우에도 방금 본 카드를 표시한다
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      const view = readJson<View>(VIEW_KEY);
      if (e.persisted && view?.q === query) setRecent(view.key);
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, [query]);

  useEffect(() => {
    if (!recent) return;
    const t = setTimeout(() => setRecent(""), HIGHLIGHT_MS);
    return () => clearTimeout(t);
  }, [recent]);

  // 상품을 누르는 순간 스크롤 위치·필터를 저장한다
  function onPick(e: React.MouseEvent) {
    const a = (e.target as HTMLElement).closest<HTMLAnchorElement>("a[data-key]");
    if (!a) return;
    writeJson(VIEW_KEY, { q: query, y: window.scrollY, key: a.dataset.key ?? "", filter, at: Date.now() } satisfies View);
  }

  const items = state.kind === "ok" ? state.items : [];
  const usePhoneFilter = phone && !desktop;
  // '본품만'을 켜면 가격대·판매처 칩의 개수도 남은 상품 기준으로 센다
  const base = useMemo(() => (usePhoneFilter && filter.main ? mainOnly(items, query) : items), [items, usePhoneFilter, filter.main, query]);
  const shown = useMemo(
    () => (usePhoneFilter ? sortItems(filterItems(base, filter.bands, filter.sellers), filter.sort) : items),
    [items, base, usePhoneFilter, filter],
  );
  const filtered = usePhoneFilter && (filter.main || filter.bands.length > 0 || filter.sellers.length > 0);

  function back() {
    if (window.history.length > 1) window.history.back();
    else window.location.href = "/shop";
  }

  return (
    <div className="pd-page sr-page">
      <header className="pd-topbar">
        <button type="button" className="pd-icon-btn" aria-label="뒤로가기" onClick={back}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <form className="sr-search" action="/shop/product" method="get" role="search">
          <ShopQueryInput defaultValue={looksLikeUrl(query) ? "" : query} placeholder="상품 이름을 넣어 주세요" />
        </form>
      </header>
      <LinkPasteHint className="sr-link-hint" />
      {state.kind === "ok" && state.items.length > 0 && usePhoneFilter && <MobileFilters items={base} value={filter} onChange={setFilter} />}

      <main className="pd-main" onClick={onPick}>
        {state.kind === "loading" && <ShopLoading query={query} steps={["상품을 찾고 있어요", "비슷한 상품을 모으고 있어요"]} rows={5} />}
        {state.kind === "link" && (
          <div className="pd-state">
            <p>{LINK_PASTE_HINT}</p>
            <a className="pd-state-link" href="/shop">
              상품 이름으로 찾기
            </a>
          </div>
        )}
        {state.kind === "error" && (
          <div className="pd-state">
            <p>지금은 상품 데이터를 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.</p>
            <small>오류 {state.code}</small>
          </div>
        )}
        {state.kind === "ok" && !state.items.length && (
          <div className="pd-state" role="status">
            <p>“{query}” 상품 데이터를 찾지 못했어요. 상품명을 조금 다르게 입력해 보세요.</p>
          </div>
        )}
        {state.kind === "unrelated" && (
          <div className="pd-state" role="status">
            <p>
              <strong>비슷한 상품을 못 찾았어요</strong>
            </p>
            <p>“{query}”와 맞는 상품이 없어요. 상품 이름이나 모델명을 조금 다르게 넣어 보세요.</p>
          </div>
        )}
        {state.kind === "ok" && state.items.length > 0 && desktop && (
          <DesktopResults query={query} items={state.items} sample={state.sample} recentKey={recent} />
        )}
        {state.kind === "ok" && state.items.length > 0 && !desktop && (
          <>
            <div className="sr-head">
              {/* 결과 개수는 제목. 필터로 개수가 바뀌면 낭독기가 읽는다 (보이는 모양은 그대로) */}
              <h2 className="sr-count" role="status" aria-live="polite">
                “{query}” 상품 {shown.length}개{filtered && ` (전체 ${state.items.length}개 중)`}
              </h2>
              <span> · 상품을 누르면 스토어별 가격을 보여 드려요</span>
              {state.sample && <span className="pd-sample">개발용 예시 데이터</span>}
            </div>
            {shown.length === 0 ? (
              <div className="srd-empty sr-empty">
                <p>선택한 조건에 맞는 상품이 없어요</p>
                <button type="button" className="mf-chip" onClick={() => setFilter({ ...filter, bands: [], sellers: [], main: false })}>
                  필터 끄기
                </button>
              </div>
            ) : (
              <ul className="sr-list">
                {shown.map((item) => (
                  <li key={itemKey(item)}>
                    <a className={`sr-item${recent === itemKey(item) ? " sr-recent" : ""}`} href={detailHref(query, item)} data-key={itemKey(item)}>
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
                          {item.used && <span className="sr-used">중고</span>}
                        </span>
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </main>
    </div>
  );
}

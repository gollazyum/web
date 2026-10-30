"use client";

import { useEffect, useRef, useState } from "react";
import { ChatBox } from "@/components/ChatBox";
import { FlightSearch } from "@/components/FlightSearch";
import { HotelSearch } from "@/components/HotelSearch";
import { LowbotiBot } from "@/components/LowbotiBot";
import { SCAN_FIRST_MS, SCAN_REPEAT_MS, ScanProgress } from "@/components/ScanProgress";
import { AFFILIATE_CID, HOTEL_PROMOCODES, groupOrder, hotelNameFromUrl, parseAgodaUrl, routes, sampleLinks, withCid } from "@/lib/agoda";
import { site } from "@/lib/site";
import { SoonBadge } from "@/components/SoonBadge";

type Result =
  | { kind: "loading"; url: URL; ms: number }
  | { kind: "ok"; url: URL }
  | { kind: "notAgoda" }
  | { kind: "invalid" };

export type TabId = "stay" | "ask" | "flight" | "shop";

// 다른 섹션(패밀리 카드 등)에서 검색창 탭을 바꿀 때 쓰는 이벤트
export const TAB_EVENT = "lowboti:tab";

// 검색창의 해당 탭으로 바꾸고 첫 화면으로 올라간다
export function openSearchTab(tab: TabId) {
  window.dispatchEvent(new CustomEvent(TAB_EVENT, { detail: tab }));
  document.getElementById("top")?.scrollIntoView({ behavior: "smooth" });
}

const tabs: { id: TabId; label: string; short: string; img: string; live: boolean; ai?: boolean; soon?: string }[] = [
  { id: "stay", label: "숙소", short: "숙소", img: "hotel", live: true },
  { id: "flight", label: "항공권", short: "항공권", img: "flight", live: true },
  { id: "shop", label: "Lifestyle·eSIM", short: "Lifestyle", img: "shop", live: false, soon: "여행 준비물과 eSIM 데이터를 연결하는 Lifestyle 서비스를 준비하고 있어요." },
  { id: "ask", label: "Gollazyum AI", short: "AI", img: "mark", live: true, ai: true },
];

export function LinkChecker() {
  const [tab, setTab] = useState<TabId>("stay");
  const [stayMode, setStayMode] = useState<"search" | "link">("search");
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  // 버튼 글자는 첫 HTML에 바로 넣고, 날짜가 들어간 주소는 누를 때 만든다
  const samples = sampleLinks();

  useEffect(() => {
    // 다른 페이지의 메뉴에서 /?tab=flight 처럼 들어오면 그 탭을 연다
    const fromUrl = new URLSearchParams(window.location.search).get("tab");
    if (tabs.some((t) => t.id === fromUrl)) setTab(fromUrl as TabId);
    const onTab = (e: Event) => setTab((e as CustomEvent<TabId>).detail);
    window.addEventListener(TAB_EVENT, onTab);
    return () => window.removeEventListener(TAB_EVENT, onTab);
  }, []);

  // 분석 중 화면을 잠깐 보여준 뒤 결과로 바꾼다
  useEffect(() => {
    if (result?.kind !== "loading") return;
    const t = setTimeout(() => setResult({ kind: "ok", url: result.url }), result.ms);
    return () => clearTimeout(t);
  }, [result]);

  // 같은 방문에서 두 번째 검색부터는 스캔을 짧게
  const scans = useRef(0);
  const scanMs = () => (scans.current++ === 0 ? SCAN_FIRST_MS : SCAN_REPEAT_MS);

  function trySample(sample: string) {
    setUrl(sample);
    setResult({ kind: "loading", url: new URL(sample), ms: scanMs() });
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^https?:\/\//i.test(url.trim())) {
      setResult({ kind: "invalid" });
      return;
    }
    const agoda = parseAgodaUrl(url);
    setResult(agoda ? { kind: "loading", url: agoda, ms: scanMs() } : { kind: "notAgoda" });
  }

  const current = tabs.find((t) => t.id === tab)!;

  return (
    <div className="search">
      <div className="search-tabs" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`search-tab${tab === t.id ? " active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={t.img === "mark" ? "/brand/lowboti-mark.svg" : `/brand/family/${t.img}.svg`} alt="" />
            <span className="tab-label">{t.label}</span>
            <span className="tab-label-short">{t.short}</span>
            {t.ai && <span className="soon ai">AI</span>}
            {!t.live && <span className="soon">준비 중</span>}
          </button>
        ))}
      </div>

      {tab === "stay" && (
        <div className="stay-modes" role="group" aria-label="숙소 찾는 방법">
          <button type="button" className={stayMode === "search" ? "active" : undefined} onClick={() => setStayMode("search")}>
            도시·호텔 탐색
          </button>
          <button type="button" className={stayMode === "link" ? "active" : undefined} onClick={() => setStayMode("link")}>
            아고다 링크 {routes.length}개 경로
          </button>
        </div>
      )}

      <div className="search-glow">
        <div key={tab} className="tab-panel">
        {tab === "ask" ? (
          <ChatBox />
        ) : tab === "flight" ? (
          <FlightSearch />
        ) : tab === "stay" && stayMode === "search" ? (
          <HotelSearch />
        ) : current.live ? (
          <form onSubmit={onSubmit} className="search-card stay-card">
            <label className="field field-url">
              <span>아고다 호텔 링크</span>
              <input
                type="url"
                inputMode="url"
                placeholder="아고다에서 보던 호텔 페이지 주소를 붙여넣으세요"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
              />
            </label>
            <button type="submit">할인 경로 탐색</button>
          </form>
        ) : (
          <div className="search-card search-soon">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/brand/family/${current.img}.svg`} alt="" />
            <div>
              <strong>{current.label}, 곧 열려요</strong>
              <p>{current.soon}</p>
            </div>
            {site.notifyUrl ? (
              <a className="notify-btn" href={site.notifyUrl} target="_blank" rel="noopener noreferrer">
                🔔 오픈 알림 받기
              </a>
            ) : (
              <SoonBadge />
            )}
          </div>
        )}
        </div>
      </div>

      {tab === "stay" && stayMode === "link" && !result && (
        <div className="quick-try">
          <span>링크가 없으신가요?</span>
          {samples.map((s, i) => (
            <button key={s.label} type="button" onClick={() => trySample(sampleLinks()[i].url)}>
              🔥 {s.label}
            </button>
          ))}
        </div>
      )}

      {tab === "stay" && stayMode === "link" && result && (
        <div className={`search-result${result.kind === "ok" || result.kind === "loading" ? " ok" : ""}`} role="status">
          {result.kind === "loading" && (
            <ScanProgress
              ms={result.ms}
              morphTo="hotel"
              steps={[
                { text: "호텔 정보와 날짜·인원 조건 읽는 중...", at: 0 },
                { text: `검색엔진·카드사·항공사 ${routes.length}개 경로 링크 만드는 중...`, at: 0.31 },
                { text: "경로별로 정리 완료!", at: 0.69 },
              ]}
            />
          )}
          {result.kind === "ok" && <RouteList url={result.url} />}
          {result.kind === "notAgoda" && <SadNote>지금은 아고다 호텔 링크만 바꿀 수 있어요. agoda.com 호텔 페이지 주소를 넣어 주세요.</SadNote>}
          {result.kind === "invalid" && <SadNote>https:// 로 시작하는 아고다 호텔 페이지 주소를 넣어 주세요.</SadNote>}
        </div>
      )}
    </div>
  );
}

// 링크를 못 바꿨을 때: 시무룩한 로보티
function SadNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="result-sad lb-st-sad">
      <div className="result-bot" aria-hidden="true">
        <div className="lb-act">
          <LowbotiBot fx={false} />
        </div>
      </div>
      <span>{children}</span>
    </div>
  );
}

// 결과가 뜨는 순간: 깡충 뛰며 렌즈가 커지고 반짝
function FoundBot() {
  const actRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setZoom(false), 1400);
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) actRef.current?.classList.add("lb-hop");
    return () => clearTimeout(t);
  }, []);
  return (
    <div className={`result-bot found${zoom ? " lb-st-zoom" : ""}`} aria-hidden="true">
      <div className="lb-breathe">
        <div ref={actRef} className="lb-act" onAnimationEnd={(e) => e.target === e.currentTarget && e.currentTarget.classList.remove("lb-hop")}>
          <LowbotiBot kind="hotel" />
        </div>
      </div>
    </div>
  );
}

function RouteList({ url }: { url: URL }) {
  const name = hotelNameFromUrl(url);
  // 열어 본 경로는 표시해서 어디까지 비교했는지 알 수 있게 한다
  const [opened, setOpened] = useState<Set<string>>(new Set());
  const markOpened = (cid: string) => setOpened((prev) => new Set(prev).add(cid));
  const [copied, setCopied] = useState<string | null>(null);
  let order = 0; // 경로 카드가 차례로 나타나게
  return (
    <div className="route-reveal">
      <div className="result-head">
        <FoundBot />
        <div className="result-head-text">
          <strong>{name ? `${name} 링크를 ${routes.length}개 경로로 바꿨어요` : `링크를 ${routes.length}개 경로로 바꿨어요`}</strong>
          <span>같은 호텔·날짜·인원 기준</span>
        </div>
      </div>

      {AFFILIATE_CID && (
        <a className="route-best" href={withCid(url, AFFILIATE_CID)} target="_blank" rel="noopener noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/lowboti-mark.svg" alt="" />
          <span>
            <strong>Gollazyum 제휴 링크</strong>
            <small>먼저 이 링크로 가격을 확인해 보세요</small>
          </span>
          <b>가격 보기 ↗</b>
        </a>
      )}

      {HOTEL_PROMOCODES.length > 0 && (
        <div className="promo">
          <span>
            <strong>Gollazyum 프로모코드</strong>
            <small>아고다 결제 화면의 프로모션 코드 칸에 넣어 보세요. 적용 여부와 할인은 아고다 조건에 따라 달라요.</small>
          </span>
          <div className="promo-codes">
            {HOTEL_PROMOCODES.map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(code).catch(() => {});
                  setCopied(code);
                }}
              >
                {code} <em>{copied === code ? "복사됨 ✓" : "복사"}</em>
              </button>
            ))}
          </div>
        </div>
      )}

      {groupOrder.map((group) => {
        const items = routes.filter((r) => r.group === group);
        if (!items.length) return null;
        return (
          <div key={group} className="route-group">
            <p className="route-group-title">{group}</p>
            <div className="route-grid">
              {items.map((r) => (
                <a
                  key={r.cid + r.name}
                  style={{ "--i": order++ } as React.CSSProperties}
                  href={withCid(url, r.cid)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={opened.has(r.cid) ? "opened" : undefined}
                  onClick={() => markOpened(r.cid)}
                >
                  <span>{r.name}</span>
                  <b>{opened.has(r.cid) ? "확인함 ✓" : "가격 보기 ↗"}</b>
                </a>
              ))}
            </div>
          </div>
        );
      })}

      <p className="result-note">
        아고다는 들어온 경로에 따라 같은 방도 가격이 달라질 수 있어요. 링크를 새 탭으로 열어 결제 직전 총액을 확인해 보세요.
        가격과 예약은 아고다에서 확인·진행돼요.
        {AFFILIATE_CID && " Gollazyum 제휴 링크로 예약하면 Gollazyum이 수수료를 받을 수 있어요."}
        {site.instagramUrl && (
          <>
            {" "}
            <a href={site.instagramUrl} target="_blank" rel="noopener noreferrer">
              소식 받기
            </a>
          </>
        )}
      </p>
    </div>
  );
}

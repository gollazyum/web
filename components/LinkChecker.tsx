"use client";

import { useEffect, useState } from "react";
import { ChatBox } from "@/components/ChatBox";
import { FlightSearch } from "@/components/FlightSearch";
import { AFFILIATE_CID, HOTEL_PROMOCODES, groupOrder, hotelNameFromUrl, parseAgodaUrl, routes, withCid } from "@/lib/agoda";
import { site } from "@/lib/site";

type Result =
  | { kind: "loading"; url: URL }
  | { kind: "ok"; url: URL }
  | { kind: "notAgoda" }
  | { kind: "invalid" };

type TabId = "stay" | "ask" | "flight" | "shop";

const tabs: { id: TabId; label: string; short: string; img: string; live: boolean; ai?: boolean; soon?: string }[] = [
  { id: "stay", label: "숙소", short: "숙소", img: "hotel", live: true },
  { id: "flight", label: "항공권", short: "항공권", img: "flight", live: true },
  { id: "shop", label: "쇼핑·유심", short: "쇼핑·유심", img: "shop", live: false, soon: "쇼핑봇이 여행 준비물과 유심 최저가 비교를 준비하고 있어요." },
  { id: "ask", label: "로보티에게 물어보기", short: "물어보기", img: "mark", live: true, ai: true },
];

export function LinkChecker() {
  const [tab, setTab] = useState<TabId>("stay");
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  // 분석 중 화면을 잠깐 보여준 뒤 결과로 바꾼다
  useEffect(() => {
    if (result?.kind !== "loading") return;
    const t = setTimeout(() => setResult({ kind: "ok", url: result.url }), 1000);
    return () => clearTimeout(t);
  }, [result]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^https?:\/\//i.test(url.trim())) {
      setResult({ kind: "invalid" });
      return;
    }
    const agoda = parseAgodaUrl(url);
    setResult(agoda ? { kind: "loading", url: agoda } : { kind: "notAgoda" });
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
            {!t.live && <span className="soon">곧 오픈</span>}
          </button>
        ))}
      </div>

      <div className="search-glow">
        {tab === "ask" ? (
          <ChatBox />
        ) : tab === "flight" ? (
          <FlightSearch />
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
            <button type="submit">최저가 경로 찾기</button>
          </form>
        ) : (
          <div className="search-card search-soon">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/brand/family/${current.img}.svg`} alt="" />
            <div>
              <strong>{current.label} 비교, 곧 열려요</strong>
              <p>{current.soon}</p>
            </div>
            <span className="badge">준비 중</span>
          </div>
        )}
      </div>

      {tab === "stay" && result && (
        <div className={`search-result${result.kind === "ok" || result.kind === "loading" ? " ok" : ""}`} role="status">
          {result.kind === "loading" && (
            <>
              <div className="result-head">
                <strong className="analyzing">
                  <span className="dot" /> 로보티가 {routes.length}개 경로로 링크를 바꾸고 있어요
                </strong>
                <span className="badge live">경로 스캔</span>
              </div>
              <ul className="result-sites">
                {[0, 1, 2, 3].map((i) => (
                  <li key={i}>
                    <span className="skeleton" style={{ width: 120 }} />
                    <span className="skeleton" style={{ width: 80 }} />
                  </li>
                ))}
              </ul>
            </>
          )}
          {result.kind === "ok" && <RouteList url={result.url} />}
          {result.kind === "notAgoda" && <span>지금은 아고다 호텔 링크만 바꿀 수 있어요. agoda.com 호텔 페이지 주소를 넣어 주세요.</span>}
          {result.kind === "invalid" && <span>https:// 로 시작하는 아고다 호텔 페이지 주소를 넣어 주세요.</span>}
        </div>
      )}
    </div>
  );
}

function RouteList({ url }: { url: URL }) {
  const name = hotelNameFromUrl(url);
  // 열어 본 경로는 표시해서 어디까지 비교했는지 알 수 있게 한다
  const [opened, setOpened] = useState<Set<string>>(new Set());
  const markOpened = (cid: string) => setOpened((prev) => new Set(prev).add(cid));
  const [copied, setCopied] = useState<string | null>(null);
  return (
    <>
      <div className="result-head">
        <strong>{name ? `${name} 링크를 ${routes.length}개 경로로 바꿨어요` : `링크를 ${routes.length}개 경로로 바꿨어요`}</strong>
        <span>같은 호텔·날짜·인원 기준</span>
      </div>

      {AFFILIATE_CID && (
        <a className="route-best" href={withCid(url, AFFILIATE_CID)} target="_blank" rel="noopener noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/lowboti-mark.svg" alt="" />
          <span>
            <strong>로보티 추천 링크</strong>
            <small>먼저 이 링크로 가격을 확인해 보세요</small>
          </span>
          <b>가격 보기 ↗</b>
        </a>
      )}

      {HOTEL_PROMOCODES.length > 0 && (
        <div className="promo">
          <span>
            <strong>로보티 프로모코드</strong>
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
        아고다는 들어온 경로에 따라 같은 방도 가격이 달라질 수 있어요. 링크를 새 탭으로 열어 결제 직전 총액을 비교해 보세요.
        가격과 예약은 아고다에서 확인·진행돼요.
        {AFFILIATE_CID && " 로보티 추천 링크는 제휴 링크라 예약 시 로보티가 수수료를 받을 수 있어요."}
        {site.instagramUrl && (
          <>
            {" "}
            <a href={site.instagramUrl} target="_blank" rel="noopener noreferrer">
              소식 받기
            </a>
          </>
        )}
      </p>
    </>
  );
}

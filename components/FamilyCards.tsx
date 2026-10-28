"use client";

import { openSearchTab, type TabId } from "@/components/LinkChecker";
import { LowbotiBot, type BotKind } from "@/components/LowbotiBot";
import { site } from "@/lib/site";

const family: { img: BotKind; tab: TabId; name: string; en: string; body: string; live: boolean }[] = [
  { img: "hotel", tab: "stay", name: "숙소봇", en: "Stay", body: "도시나 호텔 이름만 넣으면 예약 사이트별 가격을 한 번에 비교해요.", live: true },
  { img: "flight", tab: "flight", name: "항공봇", en: "Flight", body: "출발지와 날짜만 넣으면 항공권 최저가를 찾아드려요.", live: true },
  { img: "shop", tab: "shop", name: "쇼핑봇", en: "Shop", body: "여행 준비물과 유심도 최저가로 찾아드려요.", live: false },
];

export function FamilyCards() {
  return (
    <div className="family">
      {family.map((f) => (
        <div key={f.name} className={`family-card family-${f.img}`}>
          <div className="family-bot lb-breathe" aria-hidden="true">
            <LowbotiBot kind={f.img} fx={false} />
          </div>
          <h3>
            {f.name} <span>{f.en}</span>
          </h3>
          <p>{f.body}</p>
          {f.live ? (
            <button type="button" className="family-go" onClick={() => openSearchTab(f.tab)}>
              지금 써 보기 →
            </button>
          ) : site.notifyUrl ? (
            <a className="notify-btn" href={site.notifyUrl} target="_blank" rel="noopener noreferrer">
              🔔 오픈 알림 받기
            </a>
          ) : (
            <span className="badge">준비 중</span>
          )}
        </div>
      ))}
    </div>
  );
}

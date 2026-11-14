"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { HotelOption } from "@/lib/hotels";
import { man, nightsOf, stayTotal, won, type StayQuery } from "@/lib/trip";
import { StayMap } from "./StayMap";
import { Mascot } from "./Mascot";
import { IconChat, IconHeart, IconList, IconMap, IconOut } from "./icons";

export type StayData = { query: StayQuery; options: HotelOption[]; picks: string[] };
// 대화의 '지도'·'모두 보기' 버튼이 보낸 요청. n이 바뀔 때마다 그 보기로 바꾼다
export type BrowseFocus = { view: "list" | "map"; token: string | null; n: number };

type Props = {
  data: StayData;
  saved: Set<string>;
  focus?: BrowseFocus;
  onSave: (h: HotelOption) => void;
  onOpen: (h: HotelOption) => void; // 예약처별 총액 시트 열기
  onClose?: () => void; // 휴대폰 시트일 때만
};

const AMENITY_CHIPS: { label: string; test: RegExp }[] = [
  { label: "조식", test: /조식|아침/ },
  { label: "수영장", test: /수영장/ },
  { label: "온천·대욕장", test: /온천|대욕장|사우나/ },
  { label: "무료 취소", test: /무료 취소/ },
];

type Sort = "ai" | "price" | "rating";

// 찾은 숙소 전체를 목록/지도로 (v5 04·06). 휴대폰에서는 전체 화면, PC에서는 오른쪽 패널에 그대로 놓인다
export function StayBrowser({ data, saved, focus, onSave, onOpen, onClose }: Props) {
  const { query, options, picks } = data;
  const nights = nightsOf(query);
  const [view, setView] = useState<"list" | "map">(focus?.view ?? "map");
  const [sort, setSort] = useState<Sort>("ai");
  const [budgetOn, setBudgetOn] = useState(query.budget > 0);
  const [chips, setChips] = useState<Set<string>>(new Set());
  const [goodOnly, setGoodOnly] = useState(false);
  const [active, setActive] = useState<string | null>(focus?.token ?? picks[0] ?? null);
  const pickSet = useMemo(() => new Set(picks), [picks]);
  const cards = useRef<Map<string, HTMLElement>>(new Map());

  useEffect(() => {
    if (!focus?.n) return;
    setView(focus.view);
    if (focus.token) setActive(focus.token);
  }, [focus?.n]); // eslint-disable-line react-hooks/exhaustive-deps

  // 핀을 누르면 아래 카드 줄도 그 숙소로 넘긴다
  useEffect(() => {
    if (view === "map" && active) cards.current.get(active)?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [active, view]);

  const available = AMENITY_CHIPS.filter((c) => options.some((h) => h.amenities.some((a) => c.test.test(a))));

  const shown = useMemo(() => {
    const cost = (h: HotelOption) => stayTotal(h, nights)?.value ?? Infinity;
    let list = options.filter((h) => {
      if (budgetOn && query.budget && cost(h) > query.budget) return false;
      if (goodOnly && (h.rating ?? 0) < 4) return false;
      for (const c of available) if (chips.has(c.label) && !h.amenities.some((a) => c.test.test(a))) return false;
      return true;
    });
    if (sort === "price") list = [...list].sort((a, b) => cost(a) - cost(b));
    else if (sort === "rating") list = [...list].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    else list = [...list].sort((a, b) => Number(pickSet.has(b.token)) - Number(pickSet.has(a.token)) || picks.indexOf(a.token) - picks.indexOf(b.token));
    return list;
  }, [options, budgetOn, goodOnly, chips, sort, nights, query.budget, available, pickSet, picks]);

  const onMap = shown.filter((h) => h.gps);
  const activeHotel = onMap.find((h) => h.token === active) ?? onMap[0] ?? null;
  const pickedOnMap = onMap.filter((h) => pickSet.has(h.token)).length;
  const toggle = (label: string) =>
    setChips((s) => {
      const n = new Set(s);
      if (n.has(label)) n.delete(label);
      else n.add(label);
      return n;
    });

  return (
    <div className="tb-browser">
      <div className="tb-browser-top">
        {onClose && (
          <button type="button" className="tb-round" onClick={onClose} aria-label="대화로 돌아가기">
            <IconChat size={22} />
          </button>
        )}
        <div className="tb-browser-title">
          <strong>
            {query.place} 숙소 {shown.length}곳
          </strong>
          <span>
            {query.checkIn.slice(5).replace("-", "/")}–{query.checkOut.slice(5).replace("-", "/")} · {query.adults}명 · {nights}박 총액
          </span>
        </div>
        <div className="tb-seg" role="group" aria-label="보기 방식">
          <button type="button" aria-pressed={view === "list"} onClick={() => setView("list")} aria-label="목록">
            <IconList size={18} />
          </button>
          <button type="button" aria-pressed={view === "map"} onClick={() => setView("map")} aria-label="지도">
            <IconMap size={18} />
          </button>
        </div>
      </div>
      <div className="tb-chips scroll">
        {query.budget > 0 && (
          <button type="button" className="tb-chip" aria-pressed={budgetOn} onClick={() => setBudgetOn((v) => !v)}>
            {nights}박 {man(query.budget)} 원 아래
          </button>
        )}
        {available.map((c) => (
          <button key={c.label} type="button" className="tb-chip" aria-pressed={chips.has(c.label)} onClick={() => toggle(c.label)}>
            {c.label}
          </button>
        ))}
        <button type="button" className="tb-chip" aria-pressed={goodOnly} onClick={() => setGoodOnly((v) => !v)}>
          후기 4점 이상
        </button>
        <select className="tb-chip tb-sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="정렬">
          <option value="ai">AI가 먼저 본 순</option>
          <option value="price">총액 낮은 순</option>
          <option value="rating">후기 점수 순</option>
        </select>
      </div>

      {view === "list" ? (
        <div className="tb-hlist">
          {shown.map((h) => (
            <HotelRow key={h.token} h={h} nights={nights} pick={pickSet.has(h.token)} saved={saved.has(h.token)} onOpen={() => onOpen(h)} />
          ))}
          {!shown.length && <p className="tb-note">조건에 맞는 숙소가 없어요. 위의 조건을 하나 풀어 보세요.</p>}
        </div>
      ) : (
        <div className="tb-mapbox">
          <div className="tb-mapwrap">
            <StayMap hotels={shown} nights={nights} picked={pickSet} saved={saved} active={activeHotel?.token ?? null} onPick={setActive} />
            {!onMap.length && <p className="tb-note tb-map-empty">위치 정보가 있는 숙소가 없어요.</p>}
          </div>
          {activeHotel && (
            <div className="tb-mapsheet">
              <div className="tb-mapsheet-head">
                <Mascot size={34} />
                <strong>
                  지도에 {pickedOnMap ? `${pickedOnMap}곳 + 비슷한 곳 ${onMap.length - pickedOnMap}곳` : `${onMap.length}곳`}
                </strong>
                {onClose && (
                  <button type="button" className="tb-btn soft" onClick={onClose}>
                    <IconChat size={18} /> 대화로
                  </button>
                )}
              </div>
              <div className="tb-carousel">
                {onMap.map((h) => {
                  const t = stayTotal(h, nights);
                  return (
                    <button
                      key={h.token}
                      ref={(el) => {
                        if (el) cards.current.set(h.token, el);
                        else cards.current.delete(h.token);
                      }}
                      type="button"
                      className={`tb-mcard${h.token === activeHotel.token ? " on" : ""}`}
                      onClick={() => setActive(h.token)}
                    >
                      {h.image ? <img src={h.image} alt="" loading="lazy" onError={(e) => (e.currentTarget.style.visibility = "hidden")} /> : <span className="tb-noimg" />}
                      <span className="tb-mcard-body">
                        <strong>{h.name}</strong>
                        <small>{[h.rating ? `★ ${h.rating.toFixed(1)}` : "", h.stars ? `${h.stars}성급` : h.kind, h.amenities[0] ?? ""].filter(Boolean).join(" · ")}</small>
                        <span>
                          {nights}박 <b>{t ? won(t.value) : "가격 확인"}</b>
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="tb-mapsheet-go">
                <button type="button" className="tb-btn soft" aria-pressed={saved.has(activeHotel.token)} onClick={() => onSave(activeHotel)}>
                  <IconHeart size={18} on={saved.has(activeHotel.token)} /> {saved.has(activeHotel.token) ? "담았어요" : "여행에 담기"}
                </button>
                <button type="button" className="tb-btn dark" onClick={() => onOpen(activeHotel)}>
                  예약 <IconOut />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function HotelRow({ h, nights, pick, saved, onOpen }: { h: HotelOption; nights: number; pick: boolean; saved: boolean; onOpen: () => void }) {
  const t = stayTotal(h, nights);
  return (
    <button type="button" className="tb-hrow" onClick={onOpen}>
      {h.image ? <img src={h.image} alt="" loading="lazy" /> : <span className="tb-noimg" />}
      <span className="tb-hrow-body">
        <span className="tb-hrow-name">
          {pick && <em className="tb-ai-dot">AI</em>}
          {h.name}
          {saved && (
            <span className="tb-heart" aria-label="담은 숙소">
              <IconHeart size={14} on />
            </span>
          )}
        </span>
        <span className="tb-hrow-meta">{[h.rating ? `★ ${h.rating.toFixed(1)}` : "", h.stars ? `${h.stars}성급` : h.kind, ...h.amenities.slice(0, 2)].filter(Boolean).join(" · ")}</span>
        <span className="tb-hrow-price">
          <small>
            {nights}박 총액{t?.approx ? "(어림)" : ""}
          </small>
          <strong>{t ? won(t.value) : "가격 확인"}</strong>
        </span>
      </span>
    </button>
  );
}

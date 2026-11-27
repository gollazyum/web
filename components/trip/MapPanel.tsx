"use client";

import { cityViewOf } from "@/lib/city-view";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import type { HotelOption } from "@/lib/hotels";
import { EMPTY_CHIPS, filterPins, lowestToken, MAP_BUDGETS, pinText, webglOk, type MapChips } from "@/lib/map-pins";
import { hasFreeCancel } from "@/lib/stay-filters";
import { nightsOf, won, type StayQuery } from "@/lib/trip";
import { shownPrice, usePriceVersion } from "./prices";
import { checkedText } from "@/lib/checked-at";
import { IconBack } from "./icons";
import { nearby } from "@/lib/landmarks";
import { manText, priceBrief, TRAVEL_NOTE, travelText, walkMin, zoneAverages } from "@/lib/map-decide";
import type { NearStation } from "./StayMap";
import { cityNear, haversine, VIBE_KEYS, VIBE_NOTE, VIBES, type VibeKey } from "@/data/neighborhoodVibes";

// 가격 핀 지도 화면 (휴대폰: 결과 위 전체 화면, PC: 오른쪽 패널).
// 지도 코드(mapbox-gl)는 이 화면을 실제로 띄울 때만 받는다. 토큰이 없거나 WebGL을 못 쓰면 지도 없이 안내만 보이고 목록으로 돌아가게 한다.
// 칩은 받은 목록 안에서만 거른다 (검색 다시 하지 않음)
const StayMap = dynamic(() => import("./StayMap"), { ssr: false, loading: () => <div className="tb-map-canvas tb-map-loading" aria-hidden /> });

const FAIL_TEXT: Record<string, string> = {
  "no-token": "까닭: 지도 키가 사이트에 설정되지 않았어요",
  webgl: "까닭: 이 브라우저에서 지도 그래픽(WebGL)을 쓸 수 없어요",
  rejected: "까닭: 지도 키가 이 주소에서 허용되지 않았어요",
  error: "까닭: 지도를 불러오지 못했어요",
};

// modal: PC 넓은 지도 창 (왼쪽 지도 72% + 오른쪽 선택 숙소·동네 분위기·거리). initial: 처음 골라 둘 숙소
// side: PC 결과 오른쪽 큰 지도 (목록+지도 · 지도만). 목록에서 거른 숙소를 그대로 받고, 핀을 누르면 작은 요약 카드만 띄운다 (유료 조회 0회).
// hover: 목록 행에 마우스를 올린 숙소 (그 핀을 강조). fitKey: 바뀌면(새 검색) 같은 지도에서 핀 전체를 다시 맞춘다.
// onArea: [이 지역에서 다시 검색] → 지금 지도 범위 안 숙소 token 목록 (검색은 다시 하지 않는다)
type Props = {
  query: StayQuery;
  options: HotelOption[];
  onOpen: (h: HotelOption) => void;
  onList: () => void;
  panel?: boolean;
  modal?: boolean;
  initial?: string | null;
  side?: boolean;
  hover?: string | null;
  fitKey?: string;
  onArea?: (tokens: string[]) => void;
  saved?: Set<string>;
  onSave?: (h: HotelOption) => void;
};

const NO_MATCH = "이번 검색 결과 중 이 동네 구역 안에 있는 숙소는 없어요";

export function MapPanel({ query, options, onOpen, onList, panel, modal, initial = null, side, hover = null, fitKey, onArea, saved, onSave }: Props) {
  usePriceVersion(); // 예약처에서 확인한 금액이 오면 핀 글자를 맞춘다
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim() ?? "";
  // 지도를 못 여는 까닭 (null이면 지도). 안내 아래에 한 줄로 보여 줘서 설정 문제인지 기기 문제인지 바로 알 수 있게 한다
  const [failed, setFailed] = useState<string | null>(() => (!token ? "no-token" : typeof document !== "undefined" && !webglOk() ? "webgl" : null));
  const [chips, setChips] = useState<MapChips>(EMPTY_CHIPS);
  const [sel, setSel] = useState<string | null>(initial);
  // 넓은 지도 창: ESC로 닫고, 뒤쪽 화면은 스크롤되지 않게
  const closeRef = useRef(onList);
  closeRef.current = onList;
  useEffect(() => {
    if (!modal) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current();
    window.addEventListener("keydown", key);
    // 스크롤을 막을 때 스크롤바 폭만큼 오른쪽을 채워 뒤 화면 폭이 바뀌지 않게 한다
    // (폭이 바뀌면 뒤 목록 카드가 다시 배치되며 새로 보인 카드의 가격 확인이 불릴 수 있다. 지도 창을 열고 닫을 때 추가 호출 0회)
    const html = document.documentElement;
    const prev = { overflow: html.style.overflow, pad: html.style.paddingRight };
    const bar = window.innerWidth - html.clientWidth;
    html.style.overflow = "hidden";
    if (bar > 0) html.style.paddingRight = `${bar}px`;
    return () => {
      window.removeEventListener("keydown", key);
      html.style.overflow = prev.overflow;
      html.style.paddingRight = prev.pad;
    };
  }, [modal]);
  const nights = nightsOf(query);

  const items = options.map((h) => {
    const p = shownPrice(h, query);
    return { h, token: h.token, gps: h.gps, rating: h.rating, stars: h.stars, fc: hasFreeCancel(h) || !!p.fc, price: p.none ? null : p.value, verified: p.verified, at: p.at };
  });
  const shown = filterPins(items, chips);
  // '가장 낮은 핀'은 예약처에서 확인한 총액끼리만 견준다 (예상 금액과 섞지 않는다)
  const low = lowestToken(shown.filter((x) => x.verified));
  const pick = shown.find((x) => x.token === sel) ?? null;
  // 동네 분위기: 숙소 좌표 가운데(중앙값)에서 15km 안에 있는 도시만. 칩을 눌러도 검색은 다시 하지 않는다
  const city = useMemo(() => {
    const g = items.map((x) => x.gps).filter((p): p is [number, number] => !!p && Number.isFinite(p[0]) && Number.isFinite(p[1]));
    if (!g.length) return null;
    const mid = (a: number[]) => a.sort((x, y) => x - y)[Math.floor(a.length / 2)];
    return cityNear([mid(g.map((p) => p[1])), mid(g.map((p) => p[0]))]);
  }, [items.map((x) => x.token).join()]); // eslint-disable-line react-hooks/exhaustive-deps
  const [vibeOn, setVibeOn] = useState(false); // 동네 분위기는 처음엔 꺼 둔다 (핀 가격이 먼저 보이게)
  const [vibePick, setVibePick] = useState<VibeKey | null>(null);
  const inPick = (gps: [number, number]) => !!city && city.zones.some((z) => z.vibe === vibePick && haversine([gps[1], gps[0]], z.center) <= z.radiusMeters);
  // 고른 분위기 구역 안에 숙소가 1곳 이상일 때만 구역 밖 핀을 흐리게. 0곳이면 핀은 그대로 두고 카메라만 그 구역으로 옮긴다
  const matched = !!city && vibeOn && !!vibePick ? shown.filter((x) => inPick(x.gps!)).length : 0;
  const noMatch = !!city && vibeOn && !!vibePick && matched === 0;
  const dimOn = !!city && vibeOn && !!vibePick && matched > 0;
  const focus = useMemo(() => {
    if (!noMatch || !city || !vibePick) return null;
    const zs = city.zones.filter((z) => z.vibe === vibePick);
    if (!zs.length) return null;
    // 구역 반경까지 들어오게 (위도 1도 ≈ 111km)
    const lngs = zs.flatMap((z) => { const d = z.radiusMeters / (111_000 * Math.cos((z.center[1] * Math.PI) / 180)); return [z.center[0] - d, z.center[0] + d]; });
    const lats = zs.flatMap((z) => { const d = z.radiusMeters / 111_000; return [z.center[1] - d, z.center[1] + d]; });
    return { key: `${city.id}:${vibePick}`, box: [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]] as [[number, number], [number, number]] };
  }, [noMatch, city?.id, vibePick]); // eslint-disable-line react-hooks/exhaustive-deps
  const pins = useMemo(
    // 핀 금액 = 목록 카드·오른쪽 상세와 같은 값(shownPrice: 허용 예약처 1위 N박 총액). 아직 확인 전이면 '예상'을 붙여 회색으로
    // 예약처 확인 전 금액은 '예상' 글자 없이 물결(~)만 붙인 회색 숫자 (오른쪽 아래 범례로 설명)
    () => shown.map((x) => ({ token: x.token, lat: x.gps![0], lng: x.gps![1], label: x.price !== null && !x.verified ? `~${pinText(x.price)}` : pinText(x.price), est: x.price !== null && !x.verified, low: x.token === low, on: x.token === sel || x.token === hover, name: x.h.name, dim: dimOn && !inPick(x.gps!) })),
    [shown.map((x) => `${x.token}:${x.price}:${x.verified}`).join(), low, sel, hover, dimOn, vibePick, city?.id], // eslint-disable-line react-hooks/exhaustive-deps
  );
  // 동네별 가격 수준: 이번 검색에서 예약처로 확인한 총액만 (예상 금액은 넣지 않는다). 구역 안 2곳 이상일 때만 평균
  const spots = items.map((x) => ({ token: x.token, gps: x.gps, price: x.verified ? x.price : null }));
  const spotSig = spots.map((x) => `${x.token}:${x.price}`).join();
  const avgs = useMemo(() => zoneAverages(city, spots), [city?.id, spotSig]); // eslint-disable-line react-hooks/exhaustive-deps
  const avgLabels = useMemo(() => Object.fromEntries([...avgs].map(([id, a]) => [id, manText(a.avg)])), [avgs]);
  const vibe = useMemo(() => ({ city, on: vibeOn, pick: vibePick, avg: avgLabels }), [city, vibeOn, vibePick, avgLabels]);
  const brief = pick ? priceBrief(city, spots.find((x) => x.token === pick.token) ?? null, spots) : null;
  const pickVibe = (k: VibeKey) => setVibePick((v) => (v === k ? null : k));
  // 도보 5·10분 원 (기본 켬). 끄면 원과 가장 가까운 역 줄을 함께 숨긴다
  const [walkOn, setWalkOn] = useState(true);
  const ring = walkOn ? (pick?.gps ?? null) : null;
  const [station, setStation] = useState<NearStation>(null);
  const stationLine = ring && station ? `🚇 가장 가까운 역: ${station.name} · 도보 약 ${walkMin(station.m)}분 (${Math.round(station.m)}m)` : null;
  const flip = (k: "freeCancel" | "rating45" | "stars4") => setChips((c) => ({ ...c, [k]: !c[k] }));
  const boundsRef = useRef<[number, number, number, number] | null>(null);

  const chipRow = (
    <div className="tb-map-chips" role="group" aria-label="지도 조건">
      <button type="button" className="tb-chip" aria-pressed={chips.freeCancel} onClick={() => flip("freeCancel")}>
        무료취소 확인됨
      </button>
      <button type="button" className="tb-chip" aria-pressed={chips.rating45} onClick={() => flip("rating45")}>
        평점 4.5+
      </button>
      <button type="button" className="tb-chip" aria-pressed={chips.stars4} onClick={() => flip("stars4")}>
        4성급 이상
      </button>
      {MAP_BUDGETS.map((b) => (
        <button key={b} type="button" className="tb-chip" aria-pressed={chips.budget === b} onClick={() => setChips((c) => ({ ...c, budget: c.budget === b ? 0 : b }))}>
          {b / 10000}만 원 아래
        </button>
      ))}
    </div>
  );
  const vibeBar = city && !failed && (
    <div className="tb-vibe-bar" role="group" aria-label="동네 분위기">
      <button type="button" className="tb-vibe-toggle" aria-pressed={vibeOn} onClick={() => setVibeOn((o) => !o)}>
        🎨 동네 분위기 {vibeOn ? "켜짐" : "꺼짐"}
      </button>
      {vibeOn &&
        VIBE_KEYS.filter((k) => city.zones.some((z) => z.vibe === k)).map((k) => (
          <button key={k} type="button" className="tb-vibe-chip" style={{ ["--vc" as string]: VIBES[k].color }} aria-pressed={vibePick === k} onClick={() => pickVibe(k)}>
            {VIBES[k].emoji} {VIBES[k].label}
          </button>
        ))}
    </div>
  );
  const offBox = (
    <div className="tb-map-off">
      <strong>이 화면에서는 지도를 열 수 없어요</strong>
      <p>목록에서 같은 숙소와 총액을 볼 수 있어요.</p>
      <small className="tb-map-why">{FAIL_TEXT[failed ?? "error"] ?? FAIL_TEXT.error}</small>
      <button type="button" className="tb-cta small" onClick={onList}>
        리스트로 보기
      </button>
    </div>
  );
  const pickCard = pick && (
    <div className="tb-map-card">
      <button type="button" className="tb-map-card-body" onClick={() => onOpen(pick.h)}>
        <strong>{pick.h.name}</strong>
        <small>{[pick.h.rating ? `★ ${pick.h.rating.toFixed(1)}` : "", pick.h.stars ? `${pick.h.stars}성급` : pick.h.kind, pick.fc ? "무료 취소 확인" : ""].filter(Boolean).join(" · ")}</small>
        <span className="tb-map-card-price">
          {pick.price !== null ? (
            <>
              <b className={pick.token === low && pick.verified ? "low" : pick.verified ? undefined : "est"}>
                {pick.verified ? "" : "~"}
                {won(pick.price)}
              </b>
              <small>
                {" "}
                · {nights}박 {pick.verified ? "세금 포함" : "예약처 확인 전"}
                {pick.verified && pick.at ? ` · ${checkedText(pick.at)}` : ""}
              </small>
            </>
          ) : (
            <small>예약처별 가격 보기</small>
          )}
        </span>
        {brief && <small className="tb-map-brief">{brief}</small>}
        {stationLine && <small className="tb-map-station">{stationLine}</small>}
        <em className="tb-cmp">예약처 비교 · 상세 보기 ↗</em>
      </button>
    </div>
  );
  const map = (
    <StayMap
      token={token}
      pins={pins}
      ring={ring}
      vibe={vibe}
      focus={focus}
      fit={modal || side ? { padding: 64, maxZoom: 14.5 } : undefined}
      fitKey={fitKey}
      start={initial ? null : cityViewOf(query.place)}
      onBounds={side ? (b) => (boundsRef.current = b) : undefined}
      onBlank={side ? () => setSel(null) : undefined}
      tip={modal && pick?.gps ? { token: pick.token, lat: pick.gps[0], lng: pick.gps[1], title: pick.h.name, line: pick.price !== null ? `${pick.verified ? "" : "예상 "}${won(pick.price)} · ${nights}박 ${pick.verified ? "세금 포함" : "예약처 확인 전"}` : "예약처별 가격 보기" } : null}
      onTip={() => pick && onOpen(pick.h)}
      onPick={setSel}
      onVibe={pickVibe}
      onFail={(why) => setFailed(why)}
      onStation={setStation}
    />
  );

  if (side) {
    const area = () => {
      const b = boundsRef.current;
      if (!b || !onArea) return;
      const [w, so, e, n] = b;
      onArea(shown.filter((x) => x.gps![0] >= so && x.gps![0] <= n && x.gps![1] >= w && x.gps![1] <= e).map((x) => x.token));
    };
    const on = pick ? !!saved?.has(pick.token) : false;
    const ph = pick ? pick.h.image || pick.h.images[0] || "" : "";
    return (
      <section className="tb-bigmap-in" aria-label={`${query.place} 숙소 지도`}>
        {failed ? (
          offBox
        ) : (
          <div className="tb-map-body">
            {map}
            {city && (
              <div className="tb-bigmap-vibe">
                <button type="button" className="tb-vibe-toggle" aria-pressed={vibeOn} onClick={() => setVibeOn((o) => !o)}>
                  🎨 동네 분위기 {vibeOn ? "켜짐" : "꺼짐"}
                </button>
                {vibeOn &&
                  VIBE_KEYS.filter((k) => city.zones.some((z) => z.vibe === k)).map((k) => (
                    <button key={k} type="button" className="tb-vibe-chip" style={{ ["--vc" as string]: VIBES[k].color }} aria-pressed={vibePick === k} onClick={() => pickVibe(k)}>
                      {VIBES[k].emoji} {VIBES[k].label}
                    </button>
                  ))}
              </div>
            )}
            {onArea && (
              <button type="button" className="tb-bigmap-area" onClick={area}>
                이 지역에서 다시 검색
              </button>
            )}
            {noMatch && <p className="tb-mapx-nomatch" role="status">{NO_MATCH}</p>}
            {!shown.length && <p className="tb-map-empty">조건에 맞는 숙소가 지도에 없어요. 필터를 하나 풀어 보세요.</p>}
            {pick && (
              <div className="tb-mini">
                <button type="button" className="tb-mini-x" aria-label="요약 닫기" onClick={() => setSel(null)}>
                  ✕
                </button>
                <div className="tb-mini-top">
                  {ph ? <img src={ph} alt="" onError={(e) => (e.currentTarget.style.visibility = "hidden")} /> : <span className="tb-mini-noph" aria-hidden />}
                  <div>
                    <strong>{pick.h.name}</strong>
                    <small>{[pick.h.stars ? `${pick.h.stars}성급` : pick.h.kind, pick.h.rating ? `후기 ${pick.h.rating.toFixed(1)}${pick.h.reviews ? ` (${pick.h.reviews.toLocaleString("ko-KR")})` : ""}` : ""].filter(Boolean).join(" · ")}</small>
                    <p className="tb-mini-price">
                      {pick.price !== null ? (
                        <>
                          <b className={pick.verified ? "ok" : "est"}>
                            {pick.verified ? "" : "~"}
                            {won(pick.price)}
                          </b>
                          <small> · {nights}박 {pick.verified ? "세금 포함 최저 총액" : "예약처 확인 전 금액"}</small>
                        </>
                      ) : (
                        <small>가격은 상세에서 확인해요</small>
                      )}
                    </p>
                    {brief && <small className="tb-map-brief">{brief}</small>}
                  </div>
                </div>
                <div className="tb-mini-go">
                  <button type="button" className="tb-mini-open" onClick={() => onOpen(pick.h)}>
                    예약처 비교 · 상세 보기 ↗
                  </button>
                  {onSave && (
                    <button type="button" className={`tb-mini-love${on ? " on" : ""}`} aria-pressed={on} onClick={() => onSave(pick.h)}>
                      ♡ 찜
                    </button>
                  )}
                </div>
              </div>
            )}
            <p className="tb-bigmap-legend">
              <span>
                <i className="ok" aria-hidden /> 확인한 {nights}박 총액
              </span>
              <span>
                <i className="est" aria-hidden /> 예상 총액 (확인 전)
              </span>
            </p>
            {city && vibeOn && <small className="tb-bigmap-note">{VIBE_NOTE}</small>}
          </div>
        )}
      </section>
    );
  }

  if (modal)
    return (
      <div className="tb-mapx-wrap" onClick={(e) => e.target === e.currentTarget && onList()}>
        <section className="tb-mapx" role="dialog" aria-modal="true" aria-label={`${query.place} 숙소 지도`}>
          <div className="tb-mapx-map">
            {failed ? (
              offBox
            ) : (
              <div className="tb-map-body">
                {map}
                {noMatch && <p className="tb-mapx-nomatch" role="status">{NO_MATCH}</p>}
                {!shown.length && <p className="tb-map-empty">조건에 맞는 숙소가 지도에 없어요. 조건을 하나 풀어 보세요.</p>}
              </div>
            )}
          </div>
          <aside className="tb-mapx-side">
            <button type="button" className="tb-mapx-close" onClick={onList}>
              ✕ 목록으로 돌아가기
            </button>
            <p className="tb-mapx-count">
              {query.place} · 지도 {shown.length}곳 · {nights}박 세금 포함 총액
            </p>
            <section className="tb-mapx-sec" aria-label="선택한 숙소">
              <h3>선택한 숙소</h3>
              {pick ? (
                <div className="tb-mapx-pick">
                  <strong>{pick.h.name}</strong>
                  <small>{[pick.h.stars ? `${pick.h.stars}성급` : pick.h.kind, pick.h.rating ? `후기 ${pick.h.rating.toFixed(1)}` : "", pick.fc ? "무료 취소 확인" : ""].filter(Boolean).join(" · ")}</small>
                  {pick.price !== null ? (
                    <p className="tb-mapx-price">
                      {!pick.verified && <><em className="tb-est">예상</em>{" "}</>}
                      <b className={pick.token === low && pick.verified ? "low" : undefined}>{won(pick.price)}</b>
                      <small> · {nights}박 {pick.verified ? "세금 포함" : "예약처 확인 전"}</small>
                      {pick.verified && pick.at ? <small className="tb-checked"> · {checkedText(pick.at)}</small> : null}
                    </p>
                  ) : null}
                  {brief && <p className="tb-map-brief">{brief}</p>}
                  {stationLine && <p className="tb-map-station">{stationLine}</p>}
                  <button type="button" className="tb-cta small" onClick={() => onOpen(pick.h)}>
                    예약처별 총액 보기
                  </button>
                </div>
              ) : (
                <p className="tb-mute">지도에서 가격 핀을 누르면 여기에 보여요.</p>
              )}
            </section>
            {pick?.gps && (
              <section className="tb-mapx-sec" aria-label="도보 반경">
                <div className="tb-mapx-row">
                  <h3>도보 반경 표시</h3>
                  <button type="button" className="tb-switch" role="switch" aria-checked={walkOn} aria-label="도보 반경 표시" onClick={() => setWalkOn((o) => !o)}>
                    <span>
                      <i />
                    </span>
                  </button>
                </div>
                <small className="tb-mute">선택한 숙소 둘레 도보 약 5분(400m)·10분(800m) 원. 지도를 조금 더 확대하면 보여요.</small>
              </section>
            )}
            <section className="tb-mapx-sec" aria-label="지도 조건">
              <h3>조건</h3>
              {chipRow}
            </section>
            {city && !failed && (
              <section className="tb-mapx-sec" aria-label="동네 분위기">
                <h3>동네 분위기</h3>
                {vibeBar}
                {noMatch && <p className="tb-mapx-nomatch side">{NO_MATCH}</p>}
                {vibeOn && <small className="tb-mute">{VIBE_NOTE}</small>}
              </section>
            )}
            {pick?.gps && (
              <section className="tb-mapx-sec" aria-label="주요 장소까지 예상 시간">
                <h3>주요 장소까지 예상 시간</h3>
                <ul className="tb-mapx-dist">
                  {nearby(pick.gps).map((n) => {
                    const t = travelText(n.name, n.km);
                    return (
                      <li key={n.name}>
                        <span>{n.name}</span>
                        <b>
                          {t.time} <small>({t.sub})</small>
                        </b>
                      </li>
                    );
                  })}
                </ul>
                <small className="tb-mute">{TRAVEL_NOTE}</small>
              </section>
            )}
          </aside>
        </section>
      </div>
    );

  return (
    <section className={`tb-map${panel ? " panel" : ""}`} aria-label={`${query.place} 숙소 지도`}>
      <div className="tb-map-top">
        <button type="button" className="tb-map-back" onClick={onList}>
          <IconBack size={18} /> 리스트로
        </button>
        <span className="tb-map-count">
          지도 {shown.length}곳 · {nights}박 총액
        </span>
      </div>
      {chipRow}
      {vibeBar}
      {failed ? (
        offBox
      ) : (
        <div className="tb-map-body">
          {map}
          {city && vibeOn && <small className="tb-vibe-note">{VIBE_NOTE}</small>}
          {noMatch && <p className="tb-mapx-nomatch" role="status">{NO_MATCH}</p>}
          {!shown.length && <p className="tb-map-empty">조건에 맞는 숙소가 지도에 없어요. 칩을 하나 풀어 보세요.</p>}
          {pickCard}
        </div>
      )}
      {!failed && <p className="tb-map-note">{pick ? "점선 원은 누른 숙소에서 도보 약 5분(400m)·10분(800m)이에요. 직선거리 기준 참고용이라 실제 도보 시간은 길에 따라 달라요" : "핀을 누르면 숙소와 주변 도보 5·10분 원이 보여요"}</p>}
    </section>
  );
}

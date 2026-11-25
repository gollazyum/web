"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import type { HotelOption } from "@/lib/hotels";
import { EMPTY_CHIPS, filterPins, lowestToken, MAP_BUDGETS, pinText, webglOk, type MapChips } from "@/lib/map-pins";
import { hasFreeCancel } from "@/lib/stay-filters";
import { nightsOf, won, type StayQuery } from "@/lib/trip";
import { shownPrice, usePriceVersion } from "./prices";
import { IconBack } from "./icons";

// 가격 핀 지도 화면 (휴대폰: 결과 위 전체 화면, PC: 오른쪽 패널).
// 지도 코드(mapbox-gl)는 이 화면을 실제로 띄울 때만 받는다. 토큰이 없거나 WebGL을 못 쓰면 지도 없이 안내만 보이고 목록으로 돌아가게 한다.
// 칩은 받은 목록 안에서만 거른다 (검색 다시 하지 않음). 지도 키(NEXT_PUBLIC_MAPBOX_TOKEN)는 배포할 때 들어가므로 키를 바꾸면 다시 배포해야 한다
const StayMap = dynamic(() => import("./StayMap"), { ssr: false, loading: () => <div className="tb-map-canvas tb-map-loading" aria-hidden /> });

const FAIL_TEXT: Record<string, string> = {
  "no-token": "까닭: 지도 키가 사이트에 설정되지 않았어요",
  webgl: "까닭: 이 브라우저에서 지도 그래픽(WebGL)을 쓸 수 없어요",
  rejected: "까닭: 지도 키가 이 주소에서 허용되지 않았어요",
  error: "까닭: 지도를 불러오지 못했어요",
};

type Props = { query: StayQuery; options: HotelOption[]; onOpen: (h: HotelOption) => void; onList: () => void; panel?: boolean };

export function MapPanel({ query, options, onOpen, onList, panel }: Props) {
  usePriceVersion(); // 예약처에서 확인한 금액이 오면 핀 글자를 맞춘다
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim() ?? "";
  // 지도를 못 여는 까닭 (null이면 지도). 안내 아래에 한 줄로 보여 줘서 설정 문제인지 기기 문제인지 바로 알 수 있게 한다
  const [failed, setFailed] = useState<string | null>(() => (!token ? "no-token" : typeof document !== "undefined" && !webglOk() ? "webgl" : null));
  const [chips, setChips] = useState<MapChips>(EMPTY_CHIPS);
  const [sel, setSel] = useState<string | null>(null);
  const nights = nightsOf(query);

  const items = options.map((h) => {
    const p = shownPrice(h, query);
    return { h, token: h.token, gps: h.gps, rating: h.rating, stars: h.stars, fc: hasFreeCancel(h) || !!p.fc, price: p.none ? null : p.value, verified: p.verified };
  });
  const shown = filterPins(items, chips);
  const low = lowestToken(shown);
  const pick = shown.find((x) => x.token === sel) ?? null;
  const pins = useMemo(
    () => shown.map((x) => ({ token: x.token, lat: x.gps![0], lng: x.gps![1], label: pinText(x.price), low: x.token === low, on: x.token === sel, name: x.h.name })),
    [shown.map((x) => `${x.token}:${x.price}`).join(), low, sel], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const ring = pick?.gps ?? null;
  const flip = (k: "freeCancel" | "rating45" | "stars4") => setChips((c) => ({ ...c, [k]: !c[k] }));

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
      {failed ? (
        <div className="tb-map-off">
          <strong>이 화면에서는 지도를 열 수 없어요</strong>
          <p>목록에서 같은 숙소와 총액을 볼 수 있어요.</p>
          <small className="tb-map-why">{FAIL_TEXT[failed] ?? FAIL_TEXT.error}</small>
          <button type="button" className="tb-cta small" onClick={onList}>
            리스트로 보기
          </button>
        </div>
      ) : (
        <div className="tb-map-body">
          <StayMap token={token} pins={pins} ring={ring} onPick={setSel} onFail={(why) => setFailed(why)} />
          {!shown.length && <p className="tb-map-empty">조건에 맞는 숙소가 지도에 없어요. 칩을 하나 풀어 보세요.</p>}
          {pick && (
            <div className="tb-map-card">
              <button type="button" className="tb-map-card-body" onClick={() => onOpen(pick.h)}>
                <strong>{pick.h.name}</strong>
                <small>{[pick.h.rating ? `★ ${pick.h.rating.toFixed(1)}` : "", pick.h.stars ? `${pick.h.stars}성급` : pick.h.kind, pick.fc ? "무료 취소 확인" : ""].filter(Boolean).join(" · ")}</small>
                <span className="tb-map-card-price">
                  {pick.price !== null ? (
                    <>
                      {!pick.verified && <em className="tb-est">예상</em>}
                      <b className={pick.token === low && pick.verified ? "low" : undefined}>{won(pick.price)}</b>
                      <small>
                        {" "}
                        · {nights}박 {pick.verified ? "세금 포함" : "예약처 확인 전"}
                      </small>
                    </>
                  ) : (
                    <small>예약처별 가격 보기</small>
                  )}
                </span>
                <em className="tb-cmp">예약처별 총액 보기 &gt;</em>
              </button>
            </div>
          )}
        </div>
      )}
      {!failed && <p className="tb-map-note">{pick ? "점선 원은 누른 숙소에서 400m·800m예요. 직선거리 기준 참고용 원이에요 (실제 도보 시간은 길에 따라 달라요)" : "핀을 누르면 숙소와 주변 400m·800m 원이 보여요"}</p>}
    </section>
  );
}

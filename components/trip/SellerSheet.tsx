"use client";

import { VibeTag } from "./VibeTag";
import { freeCancelGap, maxGapOf, savingsOf } from "@/lib/savings";
import { checkedText } from "@/lib/checked-at";
import { useEffect, useRef, useState } from "react";
import { sellerRows, type HotelInfo, type HotelOption, type ReviewTopic, type SellerRow } from "@/lib/hotels";
import { distText, nearby } from "@/lib/landmarks";
import { TRAVEL_NOTE, travelText } from "@/lib/map-decide";
import { positivePct } from "@/lib/prefs";
import { affiliateNoticeOn } from "@/lib/affiliate";
import { linkRel, sellerDef, sellerSearchUrl, withRo } from "@/lib/hotel-sellers";
import { topicKo } from "@/lib/hotelText";
import { staticMapUrl } from "@/lib/maps";
import { guestText, isPlainReason, nightsOf, stayTotal, won, type StayQuery } from "@/lib/trip";
import { searchErrorMessage } from "@/lib/search-error";
import { askHotel, stayPrices } from "./api";
import { checkInput } from "@/lib/checkpoints";
import { CheckBox } from "./CheckBox";
import { peekCheckpoints } from "./useCheckpoints";
import { checkedAtOf, getVerified, setChecking, setVerified, usePriceVersion, type Verified } from "./prices";
import { priceChange, savedBaseFor } from "./saved-price";
import { EstNote, PhotoStrip, PriceChange } from "./StayList";
import { Sheet } from "./Sheet";
import { BookedWatch } from "./BookingWatch";
import { UsualPrice } from "./UsualPrice";
import type { Peer } from "@/lib/usual-price";
import { IconHeart, IconOut, IconSpark, IconUp } from "./icons";

type Props = {
  hotel: HotelOption | null;
  query: StayQuery;
  saved: boolean;
  onSave: () => void;
  onClose: () => void;
  onGo?: (text: string) => void; // 예약 사이트로 넘어갈 때 잠깐 띄우는 안내
  reason?: string; // AI 추천 이유 (추천 3곳일 때만)
  onSimilar?: () => void; // 예약처 0곳일 때 '비슷한 숙소 보기' (같은 지역·성급)
  peers?: Peer[]; // 같은 검색 결과의 숙소들 ('평소 가격과 비교'의 동급 평균용, 없으면 기록 비교만)
  onBigMap?: () => void; // 작은 지도 [크게 보기]: 사이트 안 넓은 지도 창으로 (바깥 지도 사이트로 나가지 않는다)
};

// 판매처 표시용 색 (첫 글자 배지). 로고 이미지는 쓰지 않는다
const TONE: Record<string, string> = {
  agoda: "#5B4BDB",
  trip: "#287DFA",
  expedia: "#1B2E5A",
  hotels: "#D32F2F",
  booking: "#003B95",
  yanolja: "#FF3478",
  yeogi: "#E6007E",
  interpark: "#6A3DF0",
  myrealtrip: "#0BB3E6",
  rakuten: "#BF0000",
  klook: "#FF5B00",
  official: "#18202B",
};

// 원형 뱃지 안 글자: 영문 이니셜 (한글 첫 글자보다 정돈돼 보인다)
const BADGE: Record<string, string> = {
  expedia: "EX",
  hotels: "H",
  booking: "B.",
  agoda: "AG",
  trip: "TR",
  yanolja: "Y",
  yeogi: "여기",
  interpark: "NOL",
  myrealtrip: "MRT",
  rakuten: "R",
  klook: "K",
  official: "공식",
};

const md = (iso: string) => `${Number(iso.slice(5, 7))}월 ${Number(iso.slice(8, 10))}일`;


// 예약처별 결제 총액. 열 때 그 숙소의 예약처 가격을 한 번 더 받아 온다 (같은 조건은 이 탭에 30분 캐시)
export function SellerSheet({ hotel, query, saved, onSave, onClose, onGo, reason, onSimilar, peers, onBigMap }: Props) {
  return (
    <Sheet open={!!hotel} onClose={onClose} label="숙소 상세" tall>
      {hotel && <SellerBody key={hotel.token} hotel={hotel} query={query} saved={saved} onSave={onSave} onGo={onGo} reason={reason} onSimilar={onSimilar} peers={peers} onBigMap={onBigMap} />}
    </Sheet>
  );
}

// 후기 주제: 언급이 많은 순 4개 (3건 이상만)
const topTopics = (t: ReviewTopic[] | null) => (t ?? []).filter((x) => x.total >= 3).sort((a, b) => b.total - a.total).slice(0, 4);

const QUICK = ["조식은 어때요?", "역이나 번화가까지 가까워요?", "부모님과 가기 좋아요?"];

// AI에게 넘길 숙소 정보 (화면에 보이는 사실만)
function factsOf(h: HotelOption, q: StayQuery, nights: number, rows: SellerRow[] | null, topics: ReviewTopic[] | null, near: ReturnType<typeof nearby>, reason?: string): string {
  return [
    `이름: ${h.name}`,
    `종류: ${[h.kind, h.stars ? `${h.stars}성급` : ""].filter(Boolean).join(", ")}`,
    h.rating ? `후기 점수: 5점 만점 ${h.rating.toFixed(1)}점${h.reviews ? ` (후기 ${h.reviews}개)` : ""}` : "",
    h.amenities.length ? `편의시설: ${h.amenities.slice(0, 15).join(", ")}` : "",
    topTopics(topics).length ? `후기 주제: ${topTopics(topics).map((t) => `${topicKo(t.name)} 긍정 ${positivePct(t)}% (${t.total}건)`).join(", ")}` : "",
    near.length ? `주요 장소까지 직선거리: ${near.map((n) => `${n.name} ${distText(n.km)}`).join(", ")}` : "",
    `일정: ${q.place} ${q.checkIn}~${q.checkOut} (${nights}박), ${guestText(q)}`,
    rows?.length ? `가장 낮은 예약처 총액: ${rows[0].cost.toLocaleString("ko-KR")}원 (세금 포함, 확인 시각 기준)` : "",
    reason ? `AI가 먼저 보여 준 이유: ${reason}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

// 시트(휴대폰)와 오른쪽 고정 패널(PC)이 같이 쓰는 숙소 상세: 사진 → 이유 → 예약처별 총액 → 후기 → 주변 장소 → AI에게 물어보기
// 담아 둔 숙소: 지금 예약처 1위 총액과 담을 때 금액의 차이 (확인 총액끼리만)
// 공용 가격 저장소의 예약처 배열 → 화면 줄 (다른 화면·다른 탭이 더 최근에 확인한 값을 같이 그린다)
function rowsFromStore(v: Verified | undefined): SellerRow[] | null {
  if (!v || v.partial || !v.rows?.length || !v.rows.every((r) => r.href)) return null;
  return v.rows.map((r) => ({ name: r.name ?? sellerDef(r.key).label, logo: "", perNight: null, total: r.approx ? null : r.cost, link: r.href!, official: r.key === "official", freeCancel: !!r.fc, key: r.key, href: r.href!, cost: r.cost, approx: !!r.approx }));
}

const sellerDiff = (token: string, q: StayQuery, cost: number) => priceChange(savedBaseFor(token, q), { value: cost, verified: true, none: false });

// page: 전용 숙소 상세 페이지 (/hotels/[propertyToken]) 본문. location: 그 페이지의 위치 지도 칸 (지도·가까운 역·편의시설)
// onInfo: 가격 조회에 같이 온 숙소 기본 정보 (공유 링크로 들어와 이름·사진을 모를 때 채운다)
export function SellerBody({ hotel, query, saved, onSave, onGo, reason, onSimilar, peers = [], onBigMap, page, location, onInfo }: Omit<Props, "hotel" | "onClose"> & { hotel: HotelOption; page?: boolean; location?: React.ReactNode; onInfo?: (info: HotelInfo) => void }) {
  const hotelRef = useRef(hotel);
  hotelRef.current = hotel;
  const infoRef = useRef(onInfo);
  infoRef.current = onInfo;
  const [state, setState] = useState<{ token: string; rows: SellerRow[] | null; status: number | null | "ok"; at: number; topics?: ReviewTopic[] | null } | null>(null);
  const [qa, setQa] = useState<{ token: string; list: { q: string; a: string | null }[] }>({ token: hotel.token, list: [] });
  const [ask, setAsk] = useState("");
  const near = nearby(hotel.gps);
  const [again, setAgain] = useState(0);
  const nights = nightsOf(query);
  usePriceVersion(); // 다른 화면·탭에서 같은 숙소 가격을 새로 확인하면 바로 다시 그린다
  // "12분 전 확인"이 멈춰 보이지 않게 1분마다 다시 그린다
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let live = true;
    const hotel = hotelRef.current;
    const hq = { q: query.place, checkIn: query.checkIn, checkOut: query.checkOut, adults: query.adults, rooms: query.rooms, childAges: query.childAges };
    setState({ token: hotel.token, rows: null, status: "ok", at: 0 });
    setChecking(hotel.token, query, true);
    stayPrices(hotel.token, query, hotel.name || query.place, again > 0, !!page).then((r) => {
      setChecking(hotel.token, query, false);
      if (r.ok && r.data.info) infoRef.current?.(r.data.info);
      if (r.ok) {
        const rows = sellerRows(r.data.sources, nights, hotel.name || r.data.info?.name || query.place, hq);
        const at = checkedAtOf(r);
        // 목록·지도·홈·내 여행 금액도 이 값으로 맞춘다 (확인 시각이 더 최근일 때만. 더 오래된 값이면 저장소의 최신 값을 그린다)
        setVerified(hotel.token, query, rows, true, at);
        if (live) setState({ token: hotel.token, rows, status: "ok", at, topics: r.data.topics });
        return;
      }
      // 실패하면 목록에 같이 온 몇 곳이라도 보여 주고, 보여 준 1위로 카드 금액도 맞춘다 (0곳이면 카드는 그대로)
      const rows = sellerRows(hotel.sources, nights, hotel.name, hq);
      if (rows.length) setVerified(hotel.token, query, rows, false);
      if (live) setState({ token: hotel.token, rows, status: r.status, at: 0 });
    });
    return () => {
      live = false;
      setChecking(hotel.token, query, false);
    };
  }, [hotel.token, query, nights, again, page]);

  // 화면에 그리는 예약처 배열·확인 시각: 이 화면이 받은 값과 공용 저장소 값 중 더 최근에 확인한 쪽 (모든 화면이 같은 값)
  const stored = getVerified(hotel.token, query);
  const own = state?.token === hotel.token ? state : null;
  const fromStore = own?.rows && own.status === "ok" && stored && stored.at > own.at ? rowsFromStore(stored) : null;
  const rows = fromStore ?? own?.rows ?? null;
  const checkedAt = fromStore ? stored!.at : (own?.at ?? 0);
  // 보는 중에 다시 확인해 1위 총액이 바뀌면 조용히 숫자만 바꾸지 않고 알린다
  const shownTop = own?.status === "ok" && rows?.length ? rows[0].cost : null;
  const prevTop = useRef<{ token: string; cost: number } | null>(null);
  const [moved, setMoved] = useState<{ token: string; diff: number } | null>(null);
  useEffect(() => {
    if (shownTop === null) return;
    const prev = prevTop.current;
    if (prev && prev.token === hotel.token && prev.cost !== shownTop) setMoved({ token: hotel.token, diff: shownTop - prev.cost });
    prevTop.current = { token: hotel.token, cost: shownTop };
  }, [shownTop, hotel.token]);
  const movedLine = moved && moved.token === hotel.token ? (
    <p className={`tb-rechecked${moved.diff < 0 ? " down" : ""}`} role="status">
      방금 다시 확인했어요 · {won(Math.abs(moved.diff))} {moved.diff < 0 ? "내려갔어요" : "올랐어요"}
    </p>
  ) : null;
  const topics = state?.token === hotel.token ? topTopics(state.topics ?? null) : [];
  const failed = state && state.status !== "ok";
  const capped = state?.status === 429 && !!page && !rows?.length; // 상세 페이지 새 조회 하루 상한
  const list = qa.token === hotel.token ? qa.list : [];
  const waiting = list.some((x) => x.a === null);
  // 솔직 체크포인트: 예약처 가격 확인이 끝난 뒤(후기 주제·무료 취소까지 받은 뒤) 한 번 만든다
  const loaded = !!rows && state?.token === hotel.token;
  const input = loaded ? checkInput(hotel, query, { fc: rows.some((r) => r.freeCancel), price: rows.length ? (failed ? "estimate" : "verified") : "none", topics: state?.topics ?? null }) : null;
  const check = peekCheckpoints(hotel, query, input);
  // 작은 위치 지도: 토큰이 없거나 이미지가 안 불러지면 글자 링크로 돌아간다
  const [mapFail, setMapFail] = useState<string | null>(null);
  const mapSrc = hotel.gps ? staticMapUrl(hotel.gps[0], hotel.gps[1]) : null;
  const mapImg = mapSrc && mapSrc !== mapFail ? mapSrc : null;
  const photos = (hotel.images.length ? hotel.images : hotel.image ? [hotel.image] : []).slice(0, 8);

  async function send(raw: string) {
    const q = raw.trim().slice(0, 200);
    if (!q || waiting) return;
    setAsk("");
    const token = hotel.token;
    setQa({ token, list: [...list, { q, a: null }] });
    const r = await askHotel(factsOf(hotel, query, nights, rows ?? null, state?.topics ?? null, near, reason), q);
    const a = r.ok && r.data.answer ? r.data.answer : r.ok ? "그 질문에는 여기 있는 정보로 답하기 어려워요. 예약 사이트 숙소 소개에서 확인해 주세요." : r.status === 429 ? "질문이 많아서 잠시 쉬어야 해요. 조금 뒤에 다시 물어봐 주세요." : "지금은 답을 드리기 어려워요. 잠시 뒤에 다시 물어봐 주세요.";
    setQa((s) => (s.token === token ? { token, list: s.list.map((x) => (x.q === q && x.a === null ? { q, a } : x)) } : s));
  }

  // ---------- 부분들 (시트·PC 패널은 한 줄로, 상세 페이지는 왼쪽 검증 60% · 오른쪽 가격 40%로 놓는다) ----------
  const reasonBox = reason && !isPlainReason(reason) && (
    <p className="tb-detail-why">
      <IconSpark size={16} />
      <span>
        <b>AI가 먼저 보여 드린 이유</b>
        {reason}
      </span>
    </p>
  );
  const checkBox = loaded ? <CheckBox c={check ?? null} fc={!!input?.freeCancel} /> : null;
  const priceTitle = (
    <div className="tb-seller-title">
      <h3>예약처별 결제 총액</h3>
      {checkedAt && own?.status === "ok" ? (
        <span className="tb-checked">
          {checkedText(checkedAt)}
          {!capped && (
            <button type="button" className="tb-recheck-btn" onClick={() => setAgain((n) => n + 1)} disabled={!rows}>
              다시 확인
            </button>
          )}
        </span>
      ) : null}
    </div>
  );
  const saveLine = (() => {
    // 아낀 금액: 예약처에서 확인한 세금 포함 총액끼리만 (검색 목록의 예상 금액·가격을 못 받은 경우는 보여 주지 않는다)
    const save = rows?.length && state?.status === "ok" ? savingsOf(rows) : null;
    return save ? (
      <p className="tb-save-line" role="note">
        두 번째로 싼 곳보다 <b>{won(save.amount)}</b> 저렴해요
        <small>확인한 예약처 {save.count}곳 · {nights}박 세금 포함 총액</small>
      </p>
    ) : null;
  })();
  // 가장 비싼 곳과의 차이는 비교표 아래 보조 정보로만
  const maxLine = (() => {
    const gap = rows && rows.length > 1 && state?.status === "ok" ? maxGapOf(rows) : null;
    return gap ? <p className="tb-save-max">가장 비싼 곳과는 {won(gap)} 차이 나요</p> : null;
  })();
  const fcLine = (() => {
    // 1위 요금이 무료 취소가 아니면, 무료 취소 요금 중 가장 낮은 곳과의 차액을 한 줄로 (예약처마다 가장 싼 요금 하나만 받는다)
    const fc = rows?.length ? freeCancelGap(rows) : null;
    return fc ? (
      <p className="tb-fc-note">
        <b>+{won(fc.gap)}</b>이면 무료 취소 <small>· {sellerDef(fc.row.key).ko} {won(fc.row.cost)}</small>
      </p>
    ) : null;
  })();
  const infoList = (
    <ul className="tb-seller-info">
      <li>세금·수수료를 포함한 {nights}박 총액이에요. 현지에서 내는 숙박세는 포함되지 않아 따로 낼 수 있어요.</li>
      <li>결제는 이동한 예약 사이트에서 진행돼요.</li>
    </ul>
  );
  const rowList = rows?.length ? (
    <div className="tb-rows">
      {rows.map((s, i) => {
        const ko = sellerDef(s.key).ko;
        return (
          <div key={`${s.key}:${s.name}`} className="tb-row">
            <span className="tb-seller-badge" style={{ background: TONE[s.key] }} aria-hidden>
              {BADGE[s.key] ?? ko.slice(0, 1)}
            </span>
            <div className="tb-row-name">
              <strong>{ko}</strong>
              {s.approx && <small>1박 요금 × {nights}박</small>}
              {s.freeCancel ? <small className="tb-free">무료 취소 가능</small> : i === 0 ? <small>환불 조건은 결제 화면에서 확인</small> : null}
            </div>
            <div className={`tb-row-price${i === 0 ? " best" : ""}`}>
              {i === 0 && rows.length > 1 && <em className="tb-low">가장 낮아요</em>}
              <strong>{won(s.cost)}</strong>
            </div>
            <a className={`tb-book${i === 0 ? " dark" : ""}`} href={s.href} target="_blank" rel={linkRel(s.key)} aria-label={`${ko}에서 보기`} onClick={() => onGo?.(`${withRo(ko)} 이동해요 · 최종 금액은 결제 화면에서 확인해 주세요`)}>
              보기 <IconOut />
            </a>
          </div>
        );
      })}
    </div>
  ) : null;
  const loadingRows = (
    <div className="tb-rows" aria-busy="true">
      <p className="tb-checking" role="status">
        <i aria-hidden /> 예약처 가격을 확인하는 중
      </p>
      {[0, 1, 2].map((i) => (
        <div key={i} className="tb-row skel" />
      ))}
    </div>
  );
  const noneBox = (
    <div className="tb-seller-none">
      <p>{capped ? "오늘은 새 가격 확인을 많이 하셨어요. 잠시 뒤에 다시 열어 주세요" : "지금 비교할 수 있는 예약처 가격이 없어요"}</p>
      <a className="tb-cta small" href={sellerSearchUrl("agoda", hotel.name, query)} target="_blank" rel={linkRel("agoda")} onClick={() => onGo?.("아고다로 이동해요 · 최종 금액은 결제 화면에서 확인해 주세요")}>
        아고다에서 이 숙소 찾아보기 ↗
      </a>
      {onSimilar && (
        <button type="button" className="tb-btn" onClick={onSimilar}>
          비슷한 숙소 보기(같은 지역·성급)
        </button>
      )}
      {!capped && (
        <button type="button" className="tb-link" onClick={() => setAgain((n) => n + 1)}>
          다시 검색
        </button>
      )}
    </div>
  );
  const usual = rows?.length && state?.status === "ok" ? <UsualPrice token={hotel.token} stars={hotel.stars} adults={query.adults} checkIn={query.checkIn} nights={nights} current={rows[0].cost} peers={peers} kids={(query.childAges?.length ?? 0) > 0 || (query.rooms ?? 1) > 1} /> : null;
  const watch = rows?.length && state?.status === "ok" ? <BookedWatch hotel={hotel} query={query} rows={rows} /> : null;
  const failNote = failed && rows?.length ? <p className="tb-note">{searchErrorMessage(state.status === "ok" ? null : state.status)}</p> : null;
  const priceNote = (
    <p className="tb-note">
      가격은 확인한 시각 기준이라 바뀔 수 있어요. 최종 금액은 예약 사이트 결제 화면에서 꼭 확인해 주세요.
      {affiliateNoticeOn() ? " 일부 예약처에서 제휴 수수료를 받을 수 있지만, 내는 금액은 같아요." : ""}
    </p>
  );
  const topicSec = topics.length > 0 && (
    <section className="tb-detail-sec">
      <h3>후기에서 많이 나온 이야기</h3>
      <ul className="tb-topics">
        {topics.map((t) => (
          <li key={t.name}>
            <span>{topicKo(t.name)}</span>
            <i aria-hidden>
              <b style={{ width: `${positivePct(t)}%` }} />
            </i>
            <small>
              좋아요 {positivePct(t)}% · {t.total.toLocaleString("ko-KR")}건
            </small>
          </li>
        ))}
      </ul>
    </section>
  );
  const nearList = near.length > 0 && (
    <>
      <ul className="tb-near">
        {near.map((n) => {
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
      <p className="tb-note">{TRAVEL_NOTE}</p>
    </>
  );
  const nearSec = near.length > 0 && (
    <section className="tb-detail-sec">
      <h3>주요 장소까지 예상 시간</h3>
      {nearList}
    </section>
  );
  const askSec = (
    <section className="tb-detail-sec">
      <h3>이 숙소, AI에게 물어보기</h3>
      {list.length === 0 ? (
        <div className="tb-chips">
          {QUICK.map((q) => (
            <button key={q} type="button" className="tb-chip" onClick={() => send(q)}>
              {q}
            </button>
          ))}
        </div>
      ) : (
        <div className="tb-qa" aria-live="polite">
          {list.map((x, i) => (
            <div key={i}>
              <p className="tb-qa-q">{x.q}</p>
              <p className="tb-qa-a">{x.a ?? "숙소 정보를 살펴보고 있어요…"}</p>
            </div>
          ))}
        </div>
      )}
      <form
        className="tb-composer tb-detail-ask"
        onSubmit={(e) => {
          e.preventDefault();
          send(ask);
        }}
      >
        <input value={ask} maxLength={200} onChange={(e) => setAsk(e.target.value)} placeholder="예: 수영장 있어요?" aria-label="이 숙소에 대해 AI에게 묻기" enterKeyHint="send" />
        <button type="submit" className="tb-send" disabled={!ask.trim() || waiting} aria-label="보내기">
          <IconUp size={20} />
        </button>
      </form>
      <p className="tb-note">화면에 보이는 숙소 정보만으로 답해요. 정확한 내용은 예약 사이트에서 확인해 주세요.</p>
    </section>
  );

  // ---------- 전용 상세 페이지: 왼쪽 검증 60% · 오른쪽 고정 가격 결정 40% ----------
  if (page) {
    const best = rows?.length ? rows[0] : null;
    const bestKo = best ? sellerDef(best.key).ko : "";
    return (
      <div className="tb-hp-body">
        <div className="tb-hp-left">
          {reasonBox}
          {loaded ? <section className="tb-hp-sec">{checkBox}</section> : null}
          {topicSec}
          {location ? (
            <section className="tb-detail-sec tb-hp-loc">
              <h3>위치 · 도보 5/10분 원</h3>
              {location}
              <VibeTag gps={hotel.gps} detail />
              {nearList}
            </section>
          ) : (
            nearSec
          )}
          {usual ? <section className="tb-detail-sec tb-hp-usual">{usual}</section> : null}
          {askSec}
        </div>
        <aside className="tb-hp-right" aria-label="예약처별 총액">
          <div className="tb-hp-box">
            <p className="tb-hp-when">
              {md(query.checkIn)} – {md(query.checkOut)} · {nights}박 · {guestText(query)}
            </p>
            {priceTitle}
            {!rows ? loadingRows : rows.length ? (
              <>
                {movedLine}
                {saveLine}
                {fcLine}
                {rowList}
                {maxLine}
              </>
            ) : (
              noneBox
            )}
            {saved && best && state?.status === "ok" && sellerDiff(hotel.token, query, best.cost) !== null ? <PriceChange diff={sellerDiff(hotel.token, query, best.cost)!} /> : null}
            {failNote}
            {best ? (
              <div className="tb-hp-go">
                <a className="tb-hp-main" href={best.href} target="_blank" rel={linkRel(best.key)} onClick={() => onGo?.(`${withRo(bestKo)} 이동해요 · 최종 금액은 결제 화면에서 확인해 주세요`)}>
                  {bestKo}에서 {won(best.cost)}으로 보기 <IconOut />
                </a>
                <button type="button" className={`tb-hp-love${saved ? " on" : ""}`} onClick={onSave} aria-pressed={saved} aria-label={saved ? "찜 빼기" : "찜하기"}>
                  <IconHeart size={18} on={saved} /> 찜
                </button>
              </div>
            ) : rows ? (
              <div className="tb-hp-go">
                <button type="button" className={`tb-hp-love wide${saved ? " on" : ""}`} onClick={onSave} aria-pressed={saved}>
                  <IconHeart size={18} on={saved} /> {saved ? "찜했어요" : "찜하기"}
                </button>
              </div>
            ) : null}
            {watch}
            {infoList}
            {priceNote}
          </div>
        </aside>
      </div>
    );
  }

  return (
    <div className="tb-seller">
      {photos.length > 1 && (
        <div className="tb-gallery">
          <PhotoStrip images={photos} name={hotel.name} max={8} big />
        </div>
      )}
      <div className={`tb-seller-head${photos.length > 1 ? " under" : ""}`}>
        {photos.length > 1 ? null : hotel.image ? <img src={hotel.image} alt="" className="tb-seller-img" /> : <div className="tb-seller-img tb-nophoto"><small>사진 없음</small></div>}
        <div>
          <h2>{hotel.name}</h2>
          <p>
            {[hotel.stars ? `${hotel.stars}성급` : hotel.kind, `${nights}박`, guestText(query)].filter(Boolean).join(" · ")}
          </p>
          {hotel.rating ? <p className="tb-mute">후기 {hotel.rating.toFixed(1)}점{hotel.reviews ? ` (${hotel.reviews.toLocaleString("ko-KR")})` : ""}</p> : null}
          {hotel.gps && !mapImg && onBigMap && (
            <button type="button" className="tb-maplink" onClick={onBigMap}>
              지도에서 위치 보기
            </button>
          )}
        </div>
      </div>
      {hotel.gps && mapImg ? (
        onBigMap ? (
          <button type="button" className="tb-minimap" onClick={onBigMap} aria-label="지도에서 위치 크게 보기">
            <img src={mapImg} alt={`${hotel.name} 위치 지도`} width={600} height={200} loading="lazy" decoding="async" onError={() => setMapFail(mapImg)} />
            <span>크게 보기</span>
          </button>
        ) : (
          <div className="tb-minimap">
            <img src={mapImg} alt={`${hotel.name} 위치 지도`} width={600} height={200} loading="lazy" decoding="async" onError={() => setMapFail(mapImg)} />
          </div>
        )
      ) : null}
      <VibeTag gps={hotel.gps} detail />
      {reasonBox}
      {checkBox}
      {priceTitle}
      {rows?.length && state?.status === "ok" ? <EstNote est={stayTotal(hotel, nights)?.value ?? null} cost={rows[0].cost} at={checkedAt} /> : null}
      {saved && rows?.length && state?.status === "ok" && sellerDiff(hotel.token, query, rows[0].cost) !== null ? (
        <PriceChange diff={sellerDiff(hotel.token, query, rows[0].cost)!} />
      ) : null}
      {infoList}
      {!rows ? (
        loadingRows
      ) : rows.length ? (
        <>
          {movedLine}
          {saveLine}
          {fcLine}
          {rowList}
          {maxLine}
          {usual}
          {watch}
        </>
      ) : (
        noneBox
      )}
      {failNote}
      {priceNote}
      {topicSec}
      {nearSec}
      {askSec}
      {/* 아래 고정: 예약처 총액을 받으면 ♡ + 가장 낮은 총액 + 예약 버튼, 그 전에는 '내 여행에 담기'만 */}
      <div className="tb-save-bar">
        {rows?.length ? (
          <div className="tb-book-bar">
            <button type="button" className={`tb-save-ic${saved ? " on" : ""}`} onClick={onSave} aria-pressed={saved} aria-label={saved ? "찜 빼기" : "찜하기"}>
              <IconHeart size={20} on={saved} />
              <span className="tb-save-ic-label">찜</span>
            </button>
            <span className="tb-book-bar-price">
              <strong>{won(rows[0].cost)}</strong>
              <small>
                {nights}박 총액 · {sellerDef(rows[0].key).ko}
              </small>
            </span>
            <a
              className="tb-book-bar-go"
              href={rows[0].href}
              target="_blank"
              rel={linkRel(rows[0].key)}
              onClick={() => onGo?.(`${withRo(sellerDef(rows[0].key).ko)} 이동해요 · 최종 금액은 결제 화면에서 확인해 주세요`)}
            >
              {/* P2: 어디로 가는지 그대로 쓴다 */}
              {sellerDef(rows[0].key).ko}에서 보기 <IconOut />
            </a>
          </div>
        ) : (
          <button type="button" className="tb-save" onClick={onSave} aria-pressed={saved}>
            <IconHeart size={18} on={saved} /> {saved ? "찜했어요" : "찜하기"}
          </button>
        )}
      </div>
    </div>
  );
}

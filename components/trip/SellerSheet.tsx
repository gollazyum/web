"use client";

import { freeCancelGap, savingsOf } from "@/lib/savings";
import { useEffect, useState } from "react";
import { sellerRows, type HotelOption, type ReviewTopic, type SellerRow } from "@/lib/hotels";
import { distText, nearby } from "@/lib/landmarks";
import { positivePct } from "@/lib/prefs";
import { agodaAffiliateOn } from "@/lib/affiliate";
import { linkRel, sellerDef, sellerSearchUrl, withRo } from "@/lib/hotel-sellers";
import { topicKo } from "@/lib/hotelText";
import { guestText, isPlainReason, nightsOf, stayTotal, won, type StayQuery } from "@/lib/trip";
import { searchErrorMessage } from "@/lib/search-error";
import { askHotel, stayPrices } from "./api";
import { checkInput } from "@/lib/checkpoints";
import { CheckBox } from "./CheckBox";
import { useCheckpoints } from "./useCheckpoints";
import { setChecking, setVerified } from "./prices";
import { priceChange, savedBaseFor } from "./saved-price";
import { EstNote, PhotoStrip, PriceChange } from "./StayList";
import { Sheet } from "./Sheet";
import { BookedWatch } from "./BookingWatch";
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
  official: "공식",
};

const hm = (at: number) => {
  const d = new Date(at);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

// 예약처별 결제 총액. 열 때 그 숙소의 예약처 가격을 한 번 더 받아 온다 (같은 조건은 이 탭에 30분 캐시)
export function SellerSheet({ hotel, query, saved, onSave, onClose, onGo, reason, onSimilar }: Props) {
  return (
    <Sheet open={!!hotel} onClose={onClose} label="숙소 상세" tall>
      {hotel && <SellerBody key={hotel.token} hotel={hotel} query={query} saved={saved} onSave={onSave} onGo={onGo} reason={reason} onSimilar={onSimilar} />}
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
const sellerDiff = (token: string, q: StayQuery, cost: number) => priceChange(savedBaseFor(token, q), { value: cost, verified: true, none: false });

export function SellerBody({ hotel, query, saved, onSave, onGo, reason, onSimilar }: Omit<Props, "hotel" | "onClose"> & { hotel: HotelOption }) {
  const [state, setState] = useState<{ token: string; rows: SellerRow[] | null; status: number | null | "ok"; at: number; topics?: ReviewTopic[] | null } | null>(null);
  const [qa, setQa] = useState<{ token: string; list: { q: string; a: string | null }[] }>({ token: hotel.token, list: [] });
  const [ask, setAsk] = useState("");
  const near = nearby(hotel.gps);
  const [again, setAgain] = useState(0);
  const nights = nightsOf(query);

  useEffect(() => {
    let live = true;
    const hq = { q: query.place, checkIn: query.checkIn, checkOut: query.checkOut, adults: query.adults, rooms: query.rooms, childAges: query.childAges };
    setState({ token: hotel.token, rows: null, status: "ok", at: 0 });
    setChecking(hotel.token, query, true);
    stayPrices(hotel.token, query, hotel.name, again > 0).then((r) => {
      setChecking(hotel.token, query, false);
      if (r.ok) {
        const rows = sellerRows(r.data.sources, nights, hotel.name, hq);
        setVerified(hotel.token, query, rows); // 목록 카드 금액도 이 1위 총액으로 맞춘다 (패널을 닫아도)
        if (live) setState({ token: hotel.token, rows, status: "ok", at: r.at ?? Date.now(), topics: r.data.topics });
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
  }, [hotel, query, nights, again]);

  const rows = state?.token === hotel.token ? state?.rows : null;
  const topics = state?.token === hotel.token ? topTopics(state.topics ?? null) : [];
  const failed = state && state.status !== "ok";
  const list = qa.token === hotel.token ? qa.list : [];
  const waiting = list.some((x) => x.a === null);
  // 솔직 체크포인트: 예약처 가격 확인이 끝난 뒤(후기 주제·무료 취소까지 받은 뒤) 한 번 만든다
  const loaded = !!rows && state?.token === hotel.token;
  const input = loaded ? checkInput(hotel, query, { fc: rows.some((r) => r.freeCancel), price: rows.length ? (failed ? "estimate" : "verified") : "none", topics: state?.topics ?? null }) : null;
  const checkItems = input ? [{ h: hotel, withTopics: input.topics.length > 0, input }] : [];
  const check = useCheckpoints(checkItems, query, loaded).get(hotel.token);
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
          {hotel.gps && (
            <a className="tb-maplink" href={`https://www.openstreetmap.org/?mlat=${hotel.gps[0]}&mlon=${hotel.gps[1]}#map=17/${hotel.gps[0]}/${hotel.gps[1]}`} target="_blank" rel="noopener noreferrer">
              지도에서 위치 보기 <IconOut />
            </a>
          )}
        </div>
      </div>
      {reason && !isPlainReason(reason) && (
        <p className="tb-detail-why">
          <IconSpark size={16} />
          <span>
            <b>AI가 먼저 보여 드린 이유</b>
            {reason}
          </span>
        </p>
      )}
      {loaded ? <CheckBox c={check ?? null} fc={!!input?.freeCancel} /> : null}
      <div className="tb-seller-title">
        <h3>예약처별 결제 총액</h3>
        {state?.at ? <span>{hm(state.at)} 확인</span> : null}
      </div>
      {rows?.length && state?.status === "ok" ? <EstNote est={stayTotal(hotel, nights)?.value ?? null} cost={rows[0].cost} at={state.at} /> : null}
      {saved && rows?.length && state?.status === "ok" && sellerDiff(hotel.token, query, rows[0].cost) !== null ? (
        <PriceChange diff={sellerDiff(hotel.token, query, rows[0].cost)!} />
      ) : null}
      <ul className="tb-seller-info">
        <li>세금·수수료를 포함한 {nights}박 총액이에요. 현지에서 내는 숙박세는 포함되지 않아 따로 낼 수 있어요.</li>
        <li>결제는 이동한 예약 사이트에서 진행돼요.</li>
      </ul>
      {!rows ? (
        <div className="tb-rows" aria-busy="true">
          <p className="tb-checking" role="status">
            <i aria-hidden /> 예약처 가격을 확인하는 중
          </p>
          {[0, 1, 2].map((i) => (
            <div key={i} className="tb-row skel" />
          ))}
        </div>
      ) : rows.length ? (
        <>
        {(() => {
          // 아낀 금액: 예약처에서 확인한 세금 포함 총액끼리만 (검색 목록의 예상 금액·가격을 못 받은 경우는 보여 주지 않는다)
          const save = state?.status === "ok" ? savingsOf(rows) : null;
          return save ? (
            <p className="tb-save-line" role="note">
              가장 비싼 예약처보다 <b>{won(save.amount)}</b> 아껴요
              <small>확인한 예약처 {save.count}곳 · {nights}박 세금 포함 총액</small>
            </p>
          ) : null;
        })()}
        {(() => {
          // 1위 요금이 무료 취소가 아니면, 무료 취소 요금 중 가장 낮은 곳과의 차액을 한 줄로 (예약처마다 가장 싼 요금 하나만 받는다)
          const fc = freeCancelGap(rows);
          return fc ? (
            <p className="tb-fc-note">
              <b>+{won(fc.gap)}</b>이면 무료 취소 <small>· {sellerDef(fc.row.key).ko} {won(fc.row.cost)}</small>
            </p>
          ) : null;
        })()}
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
        {state?.status === "ok" && <BookedWatch hotel={hotel} query={query} rows={rows} />}
        </>
      ) : (
        <div className="tb-seller-none">
          <p>지금 비교할 수 있는 예약처 가격이 없어요</p>
          <a className="tb-cta small" href={sellerSearchUrl("agoda", hotel.name, query)} target="_blank" rel={linkRel("agoda")} onClick={() => onGo?.("아고다로 이동해요 · 최종 금액은 결제 화면에서 확인해 주세요")}>
            아고다에서 이 숙소 찾아보기 ↗
          </a>
          {onSimilar && (
            <button type="button" className="tb-btn" onClick={onSimilar}>
              비슷한 숙소 보기(같은 지역·성급)
            </button>
          )}
          <button type="button" className="tb-link" onClick={() => setAgain((n) => n + 1)}>
            다시 검색
          </button>
        </div>
      )}
      {failed && rows?.length ? <p className="tb-note">{searchErrorMessage(state.status === "ok" ? null : state.status)}</p> : null}
      <p className="tb-note">
        가격은 확인한 시각 기준이라 바뀔 수 있어요. 최종 금액은 예약 사이트 결제 화면에서 꼭 확인해 주세요.
        {agodaAffiliateOn() ? " 일부 예약처에서 제휴 수수료를 받을 수 있지만, 내는 금액은 같아요." : ""}
      </p>
      {topics.length > 0 && (
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
      )}
      {near.length > 0 && (
        <section className="tb-detail-sec">
          <h3>주요 장소까지 거리</h3>
          <ul className="tb-near">
            {near.map((n) => (
              <li key={n.name}>
                <span>{n.name}</span>
                <b>{distText(n.km)}</b>
              </li>
            ))}
          </ul>
          <p className="tb-note">직선거리예요. 실제 이동 거리와 시간은 더 걸릴 수 있어요.</p>
        </section>
      )}
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
      {/* 아래 고정: 예약처 총액을 받으면 ♡ + 가장 낮은 총액 + 예약 버튼, 그 전에는 '내 여행에 담기'만 */}
      <div className="tb-save-bar">
        {rows?.length ? (
          <div className="tb-book-bar">
            <button type="button" className={`tb-save-ic${saved ? " on" : ""}`} onClick={onSave} aria-pressed={saved} aria-label={saved ? "찜 빼기" : "찜하기"}>
              <IconHeart size={20} on={saved} />
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
            {(() => {
              // 아고다가 가장 싼 곳이 아니면 총액 옆에 보조 버튼으로 둔다
              const ag = rows.find((r, i) => i > 0 && r.key === "agoda");
              return ag ? (
                <a className="tb-book-bar-sub" href={ag.href} target="_blank" rel={linkRel("agoda")} onClick={() => onGo?.("아고다로 이동해요 · 최종 금액은 결제 화면에서 확인해 주세요")}>
                  아고다에서 보기 <IconOut />
                </a>
              ) : null;
            })()}
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

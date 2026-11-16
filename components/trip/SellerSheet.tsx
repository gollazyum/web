"use client";

import { useEffect, useState } from "react";
import { sellerRows, type HotelOption, type SellerRow } from "@/lib/hotels";
import { agodaAffiliateOn } from "@/lib/affiliate";
import { linkRel, sellerDef, withRo } from "@/lib/hotel-sellers";
import { nightsOf, won, type StayQuery } from "@/lib/trip";
import { searchErrorMessage } from "@/lib/search-error";
import { stayPrices } from "./api";
import { setVerified } from "./prices";
import { Sheet } from "./Sheet";
import { IconHeart, IconOut } from "./icons";

type Props = {
  hotel: HotelOption | null;
  query: StayQuery;
  saved: boolean;
  onSave: () => void;
  onClose: () => void;
  onGo?: (text: string) => void; // 예약 사이트로 넘어갈 때 잠깐 띄우는 안내
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

const hm = (at: number) => {
  const d = new Date(at);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

// 예약처별 결제 총액. 열 때 그 숙소의 예약처 가격을 한 번 더 받아 온다 (같은 조건은 이 탭에 30분 캐시)
export function SellerSheet({ hotel, query, saved, onSave, onClose, onGo }: Props) {
  return (
    <Sheet open={!!hotel} onClose={onClose} label="예약처별 결제 총액">
      {hotel && <SellerBody hotel={hotel} query={query} saved={saved} onSave={onSave} onGo={onGo} />}
    </Sheet>
  );
}

// 시트(휴대폰)와 오른쪽 고정 패널(PC)이 같이 쓰는 본문
export function SellerBody({ hotel, query, saved, onSave, onGo }: Omit<Props, "hotel" | "onClose"> & { hotel: HotelOption }) {
  const [state, setState] = useState<{ token: string; rows: SellerRow[] | null; status: number | null | "ok"; at: number } | null>(null);
  const [again, setAgain] = useState(0);
  const nights = nightsOf(query);

  useEffect(() => {
    let live = true;
    const hq = { q: query.place, checkIn: query.checkIn, checkOut: query.checkOut, adults: query.adults };
    setState({ token: hotel.token, rows: null, status: "ok", at: 0 });
    stayPrices(hotel.token, query, hotel.name, again > 0).then((r) => {
      if (!live) return;
      if (r.ok) {
        const rows = sellerRows(r.data.sources, nights, hotel.name, hq);
        setVerified(hotel.token, query, rows); // 목록 카드 금액도 이 1위 총액으로 맞춘다
        setState({ token: hotel.token, rows, status: "ok", at: r.at ?? Date.now() });
      }
      // 실패하면 목록에 같이 온 몇 곳이라도 보여 준다
      else setState({ token: hotel.token, rows: sellerRows(hotel.sources, nights, hotel.name, hq), status: r.status, at: 0 });
    });
    return () => {
      live = false;
    };
  }, [hotel, query, nights, again]);

  const rows = state?.token === hotel.token ? state?.rows : null;
  const failed = state && state.status !== "ok";
  const lowest = rows?.[0]?.cost ?? 0;

  return (
    <div className="tb-seller">
      <div className="tb-seller-head">
        {hotel.image ? <img src={hotel.image} alt="" className="tb-seller-img" /> : <div className="tb-seller-img" />}
        <div>
          <h2>{hotel.name}</h2>
          <p>
            {[hotel.stars ? `${hotel.stars}성급` : hotel.kind, `${nights}박`, `${query.adults}명`].filter(Boolean).join(" · ")}
          </p>
          {hotel.rating ? <p className="tb-mute">후기 {hotel.rating.toFixed(1)}점{hotel.reviews ? ` (${hotel.reviews.toLocaleString("ko-KR")})` : ""}</p> : null}
          {hotel.gps && (
            <a className="tb-maplink" href={`https://www.openstreetmap.org/?mlat=${hotel.gps[0]}&mlon=${hotel.gps[1]}#map=17/${hotel.gps[0]}/${hotel.gps[1]}`} target="_blank" rel="noopener noreferrer">
              지도에서 위치 보기 <IconOut />
            </a>
          )}
        </div>
      </div>
      <div className="tb-seller-title">
        <h3>예약처별 결제 총액</h3>
        {state?.at ? <span>{hm(state.at)} 확인</span> : null}
      </div>
      <ul className="tb-seller-info">
        <li>세금·수수료를 포함한 {nights}박 총액이에요. 현지에서 내는 숙박세는 포함되지 않아 따로 낼 수 있어요.</li>
        <li>결제는 이동한 예약 사이트에서 진행돼요.</li>
      </ul>
      {!rows ? (
        <div className="tb-rows">
          {[0, 1, 2].map((i) => (
            <div key={i} className="tb-row skel" />
          ))}
        </div>
      ) : rows.length ? (
        <div className="tb-rows">
          {rows.map((s, i) => {
            const ko = sellerDef(s.key).ko;
            return (
              <div key={`${s.key}:${s.name}`} className="tb-row">
                <span className="tb-seller-badge" style={{ background: TONE[s.key] }} aria-hidden>
                  {ko.slice(0, 1)}
                </span>
                <div className="tb-row-name">
                  <strong>{ko}</strong>
                  {s.approx && <small>1박 요금 × {nights}박</small>}
                </div>
                <div className={`tb-row-price${i === 0 ? " best" : ""}`}>
                  {i === 0 && rows.length > 1 && <em className="tb-low">가장 낮아요</em>}
                  <strong>{won(s.cost)}</strong>
                  {i > 0 && s.cost > lowest && <small>+{Math.round(s.cost - lowest).toLocaleString("ko-KR")}</small>}
                </div>
                <a className={`tb-book${i === 0 ? " dark" : ""}`} href={s.href} target="_blank" rel={linkRel(s.key)} onClick={() => onGo?.(`${withRo(ko)} 이동해요 · 최종 금액은 결제 화면에서 확인해 주세요`)}>
                  예약 <IconOut />
                </a>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="tb-seller-none">
          <p>지금 비교할 수 있는 예약 사이트가 없어요</p>
          <button type="button" className="tb-cta small" onClick={() => setAgain((n) => n + 1)}>
            다시 검색
          </button>
        </div>
      )}
      {failed && rows?.length ? <p className="tb-note">{searchErrorMessage(state.status === "ok" ? null : state.status)}</p> : null}
      <p className="tb-note">
        가격은 확인한 시각 기준이라 바뀔 수 있어요. 최종 금액은 예약 사이트 결제 화면에서 꼭 확인해 주세요.
        {agodaAffiliateOn() ? " 일부 예약처에서 제휴 수수료를 받을 수 있지만, 내는 금액은 같아요." : ""}
      </p>
      <button type="button" className="tb-save" onClick={onSave} aria-pressed={saved}>
        <IconHeart size={18} on={saved} /> {saved ? "내 여행에 담았어요" : "내 여행에 담기"}
      </button>
    </div>
  );
}

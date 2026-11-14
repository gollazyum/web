"use client";

import { useEffect, useState } from "react";
import { bookingLink, type HotelOption, type HotelSource } from "@/lib/hotels";
import { hotelSellerKey, linkRel, sellerDef } from "@/lib/hotel-sellers";
import { nightsOf, won, type StayQuery } from "@/lib/trip";
import { searchErrorMessage } from "@/lib/search-error";
import { stayPrices } from "./api";
import { Sheet } from "./Sheet";
import { IconHeart, IconOut } from "./icons";

type Props = {
  hotel: HotelOption | null;
  query: StayQuery;
  saved: boolean;
  onSave: () => void;
  onClose: () => void;
};

// 판매처 표시용 색 (첫 글자 배지). 로고 이미지는 쓰지 않는다
const TONE: Record<string, string> = { agoda: "#5B4BDB", trip: "#287DFA", expedia: "#1B2E5A", hotels: "#D32F2F", yanolja: "#FF3478", yeogi: "#E6007E" };

type Row = HotelSource & { cost: number; approx: boolean };

function rowsOf(sources: HotelSource[], nights: number): Row[] {
  return sources
    .map((s) => {
      const cost = s.total ?? (s.perNight ? s.perNight * nights : null);
      return cost === null ? null : { ...s, cost, approx: s.total === null };
    })
    .filter((r): r is Row => !!r)
    .sort((a, b) => a.cost - b.cost);
}

// v4 09번: 예약처별 결제 총액. 열 때 그 숙소의 예약처 가격을 한 번 더 받아 온다 (같은 조건은 30분 캐시)
export function SellerSheet({ hotel, query, saved, onSave, onClose }: Props) {
  const [state, setState] = useState<{ token: string; rows: Row[] | null; status: number | null | "ok" } | null>(null);
  const nights = nightsOf(query);

  useEffect(() => {
    if (!hotel) return;
    let live = true;
    setState({ token: hotel.token, rows: null, status: "ok" });
    stayPrices(hotel.token, query, hotel.name).then((r) => {
      if (!live) return;
      if (r.ok) setState({ token: hotel.token, rows: rowsOf(r.data.sources, nights), status: "ok" });
      // 실패하면 목록에 같이 온 몇 곳이라도 보여 준다
      else setState({ token: hotel.token, rows: rowsOf(hotel.sources, nights), status: r.status });
    });
    return () => {
      live = false;
    };
  }, [hotel, query, nights]);

  const rows = state?.token === hotel?.token ? state?.rows : null;
  const failed = state && state.status !== "ok";
  const lowest = rows?.[0]?.cost ?? 0;
  const hq = { q: query.place, checkIn: query.checkIn, checkOut: query.checkOut, adults: query.adults };

  return (
    <Sheet open={!!hotel} onClose={onClose} label="예약처별 결제 총액">
      {hotel && (
        <div className="tb-seller">
          <div className="tb-seller-head">
            {hotel.image ? <img src={hotel.image} alt="" className="tb-seller-img" /> : <div className="tb-seller-img" />}
            <div>
              <h2>{hotel.name}</h2>
              <p>
                {[hotel.stars ? `${hotel.stars}성급` : hotel.kind, `${nights}박`, `${query.adults}명`].filter(Boolean).join(" · ")}
              </p>
              {hotel.rating ? <p className="tb-mute">후기 {hotel.rating.toFixed(1)}점{hotel.reviews ? ` (${hotel.reviews.toLocaleString("ko-KR")})` : ""}</p> : null}
            </div>
          </div>
          <div className="tb-seller-title">
            <h3>예약처별 결제 총액</h3>
            <span>세금·수수료 포함</span>
          </div>
          {!rows ? (
            <div className="tb-rows">
              {[0, 1, 2].map((i) => (
                <div key={i} className="tb-row skel" />
              ))}
            </div>
          ) : rows.length ? (
            <div className="tb-rows">
              {rows.map((s, i) => {
                const key = hotelSellerKey(s.name, s.official, s.link);
                const href = bookingLink(s, hotel.name, hq);
                if (!href) return null;
                const ko = key ? sellerDef(key).ko : s.name;
                return (
                  <div key={s.name} className="tb-row">
                    <span className="tb-seller-badge" style={{ background: (key && TONE[key]) || "#18202B" }} aria-hidden>
                      {ko.slice(0, 1)}
                    </span>
                    <div className="tb-row-name">
                      <strong>{ko}</strong>
                      {s.approx && <small>1박 요금 × {nights}박</small>}
                    </div>
                    <div className="tb-row-price">
                      {i === 0 && rows.length > 1 && <em className="tb-low">가장 낮아요</em>}
                      <strong>{won(s.cost)}</strong>
                      {i > 0 && s.cost > lowest && <small>+{Math.round(s.cost - lowest).toLocaleString("ko-KR")}</small>}
                    </div>
                    <a className={`tb-book${i === 0 ? " dark" : ""}`} href={href} target="_blank" rel={linkRel(key)}>
                      예약 <IconOut />
                    </a>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="tb-note">이 날짜에 가격을 보여 주는 예약처가 없어요. 날짜를 바꿔 다시 찾아봐 주세요.</p>
          )}
          {failed && <p className="tb-note">{searchErrorMessage(state.status === "ok" ? null : state.status)}</p>}
          <p className="tb-note">
            <strong>예약 ↗</strong>을 누르면 그 사이트로 이동해 결제해요. {` `}이 앱은 제휴 수수료를 받을 수 있지만, 내는 금액은 같아요. 가격은 찾은 시점 기준이라 결제 화면에서 꼭 다시 확인해 주세요.
          </p>
          <button type="button" className="tb-save" onClick={onSave} aria-pressed={saved}>
            <IconHeart size={18} on={saved} /> {saved ? "내 여행에 담았어요" : "내 여행에 담기"}
          </button>
        </div>
      )}
    </Sheet>
  );
}

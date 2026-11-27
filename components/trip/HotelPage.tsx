"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { HotelInfo, HotelOption } from "@/lib/hotels";
import { guestText, nightsOf, type StayQuery } from "@/lib/trip";
import { pinText } from "@/lib/map-pins";
import { priceBrief, walkMin, type PricedSpot } from "@/lib/map-decide";
import { cityNear } from "@/data/neighborhoodVibes";
import type { Peer } from "@/lib/usual-price";
import { SellerBody } from "./SellerSheet";
import { DetailMap } from "./DetailMap";
import type { ExtraPin, NearStation } from "./StayMap";
import { AMENITY_KO, amenityLine, gridKey, type Amenities } from "@/lib/amenity-shape";
import { getVerified, usePriceVersion } from "./prices";
import { IconBack } from "./icons";
import { hotelNameKo } from "@/lib/hotelText";
import { HotelGallery } from "./HotelGallery";
import { HotelFacts, SimilarHotels } from "./HotelExtras";

// 전용 숙소 상세 페이지 (/hotels/[propertyToken]).
// 위: 머리 줄(숙소명·성급·평점·공유) + 사진(왼쪽 대표 1장 + 오른쪽 4칸). 아래: 왼쪽 60% 검증 · 오른쪽 40% 고정 가격 결정 (SellerBody page).
// 예약처별 총액은 이 페이지에 들어왔을 때만 한 번 받는다 (서버 12시간 저장분 우선)
type Props = {
  hotel: HotelOption | null; // 목록·이 기기 미리 보기·서버 기본 정보로 먼저 그린다 (없으면 가격 조회에 같이 온 정보로)
  token: string;
  query: StayQuery;
  saved: boolean;
  onSave: (h: HotelOption) => void;
  onBack: () => void;
  backLabel: string;
  onGo: (text: string) => void;
  onToast: (text: string) => void;
  reason?: string;
  peers?: Peer[];
  spots?: PricedSpot[]; // 같은 검색 결과(확인 총액만) — '동네 대비 가격' 한 줄용. 새 탭에서는 없다
  pool?: HotelOption[]; // 같은 검색 결과 숙소 — '비슷한 후보 숙소'용 (유료 호출 0회). 새 탭에서는 없다
};

const md = (iso: string) => `${Number(iso.slice(5, 7))}월 ${Number(iso.slice(8, 10))}일`;

function blank(token: string): HotelOption {
  return { token, name: "", image: "", images: [], kind: "", amenities: [], deal: "", gps: null, stars: null, rating: null, reviews: null, perNight: null, total: null, priceSource: null, sources: [], near: null, freeCancel: false };
}

// 조회에 같이 온 정보로 빈 칸만 채운다 (이미 아는 값은 그대로)
function fill(h: HotelOption, info: HotelInfo | null): HotelOption {
  if (!info) return h;
  return {
    ...h,
    name: h.name || info.name,
    images: h.images.length >= 3 ? h.images : [...new Set([...h.images, ...info.images])].slice(0, 8),
    image: h.image || info.images[0] || "",
    gps: h.gps ?? info.gps,
    stars: h.stars ?? info.stars,
    rating: h.rating ?? info.rating,
    reviews: h.reviews ?? info.reviews,
    kind: h.kind || info.kind,
    amenities: h.amenities.length ? h.amenities : info.amenities,
  };
}

export function HotelPage({ hotel: base, token, query, saved, onSave, onBack, backLabel, onGo, onToast, reason, peers, spots, pool }: Props) {
  usePriceVersion();
  const [info, setInfo] = useState<HotelInfo | null>(null);
  const hotel = useMemo(() => fill(base ?? blank(token), info), [base, token, info]);
  const nights = nightsOf(query);
  const [station, setStation] = useState<NearStation>(null);
  const onInfo = useCallback((i: HotelInfo) => setInfo(i), []);
  // 한글 이름: 알려진 체인 이름을 한글로 바꿀 수 있을 때만 영문 이름 아래에 함께 (모르면 영문만)
  const koName = hotel.name && hotelNameKo(hotel.name) !== hotel.name ? hotelNameKo(hotel.name) : null;
  // 사진: 숙소 응답에 온 사진(최대 30장, 큰 사진 포함)이 목록 사진보다 많으면 그것으로
  const listPhotos = (hotel.images.length ? hotel.images : hotel.image ? [hotel.image] : []).map((u) => ({ s: u, l: u }));
  const photos = info?.photos && info.photos.length >= listPhotos.length ? info.photos : listPhotos;
  const v = getVerified(hotel.token, query);
  const low = v?.total ?? null;
  const brief = useMemo(() => {
    if (!hotel.gps || !spots?.length) return null;
    const me = spots.find((s) => s.token === hotel.token) ?? (low ? { token: hotel.token, gps: hotel.gps, price: low } : null);
    return priceBrief(cityNear([hotel.gps[1], hotel.gps[0]]), me, spots);
  }, [hotel.gps, hotel.token, spots, low]);

  // 도보 5분 내 편의점·약국·병원: 이 숙소 1곳만, 위치를 알게 되면 한 번 (서버 30일 저장분 우선). 실패하면 줄을 숨긴다
  const grid = hotel.gps ? gridKey(hotel.gps[0], hotel.gps[1]) : null;
  const [amen, setAmen] = useState<{ grid: string; data: Amenities } | null>(null);
  const [amenOn, setAmenOn] = useState(false);
  useEffect(() => {
    if (!grid || !hotel.gps) return;
    const [lat, lng] = hotel.gps;
    const ctl = new AbortController();
    fetch(`/api/nearby-amenities?lat=${lat}&lng=${lng}`, { signal: ctl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { amenities?: Amenities | null } | null) => {
        if (j?.amenities) setAmen({ grid, data: j.amenities });
      })
      .catch(() => undefined);
    return () => ctl.abort();
  }, [grid]); // eslint-disable-line react-hooks/exhaustive-deps
  const amenData = amen && amen.grid === grid ? amen.data : null;
  const extras = useMemo<ExtraPin[] | undefined>(
    () =>
      amenOn && amenData
        ? amenData.items.map((x, i) => ({ id: `${x.kind}${i}`, lat: x.lat, lng: x.lng, kind: x.kind, title: x.name, sub: `${AMENITY_KO[x.kind]} · 도보 약 ${walkMin(x.m)}분` }))
        : undefined,
    [amenOn, amenData],
  );

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: hotel.name || "숙소", url });
        return;
      }
      await navigator.clipboard.writeText(url);
      onToast("링크를 복사했어요");
    } catch {
      // 공유 창을 닫은 경우 등은 조용히 넘어간다
    }
  }

  const location = hotel.gps ? (
    <>
      <DetailMap gps={hotel.gps} name={hotel.name} label={low ? pinText(low) : "숙소"} onStation={setStation} extras={extras} />
      {station && (
        <p className="tb-hp-station">
          🚇 가장 가까운 역 <b>{station.name}</b> · 도보 약 {walkMin(station.m)}분 <small>({Math.round(station.m)}m)</small>
        </p>
      )}
      {amenData && (
        <p className="tb-hp-amen">
          <span>🏪 {amenityLine(amenData)}</span>
          {amenData.items.length > 0 && (
            <button type="button" className="tb-hp-amen-tg" aria-pressed={amenOn} onClick={() => setAmenOn((x) => !x)}>
              {amenOn ? "지도에서 숨기기" : "지도에 표시"}
            </button>
          )}
        </p>
      )}
      {brief && <p className="tb-hp-brief">{brief}</p>}
      <small className="tb-mute">점선 원은 숙소에서 도보 약 5분(400m)·10분(800m)이에요. 직선거리 기준이라 실제 도보 시간은 길에 따라 달라요.</small>
    </>
  ) : null;

  return (
    <main className="tb-hp">
      <div className="tb-hp-top">
        <button type="button" className="tb-hp-back" onClick={onBack}>
          <IconBack size={18} /> {backLabel}
        </button>
      </div>
      <header className="tb-hp-head">
        <div>
          <h1>{hotel.name || <span className="tb-hp-skel" aria-label="숙소 이름을 불러오는 중" />}</h1>
          {koName && <p className="tb-hp-ko" lang="ko">{koName}</p>}
          <p>
            {[hotel.stars ? `${hotel.stars}성급` : hotel.kind, hotel.rating ? `후기 ${hotel.rating.toFixed(1)}${hotel.reviews ? ` (${hotel.reviews.toLocaleString("ko-KR")})` : ""}` : "", query.place].filter(Boolean).join(" · ")}
          </p>
          <p className="tb-hp-sub">
            {md(query.checkIn)} – {md(query.checkOut)} · {nights}박 · {guestText(query)}
          </p>
        </div>
        <button type="button" className="tb-hp-share" onClick={share}>
          공유
        </button>
      </header>
      <HotelGallery photos={photos} name={hotel.name} />
      <SellerBody page hotel={hotel} query={query} saved={saved} onSave={() => onSave(hotel)} onGo={onGo} reason={reason} peers={peers} location={location} onInfo={onInfo} facts={<HotelFacts hotel={hotel} info={info} />} />
      {hotel.name && <SimilarHotels hotel={hotel} query={query} pool={pool} />}
    </main>
  );
}

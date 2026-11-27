"use client";

import { useEffect, useState } from "react";
import { sellerDef, type HotelSellerKey } from "@/lib/hotel-sellers";
import { won } from "@/lib/trip";

// PC 홈 대표 사진 오른쪽 위 '예약처별 총액 비교' 카드.
// 서버에 이미 저장된 실제 확인 결과(체크인이 오늘 이후 · 예약처 3곳 이상)만 읽는다 (유료 검색 0회).
// 그런 기록이 없으면 지어낸 값이 아니라는 걸 밝힌 예시 카드 + '이해를 돕기 위한 예시 화면이에요'
type Snap = { token: string; name: string; place: string | null; checkIn: string; checkOut: string; adults: number; sellers: { key: HotelSellerKey; cost: number; fc: boolean }[]; at: string };

const EXAMPLE: Snap = {
  token: "",
  name: "도쿄 우에노 호텔 (예시)",
  place: "도쿄",
  checkIn: "",
  checkOut: "",
  adults: 2,
  sellers: [
    { key: "booking", cost: 238900, fc: false },
    { key: "agoda", cost: 251400, fc: true },
    { key: "trip", cost: 262000, fc: false },
    { key: "expedia", cost: 268500, fc: false },
    { key: "hotels", cost: 271200, fc: false },
  ],
  at: "",
};

const md = (iso: string) => `${Number(iso.slice(5, 7))}월 ${Number(iso.slice(8, 10))}일`;
const nightsOf = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
const when = (iso: string) => {
  const d = new Date(iso);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export function HomeHeroCard() {
  const [snap, setSnap] = useState<Snap | null | undefined>(undefined);
  useEffect(() => {
    // 휴대폰은 대표 사진을 쓰지 않아 카드도 받지 않는다
    if (!window.matchMedia("(min-width: 1024px)").matches) return;
    let live = true;
    fetch("/api/home/hero")
      .then((r) => (r.ok ? r.json() : { snap: null }))
      .then((d: { snap: Snap | null }) => live && setSnap(d.snap && d.snap.sellers?.length >= 3 ? d.snap : null))
      .catch(() => live && setSnap(null));
    return () => {
      live = false;
    };
  }, []);
  if (snap === undefined) return null;
  const real = !!snap;
  const s = snap ?? EXAMPLE;
  const list = s.sellers.slice(0, 5);
  const save = list.length > 1 ? list[list.length - 1].cost - list[0].cost : 0;
  const nights = real ? nightsOf(s.checkIn, s.checkOut) : 2;
  return (
    <aside className="tb-hero-card" aria-label={real ? "실제 검색 예시: 예약처별 총액" : "예시 화면: 예약처별 총액"}>
      <small className="tb-hero-card-cap">{real ? `실제 검색 예시 · ${when(s.at)} 확인` : "이해를 돕기 위한 예시 화면이에요"}</small>
      <strong>
        {s.name}
        {real && s.place ? ` · ${s.place}` : ""}
      </strong>
      <small>{real ? `${md(s.checkIn)}–${Number(s.checkOut.slice(8, 10))}일 · ${nights}박 · 성인 ${s.adults} · 세금 포함 총액` : `2박 · 성인 2 · 세금 포함 총액`}</small>
      <div className="tb-hero-card-th">
        <span>예약처 {list.length}곳</span>
        <span>{nights}박 세금 포함</span>
      </div>
      <ul>
        {list.map((x, i) => (
          <li key={x.key} className={i === 0 ? "best" : undefined}>
            <span>
              {sellerDef(x.key).ko}
              {i === 0 && <em>가장 낮아요</em>}
            </span>
            <b>{won(x.cost)}</b>
          </li>
        ))}
      </ul>
      {save > 0 && (
        <p className="tb-hero-card-save">
          가장 비싼 곳보다 <b>{won(save)}</b> 아껴요
        </p>
      )}
    </aside>
  );
}

"use client";

import { useEffect, useState } from "react";
import { sellerDef, type HotelSellerKey } from "@/lib/hotel-sellers";
import { won } from "@/lib/trip";
import { savingsOf } from "@/lib/savings";
import { checkedMs, checkedText } from "@/lib/checked-at";
import { getVerified, setVerified, usePriceVersion } from "./prices";

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
  usePriceVersion();
  // 같은 숙소·같은 조건을 이 기기에서 더 최근에 확인했으면 그 값(모든 화면과 같은 값)을, 아니면 서버 기록을 공용 저장소에 넣어 다른 화면도 맞춘다
  const q = snap ? { checkIn: snap.checkIn, checkOut: snap.checkOut, adults: snap.adults } : null;
  const stored = snap && q ? getVerified(snap.token, q) : undefined;
  const snapAt = snap ? (checkedMs(snap.at) ?? 0) : 0;
  useEffect(() => {
    if (!snap || !q || !snapAt) return;
    setVerified(snap.token, q, [...snap.sellers].sort((a, b) => a.cost - b.cost).map((x) => ({ key: x.key, cost: x.cost, freeCancel: x.fc })), true, snapAt);
  }, [snap]); // eslint-disable-line react-hooks/exhaustive-deps
  if (snap === undefined) return null;
  const real = !!snap;
  const base = snap ?? EXAMPLE;
  const s: Snap =
    snap && stored && !stored.partial && stored.at > snapAt && stored.rows?.length
      ? { ...snap, sellers: stored.rows.map((r) => ({ key: r.key, cost: r.cost, fc: !!r.fc })), at: new Date(stored.at).toISOString() }
      : base;
  const list = s.sellers.slice(0, 5);
  const save = savingsOf(list)?.amount ?? 0;
  const nights = real ? nightsOf(s.checkIn, s.checkOut) : 2;
  return (
    <aside className="tb-hero-card" aria-label={real ? "실제 검색 예시: 예약처별 총액" : "예시 화면: 예약처별 총액"}>
      <small className="tb-hero-card-cap">{real ? `실제 검색 예시 · ${checkedText(s.at)}` : "이해를 돕기 위한 예시 화면이에요"}</small>
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
          두 번째로 싼 곳보다 <b>{won(save)}</b> 저렴해요
        </p>
      )}
    </aside>
  );
}

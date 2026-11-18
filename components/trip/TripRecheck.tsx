"use client";

import { useState } from "react";
import { sellerRows, type SellerRow } from "@/lib/hotels";
import { linkRel, sellerDef } from "@/lib/hotel-sellers";
import { stayHref } from "@/lib/trip-url";
import { decodeTrip, sharePath, type SharedTrip as Shared } from "@/lib/trip-share";
import { nightsOf, won, type StayQuery } from "@/lib/trip";
import type { TripItem } from "@/lib/trips";
import { stayPrices } from "./api";
import { setVerified, shownPrice } from "./prices";
import { changeText, MIN_DIFF, priceChange, savedBaseFor } from "./saved-price";
import { IconOut } from "./icons";

const md = (iso: string) => `${Number(iso.slice(5, 7))}월 ${Number(iso.slice(8, 10))}일`;
const hq = (q: StayQuery) => ({ q: q.place, checkIn: q.checkIn, checkOut: q.checkOut, adults: q.adults, rooms: q.rooms, childAges: q.childAges });

// 누를 때 한 번만 예약처 가격을 받는다 (같은 조건은 이 탭에 30분 캐시). 계속 조회하거나 서버에서 따로 지켜보지 않는다
async function recheck(token: string, name: string, q: StayQuery): Promise<SellerRow[] | null> {
  const r = await stayPrices(token, q, name);
  if (!r.ok) return null;
  const rows = sellerRows(r.data.sources, nightsOf(q), name, hq(q));
  setVerified(token, q, rows); // 마이 카드 금액도 맞춘다
  return rows;
}

// 마이 여행 아래: '이 조건으로 가격 다시 보기' + '공유 링크 복사'
export function TripActions<T extends TripItem>({ items, place, checkIn, checkOut, adults }: { items: T[]; place: string; checkIn: string; checkOut: string; adults: number }) {
  const [state, setState] = useState<"idle" | "loading" | { text: string }>("idle");
  const [copied, setCopied] = useState<string | null>(null);

  async function again() {
    setState("loading");
    let changed = 0;
    let same = 0;
    let failed = 0;
    let skipped = 0;
    await Promise.all(
      items.map(async (s) => {
        const rows = await recheck(s.hotel.token, s.hotel.name, s.query);
        if (!rows) return void failed++;
        const diff = priceChange(savedBaseFor(s.hotel.token, s.query), { value: rows[0]?.cost ?? null, verified: true, none: !rows.length });
        if (diff !== null) changed++;
        else if (savedBaseFor(s.hotel.token, s.query)?.verified) same++;
        else skipped++;
      }),
    );
    const parts = [changed ? `${changed}곳은 담을 때와 가격이 달라졌어요` : same ? "담을 때와 가격이 같아요" : "가격을 다시 확인했어요"];
    if (skipped) parts.push(`${skipped}곳은 담을 때 예상 금액이라 견주지 않았어요`);
    if (failed) parts.push(`${failed}곳은 지금 확인하지 못했어요`);
    setState({ text: parts.join(" · ") });
  }

  async function share() {
    const t: Shared = {
      place,
      checkIn,
      checkOut,
      adults,
      hotels: items.map((s) => {
        const p = shownPrice(s.hotel, s.query);
        return { token: s.hotel.token, name: s.hotel.name, price: p.none ? null : p.value, verified: p.verified };
      }),
    };
    const url = `${window.location.origin}${sharePath(t)}`;
    try {
      if (navigator.share) await navigator.share({ title: `${place} 여행`, url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied("링크를 복사했어요");
      }
    } catch {
      setCopied(null);
    }
  }

  return (
    <div className="tb-trip-actions">
      <div className="tb-trip-actions-row">
        <button type="button" className="tb-btn" onClick={again} disabled={state === "loading"}>
          {state === "loading" ? "가격 확인 중…" : "이 조건으로 가격 다시 보기"}
        </button>
        <button type="button" className="tb-btn ghost" onClick={share}>
          공유 링크
        </button>
      </div>
      {state === "loading" && (
        <p className="tb-checking" role="status">
          <i aria-hidden /> 예약처 가격을 확인하는 중
        </p>
      )}
      {typeof state === "object" && <p className="tb-trip-msg" role="status">{state.text}</p>}
      {copied && <p className="tb-trip-msg" role="status">{copied}</p>}
    </div>
  );
}

// 공유 링크(/my?trip=…)로 들어왔을 때 마이 맨 위에 보이는 여행. 로그인 없이 주소에 담긴 값만 쓴다
export function SharedTripView({ code }: { code: string | null }) {
  const t = decodeTrip(code);
  const [rows, setRows] = useState<Record<string, SellerRow[] | null> | null>(null);
  const [loading, setLoading] = useState(false);
  if (!t) return null;
  const q: StayQuery = { place: t.place, checkIn: t.checkIn, checkOut: t.checkOut, adults: t.adults, budget: 0, taste: "" };
  const nights = nightsOf(q);

  async function again() {
    setLoading(true);
    const out: Record<string, SellerRow[] | null> = {};
    await Promise.all(t!.hotels.map(async (h) => (out[h.token] = await recheck(h.token, h.name, q))));
    setRows(out);
    setLoading(false);
  }

  return (
    <section className="tb-trip tb-shared" aria-label="공유받은 여행">
      <header className="tb-trip-head">
        <div>
          <strong>공유받은 여행 · {t.place}</strong>
          <span>
            {md(t.checkIn)} – {md(t.checkOut)} · {nights}박 · 성인 {t.adults}
          </span>
        </div>
      </header>
      <ul className="tb-shared-list">
        {t.hotels.map((h) => {
          const r = rows?.[h.token];
          const now = r?.[0];
          const diff = now && h.price !== null && h.verified ? now.cost - h.price : null;
          return (
            <li key={h.token}>
              <strong>{h.name}</strong>
              <small>
                공유할 때 {h.price !== null ? `${won(h.price)}${h.verified ? "" : " (예상)"}` : "금액 없음"}
              </small>
              {rows && (
                <span className="tb-shared-now">
                  {now ? (
                    <>
                      <b>
                        지금 {won(now.cost)} · {sellerDef(now.key).ko}
                      </b>
                      {diff !== null && Math.abs(diff) >= MIN_DIFF && <em className={`tb-pchg${diff < 0 ? " down" : " up"}`}>{changeText(diff).replace("담을 때보다", "공유할 때보다")}</em>}
                      <a className="tb-book" href={now.href} target="_blank" rel={linkRel(now.key)}>
                        {sellerDef(now.key).ko}에서 보기 <IconOut />
                      </a>
                    </>
                  ) : r ? (
                    <small>지금 확인한 예약처 가격이 없어요</small>
                  ) : (
                    <small>지금 확인하지 못했어요</small>
                  )}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {loading && (
        <p className="tb-checking" role="status">
          <i aria-hidden /> 예약처 가격을 확인하는 중
        </p>
      )}
      <div className="tb-trip-actions-row">
        <button type="button" className="tb-btn" onClick={again} disabled={loading}>
          이 조건으로 가격 다시 보기
        </button>
        <a className="tb-btn ghost" href={stayHref(q)}>
          이 조건으로 숙소 찾기
        </a>
      </div>
      <p className="tb-note">가격은 확인한 시각 기준이라 바뀔 수 있어요. 최종 금액은 예약 사이트 결제 화면에서 확인해 주세요.</p>
    </section>
  );
}

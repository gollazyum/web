"use client";

import { useEffect, useState } from "react";
import { addDays } from "@/lib/dates";
import { won, type StayQuery } from "@/lib/trip";
import type { HomeLow } from "@/lib/usual-price";

// 홈 '평소보다 낮은 숙소': 서버에 이미 쌓인 가격 기록만 읽는다 (외부 검색 호출 0회).
// 같은 숙소 기록이 5일치 이상 쌓이고 그 평균보다 10% 이상 낮은 기록이 있을 때만 보인다. 없으면 이 칸 자체가 없다
export function HomeLows({ onPick }: { onPick: (q: StayQuery) => void }) {
  const [items, setItems] = useState<HomeLow[]>([]);
  useEffect(() => {
    let live = true;
    fetch("/api/home/lows")
      .then((r) => (r.ok ? (r.json() as Promise<{ items: HomeLow[] }>) : { items: [] }))
      .then((d) => live && setItems(Array.isArray(d.items) ? d.items : []))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);
  if (!items.length) return null;
  const md = (iso: string) => `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`;
  return (
    <section className="tb-sec">
      <h2>평소보다 낮은 숙소</h2>
      <div className="tb-snaps">
        {items.map((x) => (
          <button key={`${x.token}${x.stayDate}`} type="button" className="tb-snap" onClick={() => onPick({ place: x.place, checkIn: x.stayDate, checkOut: addDays(x.stayDate, x.nights), adults: 2, budget: 0, taste: "" })}>
            <span className="tb-snap-text">
              <strong>{x.name}</strong>
              <small>
                {x.place} · {md(x.stayDate)} 체크인 {x.nights}박 · 성인 2명
              </small>
              <small>
                조회 기록 {x.days}일 평균({won(x.avg)})보다 {x.pct}% 낮았어요
              </small>
            </span>
            <span className="tb-snap-price">
              <b>{won(x.total)}</b>
              <small>기록된 총액 · 예약처에서 다시 확인</small>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

"use client";

import { useEffect, useState } from "react";
import { won } from "@/lib/trip";
import { isWeekendStay, usualCompare, type HistoryStats, type Peer } from "@/lib/usual-price";

// 숙소 상세 '평소 가격과 비교' 막대 2개 (지금 이 숙소 총액 vs 평균 총액).
// 서버의 가격 기록 평균(외부 검색 없음)을 한 번 묻고, 기록이 모자라면 이번 검색 결과의 동급 숙소와 견준다. 둘 다 안 되면 숨긴다
const memo = new Map<string, Promise<HistoryStats | null>>();
function loadStats(token: string, adults: number, weekend: boolean): Promise<HistoryStats | null> {
  const key = `${token}|${adults}|${weekend ? 1 : 0}`;
  let p = memo.get(key);
  if (!p) {
    p = fetch(`/api/hotels/${encodeURIComponent(token)}/price-stats?adults=${adults}&weekend=${weekend ? 1 : 0}`)
      .then((r) => (r.ok ? (r.json() as Promise<HistoryStats>) : null))
      .catch(() => null);
    memo.set(key, p);
  }
  return p;
}

type Props = { token: string; stars: number | null; adults: number; checkIn: string; nights: number; current: number; peers: Peer[]; kids: boolean };

export function UsualPrice({ token, stars, adults, checkIn, nights, current, peers, kids }: Props) {
  const [stats, setStats] = useState<{ key: string; v: HistoryStats | null } | null>(null);
  const weekend = isWeekendStay(checkIn);
  const key = `${token}|${adults}|${weekend}`;
  useEffect(() => {
    // 아이가 있는 검색은 기록하지 않으므로 서버에 묻지 않는다
    if (kids) return setStats({ key, v: null });
    let live = true;
    void loadStats(token, adults, weekend).then((v) => live && setStats({ key, v }));
    return () => {
      live = false;
    };
  }, [key, kids]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!stats || stats.key !== key) return null;
  const c = usualCompare(stats.v, { token, stars }, peers, current, nights);
  if (!c) return null;
  const max = Math.max(c.current, c.avg);
  const pct = (v: number) => `${Math.max(4, (v / max) * 100)}%`;
  const gap = Math.abs(c.diff);
  const head = c.word === "same" ? "평균과 비슷해요" : c.word === "low" ? `평균보다 ${won(gap)} 낮아요` : `평균보다 ${won(gap)} 높아요`;
  const avgLabel = c.basis === "history" ? `조회 기록 ${c.n}일 평균` : `동급 ${c.n}곳 평균`;
  return (
    <section className="tb-usual" aria-label="평소 가격과 비교">
      <div className="tb-usual-head">
        <h3>평소 가격과 비교</h3>
        <strong className={c.word}>{head}</strong>
      </div>
      <ul className="tb-usual-bars">
        <li>
          <span>지금 이 숙소</span>
          <i aria-hidden>
            <b className="now" style={{ width: pct(c.current) }} />
          </i>
          <em>{won(c.current)}</em>
        </li>
        <li>
          <span>{avgLabel}</span>
          <i aria-hidden>
            <b style={{ width: pct(c.avg) }} />
          </i>
          <em>{won(c.avg)}</em>
        </li>
      </ul>
      <p className="tb-note">
        {c.basis === "history"
          ? `누적된 조회 기록 ${c.n}일 평균과의 비교예요. ${nights}박 전체 숙박 총액 기준이고, 체크인 ${weekend ? "주말" : "평일"} 기록끼리 견줬어요.`
          : `이번 검색 결과 내 동급 ${c.n}곳 평균과의 비교예요. ${nights}박 전체 숙박 총액 기준이에요.${c.estimated ? " 다른 숙소 금액에는 예약처 확인 전 예상 총액이 섞여 있어요." : ""}`}
      </p>
    </section>
  );
}

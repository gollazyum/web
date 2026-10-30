"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { MochiStars } from "./MochiMarks";
import type { PriceState } from "./HotelPriceSheet";
import { RememberPrefsModal, AUTH_ENABLED } from "./RememberPrefsModal";
import { bookingLink, type HotelQuery, type HotelSource, type ReviewTopic } from "@/lib/hotels";
import { hotelNameKo } from "@/lib/hotelText";
import type { CompareItem, Prefs, TopicCache } from "@/lib/lowbotiStore";
import { MAX_CHIPS, PREF_CHIPS, chipOf, positivePct, prefScore, topicFor, topicLine, type Facts } from "@/lib/prefs";
import { useSheet } from "@/lib/useSheet";

// 비교함 2~3곳 비교 (PC는 가운데 큰 모달, 휴대폰은 92dvh 바텀시트). 페이지를 옮기지 않고 결과 위에서 열린다.
// 1) 선호 칩(최대 3개)과 1박 예산을 고르면 lowboti:v1.prefs에 바로 저장해 다음에도 채워 둔다
// 2) 표는 원본 숫자로만 그린다 (AI 문장 없음). 가격은 지금 검색 날짜로 다시 받는다
// 3) 맨 아래 '로보티의 결론'만 /api/compare(Claude)가 숫자를 보고 쓴다. 못 쓰면 같은 숫자로 점수를 매겨 고른다

const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;
const NO_TOPICS = "상세 후기 주제 데이터는 아직 확인하지 못했어요";

type Props = {
  items: CompareItem[];
  query: HotelQuery;
  nights: number;
  prices: Record<string, PriceState>;
  topicCache: TopicCache;
  ensurePrices: (item: CompareItem) => void;
  prefs: Prefs;
  onPrefs: (p: Prefs) => void;
  onClose: () => void;
};

type Row = CompareItem & Facts & { total: number | null; site: HotelSource | null; state: PriceState | null; topicsKnown: boolean };
type Verdict = { winner: number; reasons: string[]; by: "ai" | "data" };

export function CompareModal({ items, query, nights, prices, topicCache, ensurePrices, prefs, onPrefs, onClose }: Props) {
  useSheet(true, onClose);
  const [stage, setStage] = useState<"prefs" | "result">("prefs");
  const [tab, setTab] = useState(0);
  const [budgetText, setBudgetText] = useState(prefs.maxBudgetPerNight ? String(prefs.maxBudgetPerNight / 10000) : "");

  const toggleChip = (id: string) => {
    const on = prefs.chips.includes(id);
    if (!on && prefs.chips.length >= MAX_CHIPS) return;
    onPrefs({ ...prefs, chips: on ? prefs.chips.filter((c) => c !== id) : [...prefs.chips, id] });
  };
  const setBudget = (v: string) => {
    const clean = v.replace(/[^\d.]/g, "").slice(0, 5);
    setBudgetText(clean);
    const n = Math.round(Number(clean) * 10000);
    onPrefs({ ...prefs, maxBudgetPerNight: n > 0 ? n : null });
  };

  function start() {
    items.forEach(ensurePrices);
    setStage("result");
  }

  // 표에 쓰는 숫자. 가격은 지금 날짜로 받은 사이트별 최저가, 아직 못 받았으면 같은 날짜에 담은 값만 쓴다
  const rows: Row[] = items.map((it) => {
    const state = prices[it.token] ?? null;
    const sources = state?.kind === "ok" ? state.sources.filter((s) => s.perNight !== null) : [];
    const site = sources.length ? sources.reduce((a, b) => ((b.total ?? b.perNight ?? Infinity) < (a.total ?? a.perNight ?? Infinity) ? b : a)) : null;
    const sameDates = it.searchParams.checkin === query.checkIn && it.searchParams.checkout === query.checkOut && it.searchParams.adults === query.adults;
    const perNight = site?.perNight ?? (sameDates ? it.perNight : null);
    const total = site?.total ?? (sameDates ? it.total : null) ?? (perNight !== null ? perNight * nights : null);
    const fresh = state?.kind === "ok" ? state.topics : undefined;
    const cached = topicCache[it.token];
    const topics = fresh !== undefined ? fresh : cached ? cached.list : null;
    return { ...it, perNight, total, site, state, topics: topics ?? null, topicsKnown: fresh !== undefined || !!cached };
  });
  const settled = rows.every((r) => r.state && r.state.kind !== "loading");
  const cheapest = Math.min(...rows.map((r) => r.perNight ?? Infinity));
  const lowestTotal = Math.min(...rows.map((r) => r.total ?? Infinity));
  const budget = prefs.maxBudgetPerNight;

  // 결론: 가격을 다 받은 뒤 한 번 묻는다. 선호를 바꾸고 다시 들어오면 다시 묻는다
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const askKey = settled && stage === "result" ? JSON.stringify([prefs, rows.map((r) => [r.token, r.perNight])]) : "";
  useEffect(() => {
    if (!askKey) return;
    setVerdict(null);
    let cancelled = false;
    const fallback = (): Verdict => dataVerdict(rows, prefs, Number.isFinite(cheapest) ? cheapest : null);
    fetch("/api/compare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chips: prefs.chips,
        budget,
        hotels: rows.map((r) => ({
          name: hotelNameKo(r.name),
          perNight: r.perNight,
          total: r.total,
          site: r.site?.name ?? "",
          rating: r.rating,
          reviews: r.reviews,
          stars: r.stars,
          amenities: r.amenities,
          topics: r.topics,
        })),
      }),
    })
      .then(async (res) => {
        const j = res.ok ? ((await res.json()) as { winner: number; reasons: string[] }) : null;
        if (!cancelled) setVerdict(j && rows[j.winner] ? { ...j, by: "ai" } : fallback());
      })
      .catch(() => !cancelled && setVerdict(fallback()));
    return () => {
      cancelled = true;
    };
    // askKey가 rows·prefs를 대신한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [askKey]);

  // 로그인(Phase 2) 플래그가 켜져 있을 때만 결론 뒤에 '이 취향 기억할까요?'
  const [remember, setRemember] = useState(false);
  useEffect(() => {
    if (AUTH_ENABLED && verdict) setRemember(true);
  }, [verdict]);

  const chipTopics = prefs.chips.map(chipOf).filter((c) => c?.topic) as NonNullable<ReturnType<typeof chipOf>>[];
  const keyAmenities = useMemo(() => {
    const picked = prefs.chips.map(chipOf).filter((c) => c?.amenity);
    const count = new Map<string, number>();
    for (const r of items) for (const a of r.amenities) count.set(a, (count.get(a) ?? 0) + 1);
    const wanted = [...count.keys()].filter((a) => picked.some((c) => c!.amenity!.test(a)));
    const common = [...count.entries()].sort((a, b) => b[1] - a[1]).map(([a]) => a);
    return [...new Set([...wanted, ...common])].slice(0, 4);
  }, [items, prefs.chips]);

  const link = (r: Row) => (r.site ? bookingLink(r.site, r.name, { ...query, q: r.searchParams.q }) : "");
  const winner = verdict ? rows[verdict.winner] : null;
  const lead = prefs.chips.length ? prefs.chips.join("·") : "가격과 후기";

  // 결과 화면의 쌓임 순서(도우미 패널 등)와 상관없이 맨 위에 뜨도록 body에 바로 붙인다
  return createPortal(
    <>
      <div className="cmp-dim" aria-hidden="true" onClick={onClose} />
      <div className="cmp" role="dialog" aria-modal="true" aria-label="Gollazyum AI 분석 결과">
        <header className="cmp-head">
          <strong>{stage === "prefs" ? "Gollazyum AI 분석" : `${items.length}곳 AI 분석 결과`}</strong>
          <button type="button" className="cmp-close" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </header>

        {stage === "prefs" ? (
          <div className="cmp-body">
            <h3 className="cmp-q">이번 여행에서 제일 중요한 건?</h3>
            <p className="cmp-sub">최대 {MAX_CHIPS}개까지 눌러 주세요. 다음 분석 때도 기억해 둘게요.</p>
            <div className="chip-row cmp-chips">
              {PREF_CHIPS.map((c) => {
                const on = prefs.chips.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={`chip${on ? " on" : ""}`}
                    aria-pressed={on}
                    aria-disabled={!on && prefs.chips.length >= MAX_CHIPS}
                    onClick={() => toggleChip(c.id)}
                  >
                    {c.emoji} {c.id}
                  </button>
                );
              })}
            </div>
            <label className="cmp-budget">
              <span>1박 예산 (입력 안 해도 돼요)</span>
              <span className="cmp-budget-box">
                <input inputMode="decimal" placeholder="예: 15" value={budgetText} onChange={(e) => setBudget(e.target.value)} />
                만 원 이하
              </span>
            </label>
            <button type="button" className="cmp-cta" onClick={start}>
              AI 분석 결과 보기 ✨
            </button>
          </div>
        ) : (
          <div className="cmp-body">
            <p className="cmp-criteria">
              <span>
                {prefs.chips.length ? prefs.chips.map((id) => `${chipOf(id)?.emoji ?? ""} ${id}`).join("  ") : "기준 없음 (가격·후기 균형)"}
                {budget ? `  · 1박 ${won(budget)} 이하` : ""}
              </span>
              <button type="button" className="link-btn" onClick={() => setStage("prefs")}>
                기준 바꾸기
              </button>
            </p>

            <div className="cmp-table-wrap">
              <table className="cmp-table" style={{ "--cols": rows.length } as React.CSSProperties}>
                <thead>
                  <tr>
                    <th scope="col" className="cmp-label" />
                    {rows.map((r) => (
                      <th key={r.token} scope="col">
                        {r.thumbnail ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={r.thumbnail} alt="" />
                        ) : (
                          <span className="cmp-noimg" />
                        )}
                        <span className="cmp-name">{hotelNameKo(r.name)}</span>
                        {winner?.token === r.token && <em className="cmp-win">AI Insight</em>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">1박 평균</th>
                    {rows.map((r) => (
                      <td key={r.token} className={r.perNight !== null && r.perNight === cheapest && rows.length > 1 ? "best" : undefined}>
                        {r.state?.kind === "loading" || !r.state ? <i className="cmp-wait">불러오는 중</i> : r.perNight !== null ? won(r.perNight) : "-"}
                        {budget && r.perNight !== null && r.perNight > budget && <small className="cmp-over">예산 초과</small>}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <th scope="row">총액 ({nights}박)</th>
                    {rows.map((r) => (
                      <td key={r.token} className={r.total !== null && r.total === lowestTotal && rows.length > 1 ? "best" : undefined}>
                        {r.total !== null ? won(r.total) : "-"}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <th scope="row">가장 낮은 총액 사이트</th>
                    {rows.map((r) => (
                      <td key={r.token}>{r.site?.name ?? (r.state?.kind === "error" ? "못 불러왔어요" : "-")}</td>
                    ))}
                  </tr>
                  <tr>
                    <th scope="row">후기</th>
                    {rows.map((r) => (
                      <td key={r.token}>
                        {r.rating !== null ? `${r.rating.toFixed(1)}점` : "-"}
                        {r.reviews ? <small>{r.reviews.toLocaleString("ko-KR")}개</small> : null}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <th scope="row">등급</th>
                    {rows.map((r) => (
                      <td key={r.token}>{r.stars ? <MochiStars count={r.stars} size={12} /> : "-"}</td>
                    ))}
                  </tr>
                  {keyAmenities.map((a) => (
                    <tr key={a}>
                      <th scope="row">{a}</th>
                      {rows.map((r) => (
                        <td key={r.token}>{r.amenities.includes(a) ? "✔" : "–"}</td>
                      ))}
                    </tr>
                  ))}
                  {/* 후기 주제 줄은 한 곳이라도 숫자가 있을 때만 */}
                  {chipTopics.filter((c) => rows.some((r) => topicFor(c, r.topics))).map((c) => (
                    <tr key={c.id}>
                      <th scope="row">
                        {c.emoji} {c.id} 후기
                      </th>
                      {rows.map((r) => {
                        const t = topicFor(c, r.topics);
                        return (
                          <td key={r.token}>
                            {t ? (
                              <>
                                <span className="m-only">{positivePct(t)}%</span>
                                <span className="pc-only">{topicLine(t)}</span>
                              </>
                            ) : (
                              "-"
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  <tr className="cmp-book-row">
                    <th scope="row" />
                    {rows.map((r) => (
                      <td key={r.token}>
                        {link(r) ? (
                          <a href={link(r)} target="_blank" rel="noopener noreferrer sponsored" className="cmp-book">
                            예약 ↗
                          </a>
                        ) : (
                          "-"
                        )}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="cmp-tabs" role="tablist" aria-label="호텔별 상세">
              {rows.map((r, i) => (
                <button key={r.token} type="button" role="tab" aria-selected={tab === i} onClick={() => setTab(i)}>
                  {hotelNameKo(r.name)}
                </button>
              ))}
            </div>
            <div className="cmp-details">
              {rows.map((r, i) => (
                <Detail key={r.token} row={r} active={tab === i} />
              ))}
            </div>

            <section className="cmp-verdict" aria-live="polite">
              {!verdict || !winner ? (
                <p className="cmp-wait">🤖 Gollazyum AI가 숫자를 맞춰 보고 있어요...</p>
              ) : (
                <>
                  <p className="cmp-verdict-head">
                    🤖 Gollazyum AI의 결론: &quot;{lead} 기준으로는 <b>{hotelNameKo(winner.name)}</b>이(가) 가장 잘 맞아요!&quot;
                  </p>
                  <ul>
                    {verdict.reasons.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                  <p className="cmp-note">
                    {verdict.by === "ai" ? "가격·점수·편의시설·후기 주제 숫자만 보고 썼어요." : "가격·점수·편의시설·후기 주제 숫자로 점수를 매겼어요."} 가격은 지금 시점 기준이에요.
                  </p>
                </>
              )}
            </section>

            <div className="cmp-actions">
              {winner && link(winner) && (
                <a href={link(winner)} target="_blank" rel="noopener noreferrer sponsored" className="cmp-cta">
                  {winner.site?.name}에서 예약하기 ↗
                </a>
              )}
              <button type="button" className="cmp-other" onClick={onClose}>
                다른 후보 보기
              </button>
            </div>
          </div>
        )}
      </div>
      {remember && <RememberPrefsModal onClose={() => setRemember(false)} />}
    </>,
    document.body,
  );
}

// 호텔 하나의 상세: 후기 주제별 긍정 비율과 숫자로 고른 장점·아쉬운 점
function Detail({ row, active }: { row: Row; active: boolean }) {
  const topics = [...(row.topics ?? [])].sort((a, b) => b.total - a.total);
  const good = topics.filter((t) => t.total >= 5 && positivePct(t) >= 80).slice(0, 3);
  const bad = topics.filter((t) => t.total >= 5 && t.negative / t.total >= 0.25).slice(0, 3);
  return (
    <article className={`cmp-detail${active ? " on" : ""}`} role="tabpanel">
      <h4>{hotelNameKo(row.name)}</h4>
      {topics.length ? (
        <>
          <ul className="cmp-topics">
            {topics.slice(0, 8).map((t) => (
              <TopicBar key={t.name} t={t} />
            ))}
          </ul>
          {good.length > 0 && <p className="cmp-pro">👍 {good.map((t) => `${t.name} ${positivePct(t)}%`).join(", ")} 긍정 평가가 많아요</p>}
          {bad.length > 0 && <p className="cmp-con">👀 {bad.map((t) => `${t.name} 부정 ${Math.round((t.negative / t.total) * 100)}%`).join(", ")}는 확인해 보세요</p>}
        </>
      ) : (
        <p className="cmp-none">{row.state?.kind === "loading" || (!row.topicsKnown && !row.state) ? "후기 주제를 불러오는 중이에요..." : NO_TOPICS}</p>
      )}
      <p className="cmp-facts">
        {[row.rating !== null ? `후기 ${row.rating.toFixed(1)}점 (${(row.reviews ?? 0).toLocaleString("ko-KR")}개)` : "", row.amenities.slice(0, 5).join(" · ")].filter(Boolean).join(" | ")}
      </p>
    </article>
  );
}

function TopicBar({ t }: { t: ReviewTopic }) {
  const pct = positivePct(t);
  return (
    <li>
      <span>{t.name}</span>
      <span className="cmp-bar" aria-hidden="true">
        <i style={{ width: `${pct}%` }} />
      </span>
      <em>
        {pct}% <small>({t.positive}/{t.total})</small>
      </em>
    </li>
  );
}

// AI가 답을 못 줄 때: 같은 숫자로 점수를 매겨 고르고, 이유도 숫자로만 쓴다
function dataVerdict(rows: Row[], prefs: Prefs, cheapest: number | null): Verdict {
  const scores = rows.map((r) => prefScore(r, prefs.chips, prefs.maxBudgetPerNight, cheapest));
  const winner = scores.indexOf(Math.max(...scores));
  const w = rows[winner];
  const reasons: string[] = [];
  if (w.perNight !== null && w.perNight === cheapest) reasons.push(`분석한 ${rows.length}곳 중 1박 ${won(w.perNight)}으로 가장 저렴해요`);
  else if (w.perNight !== null && prefs.maxBudgetPerNight && w.perNight <= prefs.maxBudgetPerNight) reasons.push(`1박 ${won(w.perNight)}으로 예산 안에 들어와요`);
  if (w.rating !== null) reasons.push(`후기 ${w.rating.toFixed(1)}점(${(w.reviews ?? 0).toLocaleString("ko-KR")}개)이에요`);
  for (const id of prefs.chips) {
    const c = chipOf(id);
    const t = c && topicFor(c, w.topics);
    if (t) reasons.push(`${id} 후기 ${topicLine(t)}예요`);
    else if (c?.amenity && w.amenities.some((a) => c.amenity!.test(a))) reasons.push(`${id} 편의시설 표시가 있어요`);
  }
  if (w.stars) reasons.push(`${w.stars}성급 숙소예요`);
  return { winner, reasons: reasons.slice(0, 3), by: "data" };
}

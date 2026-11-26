"use client";

import { useEffect, useRef, useState } from "react";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { bandLabel, type PriceBasis } from "@/lib/price-bands";
import { EMPTY_FILTER, RATING_STEPS, toggleIn, activeCount, type FilterCounts, type StayFilter } from "@/lib/stay-filters";
import { Sheet } from "./Sheet";

export type Sort = "ai" | "price" | "priceDesc" | "stars" | "rating";
export const SORTS: { id: Sort; label: string }[] = [
  { id: "ai", label: "관련도순" }, // 검색 결과가 온 순서 그대로 (AI 추천 3곳은 위 띠·배지로 따로 보여 준다)
  { id: "price", label: "낮은 요금순" },
  { id: "priceDesc", label: "높은 요금순" },
  { id: "stars", label: "성급순 (5~1)" },
  { id: "rating", label: "후기 평점순" },
];

// PC 위쪽 알약 줄에 늘 보이는 정렬 (나머지 정렬은 '필터' 서랍 안)
const PC_SORTS: Sort[] = ["ai", "price", "rating"];

const RATING_WORD: Record<number, string> = { 3.5: "좋음", 4: "아주 좋음", 4.5: "최고" };
const AMEN_SHOW = 6;
const QUICK_AMEN = ["대욕장", "전용 욕실", "수영장", "무료 주차", "레스토랑"]; // 와이파이는 거의 모든 숙소에 있어 빼둔다

// 개수는 보여 주지 않는다 (받은 숙소가 20곳 안팎이라 숫자가 작게 보여서). 0곳인 항목만 숨긴다
function Check({ on, label, onClick, radio }: { on: boolean; label: string; count?: number; onClick: () => void; radio?: boolean }) {
  return (
    <button type="button" className={`tb-fopt${radio ? " radio" : ""}`} aria-pressed={on} onClick={onClick}>
      <span>{label}</span>
      <i aria-hidden />
    </button>
  );
}

// 필터 항목 (휴대폰 전체 화면과 PC 왼쪽이 같이 쓴다). 받은 목록에 없는 항목은 숨긴다
function BasisToggle({ basis, set, nights }: { basis: PriceBasis; set: (b: PriceBasis) => void; nights: number }) {
  return (
    <span className="tb-basis" role="group" aria-label="요금 기준">
      <button type="button" aria-pressed={basis === "total"} onClick={() => set("total")}>
        {nights}박 총액
      </button>
      <button type="button" aria-pressed={basis === "night"} onClick={() => set("night")}>
        1박
      </button>
    </span>
  );
}

export function FilterPanel({ c, f, set, nights = 1 }: { c: FilterCounts; f: StayFilter; set: (f: StayFilter) => void; nights?: number }) {
  const [more, setMore] = useState(false);
  const [basis, setBasis] = useState<PriceBasis>("total");
  const stars = c.stars.filter((s) => s.count > 0 || f.stars.includes(s.n));
  const bands = c.bands.filter((b) => b.count > 0 || f.bands.includes(b.id));
  const ratings = c.ratings.filter((r) => r.count > 0);
  const kinds = c.kinds.filter((k) => k.name);
  const amen = more ? c.amenities : c.amenities.slice(0, AMEN_SHOW);
  // 빠른 조건: 아래 '성급'과 겹치지 않게, 받은 목록에서 바로 거를 수 있는 인기 조건만 (최대 4개)
  const top = c.ratings.find((r) => r.min === 4.5);
  const quick = [
    ...(c.freeCancel ? [{ key: "fc", label: "무료 취소", on: f.freeCancel, tap: () => set({ ...f, freeCancel: !f.freeCancel }) }] : []),
    ...(c.breakfast ? [{ key: "bf", label: "조식 포함", on: f.breakfast, tap: () => set({ ...f, breakfast: !f.breakfast }) }] : []),
    ...(top && top.count > 0 ? [{ key: "r45", label: "4.5점 이상", on: f.minRating === 4.5, tap: () => set({ ...f, minRating: f.minRating === 4.5 ? 0 : 4.5 }) }] : []),
    ...QUICK_AMEN.filter((name) => c.amenities.some((a) => a.name === name && a.count > 0)).map((name) => ({
      key: `a:${name}`,
      label: name,
      on: f.amenities.includes(name),
      tap: () => set({ ...f, amenities: toggleIn(f.amenities, name) }),
    })),
  ].slice(0, 4);
  return (
    <div className="tb-fpanel">
      {quick.length > 0 && (
        <section>
          <h3>빠른 조건</h3>
          <div className="tb-chips">
            {quick.map((q) => (
              <button key={q.key} type="button" className="tb-chip line" aria-pressed={q.on} onClick={q.tap}>
                {q.label}
              </button>
            ))}
          </div>
        </section>
      )}
      {stars.length > 0 && (
        <section>
          <h3>성급</h3>
          <div className="tb-fgrid five">
            {[1, 2, 3, 4, 5].map((n) => {
              const s = c.stars[n - 1];
              return (
                <button key={n} type="button" className="tb-fbox" aria-pressed={f.stars.includes(n)} disabled={!s.count && !f.stars.includes(n)} onClick={() => set({ ...f, stars: toggleIn(f.stars, n) })}>
                  <b>
                    {n}
                    <span className="tb-star" aria-hidden>
                      ★
                    </span>
                  </b>
                </button>
              );
            })}
          </div>
        </section>
      )}
      {bands.length > 0 && (
        <section>
          <h3 className="tb-h3-row">
            <span>
              요금 <small>세금 포함</small>
            </span>
            <BasisToggle basis={basis} set={setBasis} nights={nights} />
          </h3>
          <div className="tb-fgrid two">
            {bands.map((b) => (
              <button key={b.id} type="button" className="tb-fbox" aria-pressed={f.bands.includes(b.id)} onClick={() => set({ ...f, bands: toggleIn(f.bands, b.id) })}>
                <b>{bandLabel(b, basis, nights)}</b>
              </button>
            ))}
          </div>
        </section>
      )}
      {ratings.length > 0 && (
        <section>
          <h3>
            후기 평점 <small>5점 만점</small>
          </h3>
          <div className="tb-fgrid three">
            {RATING_STEPS.map((min) => {
              const r = c.ratings.find((x) => x.min === min)!;
              return (
                <button key={min} type="button" className="tb-fbox" aria-pressed={f.minRating === min} disabled={!r.count} onClick={() => set({ ...f, minRating: f.minRating === min ? 0 : min })}>
                  <b>{min.toFixed(1)}+</b>
                  <small>{RATING_WORD[min]}</small>
                </button>
              );
            })}
          </div>
        </section>
      )}
      {kinds.length > 1 && (
        <section>
          <h3>숙소 종류</h3>
          {kinds.map((k) => (
            <Check key={k.name} on={f.kinds.includes(k.name)} label={k.name} count={k.count} onClick={() => set({ ...f, kinds: toggleIn(f.kinds, k.name) })} />
          ))}
        </section>
      )}
      {c.amenities.length > 0 && (
        <section>
          <h3>편의시설</h3>
          {amen.map((a) => (
            <Check key={a.name} on={f.amenities.includes(a.name)} label={a.name} count={a.count} onClick={() => set({ ...f, amenities: toggleIn(f.amenities, a.name) })} />
          ))}
          {c.amenities.length > AMEN_SHOW && (
            <button type="button" className="tb-fmore" onClick={() => setMore((m) => !m)}>
              {more ? "접기" : "더 보기"}
            </button>
          )}
        </section>
      )}
      {c.breakfast > 0 && (
        <section className="tb-frow">
          <h3>조식 포함</h3>
          <button type="button" className="tb-switch" role="switch" aria-checked={f.breakfast} aria-label="조식 포함" onClick={() => set({ ...f, breakfast: !f.breakfast })}>
            <span>
              <i />
            </span>
          </button>
        </section>
      )}
      {c.freeCancel > 0 && (
        <section>
          <h3>결제·취소</h3>
          <Check on={f.freeCancel} label="무료 취소" count={c.freeCancel} onClick={() => set({ ...f, freeCancel: !f.freeCancel })} />
        </section>
      )}
    </div>
  );
}

// 휴대폰·좁은 PC: 결과 위 고정 3버튼 (조건 검색 / 요금 / 정렬 기준)
export function FilterBar({ c, f, set, sort, setSort, nights = 1, onMap }: { c: FilterCounts; f: StayFilter; set: (f: StayFilter) => void; sort: Sort; setSort: (s: Sort) => void; nights?: number; onMap?: () => void }) {
  const [open, setOpen] = useState<"all" | "price" | "sort" | null>(null);
  const [basis, setBasis] = useState<PriceBasis>("total");
  const [draft, setDraft] = useState<StayFilter>(f);
  const n = activeCount(f);
  const bands = c.bands.filter((b) => b.count > 0 || f.bands.includes(b.id));
  // PC(1024px 이상): 정렬 3개 + 빠른 조건 + '필터' 알약 한 줄. 받은 목록에 있는 조건만 보인다
  const r45 = c.ratings.find((r) => r.min === 4.5);
  const pcQuick = [
    ...(r45 && r45.count > 0 ? [{ key: "r45", label: "4.5점 이상", on: f.minRating === 4.5, tap: () => set({ ...f, minRating: f.minRating === 4.5 ? 0 : 4.5 }) }] : []),
    ...(c.amenities.some((a) => a.name === "대욕장" && a.count > 0) ? [{ key: "bath", label: "대욕장", on: f.amenities.includes("대욕장"), tap: () => set({ ...f, amenities: toggleIn(f.amenities, "대욕장") }) }] : []),
    ...(c.freeCancel ? [{ key: "fc", label: "무료 취소", on: f.freeCancel, tap: () => set({ ...f, freeCancel: !f.freeCancel }) }] : []),
  ];
  const openAll = () => {
    setDraft(f);
    setOpen("all");
  };
  // PC(1024px 이상): '필터'는 어두운 막·서랍 없이 버튼 바로 아래 흰 팝오버로 (목록을 가리지 않게). 휴대폰은 아래 시트 그대로
  const pc = useMediaQuery("(min-width: 1024px)");
  const pop = useRef<HTMLDivElement>(null);
  const popOpen = pc && open === "all";
  useEffect(() => {
    if (!popOpen) return;
    const out = (e: MouseEvent) => {
      const t = e.target as Node;
      if (pop.current && !pop.current.contains(t) && !(t instanceof Element && t.closest(".tb-pill-filter"))) setOpen(null);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    document.addEventListener("mousedown", out);
    window.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", out);
      window.removeEventListener("keydown", esc);
    };
  }, [popOpen]);
  const allBody = (
    <>
      <FilterPanel c={c} f={draft} set={setDraft} nights={nights} />
      <div className="tb-ffoot">
        <button type="button" className="tb-btn" onClick={() => setDraft(EMPTY_FILTER)}>
          해제하기
        </button>
        <button
          type="button"
          className="tb-cta"
          onClick={() => {
            set(draft);
            setOpen(null);
          }}
        >
          적용하기
        </button>
      </div>
    </>
  );
  return (
    <>
      <div className="tb-pcbar" role="group" aria-label="정렬과 빠른 조건">
        {PC_SORTS.map((id) => (
          <button key={id} type="button" className="tb-pill" aria-pressed={sort === id} onClick={() => setSort(id)}>
            {SORTS.find((s) => s.id === id)!.label}
          </button>
        ))}
        {pcQuick.map((q) => (
          <button key={q.key} type="button" className="tb-pill" aria-pressed={q.on} onClick={q.tap}>
            {q.label}
          </button>
        ))}
        <span className="tb-fpop-anchor">
          <button type="button" className="tb-pill tb-pill-filter" aria-pressed={n > 0} aria-expanded={popOpen} onClick={() => (popOpen ? setOpen(null) : openAll())}>
            필터{n ? ` ${n}` : ""}
          </button>
          {popOpen && (
            <div ref={pop} className="tb-fpop" role="dialog" aria-label="필터">
              <h2 className="tb-fsheet-title">필터</h2>
              {allBody}
            </div>
          )}
        </span>
        {/* PC: 넓은 지도 창 열기 (검색은 다시 하지 않는다) */}
        {onMap && (
          <button type="button" className="tb-pill tb-pill-map" onClick={onMap}>
            지도로 보기
          </button>
        )}
      </div>
      <div className="tb-fbar">
        <button type="button" aria-pressed={n > 0} onClick={openAll}>
          조건 검색{n ? <em>{n}</em> : null}
          <i className="tb-caret" aria-hidden />
        </button>
        <button type="button" aria-pressed={f.bands.length > 0} onClick={() => setOpen("price")}>
          요금{f.bands.length ? <em>{f.bands.length}</em> : null}
          <i className="tb-caret" aria-hidden />
        </button>
        <button type="button" aria-pressed={sort !== "ai"} onClick={() => setOpen("sort")}>
          정렬: {SORTS.find((s) => s.id === sort)!.label}
          <i className="tb-caret" aria-hidden />
        </button>
      </div>

      <Sheet open={!pc && open === "all"} onClose={() => setOpen(null)} label="필터" tall>
        <h2 className="tb-fsheet-title">필터</h2>
        {allBody}
      </Sheet>

      <Sheet open={open === "price"} onClose={() => setOpen(null)} label="요금">
        <h2 className="tb-fsheet-title tb-h3-row">
          <span>
            요금 <small>세금 포함</small>
          </span>
          <BasisToggle basis={basis} set={setBasis} nights={nights} />
        </h2>
        {bands.map((b) => (
          <Check key={b.id} on={f.bands.includes(b.id)} label={bandLabel(b, basis, nights)} count={b.count} onClick={() => set({ ...f, bands: toggleIn(f.bands, b.id) })} />
        ))}
        {!bands.length && <p className="tb-note">요금을 아직 확인하지 못한 숙소만 있어요.</p>}
        <div className="tb-ffoot">
          <button type="button" className="tb-btn" onClick={() => set({ ...f, bands: [] })}>
            해제하기
          </button>
          <button type="button" className="tb-cta" onClick={() => setOpen(null)}>
            적용하기
          </button>
        </div>
      </Sheet>

      <Sheet open={open === "sort"} onClose={() => setOpen(null)} label="정렬 기준">
        <h2 className="tb-fsheet-title">정렬 기준</h2>
        <p className="tb-sort-note">관련도순은 목적지 검색 결과가 온 순서 그대로예요. 저희는 광고나 제휴 수수료로 순서를 바꾸지 않아요. AI 추천 3곳은 목록 위에 따로 보여 드려요.</p>
        <div className="tb-sortlist">
          {SORTS.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={sort === s.id}
              onClick={() => {
                setSort(s.id);
                setOpen(null);
              }}
            >
              {s.label}
              {sort === s.id && <span aria-hidden>✓</span>}
            </button>
          ))}
        </div>
      </Sheet>
    </>
  );
}

"use client";

import { useState } from "react";
import { useSheet } from "@/lib/useSheet";
import {
  AVOIDS,
  BUDGETS,
  CRITERIA,
  FLIGHT_PREFS,
  FOODS,
  NOTE_MAX,
  SPLURGE,
  STAYS,
  TASTES,
  WHO,
  type NoteKey,
  type TasteProfile,
} from "@/lib/taste";
import { IconBack, IconClose, IconSpark } from "./icons";

type Props = {
  init: TasteProfile;
  onDone: (p: TasteProfile) => void;
  onClose: (p: TasteProfile) => void; // ✕나 뒤로가기: 그때까지 고른 것만 저장
};

type Opt = { id: string; label: string; icon?: string };

const flip = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

// 선택 칩 앞의 작은 선 아이콘 (24 기준)
const ICON: Record<string, string> = {
  bell: "M4 18h16M6 18a6 6 0 0 1 12 0M12 9V7m-2 0h4",
  star: "m12 4 2.4 5 5.4.6-4 3.7 1.1 5.4L12 16l-4.9 2.7 1.1-5.4-4-3.7 5.4-.6z",
  palm: "M12 20v-9m0 0c-1-3-4-4-7-3m7 3c1-3 4-4 7-3m-7 3c-2-2-2-5 0-7 2 2 2 5 0 7M7 20h10",
  steam: "M4 15h16a8 4 0 0 1-16 0zM9 11c-1-1 1-2 0-4m3 4c-1-1 1-2 0-4m3 4c-1-1 1-2 0-4",
  coin: "M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm-2-11h3a1.5 1.5 0 0 1 0 3h-2a1.5 1.5 0 0 0 0 3h3m-1-8v1m0 8v1",
  case: "M4 9h16v10H4zM9 9V6h6v3M4 13h16",
  bunk: "M5 4v16m14-16v16M5 9h14M5 15h14M8 9V7h4v2m-4 6v-2h4v2",
  home: "M4 11 12 4l8 7M6 10v10h12V10M10 20v-5h4v5",
  key: "M15 9a4 4 0 1 1-4 4l-7 7m3-3 2 2m1-4 2 2",
  bowl: "M4 11h16a8 7 0 0 1-16 0zM9 7c0-1 1-1 1-2m4 2c0-1 1-1 1-2",
  skewer: "M5 19 19 5M8 11l5 5m-2-8 5 5m-8 3-2-2",
  cup: "M7 5h10l-1 9a4 4 0 0 1-8 0zM12 18v2m-3 0h6",
  coffee: "M5 8h11v6a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4zm11 1h1.5a2.5 2.5 0 0 1 0 5H16M8 4v2m3-2v2",
  dish: "M3 17h18M5 17a7 7 0 0 1 14 0M12 8V6",
  bread: "M5 11a7 4 0 0 1 14 0v7H5zM9 11v7m6-7v7",
  spoon: "M8 4v16M6 4v4a2 2 0 0 0 4 0V4m7 0c-2 0-2 3-2 5s1 2 2 2V20",
};

function Chips({ opts, picked, onPick, other, otherOn, onOther }: { opts: Opt[]; picked: string[]; onPick: (id: string) => void; other?: boolean; otherOn?: boolean; onOther?: () => void }) {
  return (
    <div className="tb-q-chips">
      {opts.map((o) => (
        <button key={o.id} type="button" className="tb-q-chip" aria-pressed={picked.includes(o.id)} aria-label={o.label} onClick={() => onPick(o.id)}>
          {o.icon && ICON[o.icon] && (
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d={ICON[o.icon]} />
            </svg>
          )}
          {/^₩+ /.test(o.label) ? (
            <>
              <span className="tb-won" aria-hidden>
                {o.label.split(" ")[0]}
              </span>
              {o.label.slice(o.label.indexOf(" ") + 1)}
            </>
          ) : (
            o.label
          )}
        </button>
      ))}
      {other && (
        <button type="button" className="tb-q-chip" aria-pressed={!!otherOn} onClick={onOther}>
          기타
        </button>
      )}
    </div>
  );
}

const STEPS = ["여행 스타일", "좋아하는 여행", "숙소", "음식", "준비 끝"];

// 처음 들어오면 한 화면에 질문 묶음 하나씩 묻는다. 무엇이든 하나 고르면 '다음'이 켜진다
export function Onboarding({ init, onDone, onClose }: Props) {
  const [step, setStep] = useState(0);
  const [p, setP] = useState<TasteProfile>(init);
  const [open, setOpen] = useState<Partial<Record<NoteKey, boolean>>>(() => ({ splurge: !!init.notes.splurge, stay: !!init.notes.stay, food: !!init.notes.food, avoid: !!init.notes.avoid }));
  useSheet(true, () => onClose(p)); // 휴대폰 뒤로가기 = 닫기, 뒤 화면 스크롤 잠금

  const set = <K extends keyof TasteProfile>(k: K, v: TasteProfile[K]) => setP((x) => ({ ...x, [k]: v }));
  const tog = <K extends "who" | "splurge" | "tastes" | "stays" | "criteria" | "flight" | "foods">(k: K, id: string) => setP((x) => ({ ...x, [k]: flip(x[k] as string[], id) }));
  const note = (k: NoteKey) => (open[k] ? (p.notes[k] ?? "") : "");
  const toggleNote = (k: NoteKey) => setOpen((o) => ({ ...o, [k]: !o[k] }));
  // 기타 칸을 닫으면 적은 말도 버린다
  const final = (): TasteProfile => ({ ...p, notes: Object.fromEntries((Object.keys(p.notes) as NoteKey[]).filter((k) => open[k] && p.notes[k]).map((k) => [k, p.notes[k]])) });

  // 컴포넌트가 아니라 그냥 함수로 부른다 (매번 새로 만들어지면 입력 중 포커스가 빠진다)
  const noteInput = (k: NoteKey, ph: string) =>
    open[k] ? <input className="tb-q-note" value={p.notes[k] ?? ""} maxLength={NOTE_MAX} placeholder={ph} aria-label={ph} onChange={(e) => setP((x) => ({ ...x, notes: { ...x.notes, [k]: e.target.value } }))} /> : null;

  const ready = [
    p.who.length > 0 || !!p.budget || p.splurge.length > 0 || !!note("splurge"),
    p.tastes.length > 0,
    p.stays.length > 0 || !!note("stay") || p.criteria.length > 0 || p.flight.length > 0,
    p.foods.length > 0 || !!note("food") || p.avoid.length > 0 || !!note("avoid"),
    true,
  ][step];
  const last = step === STEPS.length - 1;

  return (
    <div className="tb-onb" role="dialog" aria-modal="true" aria-label="여행 취향 설문">
      <div className="tb-onb-in">
        <div className="tb-onb-top">
          {step === 0 || last ? <span className="tb-orb" style={{ width: 40, height: 40 }} aria-hidden /> : <span className="tb-onb-mark" aria-hidden><IconSpark size={20} /></span>}
          <button type="button" className="tb-onb-x" onClick={() => onClose(final())} aria-label="닫기">
            <IconClose size={20} />
          </button>
        </div>

        {step === 0 && (
          <section>
            <h1>어떤 여행을 다니는지 알려 주세요</h1>
            <p className="tb-onb-lead">여행할 때 중요한 걸 알려 주시면 추천을 맞춰 드려요.</p>
            <h2 className="tb-q">주로 누구와 여행하세요?</h2>
            <Chips opts={WHO} picked={p.who} onPick={(id) => tog("who", id)} />
            <h2 className="tb-q">여행 예산은 보통 어느 정도예요?</h2>
            <Chips opts={BUDGETS} picked={p.budget ? [p.budget] : []} onPick={(id) => set("budget", p.budget === id ? "" : (id as TasteProfile["budget"]))} />
            <h2 className="tb-q">여행에서 아끼지 않는 건 무엇인가요?</h2>
            <Chips opts={SPLURGE} picked={p.splurge} onPick={(id) => tog("splurge", id)} other otherOn={open.splurge} onOther={() => toggleNote("splurge")} />
            {noteInput("splurge", "예: 공연, 사진 촬영")}
          </section>
        )}

        {step === 1 && (
          <section>
            <h1>어떤 여행을 좋아하세요?</h1>
            <p className="tb-onb-lead">끌리는 사진을 골라 주세요. 여러 개 골라도 돼요.</p>
            <div className="tb-onb-tiles">
              {TASTES.map((t) => {
                const on = p.tastes.includes(t.id);
                return (
                  <button key={t.id} type="button" className={`tb-onb-tile${on ? " on" : ""}`} aria-pressed={on} onClick={() => tog("tastes", t.id)}>
                    <img src={`/taste/${t.id}.svg`} alt="" />
                    <span className="tb-onb-lb">{t.label}</span>
                    <span className="tb-onb-ck" aria-hidden>
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {step === 2 && (
          <section>
            <h1>어떤 숙소를 좋아하세요?</h1>
            <h2 className="tb-q">주로 묵는 숙소는요?</h2>
            <Chips opts={STAYS} picked={p.stays} onPick={(id) => tog("stays", id)} other otherOn={open.stay} onOther={() => toggleNote("stay")} />
            {noteInput("stay", "예: 캡슐 호텔, 캠핑")}
            <h2 className="tb-q">숙소를 고를 때 중요한 순서대로 눌러 주세요</h2>
            <div className="tb-onb-rank">
              {CRITERIA.map((c) => {
                const i = p.criteria.indexOf(c.id);
                return (
                  <button key={c.id} type="button" className={i >= 0 ? "on" : undefined} aria-pressed={i >= 0} aria-label={i >= 0 ? `${i + 1}순위 ${c.label}` : c.label} onClick={() => tog("criteria", c.id)}>
                    <b aria-hidden>{i >= 0 ? i + 1 : "–"}</b>
                    <span>{c.label}</span>
                  </button>
                );
              })}
            </div>
            <h2 className="tb-q">항공권은요?</h2>
            <Chips opts={FLIGHT_PREFS} picked={p.flight} onPick={(id) => tog("flight", id)} />
          </section>
        )}

        {step === 3 && (
          <section>
            <h1>음식 취향도 알려 주세요</h1>
            <h2 className="tb-q">어떤 곳에서 먹는 걸 좋아하세요?</h2>
            <Chips opts={FOODS} picked={p.foods} onPick={(id) => tog("foods", id)} other otherOn={open.food} onOther={() => toggleNote("food")} />
            {noteInput("food", "예: 라멘, 야키니쿠")}
            <h2 className="tb-q">못 먹거나 피하는 음식이 있나요?</h2>
            <Chips
              opts={AVOIDS}
              picked={p.avoid}
              onPick={(id) => {
                // '없어요'는 다른 것과 같이 고를 수 없다
                if (id === "none") {
                  set("avoid", p.avoid.includes("none") ? [] : ["none"]);
                  setOpen((o) => ({ ...o, avoid: false }));
                } else set("avoid", flip(p.avoid.filter((x) => x !== "none"), id as TasteProfile["avoid"][number]));
              }}
              other
              otherOn={open.avoid}
              onOther={() => {
                set("avoid", p.avoid.filter((x) => x !== "none"));
                toggleNote("avoid");
              }}
            />
            {noteInput("avoid", "예: 견과류 알레르기")}
          </section>
        )}

        {last && (
          <section className="tb-onb-end">
            <h1>준비가 끝났어요</h1>
            <p className="tb-onb-lead">알려 주신 취향으로 숙소와 항공권 추천을 맞춰 드릴게요. 마이 탭에서 언제든 바꿀 수 있어요.</p>
            <button type="button" className="tb-cta tb-onb-go" onClick={() => onDone(final())}>
              시작하기
            </button>
          </section>
        )}

        <div className="tb-onb-foot">
          <div className="tb-onb-bar" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={step + 1} aria-label="설문 진행">
            <i style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
          </div>
          <div className="tb-onb-nav">
            {step > 0 && (
              <button type="button" className="tb-onb-back" onClick={() => setStep(step - 1)} aria-label="이전">
                <IconBack size={20} />
              </button>
            )}
            <span className="tb-onb-step">{STEPS[step]}</span>
            {!last && (
              <button type="button" className="tb-onb-next" disabled={!ready} onClick={() => setStep(step + 1)}>
                다음
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

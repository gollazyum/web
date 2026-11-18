"use client";

import { useState } from "react";
import { useSheet } from "@/lib/useSheet";
import { BUDGETS, CRITERIA, FLIGHT_PREFS, PACES, STAYS, TASTES, WHO, type TasteProfile } from "@/lib/taste";
import { IconBack } from "./icons";

type Props = {
  init: TasteProfile;
  onDone: (p: TasteProfile) => void; // 끝까지 답함
  onSkip: (p: TasteProfile) => void; // '나중에 하기'나 휴대폰 뒤로가기: 그때까지 선택한 것만 저장하고 다시 묻지 않는다
};

type Opt = { id: string; label: string; icon?: string };

const flip = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

// 숙소 유형 칩 앞의 작은 선 아이콘 (24 기준)
const ICON: Record<string, string> = {
  bell: "M4 18h16M6 18a6 6 0 0 1 12 0M12 9V7m-2 0h4",
  star: "m12 4 2.4 5 5.4.6-4 3.7 1.1 5.4L12 16l-4.9 2.7 1.1-5.4-4-3.7 5.4-.6z",
  steam: "M4 15h16a8 4 0 0 1-16 0zM9 11c-1-1 1-2 0-4m3 4c-1-1 1-2 0-4m3 4c-1-1 1-2 0-4",
  coin: "M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm-2-11h3a1.5 1.5 0 0 1 0 3h-2a1.5 1.5 0 0 0 0 3h3m-1-8v1m0 8v1",
  bunk: "M5 4v16m14-16v16M5 9h14M5 15h14M8 9V7h4v2m-4 6v-2h4v2",
  key: "M15 9a4 4 0 1 1-4 4l-7 7m3-3 2 2m1-4 2 2",
};

function Chips({ opts, picked, onPick }: { opts: Opt[]; picked: string[]; onPick: (id: string) => void }) {
  return (
    <div className="tb-q-chips">
      {opts.map((o) => (
        <button key={o.id} type="button" className="tb-q-chip" aria-pressed={picked.includes(o.id)} onClick={() => onPick(o.id)}>
          {o.icon && ICON[o.icon] && (
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d={ICON[o.icon]} />
            </svg>
          )}
          {o.label}
        </button>
      ))}
    </div>
  );
}

const STEPS = ["여행 스타일", "좋아하는 여행", "숙소·항공"];

// AI 채팅에 처음 들어갈 때 한 번만 띄운다. 무엇이든 하나 선택하면 '다음'이 켜진다
export function Onboarding({ init, onDone, onSkip }: Props) {
  const [step, setStep] = useState(0);
  const [p, setP] = useState<TasteProfile>(init);
  useSheet(true, () => onSkip(p)); // 휴대폰 뒤로가기 = 나중에 하기, 뒤 화면 스크롤 잠금

  const one = (k: "budget" | "pace", id: string) => setP((x) => ({ ...x, [k]: x[k] === id ? "" : id }));
  const tog = (k: "who" | "tastes" | "stays" | "criteria" | "flight", id: string) => setP((x) => ({ ...x, [k]: flip(x[k] as string[], id) }));

  const ready = [p.who.length > 0 || !!p.budget || !!p.pace, p.tastes.length > 0, p.stays.length + p.criteria.length + p.flight.length > 0][step];
  const last = step === STEPS.length - 1;

  return (
    <div className="tb-onb" role="dialog" aria-modal="true" aria-label="여행 취향 설문">
      <div className="tb-onb-in">
        {/* P2: 뒤로 가기 머리글 (첫 단계에서는 설문을 닫는다) */}
        <div className="tb-onb-top">
          <button type="button" className="tb-ib" aria-label={step ? "이전 질문" : "설문 닫기"} onClick={() => (step ? setStep(step - 1) : onSkip(p))}>
            <IconBack size={20} />
          </button>
          <strong className="tb-onb-title">여행 취향 설정 · {step + 1}/{STEPS.length}</strong>
          <button type="button" className="tb-onb-skip" onClick={() => onSkip(p)}>
            나중에 하기
          </button>
        </div>

        {step === 0 && (
          <section>
            <h1>어떤 여행을 다니는지 알려 주세요</h1>
            <p className="tb-onb-lead">알려 주시면 AI 추천을 취향에 맞춰 드려요.</p>
            <h2 className="tb-q">주로 누구와 여행하세요?</h2>
            <Chips opts={WHO} picked={p.who} onPick={(id) => tog("who", id)} />
            <h2 className="tb-q">여행 예산은 보통 어느 정도예요?</h2>
            <Chips opts={BUDGETS} picked={p.budget ? [p.budget] : []} onPick={(id) => one("budget", id)} />
            <h2 className="tb-q">하루 이동은 어느 정도가 편하세요?</h2>
            <Chips opts={PACES} picked={p.pace ? [p.pace] : []} onPick={(id) => one("pace", id)} />
          </section>
        )}

        {step === 1 && (
          <section>
            <h1>어떤 여행을 좋아하세요?</h1>
            <p className="tb-onb-lead">끌리는 여행을 선택해 주세요. 여러 개 선택해도 돼요.</p>
            <div className="tb-onb-tiles">
              {TASTES.map((t) => {
                const on = p.tastes.includes(t.id);
                return (
                  <button key={t.id} type="button" className={`tb-onb-tile${on ? " on" : ""}`} aria-pressed={on} onClick={() => tog("tastes", t.id)}>
                    <img src={`/taste/${t.id}.svg?v=2`} alt="" />
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
            <h1>숙소와 항공권 기준을 알려 주세요</h1>
            <h2 className="tb-q">주로 묵는 숙소는요?</h2>
            <Chips opts={STAYS} picked={p.stays} onPick={(id) => tog("stays", id)} />
            <h2 className="tb-q">숙소를 정할 때 중요한 순서대로 선택해 주세요</h2>
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
            <h2 className="tb-q">항공권은 어떤 조건이 좋으세요?</h2>
            <Chips opts={FLIGHT_PREFS} picked={p.flight} onPick={(id) => tog("flight", id)} />
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
            <span className="tb-onb-step">
              {step + 1}/{STEPS.length} {STEPS[step]}
            </span>
            <button type="button" className={`tb-onb-next${last ? " go" : ""}`} disabled={!ready} onClick={() => (last ? onDone(p) : setStep(step + 1))}>
              {last ? "내 맞춤 여행 보러 가기" : "다음"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

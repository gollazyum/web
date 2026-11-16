"use client";

import { useState } from "react";
import { useSheet } from "@/lib/useSheet";
import { CRITERIA, FLIGHT_PREFS, TASTES, type CriterionId, type FlightPrefId, type TasteId, type TasteProfile } from "@/lib/taste";

type Props = {
  init: TasteProfile;
  onDone: (p: TasteProfile) => void;
  onSkip: () => void;
};

const flip = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

// v7 01·02: 취향 사진 고르기 → 숙소 기준 순서 정하기. 어느 단계든 건너뛸 수 있다
export function Onboarding({ init, onDone, onSkip }: Props) {
  const [step, setStep] = useState(0);
  const [tastes, setTastes] = useState<TasteId[]>(init.tastes);
  const [criteria, setCriteria] = useState<CriterionId[]>(init.criteria);
  const [flight, setFlight] = useState<FlightPrefId[]>(init.flight);
  const done = () => onDone({ tastes, criteria, flight });
  useSheet(true, onSkip); // 휴대폰 뒤로가기 = 건너뛰기, 뒤 화면 스크롤 잠금

  return (
    <div className="tb-onb" role="dialog" aria-modal="true" aria-label="취향 고르기">
      <div className="tb-onb-in">
        <div className="tb-onb-top">
          <div className="tb-onb-bar" aria-label={`${step + 1} / 2단계`}>
            <i className="on" />
            <i className={step > 0 ? "on" : undefined} />
          </div>
          <button type="button" className="tb-onb-skip" onClick={onSkip}>
            건너뛰기
          </button>
        </div>

        {step === 0 ? (
          <>
            <h1>
              어떤 여행을
              <br />
              좋아하세요?
            </h1>
            <p className="tb-onb-lead">고른 취향으로 숙소 추천을 맞춰 드려요. 여러 개 골라도 돼요.</p>
            <div className="tb-onb-tiles">
              {TASTES.map((t) => {
                const on = tastes.includes(t.id);
                return (
                  <button key={t.id} type="button" className={`tb-onb-tile${on ? " on" : ""}`} aria-pressed={on} onClick={() => setTastes((l) => flip(l, t.id))}>
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
            <div className="tb-onb-foot">
              <button type="button" className="tb-cta" onClick={() => setStep(1)}>
                {tastes.length ? `다음 · ${tastes.length}개 선택` : "다음"}
              </button>
            </div>
          </>
        ) : (
          <>
            <h1>
              숙소를 고를 때
              <br />
              무엇이 가장 중요한가요?
            </h1>
            <p className="tb-onb-lead">중요한 순서대로 눌러 주세요. 추천 순서에 그대로 반영돼요. 다시 누르면 빠져요.</p>
            <div className="tb-onb-rank">
              {CRITERIA.map((c) => {
                const i = criteria.indexOf(c.id);
                return (
                  <button key={c.id} type="button" className={i >= 0 ? "on" : undefined} aria-pressed={i >= 0} aria-label={i >= 0 ? `${i + 1}순위 ${c.label}` : c.label} onClick={() => setCriteria((l) => flip(l, c.id))}>
                    <b aria-hidden>{i >= 0 ? i + 1 : "–"}</b>
                    <span>{c.label}</span>
                  </button>
                );
              })}
            </div>
            <h2 className="tb-onb-h2">항공권은요?</h2>
            <div className="tb-onb-chips">
              {FLIGHT_PREFS.map((f) => {
                const on = flight.includes(f.id);
                return (
                  <button key={f.id} type="button" className="tb-chip" aria-pressed={on} onClick={() => setFlight((l) => flip(l, f.id))}>
                    {f.label}
                  </button>
                );
              })}
            </div>
            <div className="tb-onb-foot two">
              <button type="button" className="tb-btn" onClick={() => setStep(0)}>
                이전
              </button>
              <button type="button" className="tb-cta" onClick={done}>
                시작하기
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// 마이 탭에 보여 주는 지금 고른 취향 한 줄
export function profileSummary(p: TasteProfile | null): string {
  if (!p || (!p.tastes.length && !p.criteria.length && !p.flight.length)) return "";
  return [
    p.tastes.map((id) => TASTES.find((t) => t.id === id)?.label).join(", "),
    p.criteria.length ? `중요한 순서: ${p.criteria.map((id) => CRITERIA.find((c) => c.id === id)?.label).join(" > ")}` : "",
    p.flight.map((id) => FLIGHT_PREFS.find((f) => f.id === id)?.label).join(", "),
  ]
    .filter(Boolean)
    .join("\n");
}

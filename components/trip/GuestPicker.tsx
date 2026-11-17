"use client";

import { useState } from "react";
import { CABINS, guestText, paxText, type Cabin } from "@/lib/trip";
import { Sheet } from "./Sheet";
import { IconUsers } from "./icons";

// P1-4 인원 정하기: 숙소(객실·성인·아동 나이) / 항공(성인·소아·좌석 등급).
// 검색 카드의 인원 칸을 누르면 시트(PC는 가운데 창)가 열린다. 고른 값은 가격 조회와 예약처 링크에 그대로 넘어간다

function Row({ label, sub, value, min, max, onChange }: { label: string; sub?: string; value: number; min: number; max: number; onChange: (n: number) => void }) {
  return (
    <div className="tb-gp-row">
      <span>
        <b>{label}</b>
        {sub && <small>{sub}</small>}
      </span>
      <span className="tb-stepper">
        <button type="button" onClick={() => onChange(Math.max(min, value - 1))} aria-label={`${label} 줄이기`} disabled={value <= min}>
          −
        </button>
        <b aria-live="polite">{value}</b>
        <button type="button" onClick={() => onChange(Math.min(max, value + 1))} aria-label={`${label} 늘리기`} disabled={value >= max}>
          +
        </button>
      </span>
    </div>
  );
}

type StayGuests = { adults: number; rooms?: number; childAges?: number[] };
type FlightPax = { adults: number; children?: number; cabin?: Cabin };

export function StayGuestPicker({ value, onChange }: { value: StayGuests; onChange: (v: Required<StayGuests>) => void }) {
  const [open, setOpen] = useState(false);
  const rooms = value.rooms ?? 1;
  const ages = value.childAges ?? [];
  const set = (p: Partial<Required<StayGuests>>) => onChange({ adults: value.adults, rooms, childAges: ages, ...p });
  return (
    <>
      <button type="button" className="tb-sf narrow tb-gp-btn" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <IconUsers />
        <span>
          <small>인원</small>
          <b>{guestText(value)}</b>
        </span>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} label="인원">
        <div className="tb-gp">
          <h2>인원</h2>
          <Row label="객실" value={rooms} min={1} max={Math.min(9, value.adults)} onChange={(n) => set({ rooms: n })} />
          <Row label="성인" sub="만 18세 이상" value={value.adults} min={Math.max(1, rooms)} max={9} onChange={(n) => set({ adults: n })} />
          <Row
            label="아동"
            sub="만 0~17세"
            value={ages.length}
            min={0}
            max={6}
            onChange={(n) => set({ childAges: n > ages.length ? [...ages, ...Array(n - ages.length).fill(-1)] : ages.slice(0, n) })}
          />
          {ages.length > 0 && (
            <div className="tb-gp-ages">
              <p>체크인 날 기준 아동 나이를 알려 주세요. 요금이 나이에 따라 달라요.</p>
              {ages.map((a, i) => (
                <label key={i}>
                  <span>아동 {i + 1}</span>
                  <select value={a} onChange={(e) => set({ childAges: ages.map((x, j) => (j === i ? Number(e.target.value) : x)) })}>
                    <option value={-1} disabled>
                      나이
                    </option>
                    {Array.from({ length: 18 }, (_, n) => (
                      <option key={n} value={n}>
                        {n === 0 ? "1세 미만" : `${n}세`}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          )}
          {rooms > 1 && <p className="tb-gp-note">가격은 객실 수와 상관없이 검색한 인원 기준이라, 예약처에서 객실 {rooms}개 금액을 꼭 확인해 주세요.</p>}
          <button type="button" className="tb-gp-done" onClick={() => setOpen(false)}>
            완료
          </button>
        </div>
      </Sheet>
    </>
  );
}

export function FlightPaxPicker({ value, onChange }: { value: FlightPax; onChange: (v: Required<FlightPax>) => void }) {
  const [open, setOpen] = useState(false);
  const children = value.children ?? 0;
  const cabin = value.cabin ?? "y";
  const set = (p: Partial<Required<FlightPax>>) => onChange({ adults: value.adults, children, cabin, ...p });
  return (
    <>
      <button type="button" className="tb-sf narrow tb-gp-btn" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <IconUsers />
        <span>
          <small>인원·좌석</small>
          <b>{paxText(value)}</b>
        </span>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} label="인원과 좌석 등급">
        <div className="tb-gp">
          <h2>인원과 좌석 등급</h2>
          <Row label="성인" sub="만 12세 이상" value={value.adults} min={1} max={9 - children} onChange={(n) => set({ adults: n })} />
          <Row label="소아" sub="만 2~11세" value={children} min={0} max={9 - value.adults} onChange={(n) => set({ children: n })} />
          <div className="tb-gp-cabin" role="radiogroup" aria-label="좌석 등급">
            {CABINS.map((c) => (
              <button key={c.id} type="button" role="radio" aria-checked={cabin === c.id} onClick={() => set({ cabin: c.id })}>
                {c.label}
              </button>
            ))}
          </div>
          <p className="tb-gp-note">만 2세 미만 유아는 예약처에서 함께 추가해 주세요.</p>
          <button type="button" className="tb-gp-done" onClick={() => setOpen(false)}>
            완료
          </button>
        </div>
      </Sheet>
    </>
  );
}

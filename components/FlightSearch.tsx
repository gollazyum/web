"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AirportInput } from "./AirportInput";
import { DateRangePicker } from "./DateRangePicker";
import { codeFromText, labelForCode, loadAirports } from "@/lib/airports";
import { flightsPath, type FlightQuery } from "@/lib/flights";

// 로보티 디자인 항공권 검색창. 찾기를 누르면 결과 페이지(/flights?…)로 넘어가고,
// 그 페이지 위쪽에서도 그대로 다시 쓴다
type Props = { initial?: FlightQuery; compact?: boolean };

export function FlightSearch({ initial, compact }: Props) {
  const router = useRouter();
  const [origin, setOrigin] = useState(
    initial ? { text: initial.from, code: initial.from as string | null } : { text: "서울 모든 공항 (SEL)", code: "SEL" as string | null },
  );
  const [destination, setDestination] = useState({ text: initial?.to ?? "", code: (initial?.to ?? null) as string | null });
  const [depart, setDepart] = useState(initial?.depart ?? "");
  const [ret, setRet] = useState(initial?.ret ?? "");
  const [adults, setAdults] = useState(initial?.adults ?? 1);
  const [error, setError] = useState("");

  // 결과 페이지 주소에는 코드만 있어서, 공항 목록을 받으면 입력칸 글자를 이름으로 바꾼다
  useEffect(() => {
    if (!initial) return;
    loadAirports()
      .then((d) => {
        setOrigin((o) => (o.code && o.text === o.code ? { text: labelForCode(d, o.code), code: o.code } : o));
        setDestination((o) => (o.code && o.text === o.code ? { text: labelForCode(d, o.code), code: o.code } : o));
      })
      .catch(() => {});
    // 처음 한 번만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const from = origin.code ?? codeFromText(origin.text);
    const dest = destination.code ?? codeFromText(destination.text);
    if (!from) return setError("목록에서 출발지를 고르거나 공항 코드 세 글자(예: ICN)를 넣어 주세요.");
    if (!dest) return setError("목록에서 도착지를 고르거나 공항 코드 세 글자(예: NRT)를 넣어 주세요.");
    if (dest === from) return setError("출발지와 도착지가 같아요.");
    if (!depart) return setError("가는 날을 골라 주세요.");
    if (ret && ret < depart) return setError("오는 날은 가는 날 이후로 골라 주세요.");
    setError("");
    router.push(flightsPath({ from, to: dest, depart, ret, adults }));
  }

  return (
    <>
      <form onSubmit={onSubmit} className={`search-card flight-card${compact ? " compact" : ""}`}>
        <AirportInput
          label="출발"
          placeholder="어디에서 출발하세요?"
          text={origin.text}
          onChange={(text, code) => setOrigin({ text, code })}
        />
        <AirportInput
          label="도착"
          placeholder="도시나 공항 이름"
          text={destination.text}
          onChange={(text, code) => setDestination({ text, code })}
        />
        <DateRangePicker
          start={depart}
          end={ret}
          onChange={(a, b) => {
            setDepart(a);
            setRet(b);
          }}
          labels={["가는 날", "오는 날"]}
          prompts={["가는 날을 골라 주세요", "오는 날을 골라 주세요"]}
          endPlaceholder="편도는 비우기"
          minGap={0}
          unit={(n) => (n === 0 ? "당일 왕복" : `${n}박 ${n + 1}일`)}
          quick={{ label: "편도", end: () => "" }}
        />
        <label className="field field-small">
          <span>성인</span>
          <select value={adults} onChange={(e) => setAdults(Number(e.target.value))}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
              <option key={n} value={n}>
                {n}명
              </option>
            ))}
          </select>
        </label>
        <button type="submit">{compact ? "다시 검색" : "항공권 찾기"}</button>
      </form>
      {error && (
        <div className="search-result" role="status">
          <span>{error}</span>
        </div>
      )}
    </>
  );
}

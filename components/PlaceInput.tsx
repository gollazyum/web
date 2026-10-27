"use client";

import { useEffect, useId, useRef, useState } from "react";
import { loadAirports, searchCities } from "@/lib/airports";
import type { PlaceHit } from "@/lib/places";

type Props = { value: string; onChange: (text: string) => void };

// 숙소 검색창 "어디로 가세요?". 글자를 치면 호텔·도시 이름을 추천한다.
// 호텔은 /api/places(Google Places), 키가 없거나 실패하면 공항 데이터의 도시 이름만 보여 준다
export function PlaceInput({ value, onChange }: Props) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [results, setResults] = useState<PlaceHit[]>([]);
  const remoteOff = useRef(false); // 키가 없다는 답을 받으면 그 뒤로는 묻지 않는다
  const session = useRef("");

  useEffect(() => {
    const q = value.trim();
    if (!open || !q) return setResults([]);
    let cancelled = false;

    const local = async (): Promise<PlaceHit[]> => {
      try {
        return searchCities(await loadAirports(), q).map((c) => ({ ...c, kind: "city" as const }));
      } catch {
        return [];
      }
    };

    // 한 글자씩 칠 때마다 부르지 않게 잠깐 기다렸다가 묻는다
    const t = setTimeout(async () => {
      const cities = await local();
      if (cancelled) return;
      setResults(cities);
      setActive(0);
      if (remoteOff.current || q.length < 2) return;
      session.current ||= crypto.randomUUID();
      try {
        const res = await fetch(`/api/places?${new URLSearchParams({ q, session: session.current })}`);
        if (res.status === 503) remoteOff.current = true;
        if (!res.ok || cancelled) return;
        const { places } = (await res.json()) as { places: PlaceHit[] };
        if (!cancelled && places.length) setResults(places.slice(0, 8));
      } catch {
        // 도시 목록을 그대로 둔다
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [value, open]);

  function pick(p: PlaceHit) {
    onChange(p.name);
    setOpen(false);
    session.current = "";
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      pick(results[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const showList = open && results.length > 0;

  return (
    <label className="field field-url airport-field">
      <span>어디로 가세요?</span>
      <input
        type="text"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList ? `${listId}-${active}` : undefined}
        autoComplete="off"
        placeholder="도시나 호텔 이름 (예: 도쿄 신주쿠)"
        maxLength={100}
        value={value}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
      />
      {showList && (
        <ul id={listId} role="listbox" className="airport-list">
          {results.map((p, i) => (
            <li
              key={`${p.kind}-${p.name}-${p.sub}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={`airport-option${i === active ? " active" : ""}`}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => pick(p)}
            >
              <span className="airport-icon" aria-hidden="true">
                {p.kind === "hotel" ? "🏨" : "📍"}
              </span>
              <span className="airport-text">
                <b>{p.name}</b>
                <small>{p.sub}</small>
              </span>
            </li>
          ))}
        </ul>
      )}
    </label>
  );
}

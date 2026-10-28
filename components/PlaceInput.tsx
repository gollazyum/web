"use client";

import { useEffect, useId, useRef, useState } from "react";
import { loadAirports, searchCities } from "@/lib/airports";
import type { PlaceHit } from "@/lib/places";
import { useSearchLayer } from "@/lib/useSheet";

type Props = { value: string; onChange: (text: string) => void; onPicked?: () => void }; // onPicked: 휴대폰에서 고른 뒤 날짜 고르기로 넘어갈 때

// 숙소 검색창 "어디로 가세요?". 글자를 치면 호텔·도시 이름을 추천한다.
// 호텔은 /api/places(Google Places), 키가 없거나 실패하면 공항 데이터의 도시 이름만 보여 준다.
// 휴대폰에서는 누르면 전체 화면 검색 레이어로 펼쳐 목록이 키보드에 가리지 않게 한다
export function PlaceInput({ value, onChange, onPicked }: Props) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [results, setResults] = useState<PlaceHit[]>([]);
  const [searched, setSearched] = useState(""); // 추천을 찾아 본 글자 (없을 때 안내용)
  const remoteOff = useRef(false); // 키가 없다는 답을 받으면 그 뒤로는 묻지 않는다
  const session = useRef("");
  const sl = useSearchLayer();
  const listOpen = open || sl.layer;

  useEffect(() => {
    const q = value.trim();
    if (!listOpen || !q) return setResults([]);
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
      setSearched(q);
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
  }, [value, listOpen]);

  function pick(p: PlaceHit) {
    onChange(p.name);
    setOpen(false);
    session.current = "";
    if (sl.layer) {
      sl.close();
      (document.activeElement as HTMLElement | null)?.blur();
      onPicked?.();
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!listOpen || results.length === 0) return;
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

  const empty = listOpen && results.length === 0 && searched !== "" && searched === value.trim();
  const showList = listOpen && (results.length > 0 || empty);

  return (
    <label className={`field field-url airport-field${sl.layer ? " search-layer" : ""}`} style={sl.style}>
      {sl.layer && (
        <button
          type="button"
          className="layer-back"
          aria-label="검색 닫기"
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => {
            e.preventDefault();
            if (!sl.backReady()) return;
            (document.activeElement as HTMLElement | null)?.blur();
            sl.close();
          }}
        >
          ←
        </button>
      )}
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
        enterKeyHint="search"
        onFocus={() => {
          setOpen(true);
          sl.open();
        }}
        onBlur={() => setOpen(false)}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
      />
      {sl.layer && !value.trim() && <p className="layer-tip">도시나 호텔 이름을 넣어 주세요. 예: 도쿄 신주쿠, 다낭 해변 호텔</p>}
      {showList && (
        <ul id={listId} role="listbox" className="airport-list">
          {empty && <li className="airport-empty">추천할 곳이 없어요. 이대로 "호텔 가격 비교"를 눌러도 찾아 드려요.</li>}
          {results.map((p, i) => (
            <li
              key={`${p.kind}-${p.name}-${p.sub}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={`airport-option${i === active ? " active" : ""}`}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              // 라벨 안이라 기본 동작이 입력칸에 다시 포커스를 주므로 막는다
              onClick={(e) => {
                e.preventDefault();
                pick(p);
              }}
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

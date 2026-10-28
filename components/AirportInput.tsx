"use client";

import { useEffect, useId, useState } from "react";
import { loadAirports, searchPlaces, type Place } from "@/lib/airports";
import { useSearchLayer } from "@/lib/useSheet";

type Props = {
  label: string;
  placeholder: string;
  text: string;
  onChange: (text: string, code: string | null) => void;
  onPicked?: () => void; // 휴대폰에서 고른 뒤 다음 칸으로 넘어갈 때
  inputRef?: React.Ref<HTMLInputElement>;
};

// 글자를 치면 전 세계 도시·공항이 뜨는 입력칸. 휴대폰에서는 전체 화면 검색 레이어로 펼친다
export function AirportInput({ label, placeholder, text, onChange, onPicked, inputRef }: Props) {
  const listId = useId();
  const [data, setData] = useState<Awaited<ReturnType<typeof loadAirports>> | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [results, setResults] = useState<Place[]>([]);
  const sl = useSearchLayer();
  const listOpen = open || sl.layer;

  useEffect(() => {
    setResults(data && listOpen ? searchPlaces(data, text) : []);
    setActive(0);
  }, [data, text, listOpen]);

  function ensureData() {
    if (data) return;
    loadAirports()
      .then((d) => {
        setData(d);
        setFailed(false);
      })
      .catch(() => setFailed(true));
  }

  function pick(p: Place) {
    onChange(p.label, p.code);
    setOpen(false);
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

  const showList = listOpen && text.trim() !== "";

  return (
    <label className={`field airport-field${sl.layer ? " search-layer" : ""}`} style={sl.style}>
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
      <span>{label}</span>
      <input
        ref={inputRef}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && results[active] ? `${listId}-${active}` : undefined}
        autoComplete="off"
        placeholder={placeholder}
        value={text}
        enterKeyHint="search"
        onFocus={(e) => {
          ensureData();
          setOpen(true);
          sl.open();
          e.currentTarget.select();
        }}
        onBlur={() => setOpen(false)}
        onChange={(e) => {
          ensureData();
          onChange(e.target.value, null);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
      />
      {sl.layer && !text.trim() && <p className="layer-tip">도시나 공항 이름, 공항 코드(예: NRT)를 넣어 주세요.</p>}
      {showList && (
        <ul id={listId} role="listbox" className="airport-list">
          {!data && !failed && <li className="airport-empty">공항 목록을 불러오는 중…</li>}
          {failed && <li className="airport-empty">목록을 못 불러왔어요. 공항 코드 세 글자(예: NRT)를 넣어 주세요.</li>}
          {data && results.length === 0 && (
            <li className="airport-empty">찾는 곳이 없어요. 영어 도시 이름이나 공항 코드로도 쳐 보세요.</li>
          )}
          {results.map((p, i) => (
            <li
              key={`${p.kind}-${p.code}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={`airport-option${p.child ? " child" : ""}${i === active ? " active" : ""}`}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              // 라벨 안이라 기본 동작이 입력칸에 다시 포커스를 주므로 막는다
              onClick={(e) => {
                e.preventDefault();
                pick(p);
              }}
            >
              <span className="airport-icon" aria-hidden="true">
                {p.kind === "city" ? "📍" : "✈️"}
              </span>
              <span className="airport-text">
                <b>{p.title}</b>
                <small>{p.sub}</small>
              </span>
            </li>
          ))}
        </ul>
      )}
    </label>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// 숙소 상세 사진: 좌우로 넘기는 띠(손가락 밀기·화살표) + 누르면 크게 보는 라이트박스(←/→/Esc, 밀어서 넘기기).
// 사진은 숙소 응답에 온 것만 (최대 30장)
export type Photo = { s: string; l: string };

export function HotelGallery({ photos, name }: { photos: Photo[]; name: string }) {
  const row = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);
  const [big, setBig] = useState<number | null>(null);

  const go = (d: number) => {
    const el = row.current;
    if (!el) return;
    el.scrollBy({ left: d * el.clientWidth * 0.9, behavior: "smooth" });
  };
  const onScroll = () => {
    const el = row.current;
    const first = el?.firstElementChild as HTMLElement | null;
    if (!el || !first) return;
    setIdx(Math.min(photos.length - 1, Math.round(el.scrollLeft / (first.offsetWidth + 8))));
  };

  if (!photos.length)
    return (
      <div className="tb-hp-gallery n0">
        <div className="tb-hp-nophoto">
          <small>사진을 불러오는 중이에요</small>
        </div>
      </div>
    );

  return (
    <div className="tb-hg">
      <div className="tb-hg-row" ref={row} onScroll={onScroll}>
        {photos.map((p, i) => (
          <button key={p.s + i} type="button" className={`tb-hg-item${i === 0 ? " first" : ""}`} onClick={() => setBig(i)} aria-label={`${name} 사진 ${i + 1} 크게 보기`}>
            <img src={p.s} alt="" loading={i < 3 ? "eager" : "lazy"} onError={(e) => (e.currentTarget.style.visibility = "hidden")} />
          </button>
        ))}
      </div>
      {photos.length > 1 && (
        <>
          <button type="button" className="tb-hg-nav prev" onClick={() => go(-1)} aria-label="이전 사진" disabled={idx === 0}>
            ‹
          </button>
          <button type="button" className="tb-hg-nav next" onClick={() => go(1)} aria-label="다음 사진" disabled={idx >= photos.length - 1}>
            ›
          </button>
          <span className="tb-hg-count tb-num">
            {idx + 1} / {photos.length}
          </span>
        </>
      )}
      {big !== null && <Lightbox photos={photos} name={name} start={big} onClose={() => setBig(null)} />}
    </div>
  );
}

function Lightbox({ photos, name, start, onClose }: { photos: Photo[]; name: string; start: number; onClose: () => void }) {
  const [i, setI] = useState(start);
  const touch = useRef<number | null>(null);
  const step = useCallback((d: number) => setI((x) => Math.max(0, Math.min(photos.length - 1, x + d))), [photos.length]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, step]);
  const host = document.querySelector(".tb-app") ?? document.body;
  return createPortal(
    <div
      className="tb-lb"
      role="dialog"
      aria-modal="true"
      aria-label={`${name} 사진 크게 보기`}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touch.current === null) return;
        const dx = e.changedTouches[0].clientX - touch.current;
        touch.current = null;
        if (Math.abs(dx) > 40) step(dx < 0 ? 1 : -1);
      }}
    >
      <img src={photos[i].l} alt={`${name} 사진 ${i + 1}`} onError={(e) => photos[i].s !== e.currentTarget.src && (e.currentTarget.src = photos[i].s)} />
      <button type="button" className="tb-lb-x" onClick={onClose} aria-label="닫기">
        ✕
      </button>
      {i > 0 && (
        <button type="button" className="tb-lb-nav prev" onClick={() => step(-1)} aria-label="이전 사진">
          ‹
        </button>
      )}
      {i < photos.length - 1 && (
        <button type="button" className="tb-lb-nav next" onClick={() => step(1)} aria-label="다음 사진">
          ›
        </button>
      )}
      <span className="tb-lb-count tb-num">
        {i + 1} / {photos.length}
      </span>
    </div>,
    host,
  );
}

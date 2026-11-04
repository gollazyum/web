"use client";

import { useEffect, useRef } from "react";
import { useSheet } from "@/lib/useSheet";
import { site } from "@/lib/site";

// 상품 정보 제보 시트. 이유를 한 번 누르면 바로 메일 앱이 열린다 (제보를 받아 둘 서버가 아직 없어 메일 본문에 미리 채운다)
// 상품 주소·판매처·화면에 보인 가격·기준 시각은 자동으로 붙는다
export const REPORT_REASONS = ["가격이 달라요", "중고·리퍼 상품이에요", "품절이에요", "링크가 이상해요", "기타"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export type ReportContext = {
  title: string;
  url: string;
  rows: { seller: string; price: string }[]; // 화면에 보인 판매처와 가격 (순서대로)
  fetchedAt: string; // "2026-11-04 18:03" 처럼 사람이 읽는 기준 시각
};

export function reportMailto(reason: ReportReason, ctx: ReportContext, to = site.contactEmail): string {
  const body = [
    `제보 이유: ${reason}`,
    `상품: ${ctx.title}`,
    `상품 주소: ${ctx.url}`,
    `기준 시각: ${ctx.fetchedAt}`,
    "화면에 보인 판매처와 가격:",
    ...(ctx.rows.length ? ctx.rows.map((r) => `- ${r.seller}: ${r.price}`) : ["- (확인된 판매처 없음)"]),
    "",
    "추가로 알려 주실 내용:",
    "",
  ].join("\n");
  return `mailto:${to}?subject=${encodeURIComponent(`[상품 정보 제보] ${reason} · ${ctx.title}`)}&body=${encodeURIComponent(body)}`;
}

// 열리면 초점을 시트로 옮기고, Esc로 닫고, Tab은 시트 안에서만 돈다. 닫히면 연 버튼으로 초점을 돌려준다
export function ReportSheet({ ctx, onClose }: { ctx: ReportContext; onClose: () => void }) {
  useSheet(true, onClose);
  const sheet = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    sheet.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeRef.current();
        return;
      }
      if (e.key !== "Tab" || !sheet.current) return;
      const items = [...sheet.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled])")];
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === sheet.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      opener?.focus?.();
    };
  }, []);

  return (
    <>
      <div className="sheet-dim pd-sheet-dim" aria-hidden="true" onClick={onClose} />
      <div ref={sheet} className="pd-sheet" role="dialog" aria-modal="true" aria-labelledby="pd-report-title" tabIndex={-1}>
        <span className="pd-sheet-grab" aria-hidden="true" />
        <div className="pd-sheet-head">
          <h2 id="pd-report-title">어떤 점이 다른가요?</h2>
          <button type="button" className="pd-sheet-close" aria-label="닫기" onClick={onClose}>
            ✕
          </button>
        </div>
        <p className="pd-sheet-sub">누르면 메일 앱이 열려요. 상품 주소·판매처·가격·기준 시각은 자동으로 들어가요.</p>
        <ul className="pd-reasons">
          {REPORT_REASONS.map((r) => (
            <li key={r}>
              <a href={reportMailto(r, ctx)} onClick={() => setTimeout(onClose, 300)}>
                {r}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { today as localToday } from "@/lib/dates";
import { site } from "@/lib/site";
import { HOME_FAQ } from "@/lib/home-info";
import { readAiCount, readBigText, setBigText } from "@/lib/ui-prefs";

// 마이 탭: 내 취향 기준 · 알림 · 화면 크기 · 오늘 AI 상담 이용 · 고객지원과 결제 안내
export function MySettings({ tasteSummary, onTaste, onTrips }: { tasteSummary: string; onTaste: () => void; onTrips: () => void }) {
  const [big, setBig] = useState(false);
  const [aiCount, setAiCount] = useState(0);
  useEffect(() => {
    setBig(readBigText());
    setAiCount(readAiCount(localToday()));
  }, []);
  const pickSize = (on: boolean) => {
    setBig(on);
    setBigText(on);
  };

  return (
    <div className="tb-set">
      <section className="tb-set-box" id="my-taste">
        <h2 className="tb-h2">내 취향 기준</h2>
        <p className="tb-set-sub">{tasteSummary || "아직 알려 주신 취향이 없어요. 설정하면 AI가 보여 드리는 3곳이 취향에 맞춰져요."}</p>
        <button type="button" className="tb-btn soft" onClick={onTaste}>
          {tasteSummary ? "내 취향 기준 수정" : "취향 설정하기"}
        </button>
      </section>

      <section className="tb-set-box">
        <h2 className="tb-h2">알림 설정</h2>
        <div className="tb-set-row">
          <span>
            <strong>찜한 숙소 가격 변화</strong>
            <small>내 여행 탭을 열면 하루 한 번 최근 찜한 숙소 5곳의 가격을 다시 확인해요.</small>
          </span>
          <button type="button" className="tb-link" onClick={onTrips}>
            내 여행 보기
          </button>
        </div>
        <div className="tb-set-row">
          <span>
            <strong>휴대폰 알림</strong>
            <small>가격이 내려가면 휴대폰으로 알려 드리는 기능을 준비하고 있어요.</small>
          </span>
          <span className="tb-tag ac tb-only-m">곧 열려요</span>
          <span className="tb-soon-text tb-only-pc">준비 중</span>
        </div>
      </section>

      <section className="tb-set-box" id="my-size">
        <h2 className="tb-h2">화면 크기 설정</h2>
        {/* PC: 토글 스위치 한 줄 / 휴대폰: 두 칸 버튼 그대로 */}
        <div className="tb-set-row tb-only-pc">
          <span>
            <strong>큰 글씨 보기</strong>
            <small>켜면 글자와 버튼이 조금 더 커져요.</small>
          </span>
          <button type="button" className="tb-switch" role="switch" aria-checked={big} aria-label="큰 글씨 보기" onClick={() => pickSize(!big)}>
            <span>
              <i />
            </span>
          </button>
        </div>
        <div className="tb-seg two tb-only-m" role="radiogroup" aria-label="글자 크기">
          <button type="button" role="radio" aria-checked={!big} onClick={() => pickSize(false)}>
            기본 보기
          </button>
          <button type="button" role="radio" aria-checked={big} onClick={() => pickSize(true)}>
            큰 글씨 보기
          </button>
        </div>
        <p className="tb-set-sub tb-only-m">큰 글씨 보기를 켜면 글자와 버튼이 조금 더 커져요.</p>
      </section>

      <section className="tb-set-box" id="my-ai">
        <h2 className="tb-h2">오늘 AI 상담 이용 현황</h2>
        <p className="tb-set-count">
          오늘 <strong>{aiCount}번</strong> 물어봤어요
        </p>
        <p className="tb-set-sub">AI 상담은 무료예요. 질문이 한꺼번에 몰리면 잠시 쉬었다가 다시 답해 드려요.</p>
      </section>

      <section className="tb-set-box" id="my-help">
        <h2 className="tb-h2">고객지원 및 결제 안내</h2>
        <ul className="tb-set-links">
          <li>
            <a href={`mailto:${site.contactEmail}`}>
              <span>문의하기</span>
              <small>{site.contactEmail}</small>
            </a>
          </li>
          <li>
            <Link href="/terms">이용약관</Link>
          </li>
          <li>
            <Link href="/privacy">
              <b>개인정보처리방침</b>
            </Link>
          </li>
        </ul>
        <p className="tb-set-sub">{site.footerNotice} 결제는 이동한 예약 사이트에서 이뤄지며, 이 앱은 결제를 대신 받지 않아요.</p>
        {/* 자주 묻는 질문: 2026-11-26 홈 아래에서 이곳으로 옮겼다 */}
        <div className="tb-faq">
          <h3 className="tb-h3">자주 묻는 질문</h3>
          {HOME_FAQ.map((f) => (
            <details key={f.q}>
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}

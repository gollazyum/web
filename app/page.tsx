import type { Metadata } from "next";
import { LinkChecker } from "@/components/LinkChecker";
import { AnalysisMock } from "@/components/AnalysisMock";
import { FamilyCards } from "@/components/FamilyCards";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { SoonBadge } from "@/components/SoonBadge";
import { routes } from "@/lib/agoda";
import { site } from "@/lib/site";


const steps = [
  { title: "탐색 (Explore)", body: "찾고 있는 상품 키워드나 스토어 링크, 또는 여행지 숙소와 일정을 입력해요." },
  { title: "스마트 데이터 (Smart Data)", body: "Gollazyum AI가 여러 스토어와 예약처의 가격 데이터를 모아 한 화면에 깔끔하게 정리해 드려요." },
  { title: "연결 (Connect)", body: "궁금한 건 Gollazyum AI에게 물어보고, 마음에 드는 스토어를 눌러 바로 이동해요." },
];

const faqs = [
  {
    q: "Gollazyum은 무료인가요?",
    a: "네, 무료입니다. Gollazyum을 통해 예약하시면 예약 사이트가 Gollazyum에 소정의 수수료를 지급하며, 고객님이 내는 금액은 달라지지 않습니다.",
  },
  {
    q: "예약과 결제는 어디서 하나요?",
    a: "결제와 예약 확정, 취소는 모두 이동하신 예약 사이트에서 진행됩니다. Gollazyum은 검색 시점의 데이터를 바탕으로 예약 사이트를 연결해 드립니다.",
  },
  {
    q: "어떤 데이터를 보여 주나요?",
    a: "여러 예약 사이트의 가격을 모아 보여 드려요. 쇼핑은 쿠팡·네이버·G마켓·11번가 스토어의 상품 가격, 숙소는 예약 사이트별 숙박 요금, 항공권은 노선별 운임이에요. 아고다 호텔 링크가 있다면 카드사·항공사 같은 아고다 할인 경로로 바꿔 보는 기능도 쓸 수 있어요.",
  },
  {
    q: "가격 변동 알림은 지금 쓸 수 있나요?",
    a: "아직 준비 중이에요. 지금은 원하실 때 직접 검색하면 매번 새로 가격을 확인하실 수 있고, 알림 기능이 열리면 이 페이지에서 안내해 드릴게요.",
  },
  {
    q: "표시된 가격이 실제와 다를 수 있나요?",
    a: "가격은 조회 시점 기준이라 바뀔 수 있습니다. 최종 금액은 예약 사이트의 결제 화면에서 꼭 확인해 주세요.",
  },
];

export const metadata: Metadata = { alternates: { canonical: "/" } };

// 검색엔진용 구조화 데이터: 사이트, 운영 주체, 자주 묻는 질문
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${site.url}/#website`,
      url: site.url,
      name: site.name,
      description: site.description,
      inLanguage: "ko-KR",
      publisher: { "@id": `${site.url}/#organization` },
    },
    {
      "@type": "Organization",
      "@id": `${site.url}/#organization`,
      name: site.name,
      url: site.url,
      logo: `${site.url}/brand/gollazyum-mark.svg`,
      ...(site.contactEmail ? { email: site.contactEmail } : {}),
      ...(site.instagramUrl ? { sameAs: [site.instagramUrl] } : {}),
    },
    {
      "@type": "FAQPage",
      mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    },
  ],
};

export default function Home() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <SiteHeader />

      <section className="hero" id="top">
        <div className="hero-glow" aria-hidden="true" />
        <div className="hero-inner wrap">
          <span className="pill">
            <span className="spark">✦</span> AI Travel &amp; Lifestyle Platform
          </span>
          <h1>
            <span className="nobr hero-line">스마트한 여행과 일상의 시작,</span>{" "}
            <span className="nobr hero-line grad-blue">Gollazyum</span>
          </h1>
          <p className="hero-sub">이커머스 쇼핑 데이터와 글로벌 트래블 솔루션을 하나로 연결하는 차세대 디지털 플랫폼</p>
          <LinkChecker />
          <div className="compared">
            <span className="compared-label">지원 데이터</span>
            <span className="compared-item">
              <strong>쿠팡 · 네이버 · G마켓 · 11번가</strong>
              <em>스토어 가격</em>
            </span>
            <i aria-hidden="true" />
            <span className="compared-item">
              <strong>글로벌 숙박 요금</strong>
            </span>
          </div>
        </div>
      </section>

      <main>
        <section id="how" className="section wrap">
          <p className="eyebrow">이렇게 찾아요</p>
          <h2>세 단계면 충분해요</h2>
          <ol className="steps">
            {steps.map((s, i) => (
              <li key={s.title}>
                <span className="step-num">{String(i + 1).padStart(2, "0")}</span>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="features" className="section wrap">
          <p className="eyebrow">Gollazyum AI Solution</p>
          <h2>
            데이터는 Gollazyum이,
            <br />
            여행 계획은 여유롭게.
          </h2>
          <div className="bento">
            <div className="bento-card bento-analysis">
              <div className="badges">
                <span className="badge ai">AI 분석</span>
                <span className="badge">예시 화면</span>
              </div>
              <h3>한눈에 보는 분석 요약</h3>
              <p>예약 사이트별 총액을 한 화면에 모아, 가격 흐름을 한눈에 볼 수 있어요.</p>
              <AnalysisMock />
            </div>
            <div className="bento-card bento-stat">
              <strong className="stat grad">매번 새로</strong>
              <p>호텔·항공권 가격을 검색할 때마다 다시 받아 와요. 분석 요약의 숫자는 예시예요.</p>
            </div>
            <div className="bento-card bento-stat">
              <strong className="stat grad">0원</strong>
              <p>회원가입도, 추가 수수료도 없어요</p>
            </div>
            <div className="bento-card bento-alert">
              <div className="badges">
                <SoonBadge />
                {site.notifyUrl && (
                  <a className="notify-btn small" href={site.notifyUrl} target="_blank" rel="noopener noreferrer">
                    🔔 오픈 알림 받기
                  </a>
                )}
              </div>
              <h3>가격 변동 알림</h3>
              <p>찜해 둔 호텔이나 노선이 싸지면 알려 드리는 기능을 만들고 있어요. 아직은 신청이나 알림을 받을 수 없어요.</p>
            </div>
            <div className="bento-card">
              <span className="badge lowest">Smart Data</span>
              <h3>총액 기준 데이터</h3>
              <p>1박 표시가가 아니라 세금·수수료를 포함한 결제 금액으로 보여 드려요.</p>
            </div>
            <div className="bento-card">
              <span className="badge ai">AI 도우미</span>
              <h3>Gollazyum AI에게 물어보기</h3>
              <p>예산, 후기 점수, 조식처럼 중요한 걸 말하면 검색 결과 안에서 조건에 맞는 곳을 AI가 정리해 드려요.</p>
            </div>
            <div className="bento-card bento-wide">
              <span className="badge live">안전 결제</span>
              <h3>예약은 각 사이트에서</h3>
              <p>결제와 취소는 연결된 예약 사이트에서 그대로 안전하게 진행돼요. 아고다 링크가 있다면 {routes.length}개 할인 경로도 함께 탐색할 수 있어요.</p>
            </div>
          </div>
        </section>

        <section id="family" className="section wrap">
          <p className="eyebrow">Gollazyum Family</p>
          <h2>쇼핑부터 숙소, 항공권까지 Gollazyum이 연결해요</h2>
          <FamilyCards />
        </section>

        <section id="faq" className="section wrap">
          <p className="eyebrow">궁금한 점</p>
          <h2>자주 묻는 질문</h2>
          <div className="faq">
            {faqs.map((f) => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="wrap">
          <div className="cta">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/family/main-white.svg" alt="Gollazyum" />
            <div>
              <h2>다음 여행, Gollazyum에서 시작해 볼까요?</h2>
              <p>호텔과 항공권 가격을 검색할 때마다 새로 받아 한 화면에서 탐색하고, 예약 사이트로 바로 연결해 드려요.</p>
            </div>
            <a href="#top">탐색하기</a>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}

import Link from "next/link";
import type { Metadata } from "next";
import { LinkChecker } from "@/components/LinkChecker";
import { Logo } from "@/components/Logo";
import { AnalysisMock } from "@/components/AnalysisMock";
import { FamilyCards } from "@/components/FamilyCards";
import { SiteNav } from "@/components/SiteNav";
import { routes } from "@/lib/agoda";
import { site } from "@/lib/site";


const steps = [
  { title: "어디로, 언제", body: "도시나 호텔 이름, 또는 출발지·도착지와 날짜만 골라요." },
  { title: "한눈에 비교", body: "로보티가 여러 예약 사이트의 실시간 가격을 훑어 총액 기준으로 나란히 보여 드려요." },
  { title: "골라서 예약", body: "고민되면 로보티에게 물어보고, 마음에 드는 곳을 눌러 그 예약 사이트에서 결제해요." },
];

const faqs = [
  {
    q: "Lowboti는 무료인가요?",
    a: "네, 무료입니다. Lowboti를 통해 예약하시면 예약 사이트가 Lowboti에 소정의 수수료를 지급하며, 고객님이 내는 금액은 달라지지 않습니다.",
  },
  {
    q: "예약과 결제는 어디서 하나요?",
    a: "결제와 예약 확정, 취소는 모두 선택하신 예약 사이트에서 진행됩니다. Lowboti는 가장 낮은 가격의 사이트를 찾아 연결해 드립니다.",
  },
  {
    q: "어떤 가격을 비교하나요?",
    a: "호텔은 Google 호텔 검색에 나오는 예약 사이트별 가격을, 항공권은 Google 항공편 검색의 실시간 운임을 모아 보여 드립니다. 아고다 호텔 링크가 있다면 카드사·항공사 같은 아고다 할인 경로로 바꿔 보는 기능도 쓸 수 있어요.",
  },
  {
    q: "가격 변동 알림은 지금 쓸 수 있나요?",
    a: "아직 준비 중이에요. 지금은 원하실 때 직접 검색해 실시간 가격을 확인하실 수 있고, 알림 기능이 열리면 이 페이지에서 안내해 드릴게요.",
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
      name: `${site.nameKo} (${site.name})`,
      alternateName: [site.name, site.nameKo],
      description: site.description,
      inLanguage: "ko-KR",
      publisher: { "@id": `${site.url}/#organization` },
    },
    {
      "@type": "Organization",
      "@id": `${site.url}/#organization`,
      name: site.name,
      alternateName: site.nameKo,
      url: site.url,
      logo: `${site.url}/brand/lowboti-mark.svg`,
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
      <header className="nav-bar">
        <div className="nav wrap">
          <Link href="/" className="brand" aria-label="로보티 (Lowboti) 홈">
            <Logo height={40} />
            <span className="brand-badge" aria-hidden="true">
              AI
            </span>
          </Link>
          <SiteNav />
          <a href="#top" className="nav-cta">
            최저가 찾기
          </a>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero-glow" aria-hidden="true" />
        <div className="hero-inner wrap">
          <span className="pill">
            <span className="spark">✦</span> 가성비를 같이 골라 주는 AI 여행 도우미
          </span>
          <h1>
            혹시 나만
            <br />
            <span className="grad">비싸게</span> 예약하고 있나요?
          </h1>
          <LinkChecker />
          <div className="compared">
            <span>로보티가 비교하는 곳</span>
            <strong className="wordmark">Google Hotels</strong>
            <em>예약 사이트별 호텔가</em>
            <i aria-hidden="true" />
            <strong className="wordmark">Google Flights</strong>
            <em>실시간 항공 운임</em>
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
          <p className="eyebrow">로보티가 잘하는 것</p>
          <h2>
            가격 비교는 로보티에게,
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
              <p>예약 사이트별 총액을 나란히 놓고, 어디가 얼마나 싼지 한눈에 볼 수 있어요.</p>
              <AnalysisMock />
            </div>
            <div className="bento-card bento-stat">
              <strong className="stat grad">실시간</strong>
              <p>호텔·항공권 가격을 검색할 때마다 새로 받아 와요</p>
            </div>
            <div className="bento-card bento-stat">
              <strong className="stat grad">0원</strong>
              <p>회원가입도, 추가 수수료도 없어요</p>
            </div>
            <div className="bento-card bento-alert">
              <div className="badges">
                <span className="badge soon-badge">준비 중</span>
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
              <span className="badge lowest">최저가</span>
              <h3>총액 기준 비교</h3>
              <p>1박 표시가가 아니라 세금·수수료를 포함한 결제 금액으로 비교해요.</p>
            </div>
            <div className="bento-card">
              <span className="badge ai">AI 도우미</span>
              <h3>로보티에게 물어보기</h3>
              <p>예산, 후기 점수, 조식처럼 중요한 걸 말하면 검색 결과 안에서 가성비 좋은 곳을 골라 드려요.</p>
            </div>
            <div className="bento-card bento-wide">
              <span className="badge live">안전 결제</span>
              <h3>예약은 각 사이트에서</h3>
              <p>결제와 취소는 선택한 예약 사이트에서 그대로 안전하게 진행돼요. 아고다 링크가 있다면 {routes.length}개 할인 경로로 바꿔 비교해 볼 수도 있어요.</p>
            </div>
          </div>
        </section>

        <section id="family" className="section wrap">
          <p className="eyebrow">로보티 패밀리</p>
          <h2>숙소, 항공권, 쇼핑까지 최저가는 로보티가 찾아요</h2>
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
            <img src="/brand/family/main-white.svg" alt="로보티" />
            <div>
              <h2>다음 여행, 로보티와 같이 골라 볼까요?</h2>
              <p>호텔과 항공권 가격을 한 번에 비교하고, 가성비 좋은 선택을 함께 찾아 드려요.</p>
            </div>
            <a href="#top">최저가 찾기</a>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="wrap">
          <div className="brand">
            <Logo tone="white" height={34} />
          </div>
          <p className="disclosure">
            Lowboti는 제휴 마케팅 사이트입니다. Lowboti의 링크를 통해 예약하시면 예약 사이트로부터 수수료를 받을 수 있으며,
            고객님이 지불하는 금액에는 영향이 없습니다. 표시된 가격은 조회 시점 기준이며 최종 가격은 예약 사이트에서 확인해 주세요.
          </p>
          <p className="footer-links">
            <Link href="/privacy">개인정보처리방침</Link>
            {site.instagramUrl && (
              <a href={site.instagramUrl} target="_blank" rel="noopener noreferrer">
                Instagram
              </a>
            )}
            {site.contactEmail && <a href={`mailto:${site.contactEmail}`}>문의</a>}
          </p>
          <p className="copy">© {new Date().getFullYear()} Lowboti. All rights reserved.</p>
        </div>
      </footer>
    </>
  );
}

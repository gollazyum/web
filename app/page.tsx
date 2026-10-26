import Link from "next/link";
import { LinkChecker } from "@/components/LinkChecker";
import { Logo } from "@/components/Logo";
import { AnalysisMock } from "@/components/AnalysisMock";
import { FamilyCards } from "@/components/FamilyCards";
import { routes } from "@/lib/agoda";
import { site } from "@/lib/site";


const steps = [
  { title: "링크 붙여넣기", body: "아고다에서 보던 호텔 페이지 주소를 그대로 붙여넣어요." },
  { title: "경로별로 비교", body: "로보티가 같은 호텔·날짜를 카드사·항공사·검색 등 여러 접속 경로 링크로 바꿔 드려요." },
  { title: "가장 싼 곳에서 예약", body: "링크를 열어 결제 직전 총액을 비교하고, 가장 싼 경로에서 아고다로 예약해요." },
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
    q: "표시된 가격이 실제와 다를 수 있나요?",
    a: "가격은 조회 시점 기준이라 바뀔 수 있습니다. 최종 금액은 예약 사이트의 결제 화면에서 꼭 확인해 주세요.",
  },
];

export default function Home() {
  return (
    <>
      <header className="nav-bar">
        <div className="nav wrap">
          <Link href="/" className="brand" aria-label="Lowboti 홈">
            <Logo height={40} />
          </Link>
          <nav>
            <a href="#how">사용법</a>
            <a href="#features">기능</a>
            <a href="#family">로보티 패밀리</a>
            <a href="#faq">FAQ</a>
          </nav>
          <a href="#top" className="nav-cta">
            최저가 찾기
          </a>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero-glow" aria-hidden="true" />
        <div className="hero-inner wrap">
          <span className="pill">
            <span className="spark">✦</span> 예약 사이트를 대신 돌아보는 최저가 봇
          </span>
          <h1>
            혹시 나만
            <br />
            <span className="grad">비싸게</span> 예약하고 있나요?
          </h1>
          <LinkChecker />
          <div className="compared">
            <span>로보티가 연결하는 곳</span>
            <strong className="wordmark">agoda</strong>
            <em>{routes.length}개 접속 경로</em>
            <i aria-hidden="true" />
            <strong className="wordmark">Aviasales</strong>
            <em>항공권 검색</em>
          </div>
        </div>
      </section>

      <main>
        <section id="how" className="section wrap">
          <p className="eyebrow">How it works</p>
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
          <p className="eyebrow">Features</p>
          <h2>
            가격 비교는 로보티에게,
            <br />
            여행 계획은 여유롭게.
          </h2>
          <div className="bento">
            <div className="bento-card bento-analysis">
              <div className="badges">
                <span className="badge ai">AI 분석</span>
                <span className="badge">예시</span>
              </div>
              <h3>한눈에 보는 분석 요약</h3>
              <p>경로별 총액을 나란히 놓고, 어디가 얼마나 싼지 한눈에 볼 수 있어요.</p>
              <AnalysisMock />
            </div>
            <div className="bento-card bento-stat">
              <strong className="stat grad">{routes.length}개</strong>
              <p>한 번에 바꿔 주는 아고다 접속 경로</p>
            </div>
            <div className="bento-card bento-stat">
              <strong className="stat grad">0원</strong>
              <p>회원가입도, 추가 수수료도 없어요</p>
            </div>
            <div className="bento-card bento-alert">
              <div className="badges">
                <span className="badge ai">가격 예측</span>
                {site.notifyUrl ? (
                  <a className="notify-btn small" href={site.notifyUrl} target="_blank" rel="noopener noreferrer">
                    🔔 오픈 알림 받기
                  </a>
                ) : (
                  <span className="badge">준비 중</span>
                )}
              </div>
              <h3>가격 변동 알림</h3>
              <p>찜해 둔 호텔이나 노선이 싸지면 바로 알려드려요.</p>
              <div className="alert-mock" aria-hidden="true">
                <svg viewBox="0 0 320 90" className="chart">
                  <defs>
                    <linearGradient id="area" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0" stopColor="#1d4ed8" stopOpacity="0.18" />
                      <stop offset="1" stopColor="#1d4ed8" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d="M0 30 C40 22 60 42 100 36 S160 14 200 32 S260 72 314 66 L314 90 L0 90 Z" fill="url(#area)" />
                  <path d="M0 30 C40 22 60 42 100 36 S160 14 200 32 S260 72 314 66" fill="none" stroke="#1d4ed8" strokeWidth="3" />
                  <circle cx="314" cy="66" r="5" fill="#10b981" stroke="#fff" strokeWidth="2.5" />
                </svg>
                <div className="toast">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/brand/family/main.svg" alt="" />
                  <div>
                    <strong>찜한 호텔 가격이 내려갔어요</strong>
                    <span>어제보다 12% 저렴해요 · 알림 예시</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="bento-card">
              <span className="badge live">최저가</span>
              <h3>총액 기준 비교</h3>
              <p>1박 표시가가 아니라 세금·수수료를 포함한 결제 금액으로 비교해요.</p>
            </div>
            <div className="bento-card">
              <span className="badge live">숨은 경로</span>
              <h3>경로를 한 화면에</h3>
              <p>카드사·항공사·검색 경로를 일일이 찾아다닐 필요 없이 한 번에 모아 드려요.</p>
            </div>
            <div className="bento-card bento-wide">
              <span className="badge live">안전 결제</span>
              <h3>예약은 각 사이트에서</h3>
              <p>결제와 취소는 선택한 예약 사이트에서 그대로 안전하게 진행돼요.</p>
            </div>
          </div>
        </section>

        <section id="family" className="section wrap">
          <p className="eyebrow">Lowboti family</p>
          <h2>숙소, 항공권, 쇼핑까지 최저가는 로보티가 찾아요</h2>
          <FamilyCards />
        </section>

        <section id="faq" className="section wrap">
          <p className="eyebrow">FAQ</p>
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
            <img src="/brand/family/main-white.svg" alt="" />
            <div>
              <h2>지금 보고 있는 그 호텔, 로보티에게 보여주세요</h2>
              <p>같은 방을 더 싸게 예약할 수 있는지 바로 알려드려요.</p>
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

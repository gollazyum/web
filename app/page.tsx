import Link from "next/link";
import { LinkChecker } from "@/components/LinkChecker";
import { Logo } from "@/components/Logo";
import { site, supportedSites } from "@/lib/site";

const family = [
  { img: "hotel", name: "숙소봇", en: "Stay", body: "호텔 링크 하나로 예약 사이트별 총액을 비교해요.", status: "지금 이용 가능", live: true },
  { img: "flight", name: "항공봇", en: "Flight", body: "원하는 노선이 싸지면 바로 알려드려요.", status: "준비 중", live: false },
  { img: "shop", name: "쇼핑봇", en: "Shop", body: "여행 준비물과 유심도 최저가로 찾아드려요.", status: "준비 중", live: false },
];

const steps = [
  { title: "링크 붙여넣기", body: "보고 있던 예약 사이트의 호텔 페이지 주소를 그대로 붙여넣어요." },
  { title: "로보티가 비교", body: "같은 날짜, 같은 인원 기준으로 사이트별 총액을 나란히 보여드려요." },
  { title: "최저가로 예약", body: "가장 싼 사이트로 바로 이동해 그곳에서 안전하게 예약해요." },
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
          <p className="lead">링크만 붙여넣으면 로보티가 같은 호텔의 최저가를 찾아드려요.</p>
          <LinkChecker />
          <div className="compared">
            <span>비교하는 사이트</span>
            {supportedSites.map((s) => (
              <strong key={s.name}>{s.name}</strong>
            ))}
          </div>
        </div>
      </section>

      <main>
        <section id="features" className="section wrap">
          <p className="eyebrow">Features</p>
          <h2>
            가격 비교는 로보티에게,
            <br />
            여행 계획은 여유롭게.
          </h2>
          <div className="bento">
            <div className="bento-card bento-alert">
              <span className="badge">준비 중</span>
              <h3>가격 변동 알림</h3>
              <p>찜해 둔 호텔이나 노선이 싸지면 바로 알려드려요.</p>
              <div className="alert-mock" aria-hidden="true">
                <svg viewBox="0 0 320 120" className="chart">
                  <defs>
                    <linearGradient id="area" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0" stopColor="#1d4ed8" stopOpacity="0.18" />
                      <stop offset="1" stopColor="#1d4ed8" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d="M0 40 C40 30 60 55 100 48 S160 20 200 42 S260 95 320 88 L320 120 L0 120 Z" fill="url(#area)" />
                  <path d="M0 40 C40 30 60 55 100 48 S160 20 200 42 S260 95 320 88" fill="none" stroke="#1d4ed8" strokeWidth="3" />
                  <circle cx="320" cy="88" r="6" fill="#10b981" stroke="#fff" strokeWidth="3" />
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
              <span className="bento-icon">₩</span>
              <h3>총액 기준 비교</h3>
              <p>1박 표시가가 아니라 세금과 수수료를 포함한 결제 금액으로 비교해요.</p>
            </div>
            <div className="bento-card">
              <span className="bento-icon">⇅</span>
              <h3>중립적인 순위</h3>
              <p>특정 사이트를 앞세우지 않고, 가격이 낮은 순서대로만 보여드려요.</p>
            </div>
            <div className="bento-card bento-wide">
              <span className="bento-icon">✓</span>
              <h3>회원가입 없이, 추가 비용 없이</h3>
              <p>로보티는 무료예요. 예약 금액에 수수료가 더해지지 않고, 결제는 각 예약 사이트에서 안전하게 진행돼요.</p>
            </div>
          </div>
        </section>

        <section id="family" className="section wrap">
          <p className="eyebrow">Lowboti family</p>
          <h2>숙소, 항공권, 쇼핑까지 최저가는 로보티가 찾아요</h2>
          <div className="family">
            {family.map((f) => (
              <div key={f.name} className={`family-card family-${f.img}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/brand/family/${f.img}.svg`} alt="" />
                <h3>
                  {f.name} <span>{f.en}</span>
                </h3>
                <p>{f.body}</p>
                <span className={`badge${f.live ? " live" : ""}`}>{f.status}</span>
              </div>
            ))}
          </div>
        </section>

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

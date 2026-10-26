import Link from "next/link";
import { LinkChecker } from "@/components/LinkChecker";
import { Logo } from "@/components/Logo";
import { site, supportedSites } from "@/lib/site";

const steps = [
  { title: "호텔 링크 복사", body: "보고 있던 예약 사이트의 호텔 페이지 주소를 복사합니다." },
  { title: "날짜·인원 입력", body: "링크를 붙여넣고 체크인, 체크아웃, 인원을 고릅니다." },
  { title: "최저가로 예약", body: "총액이 가장 낮은 사이트로 이동해 그곳에서 예약합니다." },
];

const values = [
  { title: "총액 기준 비교", body: "1박 표시가가 아니라 세금과 수수료를 포함한 결제 금액으로 비교합니다." },
  { title: "중립적인 순위", body: "특정 사이트를 앞세우지 않고, 가격이 낮은 순서대로만 보여드립니다." },
  { title: "추가 비용 없음", body: "회원가입 없이 무료입니다. 예약 금액에 수수료가 더해지지 않습니다." },
];

const tips = [
  { title: "세금·수수료 포함 총액", body: "1박 표시가는 낮아도 결제 단계에서 금액이 달라질 수 있습니다." },
  { title: "무료 취소 기한", body: "조금 비싸도 취소 가능한 요금이 더 안전할 때가 많습니다." },
  { title: "사이트마다 다른 가격", body: "같은 객실도 예약 사이트와 접속 경로에 따라 가격이 다릅니다." },
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
      <div className="hero-band">
        <header className="nav wrap">
          <Link href="/" className="brand" aria-label="Lowboti 홈">
            <Logo tone="white" height={30} />
          </Link>
          <nav>
            <a href="#how">이용 방법</a>
            <a href="#tips">예약 팁</a>
            <a href="#faq">FAQ</a>
          </nav>
        </header>

        <section className="hero wrap">
          <p className="eyebrow">Hotel price comparison</p>
          <h1>
            같은 호텔, 같은 객실.
            <br />
            <span className="accent">가장 낮은 가격</span>으로.
          </h1>
          <p className="lead">호텔 링크 하나로 여러 예약 사이트의 총액을 비교합니다.</p>
          <LinkChecker />
          <ul className="trust">
            <li>{supportedSites.length}개 예약 사이트 비교</li>
            <li>세금·수수료 포함 총액</li>
            <li>회원가입 없이 무료</li>
          </ul>
        </section>
      </div>

      <main>
        <section className="section wrap">
          <p className="eyebrow">Compared sites</p>
          <div className="partners">
            {supportedSites.map((s) => (
              <span key={s.name}>{s.name}</span>
            ))}
          </div>
        </section>

        <section id="how" className="section wrap">
          <p className="eyebrow">How it works</p>
          <h2>세 단계면 충분합니다</h2>
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

        <section className="section wrap">
          <p className="eyebrow">Why Lowboti</p>
          <h2>숫자만 정직하게 비교합니다</h2>
          <div className="values">
            {values.map((v) => (
              <div key={v.title} className="value">
                <h3>{v.title}</h3>
                <p>{v.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="tips" className="section wrap">
          <p className="eyebrow">Booking tips</p>
          <h2>결제 전에 확인할 세 가지</h2>
          <ul className="tips">
            {tips.map((t) => (
              <li key={t.title}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
                <div>
                  <h3>{t.title}</h3>
                  <p>{t.body}</p>
                </div>
              </li>
            ))}
          </ul>
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
      </main>

      <footer className="footer">
        <div className="wrap">
          <div className="brand">
            <Logo tone="white" height={24} />
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

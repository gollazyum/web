import Image from "next/image";
import Link from "next/link";
import { LinkChecker } from "@/components/LinkChecker";
import { LogoMark } from "@/components/Logo";
import { site } from "@/lib/site";

const steps = [
  { title: "호텔 링크 붙여넣기", body: "보고 있던 예약 사이트의 호텔 주소를 그대로 넣어요.", img: "emoji-hello" },
  { title: "로보티가 비교", body: "여러 예약 사이트의 가격을 한 화면에 모아 보여드려요.", img: "emoji-searching" },
  { title: "최저가로 예약", body: "가장 싼 곳으로 바로 이동해서 예약하면 끝!", img: "emoji-ding" },
];

const meaning = [
  { word: "Low", color: "var(--green)", body: "가장 낮은 가격. 가격 거품을 바닥까지 낮춰요.", img: "emoji-found" },
  { word: "Bot", color: "var(--blue)", body: "여러 예약 사이트를 한 번에 비교하는 똑똑한 봇.", img: "emoji-compare" },
  { word: "-i", color: "var(--pink)", body: "Bobby, Toby처럼 다정한 애칭. 로봇의 '로보'에 귀여운 '티'를 더했어요.", img: "emoji-wink" },
];

const tips = [
  { title: "세금·수수료 포함 총액", body: "1박 표시가는 낮아도 결제 금액은 다를 수 있어요." },
  { title: "무료 취소 기한", body: "조금 비싸도 취소 가능한 요금이 더 안전할 때가 많아요." },
  { title: "사이트마다 가격 비교", body: "같은 방도 예약 사이트별로 가격이 달라요." },
];

const faqs = [
  {
    q: "로보티는 무료인가요?",
    a: "네, 무료예요. 로보티를 통해 예약하시면 예약 사이트가 로보티에 소정의 수수료를 지급하며, 고객님이 내는 가격은 달라지지 않아요.",
  },
  {
    q: "예약과 결제는 어디서 하나요?",
    a: "결제와 예약 확정, 취소는 모두 선택하신 예약 사이트(예: 아고다)에서 진행돼요. 로보티는 가장 싼 곳을 찾아 연결해 드려요.",
  },
  {
    q: "표시된 가격이 실제와 다를 수 있나요?",
    a: "가격은 확인한 시점 기준이라 바뀔 수 있어요. 최종 금액은 예약 사이트 결제 화면에서 꼭 확인해 주세요.",
  },
];

export default function Home() {
  return (
    <>
      <header className="nav wrap">
        <Link href="/" className="brand" aria-label="Lowboti 홈">
          <LogoMark />
          <span>Lowboti</span>
        </Link>
        <nav>
          <a href="#how">사용법</a>
          <a href="#story">이름의 뜻</a>
          <a href="#faq">FAQ</a>
        </nav>
      </header>

      <main>
        <section className="hero wrap">
          <div className="hero-copy">
            <span className="pill">안녕하세요, 로보티예요!</span>
            <h1>
              가격 거품,
              <br />
              <em>바닥까지</em> <span className="arrow">↓</span>
            </h1>
            <p className="lead">
              같은 호텔, 같은 방인데 사이트마다 가격이 달라요.
              <br />
              링크만 주시면 로보티가 최저가를 찾아드릴게요.
            </p>
            <LinkChecker />
          </div>
          <div className="hero-art">
            <Image src="/images/lowboti-hero.webp" alt="여행 가방을 든 로보티 캐릭터" width={800} height={800} priority />
          </div>
        </section>

        <section id="how" className="section wrap">
          <span className="pill">사용법은 딱 3단계</span>
          <h2>링크만 붙여넣으면 끝!</h2>
          <ol className="steps">
            {steps.map((s, i) => (
              <li key={s.title} className="card">
                <span className={`num${i === 2 ? " green" : ""}`}>{i + 1}</span>
                <Image src={`/images/${s.img}.webp`} alt="" width={96} height={96} />
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="story" className="section wrap">
          <span className="pill">로보티라는 이름의 뜻</span>
          <h2 className="wordmark">
            Low<span style={{ color: "var(--blue)" }}>bot</span>
            <span style={{ color: "var(--green)" }}>i</span>
          </h2>
          <div className="meaning">
            {meaning.map((m) => (
              <div key={m.word} className="card meaning-card">
                <Image src={`/images/${m.img}.webp`} alt="" width={104} height={104} />
                <div>
                  <h3 style={{ color: m.color }}>{m.word}</h3>
                  <p>{m.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="section wrap">
          <span className="pill">로보티의 호텔 예약 꿀팁</span>
          <h2>결제 전, 이것만 확인하세요</h2>
          <ul className="card tips">
            {tips.map((t) => (
              <li key={t.title}>
                <svg viewBox="0 0 56 56" aria-hidden="true">
                  <circle cx="28" cy="28" r="28" fill="var(--green)" />
                  <path d="M15 29 l9 9 l17 -19" stroke="#fff" strokeWidth="7" fill="none" strokeLinecap="round" strokeLinejoin="round" />
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
          <span className="pill">자주 묻는 질문</span>
          <h2>궁금한 점이 있나요?</h2>
          <div className="faq">
            {faqs.map((f) => (
              <details key={f.q} className="card">
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
            <LogoMark size={28} />
            <span>Lowboti</span>
          </div>
          <p className="disclosure">
            Lowboti는 제휴 마케팅 사이트입니다. 로보티의 링크를 통해 예약하시면 예약 사이트로부터 수수료를 받을 수 있으며,
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

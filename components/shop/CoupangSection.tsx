import { COUPANG_HOME, COUPANG_LINK_ATTRS, COUPANG_SAMPLE_PRODUCTS, getCoupangLink } from "@/lib/coupang-links";
import { CoupangDisclosure } from "@/components/shop/CoupangDisclosure";

// 쇼핑 탭의 쿠팡 섹션. 맨 위에 대가성 문구를 고정으로 두고, 그 아래에만 쿠팡 링크를 둔다.
// API 연동 전이라 고정 숫자 가격은 쓰지 않고 쿠팡에서 가격을 확인하도록 안내한다.
// 쿠팡 로고 이미지는 쓰지 않고 'COUPANG' 글자만 쓴다
export function CoupangSection() {
  return (
    <section className="cp-section" aria-labelledby="cp-title">
      <CoupangDisclosure />

      <div className="cp-home">
        <span className="cp-wordmark">COUPANG</span>
        <h2 id="cp-title">쿠팡에서 찾아보기</h2>
        <p>여행 준비물부터 생활용품까지, 쿠팡에서 지금 판매 중인 상품과 혜택가를 확인할 수 있어요.</p>
        <a className="cp-btn" href={COUPANG_HOME} {...COUPANG_LINK_ATTRS}>
          쿠팡에서 찾아보기
        </a>
      </div>

      <h3 className="cp-sub">여행 준비 상품</h3>
      <ul className="cp-cards">
        {COUPANG_SAMPLE_PRODUCTS.map((p) => {
          const href = p.link || getCoupangLink({ title: p.name }, p.keyword).url;
          return (
            <li key={p.name}>
              <a className="cp-card" href={href} {...COUPANG_LINK_ATTRS}>
                <span className="cp-card-img" aria-hidden="true">
                  {p.emoji}
                </span>
                <span className="cp-card-body">
                  <span className="cp-wordmark small">COUPANG</span>
                  <strong>{p.name}</strong>
                  <span className="cp-card-hint">쿠팡에서 혜택가 확인</span>
                  <span className="cp-card-price">쿠팡에서 가격 확인 ›</span>
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

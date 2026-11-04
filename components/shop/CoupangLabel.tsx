import type { CoupangLink } from "@/lib/coupang-links";

// 쿠팡 링크 문구. 검색결과 링크면 "쿠팡에서 '<상품명>' 검색결과 보기 ↗" (상품명이 길면 말줄임).
// 하단 구매 버튼에서는 "쿠팡에서 '<상품명>'" / "검색결과 보기 ↗" 두 줄로 나눠 보여 준다
export function CoupangLabel({ link }: { link: CoupangLink }) {
  if (link.type === "product") return <>쿠팡에서 구매하러 가기 ↗</>;
  return (
    <span className="cp-label" aria-label={`쿠팡에서 '${link.name}' 검색결과 보기`}>
      <span className="cp-label-l1" aria-hidden="true">
        <span>쿠팡에서 &apos;</span>
        <span className="cp-label-name">{link.name}</span>
        <span>&apos;</span>
      </span>
      <span className="cp-label-l2" aria-hidden="true">
        검색결과 보기 ↗
      </span>
    </span>
  );
}

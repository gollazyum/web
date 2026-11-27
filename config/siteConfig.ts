// 서비스 이름·사업자 정보는 이 파일 한 곳에만 둔다. 화면 로고, <title>, OG/Twitter 메타, 푸터, 약관·개인정보처리방침이 모두 여기 값을 쓴다.
// 이름(도메인)이 정해지면:
//   1) brandName(필요하면 legalName)을 바꾸고
//   2) businessInfo의 [자리표시자]를 실제 값으로 채운 뒤
//   3) Vercel 환경변수 NEXT_PUBLIC_BRAND_FINALIZED=true 를 넣고 다시 배포하면 모든 화면의 '가칭'이 한 번에 사라진다.
// 확정(true)인데 사업자 정보가 비어 있거나 [자리표시자]가 남아 있으면 빌드·개발 콘솔에 경고를 띄운다 (값을 지어내지 않는다)

export type BusinessInfo = {
  companyName: string; // 상호
  representative: string; // 대표자
  bizRegNumber: string; // 사업자등록번호
  mailOrderNumber: string; // 통신판매업 신고번호
  address: string; // 사업장 주소
  supportEmail: string; // 고객 문의 메일
  privacyOfficer: string; // 개인정보 보호책임자
};

const finalized = process.env.NEXT_PUBLIC_BRAND_FINALIZED === "true";

export const siteConfig = {
  brandName: "여행비서", // 화면에 보이는 서비스 이름 (가칭)
  aiName: "여행비서 AI",
  legalName: "Gollazyum", // 운영 이름: <title>·OG·약관·검색 노출. 도메인이 바뀔 때 같이 바꾼다
  url: "https://www.gollazyum.com",
  showProvisionalBadge: !finalized, // true면 로고 옆에 회색 '가칭'
  businessInfo: {
    companyName: "[상호]",
    representative: "[대표자]",
    bizRegNumber: "[사업자등록번호]",
    mailOrderNumber: "[통신판매업 신고번호]",
    address: "[사업장 주소]",
    supportEmail: "gollazyum@gmail.com",
    privacyOfficer: "[보호책임자]",
  } satisfies BusinessInfo,
};

// 빈 값이거나 "[상호]"처럼 대괄호 자리표시자인 칸 이름
export function missingBusinessFields(info: BusinessInfo = siteConfig.businessInfo): (keyof BusinessInfo)[] {
  return (Object.keys(info) as (keyof BusinessInfo)[]).filter((k) => {
    const v = (info[k] ?? "").trim();
    return !v || /^\[.*\]$/.test(v);
  });
}

// 확정 상태 가드: 서버(빌드·개발 서버)에서 한 번만 경고한다
if (finalized && typeof window === "undefined") {
  const miss = missingBusinessFields();
  if (miss.length) console.warn(`[siteConfig] NEXT_PUBLIC_BRAND_FINALIZED=true 인데 사업자 정보가 비어 있거나 자리표시자예요: ${miss.join(", ")} (config/siteConfig.ts)`);
}

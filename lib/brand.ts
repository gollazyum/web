// 브랜드 설정은 이 파일 하나에만 둔다. 이름·색이 정해지면 여기만 고치면 앱 전체가 바뀐다.
// - appName: 화면에 보이는 앱 이름. 아직 정하지 않아 가칭을 쓴다 (tentative가 true면 이름 옆에 '가칭' 배지)
// - legalName: 약관·개인정보처리방침·사업자 정보·검색 노출에 쓰는 운영 이름. 상표·도메인이 바뀔 때 같이 바꾼다
// - colors: 앱 화면(components/trip, app/trip.css)의 색. CSS 변수(--tb-*)로 내려간다

export const brand = {
  appName: "여행비서",
  tentative: true,
  aiName: "여행비서 AI",
  legalName: "Gollazyum",
  // 2026-11-26 PC 디자인 고급화(북유럽식): 미색 바탕 · 먹색 글자(본문/보조/각주 3단계) · 옅은 베이지 회색 선.
  // 강조색은 깊은 남색(price) 하나 — 확인한 최저가 숫자·'평소보다 N%↓' 배지·지도 최저가 핀에만 쓴다. 버튼·배너·아이콘에는 쓰지 않는다
  colors: {
    bg: "#FAF8F5", // 아주 옅은 따뜻한 미색 바탕
    card: "#FFFFFF", // 패널·입력창·떠 있는 것만 흰색
    soft: "#F2EFE9", // 칩·보조 바탕, 마이 현재 메뉴 알약
    soft2: "#E8E4DC",
    ink: "#1A1A18", // 먹색: 본문 글자·주 버튼·선택 표시
    sub: "#5F5E59", // 중간 회색: 보조 글자, '예상' 가격
    mute: "#6E6C66", // 옅은 회색: 각주 (미색 바탕 대비 4.9:1)
    line: "#E6E1D8", // 옅은 베이지 회색 구분선
    accent: "#1A1A18", // 선택·초점 표시 (먹색. 남색 강조는 price만)
    accentDark: "#000000",
    accentSoft: "#F2EFE9",
    price: "#1E3A5F", // 깊은 남색: 확인한 최저가 숫자 전용 (예전 주황 #FF5A1F 대체)
    priceSoft: "#EEF1F5", // 남색 강조의 아주 옅은 바탕 (내림 표시)
    good: "#0E9F6E",
    goodSoft: "#E3F7EE",
    warn: "#E5484D",
    warnSoft: "#FDECEC",
    star: "#1A1A18", // 별점도 먹색 (노랑·주황 강조색 없음)
  },
} as const;

// 가칭 서비스명·상단 아이콘. 이름이 정해지면 여기 두 줄만 바꾼다
export const BRAND_NAME: string = brand.appName;
export const BRAND_AI_NAME: string = brand.aiName;
export const BRAND_ICON = "orb" as const; // 구슬은 파비콘·앱 아이콘에만 쓴다 (화면 머리글에는 글자 로고)

export type BrandColorKey = keyof typeof brand.colors;

// "accentDark" → "--tb-accent-dark"
export function cssVarName(key: string): string {
  return `--tb-${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
}

// 일괄 교체용 대표 색 3개 (--bg 바탕, --primary 먹색, --accent 남색 강조). --tb-bg·--tb-ink·--tb-price는 이 셋을 따라간다
const CORE_VARS: Partial<Record<BrandColorKey, string>> = { bg: "--bg", ink: "--primary", price: "--accent" };

// :root에 넣을 CSS 변수 묶음
export function brandCssVars(): string {
  const core = Object.entries(CORE_VARS).map(([k, v]) => `${v}:${brand.colors[k as BrandColorKey]};`);
  const rest = Object.entries(brand.colors).map(([k, v]) => `${cssVarName(k)}:${CORE_VARS[k as BrandColorKey] ? `var(${CORE_VARS[k as BrandColorKey]})` : v};`);
  return [...core, ...rest].join("");
}


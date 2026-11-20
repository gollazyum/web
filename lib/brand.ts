// 브랜드 설정은 이 파일 하나에만 둔다. 이름·색이 정해지면 여기만 고치면 앱 전체가 바뀐다.
// - appName: 화면에 보이는 앱 이름. 아직 정하지 않아 가칭을 쓴다 (tentative가 true면 이름 옆에 '가칭' 배지)
// - legalName: 약관·개인정보처리방침·사업자 정보·검색 노출에 쓰는 운영 이름. 상표·도메인이 바뀔 때 같이 바꾼다
// - colors: 앱 화면(components/trip, app/trip.css)의 색. CSS 변수(--tb-*)로 내려간다

export const brand = {
  appName: "여행비서",
  tentative: true,
  aiName: "여행비서 AI",
  legalName: "Gollazyum",
  // 2026-11-20 색 공식 60:30:10 — 웜 오프화이트 바탕(60) · 잉크 네이비(30) · 시그니처 오렌지(10)
  // 오렌지(price)는 1위 최저 금액 숫자에만 쓴다. 일반 카드·2위 이하 금액·버튼에는 쓰지 않는다
  colors: {
    bg: "#FAF8F5", // 웜 오프화이트 바탕
    card: "#FFFFFF", // 카드 표면 (모서리 20px)
    soft: "#F2F0EC", // 칩·입력칸·보조 버튼 바탕
    soft2: "#E8E5DF",
    ink: "#1B2A4A", // 잉크 네이비: 글자·헤더·주 버튼·선택 탭
    sub: "#5D6475",
    mute: "#666D7D", // 오프화이트 바탕 대비 4.9:1 (글자 읽기 기준 4.5:1 이상)
    line: "#E6E2DB",
    accent: "#1B2A4A", // 선택·AI 표시 (네이비 계열로 통일)
    accentDark: "#14203A",
    accentSoft: "#ECEFF5",
    price: "#FF5A1F", // 시그니처 오렌지: 1위 최저 금액 숫자 전용
    good: "#0E9F6E",
    goodSoft: "#E3F7EE",
    warn: "#E5484D",
    warnSoft: "#FDECEC",
    star: "#F5A524",
  },
} as const;

// 가칭 서비스명·상단 아이콘. 이름이 정해지면 여기 두 줄만 바꾼다
export const BRAND_NAME: string = brand.appName;
export const BRAND_AI_NAME: string = brand.aiName;
export const BRAND_ICON = "orb" as const; // 네이비 구체 (components/trip의 .tb-orb)

export type BrandColorKey = keyof typeof brand.colors;

// "accentDark" → "--tb-accent-dark"
export function cssVarName(key: string): string {
  return `--tb-${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
}

// 일괄 교체용 대표 색 3개 (--bg 바탕, --primary 네이비, --accent 오렌지). --tb-bg·--tb-ink·--tb-price는 이 셋을 따라간다
const CORE_VARS: Partial<Record<BrandColorKey, string>> = { bg: "--bg", ink: "--primary", price: "--accent" };

// :root에 넣을 CSS 변수 묶음
export function brandCssVars(): string {
  const core = Object.entries(CORE_VARS).map(([k, v]) => `${v}:${brand.colors[k as BrandColorKey]};`);
  const rest = Object.entries(brand.colors).map(([k, v]) => `${cssVarName(k)}:${CORE_VARS[k as BrandColorKey] ? `var(${CORE_VARS[k as BrandColorKey]})` : v};`);
  return [...core, ...rest].join("");
}


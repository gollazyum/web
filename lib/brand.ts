// 브랜드 설정은 이 파일 하나에만 둔다. 이름·색이 정해지면 여기만 고치면 앱 전체가 바뀐다.
// - appName: 화면에 보이는 앱 이름. 아직 정하지 않아 가칭을 쓴다 (tentative가 true면 이름 옆에 '가칭' 배지)
// - legalName: 약관·개인정보처리방침·사업자 정보·검색 노출에 쓰는 운영 이름. 상표·도메인이 바뀔 때 같이 바꾼다
// - colors: 앱 화면(components/trip, app/trip.css)의 색. CSS 변수(--tb-*)로 내려간다

export const brand = {
  appName: "여행비서",
  tentative: true,
  aiName: "여행비서 AI",
  legalName: "Gollazyum",
  colors: {
    bg: "#FFFFFF",
    card: "#FFFFFF",
    soft: "#F4F4F6", // 칩·입력칸·보조 버튼 바탕
    soft2: "#EBEBEF",
    ink: "#0B0B0F", // 글자·검정 버튼
    sub: "#6B6B73",
    mute: "#74747C", // 흰 바탕 대비 4.6:1 (글자 읽기 기준 4.5:1 이상)
    line: "#E7E7EC",
    accent: "#3A5BFF", // 하나뿐인 강조색 (AI 표시·선택)
    accentDark: "#2742D9",
    accentSoft: "#ECF0FF",
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
export const BRAND_ICON = "orb" as const; // 파란 구체 (components/trip의 .tb-orb)

export type BrandColorKey = keyof typeof brand.colors;

// "accentDark" → "--tb-accent-dark"
export function cssVarName(key: string): string {
  return `--tb-${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
}

// 일괄 교체용 대표 색 3개. --tb-bg·--tb-ink·--tb-accent는 이 셋을 따라간다
const CORE_VARS: Partial<Record<BrandColorKey, string>> = { bg: "--bg", ink: "--primary", accent: "--accent" };

// :root에 넣을 CSS 변수 묶음
export function brandCssVars(): string {
  const core = Object.entries(CORE_VARS).map(([k, v]) => `${v}:${brand.colors[k as BrandColorKey]};`);
  const rest = Object.entries(brand.colors).map(([k, v]) => `${cssVarName(k)}:${CORE_VARS[k as BrandColorKey] ? `var(${CORE_VARS[k as BrandColorKey]})` : v};`);
  return [...core, ...rest].join("");
}


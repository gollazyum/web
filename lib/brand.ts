// 브랜드 설정은 이 파일 하나에만 둔다. 이름·색이 정해지면 여기만 고치면 앱 전체가 바뀐다.
// - appName: 화면에 보이는 앱 이름. 아직 정하지 않아 가칭을 쓴다 (tentative가 true면 이름 옆에 '가칭' 배지)
// - legalName: 약관·개인정보처리방침·사업자 정보·검색 노출에 쓰는 운영 이름. 상표·도메인이 바뀔 때 같이 바꾼다
// - colors: 앱 화면(components/trip, app/trip.css)의 색. CSS 변수(--tb-*)로 내려간다

export const brand = {
  appName: "여행친구",
  tentative: true,
  aiName: "여행친구 AI",
  legalName: "Gollazyum",
  colors: {
    bg: "#F7F4EF", // 따뜻한 모래색 바탕
    card: "#FFFFFF",
    ink: "#18202B", // 차콜 네이비 (글자·진한 버튼·탭바)
    sub: "#6B7280",
    mute: "#A3A8B0",
    line: "#ECE7E0",
    soft: "#EFEBE5", // 칩·입력칸 바탕
    accent: "#12B3A8", // 민트 티얼 (주 강조)
    accentDark: "#0B8F87",
    accentSoft: "#DDF5F2",
    ai: "#6E5CE6", // AI 표시 보라
    aiSoft: "#F1EEFF",
    warm: "#FF8C5A", // 알림·안내 주황
    warmSoft: "#FFEDE3",
  },
} as const;

export type BrandColorKey = keyof typeof brand.colors;

// "accentDark" → "--tb-accent-dark"
export function cssVarName(key: string): string {
  return `--tb-${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
}

// :root에 넣을 CSS 변수 묶음
export function brandCssVars(): string {
  return Object.entries(brand.colors)
    .map(([k, v]) => `${cssVarName(k)}:${v};`)
    .join("");
}

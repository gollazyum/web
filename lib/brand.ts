// 브랜드 설정은 이 파일 하나에만 둔다. 이름·색이 정해지면 여기만 고치면 앱 전체가 바뀐다.
// - appName: 화면에 보이는 앱 이름. 아직 정하지 않아 가칭을 쓴다 (tentative가 true면 이름 옆에 '가칭' 배지)
// - legalName: 약관·개인정보처리방침·사업자 정보·검색 노출에 쓰는 운영 이름. 상표·도메인이 바뀔 때 같이 바꾼다
// - colors: 앱 화면(components/trip, app/trip.css)의 색. CSS 변수(--tb-*)로 내려간다

export const brand = {
  appName: "여행친구",
  tentative: true,
  aiName: "여행친구 AI",
  legalName: "Gollazyum",
  // 첫 화면에서 캐릭터가 건네는 인사 (Jua 글꼴로, 이 글자만 받아 온다)
  greeting: ["안녕하세요!", "어디 가고 싶어요?"],
  colors: {
    bg: "#FFF7EE", // 따뜻한 크림 바탕
    card: "#FFFFFF",
    ink: "#2A211C", // 따뜻한 먹색 (글자·진한 버튼·내 말풍선)
    sub: "#7A6F66",
    mute: "#B3A79C",
    line: "#F0E4D6",
    soft: "#F6ECE2", // 칩·보조 버튼 바탕
    accent: "#FF7A59", // 코랄 (주 강조: 보내기·담기·선택된 핀)
    accentDark: "#E85C3A",
    accentSoft: "#FFE6D6", // 피치 (빠른 답 말풍선)
    mint: "#3CC7B4", // 완료 표시
    mintSoft: "#DDF6F1",
    ai: "#6B5BE0", // AI 표시 보라
    aiSoft: "#F0EDFF",
    butter: "#FFEDB0", // '곧 열려요' 배지
    butterInk: "#7A5A00",
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

// 인사말 글꼴 Jua: 인사 글자만 담은 작은 파일을 받는다 (안 오면 본문 글꼴로 보인다)
export function greetingFontUrl(): string {
  const chars = Array.from(new Set(brand.greeting.join(""))).join("");
  return `https://fonts.googleapis.com/css2?family=Jua&display=swap&text=${encodeURIComponent(chars)}`;
}

// 최종 헤더 로고 (최종 브랜드 키트: 모찌 마크 + Plus Jakarta Sans 글씨). 어두운 배경에는 tone="white"를 쓴다.
export function Logo({ height = 40, tone = "color" }: { height?: number; tone?: "color" | "white" }) {
  const src = tone === "white" ? "/brand/lowboti-header-logo-white.svg" : "/brand/lowboti-header-logo.svg";
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="Lowboti" height={height} width={Math.round((height * 5551) / 1323)} />;
}

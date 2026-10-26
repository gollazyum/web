// 최종 로고 (가로형). 어두운 배경에는 tone="white"를 쓴다.
export function Logo({ height = 30, tone = "color" }: { height?: number; tone?: "color" | "white" }) {
  const src = tone === "white" ? "/brand/lowboti-logo-horizontal-white.svg" : "/brand/lowboti-logo-horizontal.svg";
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="Lowboti" height={height} width={Math.round((height * 957) / 215)} />;
}

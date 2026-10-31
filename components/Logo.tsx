// 헤더·푸터 로고: 모찌 마크 + "Gollazyum" 글씨. 어두운 배경에는 tone="white"를 쓴다.
export function Logo({ height = 40, tone = "color" }: { height?: number; tone?: "color" | "white" }) {
  return (
    <span className={`logo-lockup${tone === "white" ? " white" : ""}`} style={{ height, fontSize: Math.round(height * 0.62) }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/gollazyum-mark.svg" alt="" height={height} width={height} />
      <span className="logo-word">Gollazyum</span>
    </span>
  );
}

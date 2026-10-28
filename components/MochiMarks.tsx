// 결과 화면의 작은 모찌 표시들: 호텔 등급용 노란 모찌 별, 후기 점수용 색 모찌 배지

// 통통한 별: 안쪽 꼭짓점을 넉넉하게 잡고 같은 색 굵은 선으로 모서리를 둥글린다
const STAR = (() => {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? 42 : 25;
    pts.push(`${(50 + r * Math.cos(a)).toFixed(1)} ${(55 + r * Math.sin(a)).toFixed(1)}`);
  }
  return `M${pts.join(" L")}Z`;
})();

const MOCHI = "M12 70 C9 44 27 17 51 17 C76 17 92 41 90 67 C89 85 77 91 50 91 C24 91 13 86 12 70Z";

// 로보티 얼굴 눈: 왼쪽 알약 눈, 오른쪽 돋보기 눈
function Eyes({ color, y }: { color: string; y: number }) {
  return (
    <g fill={color}>
      <rect x="35" y={y - 6} width="9" height="12" rx="4.5" />
      <circle cx="61" cy={y} r="7" fill="none" stroke={color} strokeWidth="4" />
      <circle cx="61" cy={y} r="2.4" />
    </g>
  );
}

export function MochiStar({ size = 16 }: { size?: number }) {
  return (
    <svg className="mochi-star" viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
      <path d={STAR} fill="#FCD34D" stroke="#FBBF24" strokeWidth="14" strokeLinejoin="round" />
      <g transform="translate(50 58) scale(1.35) translate(-50 -58)">
        <Eyes color="#7C4A03" y={58} />
      </g>
    </svg>
  );
}

// 호텔 등급: 성급 수만큼 노란 모찌 별
export function MochiStars({ count, size = 15 }: { count: number; size?: number }) {
  return (
    <span className="mochi-stars" role="img" aria-label={`${count}성급`}>
      {Array.from({ length: count }, (_, i) => (
        <MochiStar key={i} size={size} />
      ))}
    </span>
  );
}

// 후기 점수 등급과 모찌 색 (Google 5점 만점)
export function ratingTier(r: number): { word: string; color: string } {
  // 두 가지 색만: 3.8점 이상 에메랄드, 그 아래는 차분한 슬레이트 (오렌지는 최저가 전용)
  if (r >= 4.5) return { word: "최고예요", color: "#10B981" };
  if (r >= 4) return { word: "매우 좋아요", color: "#10B981" };
  if (r >= 3.8) return { word: "좋아요", color: "#10B981" };
  return { word: "괜찮아요", color: "#64748B" };
}

// 점수를 품은 색 모찌
export function RatingMochi({ rating, size = 40 }: { rating: number; size?: number }) {
  const { color } = ratingTier(rating);
  return (
    <span className="rating-mochi" data-tier={rating >= 3.8 ? "good" : "ok"} style={{ width: size, height: size }}>
      <svg viewBox="8 14 86 80" width={size} height={size} aria-hidden="true">
        <path d={MOCHI} fill={color} />
      </svg>
      <b>{rating.toFixed(1)}</b>
    </span>
  );
}

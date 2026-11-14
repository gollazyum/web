import { useId } from "react";

// 앱 캐릭터 (v5 시안). happy = 눈웃음, search = 돋보기를 든 모습, base = 기본
type Mood = "base" | "happy" | "search";

export function Mascot({ size = 40, mood = "base" }: { size?: number; mood?: Mood }) {
  const s = mood === "search";
  // 그라데이션 id는 그림마다 따로 (숨겨진 그림의 id를 빌려 쓰면 색이 빠진다)
  const g = `tb-mg-${useId().replace(/:/g, "")}`;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden className="tb-mascot">
      <defs>
        <linearGradient id={g} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3FD3C3" />
          <stop offset="1" stopColor="#4C8DF6" />
        </linearGradient>
      </defs>
      <path d="M50 21C51 13 55 9 58 8" stroke="#2A211C" strokeWidth="3" fill="none" strokeLinecap="round" />
      <circle cx="58" cy="8" r="6" fill="#FF8C5A" />
      <path d="M13 49c-6 3-6 15 0 18M87 49c6 3 6 15 0 18" stroke="#3FB8E0" strokeWidth="6" fill="none" strokeLinecap="round" />
      <path d="M50 19C75 19 90 35 90 57C90 79 73 91 50 91C27 91 10 79 10 57C10 35 25 19 50 19Z" fill={`url(#${g})`} />
      <ellipse cx="50" cy="61" rx="29" ry="21" fill="#fff" />
      {mood === "happy" ? (
        <path d="M35 59q5-7 10 0M55 59q5-7 10 0" stroke="#18202B" strokeWidth="3.2" fill="none" strokeLinecap="round" />
      ) : (
        <>
          <ellipse cx={s ? 44 : 40} cy={s ? 55 : 57} rx="4" ry="5.4" fill="#18202B" />
          <ellipse cx={s ? 64 : 60} cy={s ? 55 : 57} rx="4" ry="5.4" fill="#18202B" />
          <circle cx={s ? 45.5 : 41.5} cy={s ? 53 : 55} r="1.4" fill="#fff" />
          <circle cx={s ? 65.5 : 61.5} cy={s ? 53 : 55} r="1.4" fill="#fff" />
        </>
      )}
      <path d={s ? "M48 68q4 2 8 0" : "M45 66q5 5 10 0"} stroke="#18202B" strokeWidth="3" fill="none" strokeLinecap="round" />
      <ellipse cx="33" cy="67" rx="5" ry="3" fill="#FFB4A2" />
      <ellipse cx="67" cy="67" rx="5" ry="3" fill="#FFB4A2" />
      {s && (
        <g transform="translate(70 62) rotate(-20)">
          <circle r="13" fill="rgba(255,255,255,.55)" stroke="#2A211C" strokeWidth="4" />
          <path d="M0 13v14" stroke="#2A211C" strokeWidth="6" strokeLinecap="round" />
        </g>
      )}
    </svg>
  );
}

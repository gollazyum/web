// 상표 심사 안전 모드. 상표 우선심사 증빙 기간에는 기본으로 켜 둔다.
// 끄려면 Vercel 환경변수 NEXT_PUBLIC_TRADEMARK_SAFE_MODE=false 를 넣고 다시 배포한다.
export const TRADEMARK_SAFE_MODE = process.env.NEXT_PUBLIC_TRADEMARK_SAFE_MODE !== "false"; // 기본 true

// 화면 문구에 언제나 쓰면 안 되는 단어
export const ALWAYS_BANNED_WORDS = ["실시간", "골라", "고르다", "골라주다", "골라줌", "골라쥼"] as const;
// 안전 모드일 때 추가로 쓰면 안 되는 단어
export const SAFE_MODE_BANNED_WORDS = ["비교", "가격비교", "최저가", "추천"] as const;
// 데이터 출처. 화면에 절대 표시하지 않는다 (판매처명은 괜찮다)
export const SOURCE_WORDS = ["SerpApi", "Google", "구글"] as const;

export function bannedWords(safe: boolean = TRADEMARK_SAFE_MODE): string[] {
  return [...ALWAYS_BANNED_WORDS, ...(safe ? SAFE_MODE_BANNED_WORDS : []), ...SOURCE_WORDS];
}

// 화면 문구에 금지어가 있으면 그 단어들을 돌려준다 (대소문자 무시)
export function findBannedWords(text: string, safe: boolean = TRADEMARK_SAFE_MODE): string[] {
  const lower = text.toLowerCase();
  return bannedWords(safe).filter((w) => lower.includes(w.toLowerCase()));
}

// 안전 모드에 따라 바뀌는 문구는 모두 여기에 모은다. 화면 코드에 직접 쓰지 않는다
const COPY = {
  // 상품 상세 위쪽 파란 배너 (1위 조건일 때)
  topBanner: { safe: "현재 가장 유리한 조건의 스토어 데이터예요", normal: "확인한 판매처 중 가장 저렴해요" },
  // 판매처 탭의 1위 판매처 빨간 뱃지
  topTabBadge: { safe: "BEST", normal: "최저" },
  // 1위 카드 위 라벨
  topCardLabel: { safe: "스토어 데이터 1위", normal: "확인한 판매처 중 최저가" },
} as const;

export type BrandCopyKey = keyof typeof COPY;
export const BRAND_COPY_KEYS = Object.keys(COPY) as BrandCopyKey[];

// 문구 분기 헬퍼. safe를 넘기면 그 값으로, 안 넘기면 현재 설정으로 고른다
export function brandCopy(key: BrandCopyKey, safe: boolean = TRADEMARK_SAFE_MODE): string {
  return safe ? COPY[key].safe : COPY[key].normal;
}

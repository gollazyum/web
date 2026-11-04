// 상표 심사 안전 모드. 상표 우선심사 증빙 기간에는 기본으로 켜 둔다.
// 끄려면 Vercel 환경변수 NEXT_PUBLIC_TRADEMARK_SAFE_MODE=false 를 넣고 다시 배포한다.
export const TRADEMARK_SAFE_MODE = process.env.NEXT_PUBLIC_TRADEMARK_SAFE_MODE !== "false"; // 기본 true

// 화면 문구에 언제나 쓰면 안 되는 단어
// AI 이름은 'Gollazyum AI'. 예전 캐릭터 이름 '로보티'는 화면에 쓰지 않는다
export const ALWAYS_BANNED_WORDS = ["실시간", "골라", "고르다", "골라주다", "골라줌", "골라쥼", "로보티"] as const;
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
  topBanner: { safe: "찾은 판매처 중 가장 낮은 가격이에요", normal: "찾은 판매처 중 가장 낮은 가격이에요" },
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

// 쇼핑 검색 결과 PC 화면 문구. 초록이 2026-11-02에 이 문장 그대로 쓰라고 직접 정해 줬다.
// 안전 모드 금지어(비교·추천)가 들어 있지만 승인된 문구라 모드와 상관없이 쓴다.
// 화면 코드에 직접 쓰지 말고 여기서 가져다 쓴다 (금지어 검사는 tests/shop-results-copy.test.ts)
export const SHOP_RESULTS_COPY = {
  guide: "상품을 누르면 스토어별 가격을 보여 드려요",
  cardCta: "스토어별 가격 비교 ›",
  sortDefault: "추천순",
  sortLow: "낮은 가격순",
  sortHigh: "높은 가격순",
  lowestBadge: "이 검색 결과 중 가장 낮은 가격",
  emptyFiltered: "선택한 조건에 맞는 상품이 없어요",
  resetFilters: "필터 초기화",
  storeCount: (n: number) => `판매처 ${n}곳 비교`,
} as const;

// 홈 쇼핑 검색창·첫 화면 문구. PC는 기존 문구 그대로, 휴대폰(640px 이하)은 쉬운 해요체.
// 초록이 2026-11-04 모바일 개선 요청(LB-042)에서 이 문장을 직접 정해 줬다 (안전 모드 금지어 '비교'가 들어 있지만 승인된 문구)
export const HOME_SHOP_COPY = {
  labelPc: "어떤 상품을 찾으세요?",
  labelM: "어떤 상품을 찾으세요?",
  placeholder: "상품 이름을 넣어 주세요 (예: 무선충전기, 로봇청소기)",
  buttonPc: "최저가 찾기",
  buttonM: "가격 비교하기",
  heroSubM: "상품 이름을 넣으면 쇼핑몰별 가격을 비교해 드려요",
} as const;

// 상품 화면 공유 미리보기(og) 설명. 가격 숫자는 넣지 않는다 (카카오가 미리보기를 1시간 넘게 저장한다)
export const SHOP_OG_DESCRIPTION = "쿠팡·네이버 등 판매처 가격을 한눈에 비교해요";

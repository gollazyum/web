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

// 안전 모드에 따라 바뀌는 문구는 모두 여기에 모은다. 화면 코드에 직접 쓰지 않는다.
// safe: 상표 심사 중(기본) 문구 — 비교·최저가·추천·실시간·골라 같은 말을 쓰지 않는다 (초록 2026-11-04 지정)
// normal: 심사가 끝나 NEXT_PUBLIC_TRADEMARK_SAFE_MODE=false 로 바꿨을 때 쓰는 예전 문구
const COPY = {
  // 상품 상세 위쪽 파란 배너 (1위 조건일 때)
  topBanner: { safe: "찾은 판매처 중 가장 낮은 가격이에요", normal: "찾은 판매처 중 가장 낮은 가격이에요" },
  // 판매처 탭의 1위 판매처 빨간 뱃지
  topTabBadge: { safe: "BEST", normal: "최저" },
  // 1위 카드 위 라벨
  topCardLabel: { safe: "스토어 데이터 1위", normal: "확인한 판매처 중 최저가" },

  // 홈 첫 화면
  homeTitle: { safe: "쇼핑·숙소·항공권 가격 한 번에 보기", normal: "쇼핑·숙소·항공권 가격 한 번에 보기" },
  homeDescription: {
    safe: "쿠팡·네이버 같은 쇼핑몰과 여러 예약 사이트의 가격을 한 화면에 모아 보여 드려요. 숙소·항공권은 세금·수수료를 포함한 총액으로 보여 드려요.",
    normal: "쿠팡·네이버 같은 쇼핑몰과 여러 예약 사이트의 가격을 한 화면에서 비교해요. 숙소·항공권은 세금·수수료를 포함한 총액으로 보여 드려요.",
  },
  heroSubPc: {
    safe: "쿠팡·네이버 같은 쇼핑몰과 여러 예약 사이트의 가격을 한 화면에 모아 보여 드려요",
    normal: "쿠팡·네이버 같은 쇼핑몰과 여러 예약 사이트의 가격을 한 화면에서 비교해요",
  },
  // 휴대폰 첫 화면 문구. \n 자리에서 줄을 바꿔 늘 두 줄로 보인다 (글꼴이 바뀌어도 줄 수가 같아 화면이 밀리지 않는다)
  heroSubM: { safe: "상품 이름을 넣으면 쇼핑몰별 가격을\n한 화면에 모아 보여 드려요", normal: "상품 이름을 넣으면 쇼핑몰별 가격을 비교해 드려요" },
  shopButtonPc: { safe: "가격 찾아보기", normal: "최저가 찾기" },
  shopButtonM: { safe: "가격 찾아보기", normal: "가격 비교하기" },
  hotelButton: { safe: "숙소 가격 찾아보기", normal: "숙소 최저가 찾기" },
  flightButton: { safe: "항공권 가격 찾아보기", normal: "항공권 최저가 찾기" },
  comparedLabel: { safe: "모아 보는 곳", normal: "비교하는 곳" },
  stepView: { safe: "한눈에 보기", normal: "한눈에 비교" },
  featuresTitle: { safe: "가격은 Gollazyum이,", normal: "비교는 Gollazyum이," },
  mockBestBadge: { safe: "가장 낮은 가격", normal: "최저가" },
  // 공통 푸터 첫 문장
  footerLead: {
    safe: "Gollazyum은 숙소와 항공권의 예약처별 세금 포함 총액을 한 화면에 모아 보여 드려요.",
    normal: "Gollazyum은 숙소와 항공권의 예약처별 세금 포함 총액을 한 화면에서 비교해 보여 드려요.",
  },
  // 개인정보처리방침
  privacyReviewTopics: { safe: "호텔 후기 주제 숫자는 보관함 화면에 다시 쓰려고", normal: "호텔 후기 주제 숫자는 비교 화면에 다시 쓰려고" },

  // 쇼핑 탭(/shop)
  shopHeading: { safe: "쇼핑 가격 한눈에 보기", normal: "쇼핑 가격 비교" },
  shopLead: {
    safe: "상품 이름을 입력하면 쿠팡·네이버·G마켓·11번가의 판매 가격을 한 화면에 모아 보여 드려요.",
    normal: "상품 이름을 입력하면 쿠팡·네이버·G마켓·11번가의 판매 가격을 한 화면에서 비교해 보여 드려요.",
  },
  shopOgDescription: { safe: "쿠팡·네이버 등 판매처 가격을 한눈에 모아 보여 드려요", normal: "쿠팡·네이버 등 판매처 가격을 한눈에 비교해요" },
  // 쇼핑 검색 결과
  shopCardCta: { safe: "스토어별 가격 보기 ›", normal: "스토어별 가격 비교 ›" },
  shopSortDefault: { safe: "관련도순", normal: "관련도순" },
  shopStoreCount: { safe: "판매처 {n}곳", normal: "판매처 {n}곳 비교" },

  // 숙소 결과
  hotelHintLowest: { safe: "찾은 곳 중 가장 낮은", normal: "비교한 곳 중 가장 낮은" },
  hotelLowestBadge: { safe: "찾은 곳 중 가장 낮은 가격", normal: "비교한 곳 중 최저가" },
  hotelBestBadge: { safe: "가장 낮은 가격", normal: "최저가" },
} as const;

export type BrandCopyKey = keyof typeof COPY;
export const BRAND_COPY_KEYS = Object.keys(COPY) as BrandCopyKey[];

// 문구 분기 헬퍼. safe를 넘기면 그 값으로, 안 넘기면 현재 설정으로 고른다
export function brandCopy(key: BrandCopyKey, safe: boolean = TRADEMARK_SAFE_MODE): string {
  return safe ? COPY[key].safe : COPY[key].normal;
}

// 쇼핑 검색 결과 화면 문구. 화면 코드에 직접 쓰지 말고 여기서 가져다 쓴다 (금지어 검사는 tests/shop-results.test.ts)
export const SHOP_RESULTS_COPY = {
  guide: "상품을 누르면 스토어별 가격을 보여 드려요",
  cardCta: brandCopy("shopCardCta"),
  // 기본 정렬은 검색 결과 순서(관련도순). '낮은 가격순'을 기본으로 하면 케이스 같은 싼 부속품이 먼저 나온다
  sortDefault: brandCopy("shopSortDefault"),
  sortLow: "낮은 가격순",
  sortHigh: "높은 가격순",
  lowestBadge: "이 검색 결과 중 가장 낮은 가격",
  emptyFiltered: "선택한 조건에 맞는 상품이 없어요",
  resetFilters: "필터 초기화",
  storeCount: (n: number) => brandCopy("shopStoreCount").replace("{n}", String(n)),
  // 같은 상품으로 묶인 카드: "115,000원부터 · 판매처 10곳 · 색상 4개" (모두 실제 응답 값)
  priceFrom: "부터",
  optionCount: (n: number) => `색상 ${n}개`,
  // 본품/액세서리 나누기 (lib/shop-match.ts)
  mainOnlyChip: "본품만",
  accessoryGroup: "관련 액세서리",
} as const;

// 홈 쇼핑 검색창·첫 화면 문구. PC와 휴대폰(640px 이하)을 따로 둔다
export const HOME_SHOP_COPY = {
  labelPc: "어떤 상품을 찾으세요?",
  labelM: "어떤 상품을 찾으세요?",
  placeholder: "상품 이름을 넣어 주세요 (예: 무선충전기, 로봇청소기)",
  buttonPc: brandCopy("shopButtonPc"),
  buttonM: brandCopy("shopButtonM"),
  heroSubM: brandCopy("heroSubM"),
} as const;

// 쇼핑 예시 칩 (쇼핑 탭 /shop, 휴대폰 홈 쇼핑 탭). 누르면 그 말로 상품 화면을 연다
export const SHOP_EXAMPLES = ["캐리어", "보조배터리", "여행 파우치"] as const;

// 상품 화면 공유 미리보기(og) 설명. 가격 숫자는 넣지 않는다 (카카오가 미리보기를 1시간 넘게 저장한다)
export const SHOP_OG_DESCRIPTION = brandCopy("shopOgDescription");

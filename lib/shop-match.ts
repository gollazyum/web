// 쇼핑 검색 결과를 본품과 액세서리로 나누고 관련도순으로 줄 세운다 (2026-11-05 초록 요청 8번).
// 서버(lib/shopping.ts shapeSearch)가 순서를 정하고 액세서리에 accessory 표시를 붙인다. 화면은 그 표시로 '본품만'·'관련 액세서리'를 나눈다.
// 화면 문구는 이 파일에 두지 않는다 (금지어 규칙은 lib/brand-mode.ts)

// ───────── (1) 검색어·상품명 정리 ─────────
// 한글 이름과 영어 이름을 하나로 맞춘다. 긴 말을 먼저 바꾼다 (에어팟 → airpods 를 에어 → air 보다 먼저)
const ALIASES: [RegExp, string][] = [
  [/에어팟|airpods?/g, "airpods"],
  [/아이폰/g, "iphone"],
  [/아이패드/g, "ipad"],
  [/맥북/g, "macbook"],
  [/애플\s*워치|apple\s*watch/g, "applewatch"],
  [/갤럭시/g, "galaxy"],
  [/버즈/g, "buds"],
  [/워치/g, "watch"],
  [/애플/g, "apple"],
  [/삼성전자|삼성/g, "samsung"],
  [/프로/g, "pro"],
  [/맥스/g, "max"],
  [/미니/g, "mini"],
  [/울트라/g, "ultra"],
  [/플러스/g, "plus"],
  [/에어/g, "air"],
  [/폴드/g, "fold"],
  [/플립/g, "flip"],
  [/다이슨/g, "dyson"],
  [/닌텐도/g, "nintendo"],
  [/스위치/g, "switch"],
  [/소니/g, "sony"],
  [/샤오미/g, "xiaomi"],
  [/로지텍/g, "logitech"],
];

// 소문자로 바꾸고, 한글·영어 표기를 맞추고, 글자와 숫자 사이를 띄운다.
// '에어팟프로2' = '에어팟 프로 2' = 'AirPods Pro 2' → "airpods pro 2", 아이폰 = iPhone → "iphone"
export function normalizeText(s: string): string {
  let t = s.toLowerCase();
  for (const [re, to] of ALIASES) t = t.replace(re, ` ${to} `);
  return t
    .replace(/[^0-9a-z가-힣]+/g, " ")
    .replace(/(?<=[a-z가-힣])(?=\d)|(?<=\d)(?=[a-z가-힣])/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// 검색어 낱말: 글자 낱말과 숫자 낱말
export function queryTerms(query: string): { words: string[]; numbers: string[] } {
  const tokens = normalizeText(query).split(" ").filter(Boolean);
  return { words: tokens.filter((t) => !/^\d+$/.test(t)), numbers: tokens.filter((t) => /^\d+$/.test(t)) };
}

// 검색어 낱말이 상품명에 얼마나 맞는지. 글자 낱말은 띄어쓰기를 뺀 상품명 안에 있으면 맞고, 숫자는 상품명의 숫자 덩어리와 똑같아야 맞는다
// ("2"가 "256"·"2024" 안에 있다고 맞는 것으로 보지 않는다)
export function matchTerms(query: string, title: string): { matched: number; total: number } {
  const { words, numbers } = queryTerms(query);
  const norm = normalizeText(title);
  const compact = norm.replace(/ /g, "");
  const titleNumbers = new Set(norm.split(" ").filter((t) => /^\d+$/.test(t)));
  const matched = words.filter((w) => compact.includes(w)).length + numbers.filter((n) => titleNumbers.has(n)).length;
  return { matched, total: words.length + numbers.length };
}

// ───────── (2) 액세서리 단어 ─────────
// 상품명에 이 말이 있고 검색어에는 없으면 액세서리로 본다. 늘릴 때는 여기에만 더한다.
// '하드'·'젤리'·'범퍼'는 케이스를 줄여 부르는 말, '보호'는 보호필름·보호케이스
export const ACCESSORY_TERMS = {
  // 액세서리 종류. 검색어에 이 중 하나가 있으면 그 말로는 빼지 않는다 (예: '아이폰 16 케이스' 검색 시 케이스가 본품)
  kinds: [
    "케이스", "커버", "필름", "보호필름", "강화유리", "스킨", "스트랩", "키링", "이어팁", "충전기", "케이블", "거치대", "파우치",
    "어댑터", "리필", "하드", "젤리", "범퍼", "보호", "공박스", "박스만",
  ],
  // 영어 상품명용 (단어 단위로만 본다: showcase·discover 같은 말은 빼지 않는다)
  kindsEn: ["case", "cover", "film", "skin", "strap", "keyring", "eartips", "charger", "charging", "cable", "stand", "pouch", "adapter", "refill"],
  // '무엇에 맞는' 표시. 검색어가 액세서리 종류를 찾는 중이면(케이스 검색 등) 이 말로는 빼지 않는다
  relation: ["호환", "전용"],
  relationEn: ["compatible"],
} as const;

// '아이폰16용', 'AirPods Pro 2용', '갤럭시용' 같은 '~용'. 모델명(숫자·영문)이나 기기 이름 바로 뒤의 '용'만 본다 ('여행용 캐리어'는 본품)
const FOR_MODEL = /(\d|[a-z]|\)|에어팟|아이폰|아이패드|갤럭시|버즈|워치|맥북)\s*용(?![가-힣])/i;

const compactLower = (s: string) => s.toLowerCase().replace(/\s+/g, "");

// 같은 갈래의 액세서리 말. 검색어가 한 갈래를 찾으면(예: 케이스) 그 갈래의 말로는 빼지 않는다 ('아이폰 16 케이스' 검색 시 '하드 케이스'도 본품)
const FAMILIES: string[][] = [
  ["케이스", "커버", "하드", "젤리", "범퍼", "스킨", "case", "cover", "skin"],
  ["필름", "보호필름", "강화유리", "보호", "film"],
  ["충전기", "케이블", "어댑터", "charger", "charging", "cable", "adapter"],
];

const hasTerm = (compactQuery: string, lowerQuery: string, w: string) =>
  /^[a-z]+$/.test(w) ? new RegExp(`\\b${w}`, "i").test(lowerQuery) : compactQuery.includes(w);

// 검색어에 맞춘 액세서리 판별 함수
export function accessoryTest(query: string): (title: string) => boolean {
  const q = compactLower(query);
  const qLower = query.toLowerCase();
  const allKinds = [...ACCESSORY_TERMS.kinds, ...ACCESSORY_TERMS.kindsEn] as string[];
  const sought = allKinds.filter((w) => hasTerm(q, qLower, w));
  // 검색어에 있는 말과, 그 말과 같은 갈래의 말은 빼지 않는다
  const allowed = new Set([...sought, ...FAMILIES.filter((f) => f.some((w) => sought.includes(w))).flat()]);
  const kinds = ACCESSORY_TERMS.kinds.filter((w) => !allowed.has(w));
  const kindsEn = ACCESSORY_TERMS.kindsEn.filter((w) => !allowed.has(w));
  // 검색어가 액세서리 종류(케이스 등)를 찾는 중이면 '호환·전용·~용'은 그 상품의 원래 설명이라 보지 않는다
  const seekingAccessory = sought.length > 0;
  const relation = seekingAccessory ? [] : ACCESSORY_TERMS.relation.filter((w) => !q.includes(w));
  const relationEn = seekingAccessory ? [] : ACCESSORY_TERMS.relationEn.filter((w) => !qLower.includes(w));
  const en = [...kindsEn, ...relationEn];
  const enRe = en.length ? new RegExp(`\\b(${en.join("|")})(e?s)?\\b`, "i") : null;
  const forModel = !seekingAccessory && !/용/.test(query);
  return (title) => {
    const t = compactLower(title);
    return (
      kinds.some((w) => t.includes(w)) ||
      relation.some((w) => t.includes(w)) ||
      !!(enRe && enRe.test(title)) ||
      (forModel && FOR_MODEL.test(title))
    );
  };
}

// ───────── (3) 가격 ─────────
// 본품 후보 가격 중앙값의 이 비율보다 싸면 액세서리일 가능성이 높아 본품에서 뺀다
export const MAIN_PRICE_RATIO = 0.3;
// 액세서리 단어가 있어도 중앙값의 이 비율 이상이고 검색어 낱말이 모두 맞으면 본품으로 본다 ('본체 + 충전케이스' 같은 본품 상품명)
export const WORD_RESCUE_RATIO = 0.5;

export function medianPrice(items: { price: number | null }[]): number | null {
  const prices = items
    .map((it) => it.price)
    .filter((p): p is number => p !== null && p > 0)
    .sort((a, b) => a - b);
  if (!prices.length) return null;
  const mid = Math.floor(prices.length / 2);
  return prices.length % 2 ? prices[mid] : (prices[mid - 1] + prices[mid]) / 2;
}

// ───────── (4) 나누기와 관련도순 ─────────
// tier 0: 검색어 낱말·숫자가 모두 맞는 본품, 1: 일부만 맞는 본품, 2: 액세서리
export type MatchInfo = { accessory: boolean; tier: 0 | 1 | 2; score: number };

export function classifyItems<T extends { title: string; price: number | null }>(items: T[], query: string): MatchInfo[] {
  const isAccWord = accessoryTest(query);
  const word = items.map((it) => isAccWord(it.title));
  const match = items.map((it) => matchTerms(query, it.title));
  const median = medianPrice(items.filter((_, i) => !word[i]));
  const priced = (p: number | null): p is number => median !== null && p !== null && p > 0;
  const full = (i: number) => match[i].total > 0 && match[i].matched === match[i].total;
  const acc = items.map((it, i) => {
    if (word[i]) return !(full(i) && priced(it.price) && it.price >= median! * WORD_RESCUE_RATIO);
    return priced(it.price) && it.price < median! * MAIN_PRICE_RATIO;
  });
  // 모두 액세서리로 나오면 나눌 근거가 약하다: 모두 본품으로 둔다 (빈 목록이 되지 않게)
  const allAcc = items.length > 0 && acc.every(Boolean);
  return items.map((_, i) => {
    const accessory = allAcc ? false : acc[i];
    const score = match[i].total ? match[i].matched / match[i].total : 1;
    return { accessory, tier: accessory ? 2 : full(i) || !match[i].total ? 0 : 1, score };
  });
}

// 관련도순: 낱말이 모두 맞는 본품 → 일부만 맞는 본품 → 액세서리. 같은 무리 안에서는 맞는 비율, 같으면 받은 순서. 빼는 상품은 없다
export function matchOrder<T extends { title: string; price: number | null }>(items: T[], query: string): (T & { accessory?: true })[] {
  const info = classifyItems(items, query);
  return items
    .map((it, i) => ({ it, i, m: info[i] }))
    .sort((a, b) => a.m.tier - b.m.tier || b.m.score - a.m.score || a.i - b.i)
    .map(({ it, m }) => (m.accessory ? { ...it, accessory: true as const } : it));
}

// 서버가 붙인 accessory 표시로 본품과 액세서리를 나눈다 (순서는 그대로)
export function splitMain<T extends { accessory?: boolean }>(items: T[]): { main: T[]; accessories: T[] } {
  return { main: items.filter((it) => !it.accessory), accessories: items.filter((it) => it.accessory) };
}

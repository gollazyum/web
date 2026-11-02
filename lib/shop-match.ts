// 검색어와 상품명이 같은 상품인지, 옵션 줄에 올려도 되는 문구인지 가른다.
// 화면에는 검색어를 고치거나 번역해서 보여 주지 않는다. 여기서 만드는 값은 판정용이다.

export type TitleRelevance = {
  strong: boolean;
  /** 검색어 토큰 중 상품명과 겹친 비율. 0~1 */
  coverage: number;
  matched: number;
  queryTokens: number;
};

// 강한 일치: 검색어 토큰의 2/3 이상이 상품명과 겹쳐야 한다.
// 두 단어(아이폰 17)는 둘 다, 세 단어는 두 단어 이상. 절반만 겹치면(무선 이어폰 ↔ 무선 마우스) 확정하지 않는다.
// 모델·용량·치수처럼 숫자 토큰은 하나라도 빠지면 약한 일치로 본다.
export const RELEVANCE_MIN_COVERAGE = 2 / 3;

const EQUIV: string[][] = [
  ["아이폰", "iphone"],
  ["아이패드", "ipad"],
  ["맥북", "macbook"],
  ["에어팟", "airpods", "airpod"],
  ["갤럭시", "galaxy"],
  ["애플", "apple"],
  ["삼성", "samsung"],
  ["화이트", "white", "흰색"],
  ["블랙", "black", "검정", "검은색"],
  ["블루", "blue", "파랑", "파란색"],
  ["레드", "red", "빨강", "빨간색"],
  ["그린", "green", "초록", "녹색"],
  ["핑크", "pink", "분홍", "분홍색"],
  ["그레이", "gray", "grey", "회색"],
  ["실버", "silver", "은색"],
  ["골드", "gold", "금색"],
  ["퍼플", "purple", "보라", "보라색"],
  ["프로", "pro"],
  ["맥스", "max"],
  ["미니", "mini"],
  ["울트라", "ultra"],
  ["플러스", "plus"],
  ["무선", "wireless"],
  ["유선", "wired"],
  ["이어폰", "earphone", "earphones", "earbuds", "earbud"],
  ["헤드폰", "headphone", "headphones"],
  ["노트북", "laptop", "notebook"],
  ["케이스", "case"],
  ["캐리어", "suitcase", "luggage"],
];

const CANON = new Map<string, string>();
for (const group of EQUIV) for (const word of group) CANON.set(word, group[0]);

// 수식어는 더 긴 단어의 접사로 치지 않는다 (프로 ↔ 프로틴).
const NO_AFFIX = new Set(["프로", "맥스", "미니", "울트라", "플러스"]);

const STOP = new Set(["the", "a", "an", "and", "or", "for", "with", "of", "to", "in", "on", "및", "그리고"]);

const HANGUL_CHAR = "\\u1100-\\u11ff\\u3130-\\u318f\\uac00-\\ud7af";
const HANGUL_WORD = new RegExp(`^[${HANGUL_CHAR}]+$`);

function canon(token: string): string {
  return CANON.get(token) ?? token;
}

function isMeaningful(token: string): boolean {
  if (!token || STOP.has(token)) return false;
  if (/^\d+$/.test(token)) return true;
  if (/^[a-z][a-z0-9]*$/.test(token)) return token.length >= 2;
  if (new RegExp(`^[${HANGUL_CHAR}]$`).test(token) && token >= "\u1100" && token <= "\u318e") return false;
  return true;
}

// 한글·영문·숫자 경계에서 자른다. "아이폰17" → 아이폰, 17. "128GB" → 128, gb.
export function matchTokens(input: string): string[] {
  const n = input.normalize("NFKC").toLowerCase();
  const cleaned = n.replace(new RegExp(`[^0-9a-z${HANGUL_CHAR}]+`, "g"), " ");
  const spaced = cleaned
    .replace(new RegExp(`([${HANGUL_CHAR}])(?=[0-9a-z])`, "g"), "$1 ")
    .replace(new RegExp(`([a-z])(?=[0-9${HANGUL_CHAR}])`, "g"), "$1 ")
    .replace(new RegExp(`([0-9])(?=[a-z${HANGUL_CHAR}])`, "g"), "$1 ");
  return spaced
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(isMeaningful);
}

function hangulAffix(shorter: string, longer: string): boolean {
  if (NO_AFFIX.has(shorter)) return false;
  if (!HANGUL_WORD.test(shorter) || !HANGUL_WORD.test(longer)) return false;
  if (shorter.length < 2 || longer.length <= shorter.length) return false;
  return longer.startsWith(shorter) || longer.endsWith(shorter);
}

function tokenHit(queryToken: string, titleToken: string): boolean {
  const q = canon(queryToken);
  const t = canon(titleToken);
  if (q === t) return true;
  return hangulAffix(q, t) || hangulAffix(queryToken, titleToken);
}

export function titleRelevance(query: string, title: string): TitleRelevance {
  const qTokens = matchTokens(query);
  const tTokens = matchTokens(title);
  const queryTokens = qTokens.length;
  if (!queryTokens) return { strong: false, coverage: 0, matched: 0, queryTokens: 0 };

  const matched = qTokens.filter((q) => tTokens.some((t) => tokenHit(q, t))).length;
  const numbers = qTokens.filter((t) => /^\d+$/.test(t));
  const words = qTokens.filter((t) => !/^\d+$/.test(t));
  const numbersOk = numbers.every((n) => tTokens.some((t) => tokenHit(n, t)));
  const wordsOk = words.length === 0 || words.some((w) => tTokens.some((t) => tokenHit(w, t)));
  const strong = matched >= 1 && matched * 3 >= queryTokens * 2 && numbersOk && wordsOk;

  return { strong, coverage: matched / queryTokens, matched, queryTokens };
}

export function isStrongTitleMatch(query: string, title: string): boolean {
  return titleRelevance(query, title).strong;
}

export function compactText(input: string): string {
  return input.normalize("NFKC").toLowerCase().replace(new RegExp(`[^0-9a-z${HANGUL_CHAR}]+`, "g"), "");
}

// 옵션 줄. 색·용량(저장공간)·크기·수량만 남긴다.
// 근처, 37 km, 매장 거리, 데이터 출처 문구는 버린다.
// 한글 뒤에는 \b 가 먹지 않아서, 영문·숫자·한글이 이어지면 단위로 치지 않는다.
const END = `(?![0-9a-z${HANGUL_CHAR}])`;
const COLOR =
  /화이트|흰색|블랙|검정(?:색)?|레드|빨강|빨간색|블루|파랑|파란색|그린|초록|녹색|핑크|분홍(?:색)?|그레이|회색|실버|은색|골드|금색|퍼플|보라(?:색)?|네이비|남색|베이지|브라운|갈색|옐로(?:우)?|노랑|오렌지|주황|민트|카키|아이보리|스카이|라벤더|티타늄|스타라이트|미드나이트|그래파이트|스페이스\s*그레이|(?:^|[^a-z])(?:white|black|red|blue|green|pink|gr[ae]y|silver|gold|purple|navy|beige|brown|yellow|orange|mint|ivory|titanium|starlight|midnight|graphite|space\s*gr[ae]y)(?![a-z])/i;

const CAPACITY = new RegExp(`\\d+(?:\\.\\d+)?\\s*(?:tb|gb|mb|mah|wh|ml|기가|테라|밀리리터|밀리|리터|l)${END}`, "i");
const SIZE = new RegExp(
  `\\d+(?:\\.\\d+)?\\s*(?:인치|inch(?:es)?|mm|cm|호)${END}|(?:^|[^a-z])(?:xxxl|xxl|xl|xxxs|xxs|xs|s|m|l)${END}|프리사이즈|원사이즈|사이즈`,
  "i",
);
const QTY = new RegExp(`\\d+\\s*(?:개묶음|개입|묶음|세트|팩|박스|캔|병|롤|매입|입|매|장|포|개|pcs|packs|pack|sets|set)${END}`, "i");
const ALLOW = new RegExp(`${COLOR.source}|${CAPACITY.source}|${SIZE.source}|${QTY.source}`, "i");

const DENY = new RegExp(
  `근처|근방|주변|인근|매장|거리|현위치|현재\\s*위치|nearby|near\\s*me|in[\\s-]*store|google|serpapi|구글|출처|\\d+(?:\\.\\d+)?\\s*(?:km|킬로미터|mi|miles?|마일)${END}`,
  "i",
);

const OPTION_SPLIT = /[,·•|/／、，]+/;

function normPiece(s: string): string {
  return s.normalize("NFKC").replace(/\s+/g, " ").trim();
}

function stripMatched(piece: string): string {
  let rest = piece;
  for (const re of [COLOR, CAPACITY, SIZE, QTY]) rest = rest.replace(new RegExp(re.source, "giu"), " ");
  return rest.replace(new RegExp(`[^0-9a-z${HANGUL_CHAR}]+`, "giu"), "");
}

function keepWhole(piece: string): boolean {
  if (!piece || DENY.test(piece) || !ALLOW.test(piece)) return false;
  return stripMatched(piece) === "";
}

export function filterProductOptions(parts: string[]): string {
  const kept: string[] = [];
  const push = (value: string) => {
    const v = normPiece(value);
    if (!v || kept.some((x) => x.toLowerCase() === v.toLowerCase())) return;
    kept.push(v);
  };

  for (const part of parts) {
    for (const raw of normPiece(part).split(OPTION_SPLIT)) {
      const piece = raw.trim();
      if (!piece) continue;
      if (keepWhole(piece)) {
        push(piece);
        continue;
      }
      for (const sub of piece.split(/\s+/)) if (keepWhole(sub)) push(sub);
    }
  }
  return kept.slice(0, 3).join(" · ");
}

// 다른 검색 결과를 같은 상품으로 합쳐도 되는지 엄격하게 본다.
// 모델명(숫자·Pro/Max 같은 등급), 용량, 색상(있으면)이 모두 같고, 중고·리퍼·케이스 같은 말이 없어야 같은 상품.
// 확신이 없으면 false (억지로 합치지 않는다). '자급제'는 본체 상품이라 거르지 않는다

// 같은 상품이 아닐 가능성이 큰 말. 고른 상품 이름에 같은 말이 있으면 그 말은 문제 삼지 않는다
export const EXCLUDE_WORDS = [
  "중고", "리퍼", "리퍼비시", "케이스", "필름", "강화유리", "보호", "커버", "공기계", "액세서리", "악세사리", "악세서리",
  "대여", "렌탈", "렌트", "충전기", "케이블", "스트랩", "거치대", "호환", "부품", "used", "refurbished", "case",
];

const VARIANTS: Record<string, string> = {
  pro: "pro", 프로: "pro", max: "max", 맥스: "max", plus: "plus", 플러스: "plus", mini: "mini", 미니: "mini",
  air: "air", 에어: "air", ultra: "ultra", 울트라: "ultra", lite: "lite", 라이트: "lite", se: "se", fe: "fe",
  fold: "fold", 폴드: "fold", flip: "flip", 플립: "flip", edge: "edge", 엣지: "edge", e: "e",
};

const COLORS: Record<string, string> = {
  블랙: "black", black: "black", 화이트: "white", white: "white", 실버: "silver", silver: "silver", 골드: "gold", gold: "gold",
  블루: "blue", blue: "blue", 그린: "green", green: "green", 핑크: "pink", pink: "pink", 퍼플: "purple", purple: "purple",
  레드: "red", red: "red", 옐로: "yellow", 옐로우: "yellow", yellow: "yellow", 그레이: "gray", gray: "gray", grey: "gray",
  미드나이트: "midnight", 미드나잇: "midnight", midnight: "midnight", 스타라이트: "starlight", starlight: "starlight",
  라벤더: "lavender", lavender: "lavender", 세이지: "sage", sage: "sage", 미스트블루: "mistblue", 오렌지: "orange", orange: "orange",
  네이비: "navy", navy: "navy", 베이지: "beige", beige: "beige", 브라운: "brown", brown: "brown", 민트: "mint", mint: "mint",
  티타늄: "titanium", titanium: "titanium", 내추럴: "natural", natural: "natural", 데저트: "desert", desert: "desert",
};

const GENERIC = new Set(["apple", "애플", "samsung", "삼성", "삼성전자", "자급제", "정품", "공식", "국내", "새상품", "신상", "신품", "단품", "무료배송", "당일", "발송", "출시"]);

// 소문자로, 아이폰/갤럭시처럼 한글·영문이 섞이는 이름을 하나로 맞추고, 글자·숫자 덩어리로 나눈다
function tokenize(title: string): string[] {
  const t = title
    .toLowerCase()
    .replace(/아이폰/g, " iphone ")
    .replace(/갤럭시/g, " galaxy ")
    .replace(/아이패드/g, " ipad ")
    .replace(/에어팟/g, " airpods ")
    .replace(/(\d+)\s*(gb|tb|기가|테라)/g, (_, n, u) => ` ${n}${u === "tb" || u === "테라" ? "tb" : "gb"} `)
    .replace(/(\d)\s*(개|매|입|팩|ea)\b/g, "$1개")
    .replace(/[^0-9a-z가-힣]+/g, " ");
  // "iphone17", "s25"처럼 붙은 글자와 숫자를 나눈다 (용량 64gb, 수량 2개는 그대로)
  return t
    .split(" ")
    .filter(Boolean)
    .flatMap((w) => (/^\d+(gb|tb|개)$/.test(w) ? [w] : w.split(/(?<=[a-z가-힣])(?=\d)|(?<=\d)(?=[a-z가-힣])/)));
}

type Parsed = { capacity: Set<string>; colors: Set<string>; variants: Set<string>; numbers: Set<string>; words: Set<string>; excluded: Set<string> };

function parse(title: string): Parsed {
  const tokens = tokenize(title);
  const p: Parsed = { capacity: new Set(), colors: new Set(), variants: new Set(), numbers: new Set(), words: new Set(), excluded: new Set() };
  const lower = title.toLowerCase().replace(/\s+/g, "");
  for (const w of EXCLUDE_WORDS) if (lower.includes(w)) p.excluded.add(w);
  for (const t of tokens) {
    if (/^\d+(gb|tb)$/.test(t)) p.capacity.add(t);
    else if (/^\d+개$/.test(t) || /^20\d\d$/.test(t)) continue; // 수량, 연도는 모델명으로 보지 않는다
    else if (/^\d+$/.test(t)) p.numbers.add(t);
    else if (COLORS[t]) p.colors.add(COLORS[t]);
    else if (VARIANTS[t]) p.variants.add(VARIANTS[t]);
    else if (t.length >= 2 && !GENERIC.has(t)) p.words.add(t);
  }
  return p;
}

const sameSet = (a: Set<string>, b: Set<string>) => a.size === b.size && [...a].every((x) => b.has(x));

export function isSameProduct(selectedTitle: string, candidateTitle: string): boolean {
  const a = parse(selectedTitle);
  const b = parse(candidateTitle);
  // 고른 상품에 없는 제외어가 후보에 있으면 다른 상품
  if ([...b.excluded].some((w) => !a.excluded.has(w))) return false;
  // 모델 숫자(17, 25 등)와 등급(Pro, Max 등)이 정확히 같아야 한다. 숫자가 하나도 없으면 확신할 수 없다
  if (!a.numbers.size || !sameSet(a.numbers, b.numbers)) return false;
  if (!sameSet(a.variants, b.variants)) return false;
  // 용량은 같아야 한다 (한쪽만 있어도 다른 상품으로 본다)
  if (!sameSet(a.capacity, b.capacity)) return false;
  // 색상: 고른 상품에 색이 있으면 후보도 같은 색이어야 하고, 고른 상품에 색이 없는데 후보에 있으면 다른 상품
  if (!sameSet(a.colors, b.colors)) return false;
  // 상품군 이름(iphone, galaxy 등)이 하나 이상 겹쳐야 한다
  return [...a.words].some((w) => b.words.has(w));
}

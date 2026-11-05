// 쇼핑 검색 목록에서 같은 상품 묶기 (LB-069).
// 상품명에서 색상·옵션 말과 판매 문구(정품·무료배송 등)를 뺀 나머지가 같으면 같은 상품으로 본다.
// 크기(24인치)·용량(256GB)·모델 숫자는 남기므로, 크기가 다른 상품은 묶이지 않는다.
// 검색어 말고 남은 말이 짧아 브랜드·모델을 알기 어려우면(예: '캐리어 24인치 (레몬)', '러프 캐리어 블랙') 판매처 이름을 붙여
// 그 판매처 안에서만 묶는다 (다른 브랜드의 '클래식 캐리어'끼리 섞이지 않게)

// 색상 말. 낱말 전체가 색상 말(들)로만 되어 있을 때만 뺀다 ('크림화이트'는 빼고 '아이스크림'은 남긴다)
const COLOR_WORDS = [
  // 한글
  "블랙", "화이트", "실버", "골드", "블루", "그린", "핑크", "퍼플", "레드", "옐로우", "옐로", "그레이", "그레이쉬", "네이비", "베이지", "브라운",
  "민트", "아이보리", "크림", "레몬", "카키", "올리브", "차콜", "와인", "버건디", "오렌지", "라벤더", "스카이", "코랄", "로즈", "샴페인",
  "티타늄", "내추럴", "미드나이트", "미드나잇", "스타라이트", "다크", "라이트", "딥", "트리플", "스페이스", "매트", "무광", "유광", "펄", "메탈",
  "흰색", "검정", "검정색", "검은색", "하양", "회색", "남색", "빨강", "파랑", "노랑", "초록", "분홍", "보라", "하늘색", "연두", "청록", "베이비",
  // 영어
  "black", "white", "silver", "gold", "blue", "green", "pink", "purple", "red", "yellow", "gray", "grey", "navy", "beige", "brown", "mint",
  "ivory", "cream", "lemon", "khaki", "olive", "charcoal", "wine", "burgundy", "orange", "lavender", "sky", "coral", "rose", "champagne",
  "titanium", "natural", "midnight", "starlight", "dark", "light", "deep", "triple", "space", "matte",
].sort((a, b) => b.length - a.length);
const COLOR_RE = new RegExp(`^(?:${COLOR_WORDS.join("|")})+(?:색|컬러|color)?$`);

// 같은 색을 한글·영어로 따로 세지 않게 ('블랙' = 'black')
const KO_EN: Record<string, string> = {
  블랙: "black", 검정: "black", 검정색: "black", 검은색: "black", 화이트: "white", 흰색: "white", 하양: "white", 실버: "silver", 골드: "gold",
  블루: "blue", 파랑: "blue", 그린: "green", 초록: "green", 핑크: "pink", 분홍: "pink", 퍼플: "purple", 보라: "purple", 레드: "red", 빨강: "red",
  옐로우: "yellow", 옐로: "yellow", 노랑: "yellow", 그레이: "gray", 회색: "gray", grey: "gray", 네이비: "navy", 남색: "navy", 베이지: "beige",
  브라운: "brown", 민트: "mint", 아이보리: "ivory", 크림: "cream", 레몬: "lemon", 카키: "khaki", 올리브: "olive", 차콜: "charcoal",
  오렌지: "orange", 라벤더: "lavender", 티타늄: "titanium", 내추럴: "natural", 미드나이트: "midnight", 미드나잇: "midnight", 스타라이트: "starlight",
};
const sameColor = (t: string) => KO_EN[t] ?? t;

// 상품을 구분하지 않는 판매 문구·옵션 개수 표시
const NOISE = new Set([
  "정품", "국내정품", "새상품", "새제품", "미개봉", "무료배송", "당일발송", "당일출고", "택1", "단품", "공식", "신상", "x", "1개", "옵션", "선택",
]);
const OPTION_COUNT = /^\d+(?:color|colors|컬러|색상|색|size|사이즈|종)$/;

// 판매처를 넘어 묶으려면 검색어 밖의 말이 이 글자 수 이상이어야 한다 (브랜드·모델 이름)
const MIN_DISTINCT_CHARS = 4;

const compact = (s: string) => s.toLowerCase().replace(/[^0-9a-z가-힣]+/g, "");

// 한글·영어로 섞여 오는 브랜드·제품 이름은 하나로 맞춘다 ('애플 아이폰17' = 'Apple iPhone 17')
const ALIASES: [RegExp, string][] = [
  [/애플/g, " apple "],
  [/아이폰/g, " iphone "],
  [/아이패드/g, " ipad "],
  [/에어팟/g, " airpods "],
  [/맥북/g, " macbook "],
  [/갤럭시/g, " galaxy "],
  [/삼성전자|삼성/g, " samsung "],
];

// 소문자 낱말로 나누고, 붙은 글자와 숫자를 뗀다 ('아이폰17' → iphone 17, '256GB' → 256 gb)
function tokens(title: string): string[] {
  let t = title.toLowerCase();
  for (const [re, to] of ALIASES) t = t.replace(re, to);
  return t
    .replace(/[^0-9a-z가-힣]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .flatMap((w) => (OPTION_COUNT.test(w) ? [w] : w.split(/(?<=[a-z가-힣])(?=\d)|(?<=\d)(?=[a-z가-힣])/)));
}

export type GroupParts = { key: string; colors: string };

// 묶음 열쇠와, 뺀 색상 말(옵션 수를 세는 데 쓴다)
export function groupParts(title: string, source: string | null | undefined, query: string, used = false): GroupParts {
  const kept: string[] = [];
  const colors: string[] = [];
  for (const t of tokens(title)) {
    if (COLOR_RE.test(t)) colors.push(sameColor(t));
    else if (NOISE.has(t) || OPTION_COUNT.test(t)) continue;
    else kept.push(t);
  }
  // 낱말 순서는 판매처마다 달라 정렬해서 맞춘다 ('블랙 24인치' = '24인치 / 블랙')
  const uniq = [...new Set(kept)].sort();
  let key = uniq.join(" ");
  // 검색어 말고 남은 말이 4글자 미만이면 상품을 확실히 구분할 수 없다 → 판매처 이름을 붙인다
  const q = new Set(tokens(query));
  const extra = uniq.filter((t) => !q.has(t)).join("");
  if (extra.length < MIN_DISTINCT_CHARS || uniq.join("") === compact(query)) key += `@${compact(source ?? "")}`;
  if (used) key += "#used";
  return { key, colors: [...new Set(colors)].sort().join(" ") };
}

export type Grouped<T> = { lead: T; members: T[]; prices: number[]; sellers: string[]; options: number };

// 같은 열쇠끼리 묶는다. 순서는 각 묶음이 처음 나온 자리, 대표(lead)는 묶음에서 처음 나온 상품
export function groupItems<T>(
  items: T[],
  view: (it: T) => { title: string; source: string | null; seller: string | null; price: number | null; used?: boolean },
  query: string,
): Grouped<T>[] {
  const map = new Map<string, { lead: T; members: T[]; colors: Set<string> }>();
  for (const it of items) {
    const v = view(it);
    const { key, colors } = groupParts(v.title, v.source, query, !!v.used);
    const g = map.get(key);
    if (g) {
      g.members.push(it);
      if (colors) g.colors.add(colors);
    } else map.set(key, { lead: it, members: [it], colors: new Set(colors ? [colors] : []) });
  }
  return [...map.values()].map((g) => {
    const vs = g.members.map(view);
    return {
      lead: g.lead,
      members: g.members,
      prices: vs.map((v) => v.price).filter((p): p is number => p !== null && p > 0),
      sellers: [...new Set(vs.map((v) => v.seller).filter((s): s is string => !!s))],
      options: g.colors.size,
    };
  });
}

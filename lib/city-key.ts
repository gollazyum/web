import { popularCity } from "./popular-stay-cities";
import { cityKo } from "./trip";

// 도시 키(city_key): 영어 소문자 슬러그 하나로 통일한다 ('벳푸' · 'Beppu' · ' BEPPU ' → 'beppu').
// hotels_master에 저장할 때와 읽을 때 모두 cityKey()를 거친다. 화면에 보일 이름은 cityLabel()로 되돌린다.
// 1) 대소문자·공백·'도쿄도' 같은 행정 구역 접미사를 맞추고
// 2) 아래 표(대표 한글·영문 이름)에 있으면 그 슬러그 ("도쿄 신주쿠"처럼 도시 이름이 들어 있어도 같은 도시)
// 3) 표에 없으면 영문은 그대로 슬러그로, 한글은 로마자로 바꿔 슬러그로 만든다 (같은 글자면 늘 같은 슬러그)

type CityAlias = { key: string; names: string[] };

// 대표 한글·영문 이름 (앞 12곳은 lib/popular-stay-cities.ts와 같다). 첫 번째 한글 이름이 화면에 보일 이름
export const CITY_ALIASES: readonly CityAlias[] = [
  { key: "tokyo", names: ["도쿄", "동경", "tokyo"] },
  { key: "osaka", names: ["오사카", "osaka"] },
  { key: "fukuoka", names: ["후쿠오카", "fukuoka"] },
  { key: "kyoto", names: ["교토", "kyoto"] },
  { key: "sapporo", names: ["삿포로", "sapporo"] },
  { key: "okinawa", names: ["오키나와", "나하", "okinawa", "naha"] },
  { key: "bangkok", names: ["방콕", "bangkok"] },
  { key: "danang", names: ["다낭", "da nang", "danang"] },
  { key: "nhatrang", names: ["나트랑", "냐짱", "nha trang", "nhatrang"] },
  { key: "taipei", names: ["타이베이", "타이페이", "taipei"] },
  { key: "paris", names: ["파리", "paris"] },
  { key: "london", names: ["런던", "london"] },
  { key: "beppu", names: ["벳푸", "벳부", "베푸", "beppu"] },
  { key: "yufuin", names: ["유후인", "yufuin"] },
  { key: "oita", names: ["오이타", "oita"] },
  { key: "kitakyushu", names: ["기타큐슈", "키타큐슈", "kitakyushu"] },
  { key: "nagasaki", names: ["나가사키", "nagasaki"] },
  { key: "kumamoto", names: ["구마모토", "쿠마모토", "kumamoto"] },
  { key: "kagoshima", names: ["가고시마", "kagoshima"] },
  { key: "nagoya", names: ["나고야", "nagoya"] },
  { key: "kobe", names: ["고베", "kobe"] },
  { key: "nara", names: ["나라", "nara"] },
  { key: "yokohama", names: ["요코하마", "yokohama"] },
  { key: "hakone", names: ["하코네", "hakone"] },
  { key: "hiroshima", names: ["히로시마", "hiroshima"] },
  { key: "kanazawa", names: ["가나자와", "kanazawa"] },
  { key: "hakodate", names: ["하코다테", "hakodate"] },
  { key: "otaru", names: ["오타루", "otaru"] },
  { key: "takamatsu", names: ["다카마쓰", "다카마츠", "takamatsu"] },
  { key: "matsuyama", names: ["마쓰야마", "마츠야마", "matsuyama"] },
  { key: "shizuoka", names: ["시즈오카", "shizuoka"] },
  { key: "seoul", names: ["서울", "seoul"] },
  { key: "busan", names: ["부산", "busan"] },
  { key: "jeju", names: ["제주", "jeju"] },
  { key: "gangneung", names: ["강릉", "gangneung"] },
  { key: "gyeongju", names: ["경주", "gyeongju"] },
  { key: "yeosu", names: ["여수", "yeosu"] },
  { key: "sokcho", names: ["속초", "sokcho"] },
  { key: "hong-kong", names: ["홍콩", "hong kong", "hongkong"] },
  { key: "macau", names: ["마카오", "macau", "macao"] },
  { key: "singapore", names: ["싱가포르", "싱가폴", "singapore"] },
  { key: "shanghai", names: ["상하이", "상해", "shanghai"] },
  { key: "beijing", names: ["베이징", "북경", "beijing"] },
  { key: "qingdao", names: ["칭다오", "qingdao"] },
  { key: "hanoi", names: ["하노이", "hanoi"] },
  { key: "ho-chi-minh", names: ["호치민", "호찌민", "ho chi minh", "hochiminh", "saigon"] },
  { key: "phu-quoc", names: ["푸꾸옥", "푸쿠옥", "phu quoc", "phuquoc"] },
  { key: "dalat", names: ["달랏", "dalat", "da lat"] },
  { key: "chiang-mai", names: ["치앙마이", "chiang mai", "chiangmai"] },
  { key: "phuket", names: ["푸켓", "phuket"] },
  { key: "pattaya", names: ["파타야", "pattaya"] },
  { key: "kaohsiung", names: ["가오슝", "kaohsiung"] },
  { key: "cebu", names: ["세부", "cebu"] },
  { key: "boracay", names: ["보라카이", "boracay"] },
  { key: "manila", names: ["마닐라", "manila"] },
  { key: "bali", names: ["발리", "bali"] },
  { key: "kuala-lumpur", names: ["쿠알라룸푸르", "kuala lumpur"] },
  { key: "kota-kinabalu", names: ["코타키나발루", "kota kinabalu"] },
  { key: "guam", names: ["괌", "guam"] },
  { key: "saipan", names: ["사이판", "saipan"] },
  { key: "honolulu", names: ["호놀룰루", "하와이", "honolulu", "hawaii"] },
  { key: "new-york", names: ["뉴욕", "new york"] },
  { key: "los-angeles", names: ["로스앤젤레스", "엘에이", "los angeles"] },
  { key: "rome", names: ["로마", "rome"] },
  { key: "barcelona", names: ["바르셀로나", "barcelona"] },
  { key: "prague", names: ["프라하", "prague"] },
];

const HANGUL = /[가-힣]/;

// 대소문자·공백·행정 구역 접미사 맞추기
export function cityText(v: string): string {
  return cityKo(v).toLowerCase().replace(/\s+/g, " ").trim();
}

// 이름이 글 안에 들어 있는지. 영문은 낱말 단위로만 (예: 'nara'가 'naraya' 안에서 걸리지 않게)
function hasName(t: string, n: string): boolean {
  if (t === n) return true;
  if (HANGUL.test(n)) return t.includes(n);
  return new RegExp(`(^|[^a-z0-9])${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^a-z0-9])`).test(t);
}

// ---------- 한글 → 로마자 (표에 없는 도시용. 국어의 로마자 표기법 기본 대응, 소리 바뀜은 반영하지 않는다) ----------
const INITIAL = ["g", "kk", "n", "d", "tt", "r", "m", "b", "pp", "s", "ss", "", "j", "jj", "ch", "k", "t", "p", "h"];
const MEDIAL = ["a", "ae", "ya", "yae", "eo", "e", "yeo", "ye", "o", "wa", "wae", "oe", "yo", "u", "wo", "we", "wi", "yu", "eu", "ui", "i"];
const FINAL = ["", "k", "k", "k", "n", "n", "n", "t", "l", "k", "m", "l", "l", "l", "p", "l", "m", "p", "p", "t", "t", "ng", "t", "t", "k", "t", "p", "t"];

export function romanize(v: string): string {
  let out = "";
  for (const ch of v) {
    const c = ch.codePointAt(0)! - 0xac00;
    if (c < 0 || c > 11171) {
      out += ch;
      continue;
    }
    out += INITIAL[Math.floor(c / 588)] + MEDIAL[Math.floor((c % 588) / 28)] + FINAL[c % 28];
  }
  return out;
}

function slugify(v: string): string {
  return romanize(v)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const isCityKey = (v: string) => SLUG.test(v);

// 도시 이름(한글·영문, 대소문자·공백 상관없이) → 영어 소문자 슬러그. 비어 있으면 ""
export function cityKey(v: string | null | undefined): string {
  const t = cityText(v ?? "");
  if (!t) return "";
  const pop = popularCity(t);
  if (pop) return pop;
  for (const c of CITY_ALIASES) if (c.names.some((n) => hasName(t, n))) return c.key;
  // 이미 슬러그면 그대로 (cityKey(cityKey(x)) === cityKey(x))
  return SLUG.test(t) ? t : slugify(t);
}

// 슬러그 → 화면에 보일 한글 이름 (표에 없으면 슬러그 그대로)
export function cityLabel(key: string | null | undefined): string {
  const k = cityKey(key);
  const c = CITY_ALIASES.find((x) => x.key === k);
  return c?.names.find((n) => HANGUL.test(n)) ?? key ?? "";
}

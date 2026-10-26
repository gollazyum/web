// 전 세계 공항 목록(public/airports.json)을 만든다.
// 원본: OurAirports airports.csv (퍼블릭 도메인) https://ourairports.com/data/
// 사용법: node scripts/build-airports.mjs path/to/airports.csv
import { readFileSync, writeFileSync } from "node:fs";

const csvPath = process.argv[2];
if (!csvPath) throw new Error("airports.csv 경로를 넣어 주세요");

function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (ch !== "\r") field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

// 여러 공항을 묶는 도시 코드 (Aviasales에서 도시 코드로 검색 가능)
const metros = [
  ["SEL", "Seoul", "서울", "KR", ["ICN", "GMP"]],
  ["TYO", "Tokyo", "도쿄", "JP", ["NRT", "HND"]],
  ["OSA", "Osaka", "오사카", "JP", ["KIX", "ITM", "UKB"]],
  ["SPK", "Sapporo", "삿포로", "JP", ["CTS", "OKD"]],
  ["NGO", "Nagoya", "나고야", "JP", ["NGO", "NKM"]],
  ["BJS", "Beijing", "베이징", "CN", ["PEK", "PKX"]],
  ["SHA", "Shanghai", "상하이", "CN", ["PVG", "SHA"]],
  ["TPE", "Taipei", "타이베이", "TW", ["TPE", "TSA"]],
  ["BKK", "Bangkok", "방콕", "TH", ["BKK", "DMK"]],
  ["JKT", "Jakarta", "자카르타", "ID", ["CGK", "HLP"]],
  ["KUL", "Kuala Lumpur", "쿠알라룸푸르", "MY", ["KUL", "SZB"]],
  ["LON", "London", "런던", "GB", ["LHR", "LGW", "STN", "LTN", "LCY", "SEN"]],
  ["PAR", "Paris", "파리", "FR", ["CDG", "ORY", "BVA"]],
  ["ROM", "Rome", "로마", "IT", ["FCO", "CIA"]],
  ["MIL", "Milan", "밀라노", "IT", ["MXP", "LIN", "BGY"]],
  ["MOW", "Moscow", "모스크바", "RU", ["SVO", "DME", "VKO"]],
  ["STO", "Stockholm", "스톡홀름", "SE", ["ARN", "BMA"]],
  ["IST", "Istanbul", "이스탄불", "TR", ["IST", "SAW"]],
  ["DXB", "Dubai", "두바이", "AE", ["DXB", "DWC"]],
  ["NYC", "New York", "뉴욕", "US", ["JFK", "EWR", "LGA"]],
  ["CHI", "Chicago", "시카고", "US", ["ORD", "MDW"]],
  ["WAS", "Washington", "워싱턴", "US", ["IAD", "DCA", "BWI"]],
  ["YTO", "Toronto", "토론토", "CA", ["YYZ", "YTZ"]],
  ["SAO", "São Paulo", "상파울루", "BR", ["GRU", "CGH", "VCP"]],
  ["RIO", "Rio de Janeiro", "리우데자네이루", "BR", ["GIG", "SDU"]],
  ["BUE", "Buenos Aires", "부에노스아이레스", "AR", ["EZE", "AEP"]],
];

// 공항 코드 → 한국어 도시 이름 (한글로 쳐도 찾을 수 있게)
const koCity = {
  ICN: "서울", GMP: "서울", PUS: "부산", CJU: "제주", TAE: "대구", CJJ: "청주", MWX: "무안",
  KWJ: "광주", RSU: "여수", USN: "울산", KPO: "포항", YNY: "양양", KUV: "군산", WJU: "원주", HIN: "사천",
  NRT: "도쿄", HND: "도쿄", KIX: "오사카", ITM: "오사카", UKB: "고베", FUK: "후쿠오카", CTS: "삿포로",
  OKD: "삿포로", OKA: "오키나와", NGO: "나고야", NKM: "나고야", KOJ: "가고시마", KMJ: "구마모토",
  OIT: "오이타", NGS: "나가사키", KMI: "미야자키", HIJ: "히로시마", OKJ: "오카야마", TAK: "다카마쓰",
  MYJ: "마쓰야마", KMQ: "고마쓰", TOY: "도야마", SDJ: "센다이", AOJ: "아오모리", HKD: "하코다테",
  AKJ: "아사히카와", KIJ: "니가타", FSZ: "시즈오카", ISG: "이시가키", MMY: "미야코지마", YGJ: "요나고",
  KCZ: "고치", UBJ: "우베", SHI: "시모지시마",
  PEK: "베이징", PKX: "베이징", PVG: "상하이", SHA: "상하이", CAN: "광저우", SZX: "선전", CTU: "청두",
  TFU: "청두", CKG: "충칭", XIY: "시안", HGH: "항저우", NKG: "난징", TAO: "칭다오", DLC: "다롄",
  SHE: "선양", YNJ: "옌지", HRB: "하얼빈", TSN: "톈진", WEH: "웨이하이", YNT: "옌타이", CGQ: "창춘",
  XMN: "샤먼", KMG: "쿤밍", SYX: "싼야", HAK: "하이커우", KWL: "구이린", ZUH: "주하이", WUH: "우한",
  CSX: "창사", TNA: "지난", NGB: "닝보", FOC: "푸저우", DYG: "장자제", URC: "우루무치", LHW: "란저우",
  HKG: "홍콩", MFM: "마카오", TPE: "타이베이", TSA: "타이베이", KHH: "가오슝", RMQ: "타이중",
  BKK: "방콕", DMK: "방콕", HKT: "푸껫", CNX: "치앙마이", USM: "코사무이", KBV: "끄라비", UTP: "파타야",
  CEI: "치앙라이",
  DAD: "다낭", SGN: "호치민", HAN: "하노이", CXR: "나트랑", PQC: "푸꾸옥", DLI: "달랏", HPH: "하이퐁",
  VCA: "껀터", HUI: "후에", VDO: "하롱",
  CEB: "세부", MNL: "마닐라", CRK: "클락", KLO: "보라카이", MPH: "보라카이", TAG: "보홀", PPS: "팔라완",
  DVO: "다바오",
  SIN: "싱가포르", KUL: "쿠알라룸푸르", BKI: "코타키나발루", PEN: "페낭", LGK: "랑카위", KCH: "쿠칭",
  DPS: "발리", CGK: "자카르타", HLP: "자카르타", LOP: "롬복", SUB: "수라바야", BTH: "바탐",
  KTI: "프놈펜", SAI: "시엠립", VTE: "비엔티안", LPQ: "루앙프라방",
  RGN: "양곤", BWN: "반다르스리브가완", UBN: "울란바토르",
  DEL: "델리", BOM: "뭄바이", BLR: "벵갈루루", MAA: "첸나이", KTM: "카트만두", CMB: "콜롬보", MLE: "몰디브",
  GUM: "괌", SPN: "사이판", ROR: "팔라우", HNL: "호놀룰루", OGG: "마우이", KOA: "코나", NAN: "피지",
  SYD: "시드니", MEL: "멜버른", BNE: "브리즈번", OOL: "골드코스트", PER: "퍼스", CNS: "케언즈",
  ADL: "애들레이드", AKL: "오클랜드", CHC: "크라이스트처치", ZQN: "퀸스타운", NOU: "누메아",
  LAX: "로스앤젤레스", SFO: "샌프란시스코", SEA: "시애틀", LAS: "라스베이거스", JFK: "뉴욕", EWR: "뉴욕",
  LGA: "뉴욕", ORD: "시카고", MDW: "시카고", IAD: "워싱턴", DCA: "워싱턴", BWI: "워싱턴", BOS: "보스턴",
  ATL: "애틀랜타", DFW: "댈러스", IAH: "휴스턴", MIA: "마이애미", MCO: "올랜도", DEN: "덴버",
  SAN: "샌디에이고", PHX: "피닉스", MSP: "미니애폴리스", DTW: "디트로이트", PHL: "필라델피아",
  ANC: "앵커리지", SLC: "솔트레이크시티", PDX: "포틀랜드", SJC: "산호세", AUS: "오스틴",
  YVR: "밴쿠버", YYZ: "토론토", YTZ: "토론토", YUL: "몬트리올", YYC: "캘거리",
  MEX: "멕시코시티", CUN: "칸쿤", GRU: "상파울루", CGH: "상파울루", VCP: "상파울루", GIG: "리우데자네이루",
  SDU: "리우데자네이루", EZE: "부에노스아이레스", AEP: "부에노스아이레스", LIM: "리마", SCL: "산티아고",
  BOG: "보고타", HAV: "아바나", CUZ: "쿠스코",
  LHR: "런던", LGW: "런던", STN: "런던", LTN: "런던", LCY: "런던", SEN: "런던", MAN: "맨체스터",
  EDI: "에든버러", DUB: "더블린", CDG: "파리", ORY: "파리", BVA: "파리", NCE: "니스", LYS: "리옹",
  MRS: "마르세유", FCO: "로마", CIA: "로마", MXP: "밀라노", LIN: "밀라노", BGY: "밀라노", VCE: "베네치아",
  FLR: "피렌체", NAP: "나폴리", BCN: "바르셀로나", MAD: "마드리드", AGP: "말라가", SVQ: "세비야",
  PMI: "마요르카", LIS: "리스본", OPO: "포르투", FRA: "프랑크푸르트", MUC: "뮌헨", BER: "베를린",
  HAM: "함부르크", DUS: "뒤셀도르프", AMS: "암스테르담", BRU: "브뤼셀", ZRH: "취리히", GVA: "제네바",
  VIE: "빈", PRG: "프라하", BUD: "부다페스트", WAW: "바르샤바", KRK: "크라쿠프", CPH: "코펜하겐",
  ARN: "스톡홀름", BMA: "스톡홀름", OSL: "오슬로", HEL: "헬싱키", KEF: "레이캬비크", ATH: "아테네",
  JTR: "산토리니", JMK: "미코노스", ZAG: "자그레브", DBV: "두브로브니크", SPU: "스플리트",
  IST: "이스탄불", SAW: "이스탄불", AYT: "안탈리아", NAV: "카파도키아", ASR: "카파도키아",
  SVO: "모스크바", DME: "모스크바", VKO: "모스크바", LED: "상트페테르부르크", VVO: "블라디보스토크",
  KHV: "하바롭스크", IKT: "이르쿠츠크", TAS: "타슈켄트", ALA: "알마티", NQZ: "아스타나",
  DXB: "두바이", DWC: "두바이", AUH: "아부다비", DOH: "도하", RUH: "리야드", JED: "제다",
  TLV: "텔아비브", AMM: "암만", CAI: "카이로", HRG: "후르가다", CMN: "카사블랑카", RAK: "마라케시",
  NBO: "나이로비", JNB: "요하네스버그", CPT: "케이프타운", ADD: "아디스아바바", MRU: "모리셔스",
};

// 한국 공항은 한국어 공항 이름으로 보여 준다
const koName = {
  ICN: "인천국제공항", GMP: "김포국제공항", PUS: "김해국제공항", CJU: "제주국제공항", TAE: "대구국제공항",
  CJJ: "청주국제공항", MWX: "무안국제공항", KWJ: "광주공항", RSU: "여수공항", USN: "울산공항",
  KPO: "포항경주공항", YNY: "양양국제공항", KUV: "군산공항", WJU: "원주공항", HIN: "사천공항",
};

const [header, ...rows] = parseCsv(readFileSync(csvPath, "utf8"));
const col = Object.fromEntries(header.map((h, i) => [h, i]));
const regionKo = new Intl.DisplayNames(["ko"], { type: "region" });

// "Wonju Airport / Hoengseong Air Base (K-38/K-46)" → "Wonju Airport"
function cleanName(name) {
  return name.replace(/\s*\/.*$/, "").replace(/\s*\([^)]*\)\s*$/, "").trim();
}

const airports = [];
const countries = {};
for (const r of rows) {
  const iata = r[col.iata_code];
  if (!iata || !/^[A-Z]{3}$/.test(iata)) continue;
  if (r[col.scheduled_service] !== "yes") continue;
  if (!["large_airport", "medium_airport", "small_airport"].includes(r[col.type])) continue;
  const cc = r[col.iso_country];
  countries[cc] ??= regionKo.of(cc) ?? cc;
  const size = r[col.type] === "large_airport" ? 2 : r[col.type] === "medium_airport" ? 1 : 0;
  airports.push([iata, koName[iata] ?? cleanName(r[col.name]), r[col.municipality] || "", cc, koCity[iata] ?? "", size]);
}
airports.sort((a, b) => b[5] - a[5] || a[0].localeCompare(b[0]));

const out = { countries, metros, airports };
writeFileSync(new URL("../public/airports.json", import.meta.url), JSON.stringify(out));
console.log(`공항 ${airports.length}개, 나라 ${Object.keys(countries).length}개`);

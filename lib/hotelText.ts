// 외부 호텔 데이터(SerpApi Google Hotels)에서 영어로 들어오는 문구를 한글로 바꾼다.
// hl=ko로 불러도 영어가 섞여 올 때가 있어, 자주 나오는 것만 표로 옮긴다
// 영어 → 한글 번역 표. 키는 소문자로 적는다. 표에 없는 값은 원문 그대로 보여 준다
const EN_KO: Record<string, string> = {
  // 배지·특가 문구
  "great deal": "특가",
  deal: "할인",
  "great price": "좋은 가격",
  "low price": "저렴한 가격",
  "best price": "특가",
  // 숙소 종류
  hotel: "호텔",
  "vacation rental": "휴가용 숙소",
  apartment: "아파트",
  hostel: "호스텔",
  resort: "리조트",
  ryokan: "료칸",
  inn: "여관",
  guesthouse: "게스트하우스",
  "bed & breakfast": "B&B",
  motel: "모텔",
  villa: "빌라",
  // 편의시설
  "free wi-fi": "무료 와이파이",
  "wi-fi": "와이파이",
  "paid wi-fi": "와이파이(유료)",
  "free breakfast": "무료 조식",
  breakfast: "조식",
  "free parking": "무료 주차",
  parking: "주차",
  "paid parking": "주차(유료)",
  "pool": "수영장",
  "outdoor pool": "야외 수영장",
  "indoor pool": "실내 수영장",
  "hot tub": "온수 욕조",
  spa: "스파",
  "fitness centre": "피트니스 센터",
  "fitness center": "피트니스 센터",
  restaurant: "레스토랑",
  bar: "바",
  "room service": "룸서비스",
  "air conditioning": "에어컨",
  "air-conditioned": "에어컨",
  "airport shuttle": "공항 셔틀",
  "free airport shuttle": "무료 공항 셔틀",
  "full-service laundry": "세탁 서비스",
  "laundry service": "세탁 서비스",
  kitchen: "주방",
  "kitchen in some rooms": "일부 객실 주방",
  kitchenette: "간이 주방",
  accessible: "장애인 편의시설",
  "wheelchair accessible": "휠체어 이용 가능",
  "pet-friendly": "반려동물 동반 가능",
  "pets allowed": "반려동물 동반 가능",
  "kid-friendly": "어린이 친화",
  "child-friendly": "어린이 친화",
  "business centre": "비즈니스 센터",
  "business center": "비즈니스 센터",
  "smoke-free property": "전 구역 금연",
  "non-smoking": "금연",
  "beach access": "해변 이용",
  "public bath": "대욕장",
  "hot spring": "온천",
  "hot springs": "온천",
  "onsen": "온천",
  sauna: "사우나",
  elevator: "엘리베이터",
  "24-hour front desk": "24시간 프런트",
  "front desk": "프런트",
  "luggage storage": "수하물 보관",
  "airport transfer": "공항 이동 서비스",
  "electric car charging station": "전기차 충전소",
  "ev charger": "전기차 충전소",
  "washer and dryer": "세탁기·건조기",
  washer: "세탁기",
  dryer: "건조기",
  microwave: "전자레인지",
  refrigerator: "냉장고",
  balcony: "발코니",
  "all-inclusive available": "올인클루시브 가능",
  "golf": "골프",
  "tennis": "테니스",
  "ski-in/ski-out": "스키 인·아웃",
  "crib": "아기 침대",
  "cribs": "아기 침대",
  heating: "난방",
  "cable tv": "케이블 TV",
  tv: "TV",
  "open air bath": "노천탕",
  "open-air bath": "노천탕",
  "outdoor bath": "노천탕",
  "private bath": "전용 욕실",
  "private bathroom": "전용 욕실",
  "shared bath": "공용 욕실",
  "shared bathroom": "공용 욕실",
  "private onsen": "전용 온천",
  "spa tub": "스파 욕조",
  "bathtub": "욕조",
  beach: "해변",
  "beachfront": "해변 바로 앞",
  "free cancellation": "무료 취소",
  "free wifi": "무료 와이파이",
  wifi: "와이파이",
  "fitness centre with gym": "피트니스 센터",
  gym: "피트니스 센터",
  "outdoor pool (seasonal)": "야외 수영장(시즌)",
  "pool (seasonal)": "수영장(시즌)",
  "game room": "게임룸",
  "kids' club": "키즈 클럽",
  "kids club": "키즈 클럽",
  "playground": "놀이터",
  "garden": "정원",
  "terrace": "테라스",
  "shuttle": "셔틀",
  "parking (paid)": "주차(유료)",
};

function lookup(text: string): string | undefined {
  return EN_KO[text.trim().toLowerCase()];
}

// "Breakfast ($)"처럼 유료 표시가 붙은 것도 바꾸고, 모르는 것은 그대로 둔다
export function amenityKo(name: string): string {
  const paid = /\s*\(\$\)$/.test(name);
  const base = name.replace(/\s*\(\$\)$/, "").trim();
  const ko = lookup(base);
  // 한국어로 온 것도 'Wi-Fi' 표기가 섞여 온다('무료 Wi-Fi'). 필터에 두 줄로 나오지 않게 '와이파이'로 맞춘다
  if (!ko) return name.replace(/wi-?fi/gi, "와이파이");
  return paid && !ko.includes("유료") ? `${ko}(유료)` : ko;
}

// 특가 배지("Great Deal")와 설명("22% less than usual")
export function dealKo(text: string): string {
  const pct = text.match(/^(\d+)% less than usual$/i);
  if (pct) return `평소보다 ${pct[1]}% 저렴`;
  return lookup(text) ?? text;
}

// 숙소 종류. 비어 있으면 호텔로 본다
export function kindKo(type: string | undefined): string {
  if (!type) return "호텔";
  return lookup(type) ?? type;
}

// 자주 나오는 호텔 체인 영문 이름 → 한글. 앞쪽이 더 긴 이름이라 먼저 맞춰 본다
const CHAINS: [RegExp, string][] = [
  [/\bsotetsu fresa inn\b/i, "소테츠 프레사 인"],
  [/\bdaiwa roynet hotel\b/i, "다이와 로이넷 호텔"],
  [/\bmitsui garden hotel\b/i, "미쓰이 가든 호텔"],
  [/\bhotel gracery\b/i, "호텔 그레이서리"],
  [/\bhotel mystays\b/i, "호텔 마이스테이즈"],
  [/\bhotel monterey\b/i, "호텔 몬터레이"],
  [/\bhotel keihan\b/i, "호텔 게이한"],
  [/\bhotel nikko\b/i, "호텔 닛코"],
  [/\bsarasa hotel\b/i, "사라사 호텔"],
  [/\bapa hotel\b/i, "아파 호텔"],
  [/\btoyoko inn\b/i, "토요코 인"],
  [/\bdormy inn\b/i, "도미 인"],
  [/\bvessel inn\b/i, "베셀 인"],
  [/\bvia inn\b/i, "비아 인"],
  [/\bsuper hotel\b/i, "슈퍼 호텔"],
  [/\brichmond hotel\b/i, "리치몬드 호텔"],
  [/\bcomfort hotel\b/i, "컴포트 호텔"],
  [/\bremm\b/i, "렘"],
];

// 체인 이름을 바꾼 경우에만 뒤에 붙은 지명도 같이 바꾼다 ("아파 호텔 Shinjuku" 같은 반쪽 번역을 줄인다)
const PLACES: Record<string, string> = {
  tokyo: "도쿄", osaka: "오사카", kyoto: "교토", fukuoka: "후쿠오카", sapporo: "삿포로", nagoya: "나고야", okinawa: "오키나와", naha: "나하",
  yokohama: "요코하마", kobe: "고베", hiroshima: "히로시마", shinjuku: "신주쿠", shibuya: "시부야", ginza: "긴자", asakusa: "아사쿠사",
  ueno: "우에노", ikebukuro: "이케부쿠로", akihabara: "아키하바라", shinagawa: "시나가와", namba: "난바", umeda: "우메다",
  shinsaibashi: "신사이바시", dotonbori: "도톤보리", hakata: "하카타", tenjin: "덴진", susukino: "스스키노", station: "역", ekimae: "역앞",
};

// 화면에 보여 줄 호텔 이름. 예약 링크·검색에는 원래 이름을 그대로 쓴다
export function hotelNameKo(name: string): string {
  let out = name;
  for (const [re, ko] of CHAINS) out = out.replace(re, ko);
  if (out === name) return name;
  return out.replace(/\b[A-Za-z]+\b/g, (w) => PLACES[w.toLowerCase()] ?? w);
}

// 카드에 먼저 보여 줄 편의시설: 한국 여행자가 많이 찾는 것부터. 유료 주차는 빼고 무료 주차만 남긴다
const FIRST = [/무료 와이파이/, /대욕장|온천|노천탕/, /수하물 보관/, /24시간 프런트/, /금연/, /역 근처/];
export function cardAmenities(list: string[]): string[] {
  const kept = list.filter((a) => !/주차/.test(a) || /^무료 주차/.test(a));
  const rank = (a: string) => {
    const i = FIRST.findIndex((re) => re.test(a));
    return i < 0 ? FIRST.length : i;
  };
  return kept.map((a, i) => ({ a, i })).sort((x, y) => rank(x.a) - rank(y.a) || x.i - y.i).map((x) => x.a);
}

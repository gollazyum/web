// 외부 호텔 데이터(SerpApi Google Hotels)에서 영어로 들어오는 문구를 한글로 바꾼다.
// hl=ko로 불러도 영어가 섞여 올 때가 있어, 자주 나오는 것만 표로 옮긴다
// 영어 → 한글 번역 표. 키는 소문자로 적는다. 표에 없는 값은 원문 그대로 보여 준다
const EN_KO: Record<string, string> = {
  // 배지·특가 문구
  "great deal": "특가",
  deal: "할인",
  "great price": "좋은 가격",
  "low price": "저렴한 가격",
  "best price": "최저가",
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
  "luggage storage": "짐 보관",
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

// 첫 화면 '인기 여행지' 사진 카드와 PC 홈 배경 사진.
// 사진은 Unsplash 무료 사진(Unsplash License: 상업 이용 가능, 출처 표기 없어도 됨)을 Unsplash 이미지 서버에서 바로 받는다.
// 사진을 바꾸려면 photo 값(images.unsplash.com/ 뒤의 'photo-…' 부분)만 바꾼다. plus.unsplash.com(유료) 사진은 쓰지 않는다
// 도시 목록은 2026-11-04에 숙소 결과가 나오는 것을 확인한 곳만 둔다

export type HomePlace = { name: string; country: string; photo: string };

export const HOME_PLACES: HomePlace[] = [
  { name: "오사카", country: "일본", photo: "photo-1759746334715-fae30ec56600" }, // 도톤보리 밤거리
  { name: "후쿠오카", country: "일본", photo: "photo-1605472759650-41559421cef0" }, // 후쿠오카 타워와 해변
  { name: "도쿄", country: "일본", photo: "photo-1513407030348-c983a97b98d8" }, // 해 질 녘 도쿄 타워
  { name: "삿포로", country: "일본", photo: "photo-1519105467443-4779d0fb729d" }, // 삿포로 겨울
  { name: "오키나와", country: "일본", photo: "photo-1633311764953-e415d9c074ab" }, // 맑은 바다와 다리
  { name: "다낭", country: "베트남", photo: "photo-1701396173275-835886dd72ce" }, // 불 켜진 용다리
  { name: "방콕", country: "태국", photo: "photo-1768392810963-017c92313d79" }, // 짜오프라야강과 왓아룬
  { name: "타이베이", country: "대만", photo: "photo-1572716402589-c1a2cf470502" }, // 타이베이 101
];

// PC 홈 위쪽 넓은 배경 사진 (밝은 바다)
export const HOME_HERO_PHOTO = "photo-1785733159162-b4f81a8ad444";

// Unsplash 이미지 서버가 원하는 크기로 잘라서 보내 준다 (원본 3000px을 받지 않게)
export function photoUrl(photo: string, w: number, h: number): string {
  return `https://images.unsplash.com/${photo}?w=${w}&h=${h}&fit=crop&auto=format&q=70`;
}

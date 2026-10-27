import { AFFILIATE_CID } from "./agoda";

// 호텔 검색 결과 모양과 링크. 서버(app/api/hotels)와 화면(HotelSearch)이 같이 쓴다.

export type HotelSource = {
  name: string; // 예약 사이트 이름 (Agoda, Booking.com …)
  logo: string;
  perNight: number | null; // 원, 1박 요금
  total: number | null; // 원, 전체 숙박 총액
  link: string; // 예약 사이트로 가는 주소
  official: boolean; // 호텔 공식 사이트
};

export type HotelOption = {
  token: string; // 예약 사이트별 가격을 더 불러올 때 쓴다
  name: string;
  image: string;
  stars: number | null;
  rating: number | null;
  reviews: number | null;
  perNight: number | null;
  total: number | null;
  sources: HotelSource[]; // 검색 목록에 함께 온 몇 곳
};

export type HotelResults = { options: HotelOption[] };
export type HotelPrices = { sources: HotelSource[] };

export type HotelQuery = { q: string; checkIn: string; checkOut: string; adults: number };

// 아고다 가격은 로보티 제휴 번호가 붙은 아고다 검색으로 보낸다 (제휴 수수료)
export function agodaSearchUrl(name: string, query: HotelQuery): string {
  const p = new URLSearchParams({
    textToSearch: name,
    checkIn: query.checkIn,
    checkOut: query.checkOut,
    rooms: "1",
    adults: String(query.adults),
    children: "0",
    currencyCode: "KRW",
    cid: AFFILIATE_CID,
  });
  return `https://www.agoda.com/ko-kr/search?${p}`;
}

export function isAgoda(source: string): boolean {
  return /agoda|아고다/i.test(source);
}

// 항공권 검색 결과 모양과 Trip.com 예약 링크. 서버(app/api/flights)와 화면(FlightSearch)이 같이 쓴다.

export type FlightQuery = {
  from: string; // 공항 코드. 도시는 "ICN,GMP"처럼 공항을 쉼표로 이어서 보낸다
  to: string;
  depart: string; // 2026-11-03
  ret: string; // 편도면 ""
  adults: number;
};

export type FlightOption = {
  price: number; // 원. 왕복 검색이면 왕복 총액
  airlines: string[];
  logo: string;
  departTime: string; // "2026-11-03 09:10"
  arriveTime: string;
  fromId: string;
  toId: string;
  minutes: number;
  stops: string[]; // 경유 공항 코드
};

export type FlightResults = {
  options: FlightOption[];
  lowest: number | null;
  level: string | null; // low · typical · high
  typical: [number, number] | null;
};

// 도시 단위 코드(SEL)를 그대로 받는 Trip.com 한국 사이트 검색 결과 주소.
// 제휴 승인(월 트래픽 3개월) 전이라 제휴 번호 없이 연결한다
export function tripUrl(from: string, to: string, depart: string, ret: string, adults: number): string {
  const q = new URLSearchParams({
    dcity: from.toLowerCase(),
    acity: to.toLowerCase(),
    ddate: depart,
    triptype: ret ? "rt" : "ow",
    class: "y",
    quantity: String(adults),
    locale: "ko-KR",
    curr: "KRW",
  });
  if (ret) q.set("rdate", ret);
  return `https://kr.trip.com/flights/showfarefirst?${q}`;
}

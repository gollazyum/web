// 항공권 검색 결과 모양과 Aviasales 제휴 링크. 서버(app/api/flights)와 화면(FlightSearch)이 같이 쓴다.

export const MARKER = "795762";

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

// 2026-11-03 → 0311 (Aviasales 주소의 일월 형식)
function ddmm(date: string): string {
  const [, m, d] = date.split("-");
  return d + m;
}

// 도시 단위 코드(SEL)를 그대로 받는 Aviasales 검색 결과 주소. 예: SEL0311TYO07111
export function aviasalesUrl(from: string, to: string, depart: string, ret: string, adults: number): string {
  const path = `${from}${ddmm(depart)}${to}${ret ? ddmm(ret) : ""}${adults}`;
  return `https://www.aviasales.com/search/${path}?marker=${MARKER}&locale=ko&currency=krw`;
}

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
  segments: FlightSegment[];
  layovers: number[]; // 경유지에서 기다리는 시간(분), stops와 같은 순서
  token?: string; // 왕복 검색의 가는 편: 이 값으로 다시 검색하면 오는 편 선택지가 온다
};

export type FlightSegment = {
  airline: string;
  flightNo: string;
  plane: string;
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  departTime: string;
  arriveTime: string;
  minutes: number;
};

export type FlightResults = {
  options: FlightOption[];
  lowest: number | null;
  level: string | null; // low · typical · high
  typical: [number, number] | null;
};

// 결과 페이지 주소 (/flights?from=SEL&to=TYO…). from·to는 고른 도시·공항 코드 하나
export function flightsPath(query: FlightQuery): string {
  const p = new URLSearchParams({ from: query.from, to: query.to, depart: query.depart, adults: String(query.adults) });
  if (query.ret) p.set("return", query.ret);
  return `/flights?${p}`;
}

export function parseFlightsPath(sp: Record<string, string | string[] | undefined>): FlightQuery | null {
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const from = one("from").toUpperCase();
  const to = one("to").toUpperCase();
  const depart = one("depart");
  const ret = one("return");
  const adults = Number(one("adults") || 1);
  const date = /^\d{4}-\d{2}-\d{2}$/;
  if (!/^[A-Z]{3}$/.test(from) || !/^[A-Z]{3}$/.test(to) || from === to || !date.test(depart)) return null;
  if (ret && (!date.test(ret) || ret < depart)) return null;
  if (!Number.isInteger(adults) || adults < 1 || adults > 9) return null;
  return { from, to, depart, ret, adults };
}

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

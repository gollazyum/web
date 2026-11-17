import type { FlightOption } from "./flights";
import { hourOf } from "./trip";

// P1-5 항공 결과 필터: 경유 · 출발 시간 · 도착 공항 · 항공사. 항목마다 편 수와 가장 낮은 총액을 같이 보여 준다

export type FlightFilter = { stops: string[]; times: string[]; arr: string[]; airlines: string[] };
export const EMPTY_FLIGHT_FILTER: FlightFilter = { stops: [], times: [], arr: [], airlines: [] };

export type Facet = { id: string; label: string; count: number; low: number | null };
export type FlightFacets = { stops: Facet[]; times: Facet[]; arr: Facet[]; airlines: Facet[] };

const STOPS = [
  { id: "0", label: "직항", test: (o: FlightOption) => o.stops.length === 0 },
  { id: "1", label: "1회 경유", test: (o: FlightOption) => o.stops.length === 1 },
  { id: "2", label: "2회 이상 경유", test: (o: FlightOption) => o.stops.length >= 2 },
];
const TIMES = [
  { id: "dawn", label: "새벽 (0~6시)", test: (h: number) => h < 6 },
  { id: "am", label: "오전 (6~12시)", test: (h: number) => h >= 6 && h < 12 },
  { id: "pm", label: "오후 (12~18시)", test: (h: number) => h >= 12 && h < 18 },
  { id: "eve", label: "저녁 (18~24시)", test: (h: number) => h >= 18 },
];

const stopOf = (o: FlightOption) => STOPS.find((s) => s.test(o))!.id;
const timeOf = (o: FlightOption) => TIMES.find((t) => t.test(hourOf(o.departTime)))!.id;

function facet(list: FlightOption[], id: string, label: string, test: (o: FlightOption) => boolean): Facet {
  const hit = list.filter(test);
  return { id, label, count: hit.length, low: hit.length ? Math.min(...hit.map((o) => o.price)) : null };
}

// 항목 목록과 개수: 다른 칸에서 고른 조건을 먼저 걸고 센다 (그 칸 자신은 빼고) → 0편이 되는 조합이 보이지 않게
export function flightFacets(list: FlightOption[], f: FlightFilter, cityOf: (code: string) => string = (c) => c): FlightFacets {
  const except = (k: keyof FlightFilter) => applyFlightFilter(list, { ...f, [k]: [] });
  const s = except("stops");
  const t = except("times");
  const a = except("arr");
  const l = except("airlines");
  const arrIds = [...new Set(list.map((o) => o.toId).filter(Boolean))];
  const airlineIds = [...new Set(list.flatMap((o) => o.airlines))];
  return {
    stops: STOPS.map((x) => facet(s, x.id, x.label, x.test)).filter((x) => x.count > 0 || f.stops.includes(x.id)),
    times: TIMES.map((x) => facet(t, x.id, x.label, (o) => x.test(hourOf(o.departTime)))).filter((x) => x.count > 0 || f.times.includes(x.id)),
    arr: arrIds
      .map((id) => facet(a, id, cityOf(id) === id ? id : `${cityOf(id)} (${id})`, (o) => o.toId === id))
      .filter((x) => x.count > 0 || f.arr.includes(x.id))
      .sort((x, y) => y.count - x.count),
    airlines: airlineIds
      .map((id) => facet(l, id, id, (o) => o.airlines.includes(id)))
      .filter((x) => x.count > 0 || f.airlines.includes(x.id))
      .sort((x, y) => y.count - x.count || (x.low ?? 0) - (y.low ?? 0)),
  };
}

export function applyFlightFilter(list: FlightOption[], f: FlightFilter): FlightOption[] {
  return list.filter(
    (o) =>
      (!f.stops.length || f.stops.includes(stopOf(o))) &&
      (!f.times.length || f.times.includes(timeOf(o))) &&
      (!f.arr.length || f.arr.includes(o.toId)) &&
      (!f.airlines.length || o.airlines.some((a) => f.airlines.includes(a))),
  );
}

export const flightFilterCount = (f: FlightFilter) => f.stops.length + f.times.length + f.arr.length + f.airlines.length;

// 영어로 오는 항공사 이름을 한국어로 (자주 나오는 곳만. 모르는 이름은 그대로 둔다)
const AIRLINE_KO: Record<string, string> = {
  "korean air": "대한항공",
  asiana: "아시아나항공",
  "asiana airlines": "아시아나항공",
  "jeju air": "제주항공",
  "jin air": "진에어",
  "t'way air": "티웨이항공",
  "tway air": "티웨이항공",
  "air busan": "에어부산",
  "air seoul": "에어서울",
  "eastar jet": "이스타항공",
  "air premia": "에어프레미아",
  "aero k": "에어로케이",
  "parata air": "파라타항공",
  "japan airlines": "일본항공",
  jal: "일본항공",
  ana: "ANA (전일본공수)",
  "all nippon airways": "ANA (전일본공수)",
  peach: "피치항공",
  "peach aviation": "피치항공",
  zipair: "집에어",
  "jetstar japan": "젯스타 재팬",
  "skymark airlines": "스카이마크",
  "cathay pacific": "캐세이퍼시픽",
  "hong kong airlines": "홍콩항공",
  "hk express": "홍콩익스프레스",
  "eva air": "에바항공",
  "china airlines": "중화항공",
  starlux: "스타럭스항공",
  "starlux airlines": "스타럭스항공",
  "tigerair taiwan": "타이거에어 타이완",
  "thai airways": "타이항공",
  "thai airways international": "타이항공",
  "thai airasia": "타이 에어아시아",
  "thai lion air": "타이 라이온에어",
  "thai vietjet air": "타이 비엣젯",
  "bangkok airways": "방콕항공",
  airasia: "에어아시아",
  "airasia x": "에어아시아 X",
  "vietnam airlines": "베트남항공",
  vietjet: "비엣젯항공",
  "vietjet air": "비엣젯항공",
  "bamboo airways": "뱀부항공",
  "singapore airlines": "싱가포르항공",
  scoot: "스쿠트",
  "malaysia airlines": "말레이시아항공",
  "philippine airlines": "필리핀항공",
  "cebu pacific": "세부퍼시픽",
  "china eastern": "중국동방항공",
  "china southern": "중국남방항공",
  "air china": "중국국제항공",
  "shandong airlines": "산둥항공",
  "spring airlines": "춘추항공",
  "garuda indonesia": "가루다인도네시아",
  emirates: "에미레이트항공",
  "qatar airways": "카타르항공",
  "etihad airways": "에티하드항공",
  "turkish airlines": "터키항공",
  "united": "유나이티드항공",
  "united airlines": "유나이티드항공",
  "delta": "델타항공",
  "american airlines": "아메리칸항공",
  "air canada": "에어캐나다",
  lufthansa: "루프트한자",
  "air france": "에어프랑스",
  klm: "KLM 네덜란드항공",
  finnair: "핀에어",
  qantas: "콴타스항공",
  "mongolian airlines": "몽골항공",
  "miat mongolian airlines": "몽골항공",
};

export function airlineKo(name: string): string {
  return AIRLINE_KO[name.trim().toLowerCase()] ?? name;
}

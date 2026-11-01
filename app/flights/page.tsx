import type { Metadata } from "next";
import { ogBase } from "@/lib/site";
import { FlightResultsView } from "@/components/FlightResults";
import { parseFlightsPath } from "@/lib/flights";

// 항공권 검색 결과 페이지. 검색 조건은 주소(?from=&to=&depart=&return=&adults=)에 있어 그대로 공유할 수 있다
const FLIGHTS_DESCRIPTION =
  "출발지·도착지와 날짜를 입력하면 항공 운임을 낮은 가격 순서로 보여 드려요. 직항·경유, 출발 시간대, 항공사로 걸러 보고 트립닷컴에서 바로 예약하세요.";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const query = parseFlightsPath(await searchParams);
  // 검색어 없는 /flights만 검색에 노출하고, 검색 결과 주소는 모두 /flights를 대표 주소로 둔다
  return {
    title: query ? `${query.from} → ${query.to} 항공권 운임` : "Flights 항공권 운임",
    description: FLIGHTS_DESCRIPTION,
    alternates: { canonical: "/flights" },
    openGraph: { title: "Flights 항공권 운임 | Gollazyum", description: FLIGHTS_DESCRIPTION, ...ogBase, url: "/flights" },
    ...(query ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function FlightsPage({ searchParams }: Props) {
  const query = parseFlightsPath(await searchParams);
  // 조건이 바뀌면 새 화면으로 다시 그려 스캔 연출부터 보여 준다
  return <FlightResultsView key={query ? JSON.stringify(query) : "none"} query={query} />;
}

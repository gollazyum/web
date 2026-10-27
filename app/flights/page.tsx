import type { Metadata } from "next";
import { FlightResultsView } from "@/components/FlightResults";
import { parseFlightsPath } from "@/lib/flights";

// 항공권 검색 결과 페이지. 검색 조건은 주소(?from=&to=&depart=&return=&adults=)에 있어 그대로 공유할 수 있다
type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const query = parseFlightsPath(await searchParams);
  return { title: query ? `${query.from} → ${query.to} 항공권 가격 비교` : "항공권 가격 비교", robots: { index: false, follow: true } };
}

export default async function FlightsPage({ searchParams }: Props) {
  const query = parseFlightsPath(await searchParams);
  // 조건이 바뀌면 새 화면으로 다시 그려 스캔 연출부터 보여 준다
  return <FlightResultsView key={query ? JSON.stringify(query) : "none"} query={query} />;
}

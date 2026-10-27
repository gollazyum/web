import type { Metadata } from "next";
import { HotelResultsView } from "@/components/HotelResults";
import { parseHotelsPath } from "@/lib/hotels";

// 호텔 검색 결과 페이지. 검색 조건은 주소(?q=&checkin=&checkout=&adults=)에 있어 그대로 공유할 수 있다
type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const query = parseHotelsPath(await searchParams);
  return { title: query ? `${query.q} 호텔 가격 비교` : "호텔 가격 비교", robots: { index: false, follow: true } };
}

export default async function HotelsPage({ searchParams }: Props) {
  const query = parseHotelsPath(await searchParams);
  // 조건이 바뀌면 새 화면으로 다시 그려 스캔 연출부터 보여 준다
  return <HotelResultsView key={query ? JSON.stringify(query) : "none"} query={query} />;
}

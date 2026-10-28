import type { Metadata } from "next";
import { ogBase } from "@/lib/site";
import { HotelResultsView } from "@/components/HotelResults";
import { parseHotelsPath } from "@/lib/hotels";

// 호텔 검색 결과 페이지. 검색 조건은 주소(?q=&checkin=&checkout=&adults=)에 있어 그대로 공유할 수 있다
const HOTELS_DESCRIPTION =
  "도시나 호텔 이름으로 아고다·트립닷컴·부킹닷컴·호텔 공식 사이트의 실시간 숙박 가격을 세금 포함 총액으로 비교하세요. 성급·후기 점수·편의시설로 거르고, AI 도우미 로보티에게 가성비 좋은 숙소를 물어볼 수 있어요.";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const query = parseHotelsPath(await searchParams);
  // 검색어 없는 /hotels만 검색에 노출하고, 검색 결과 주소는 모두 /hotels를 대표 주소로 둔다
  return {
    title: query ? `${query.q} 호텔 가격 비교` : "호텔 가격 비교",
    description: HOTELS_DESCRIPTION,
    alternates: { canonical: "/hotels" },
    openGraph: { title: "호텔 가격 비교 | 로보티 (Lowboti)", description: HOTELS_DESCRIPTION, ...ogBase, url: "/hotels" },
    ...(query ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function HotelsPage({ searchParams }: Props) {
  const query = parseHotelsPath(await searchParams);
  // 조건이 바뀌면 새 화면으로 다시 그려 스캔 연출부터 보여 준다
  return <HotelResultsView key={query ? JSON.stringify(query) : "none"} query={query} />;
}

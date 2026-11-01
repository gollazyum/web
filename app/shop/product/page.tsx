import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ProductDetail } from "@/components/shop/ProductDetail";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const readQuery = (v: string | string[] | undefined) => (typeof v === "string" ? v.trim().slice(0, 100) : "");

// 상품 데이터 상세. 검색어는 주소(?q=)에 있어 그대로 공유할 수 있다. 검색 결과 주소라 검색엔진에는 노출하지 않는다
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const q = readQuery((await searchParams).q);
  return {
    title: q ? `${q} 스토어별 가격` : "상품 데이터",
    alternates: { canonical: "/shop" },
    robots: { index: false, follow: true },
  };
}

export default async function ProductPage({ searchParams }: Props) {
  const q = readQuery((await searchParams).q);
  if (!q) redirect("/shop");
  return <ProductDetail key={q} query={q} />;
}

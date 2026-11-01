import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ProductDetail } from "@/components/shop/ProductDetail";
import { ProductResults } from "@/components/shop/ProductResults";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const read = (v: string | string[] | undefined, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

// ?q= 만 있으면 상품 검색 목록, ?q=&token= 이면 고른 상품의 스토어별 가격 상세.
// 검색 결과 주소라 검색엔진에는 노출하지 않는다
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const q = read((await searchParams).q, 100);
  return {
    title: q ? `${q} 스토어별 가격` : "상품 데이터",
    alternates: { canonical: "/shop" },
    robots: { index: false, follow: true },
  };
}

export default async function ProductPage({ searchParams }: Props) {
  const params = await searchParams;
  const q = read(params.q, 100);
  const token = read(params.token, 2000);
  if (!q) redirect("/shop");
  return token ? <ProductDetail key={`${q}|${token}`} query={q} token={token} /> : <ProductResults key={q} query={q} />;
}

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ProductDetail } from "@/components/shop/ProductDetail";
import { ProductResults } from "@/components/shop/ProductResults";
import { SHOP_OG_DESCRIPTION } from "@/lib/brand-mode";
import { MAX_TOKEN_LENGTH } from "@/lib/shopping";
import { productPreview } from "@/lib/shop-preview";
import { ogImage, site } from "@/lib/site";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const read = (v: string | string[] | undefined, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

function parse(sp: Record<string, string | string[] | undefined>) {
  return {
    q: read(sp.q, 100),
    token: read(sp.token, MAX_TOKEN_LENGTH),
    pid: read(sp.pid, 40).replace(/\D/g, ""),
  };
}

// 상품 화면 주소 그대로 (og:url). 홈 주소가 들어가면 카카오 미리보기가 홈으로 묶인다
function productUrl(q: string, token: string, pid: string): string {
  const p = new URLSearchParams({ q });
  if (pid) p.set("pid", pid);
  else if (token) p.set("token", token);
  return `${site.url}/shop/product?${p}`;
}

// ?q= 만 있으면 상품 검색 목록, ?q=&token=(&pid=) 또는 ?q=&pid= 이면 고른 상품의 스토어별 가격 상세.
// 검색 결과 주소라 검색엔진에는 노출하지 않는다. 상품 화면은 주소마다 og 태그를 서버에서 만든다 (가격은 넣지 않는다)
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { q, token, pid } = parse(await searchParams);
  const base: Metadata = {
    title: q ? `${q} 스토어별 가격` : "상품 데이터",
    alternates: { canonical: "/shop" },
    robots: { index: false, follow: true },
  };
  if (!q || !(token || pid)) return base;

  const url = productUrl(q, token, pid);
  const preview = await productPreview(q, token, pid);
  const title = preview?.title || q;
  const images = preview?.image ? [{ url: preview.image, alt: title }] : [{ url: ogImage, width: 1200, height: 630 }];
  return {
    ...base,
    title,
    openGraph: {
      type: "website",
      siteName: site.name,
      locale: "ko_KR",
      title,
      description: SHOP_OG_DESCRIPTION,
      url,
      images,
    },
    twitter: { card: preview?.image ? "summary" : "summary_large_image", title, description: SHOP_OG_DESCRIPTION, images: images.map((i) => i.url) },
  };
}

export default async function ProductPage({ searchParams }: Props) {
  const { q, token, pid } = parse(await searchParams);
  if (!q) redirect("/shop");
  return token || pid ? (
    <ProductDetail key={`${q}|${token}|${pid}`} query={q} token={token} pid={pid} />
  ) : (
    <ProductResults key={q} query={q} />
  );
}

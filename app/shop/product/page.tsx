import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ProductDetail } from "@/components/shop/ProductDetail";
import { ProductResults } from "@/components/shop/ProductResults";
import { SHOP_OG_DESCRIPTION } from "@/lib/brand-mode";
import { MAX_TOKEN_LENGTH } from "@/lib/shopping";
import { lookupProduct, type ProductLookup } from "@/lib/shop-preview";
import { ogImage, site } from "@/lib/site";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const read = (v: string | string[] | undefined, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

// 상품 번호(pid)가 숫자가 아니거나 토큰이 너무 길면 잘못된 주소(invalid)로 본다. 잘라 내거나 고쳐서 보여 주지 않는다
function parse(sp: Record<string, string | string[] | undefined>) {
  const rawToken = typeof sp.token === "string" ? sp.token.trim() : "";
  const rawPid = typeof sp.pid === "string" ? sp.pid.trim() : "";
  return {
    q: read(sp.q, 100),
    token: rawToken,
    pid: rawPid,
    invalid: rawToken.length > MAX_TOKEN_LENGTH || !/^\d{0,40}$/.test(rawPid),
  };
}

// 상품을 가리키는 주소(token·pid)가 잘못됐거나, 검색 결과에 그 상품이 없으면 missing → 상품 화면은 404 (app/shop/product/not-found.tsx).
// 데이터를 못 불러와 알 수 없을 때(unknown)는 404로 단정하지 않고 화면이 다시 불러온다.
// 메타데이터와 화면이 같은 검색 저장분을 보므로 SerpApi 호출은 한 번이다
async function checkProduct(q: string, token: string, pid: string, invalid: boolean): Promise<ProductLookup> {
  if (invalid) return { status: "missing" };
  if (!q || !(token || pid)) return { status: "unknown" };
  return lookupProduct(q, token, pid);
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
  const { q, token, pid, invalid } = parse(await searchParams);
  const found = await checkProduct(q, token, pid, invalid);
  // 없는 상품: 화면(아래 ProductPage)이 notFound()로 404를 낸다. 여기서 던지면 운영 빌드에서 200으로 나가서 제목만 맞춘다
  if (found.status === "missing") return { title: "페이지를 찾을 수 없어요", robots: { index: false, follow: true } };
  const preview = found.status === "found" && found.title ? found : null;
  const base: Metadata = {
    title: q ? `${q} 스토어별 가격` : "상품 데이터",
    alternates: { canonical: "/shop" },
    robots: { index: false, follow: true },
  };
  if (!q || !(token || pid)) return base;

  const url = productUrl(q, token, pid);
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
  const { q, token, pid, invalid } = parse(await searchParams);
  if (!q) redirect("/shop");
  if ((await checkProduct(q, token, pid, invalid)).status === "missing") notFound();
  return token || pid ? (
    <ProductDetail key={`${q}|${token}|${pid}`} query={q} token={token} pid={pid} />
  ) : (
    <ProductResults key={q} query={q} />
  );
}

import { serpSearch } from "@/lib/serpapi";
import { relevantShoppingResult, SAMPLE_PRODUCT_JSON, SAMPLE_SHOPPING_JSON, shapeShopping } from "@/lib/shopping";

// 상품 상세 데이터. 쇼핑 결과에서 검색어와 이름이 맞는 상품의 스토어별 가격을 이어서 받아 화면용으로 줄인다.
// 맞는 상품이 없으면 두 번째 호출은 하지 않는다.
export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (!q || q.length > 100) return Response.json({ error: "bad_request" }, { status: 400 });

  // 로컬 개발에서 키가 없으면 예시 데이터로 화면을 그린다 (운영에서는 절대 쓰지 않음)
  if (!process.env.SERPAPI_API_KEY && process.env.NODE_ENV === "development") {
    const data = shapeShopping(q, SAMPLE_SHOPPING_JSON, SAMPLE_PRODUCT_JSON);
    if (data.product) data.product.sample = true;
    return Response.json(data);
  }

  return serpSearch(
    req,
    { engine: "google_shopping", q, gl: "kr", hl: "ko", location: "South Korea" },
    (json, detail) => shapeShopping(q, json, detail),
    (json) => {
      const token = relevantShoppingResult(q, json)?.immersive_product_page_token;
      return token ? { engine: "google_immersive_product", page_token: token, gl: "kr", hl: "ko" } : null;
    },
  );
}

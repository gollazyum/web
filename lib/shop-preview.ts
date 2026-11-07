import { serpRaw } from "@/lib/serpapi";
import { findSelected, SHOP_CACHE_MS, shoppingResults, shoppingSearchParams } from "@/lib/shopping";
import { SAMPLE_SEARCH_JSON } from "@/lib/shopping-fixtures";

// 상품 화면 주소가 가리키는 상품을 서버에서 미리 찾아 본다. 상품 화면과 같은 검색 저장분을 써서 추가 요금이 거의 없다.
// - found: 검색 결과에 그 상품이 있다 (공유 미리보기용 상품명·사진)
// - missing: 검색은 됐는데 그 상품이 없다 → 상품 화면은 404
// - unknown: 키가 없거나 데이터를 못 불러와 알 수 없다 → 404로 단정하지 않고 화면이 직접 다시 불러온다
export type ProductLookup = { status: "found"; title: string; image: string } | { status: "missing" } | { status: "unknown" };

export async function lookupProduct(q: string, token: string, pid: string): Promise<ProductLookup> {
  let search: Record<string, unknown> | Response;
  if (process.env.SERPAPI_API_KEY) search = await serpRaw(shoppingSearchParams(q), SHOP_CACHE_MS);
  // 로컬 개발에서 키가 없으면 /api/shopping 과 같은 예시 데이터로 판단한다 (운영에서는 쓰지 않음)
  else if (process.env.NODE_ENV !== "production") search = SAMPLE_SEARCH_JSON as Record<string, unknown>;
  else return { status: "unknown" };
  if (search instanceof Response) return { status: "unknown" };
  const hit = findSelected(shoppingResults(search), { token, pid });
  if (!hit) return { status: "missing" };
  return { status: "found", title: hit.title?.trim() ?? "", image: hit.thumbnail ?? "" };
}

// 공유 미리보기용 상품명·사진. 실패하면 null
export async function productPreview(q: string, token: string, pid: string): Promise<{ title: string; image: string } | null> {
  const r = await lookupProduct(q, token, pid);
  return r.status === "found" && r.title ? { title: r.title, image: r.image } : null;
}

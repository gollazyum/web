import { serpRaw } from "@/lib/serpapi";
import { findSelected, SHOP_CACHE_MS, shoppingResults, shoppingSearchParams } from "@/lib/shopping";

// 공유 미리보기용 상품명·사진. 상품 화면과 같은 검색 저장분을 써서 추가 요금이 거의 없다. 실패하면 null
export async function productPreview(q: string, token: string, pid: string): Promise<{ title: string; image: string } | null> {
  if (!process.env.SERPAPI_API_KEY) return null;
  const search = await serpRaw(shoppingSearchParams(q), SHOP_CACHE_MS);
  if (search instanceof Response) return null;
  const hit = findSelected(shoppingResults(search), { token, pid });
  const title = hit?.title?.trim();
  return title ? { title, image: hit?.thumbnail ?? "" } : null;
}


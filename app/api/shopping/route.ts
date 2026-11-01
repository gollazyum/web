import { rateLimit, serpRaw } from "@/lib/serpapi";
import { rawSellerLog, shapeDetail, shapeSearch } from "@/lib/shopping";
import { SAMPLE_DETAIL_JSON, SAMPLE_SEARCH_JSON } from "@/lib/shopping-fixtures";

// 쇼핑 데이터.
// - ?q=검색어 → 상품 검색 목록 (google_shopping 1회). 스토어별 가격은 부르지 않는다
// - ?q=검색어&token=… → 사용자가 고른 상품의 스토어별 가격 (google_immersive_product 1회, 검색 결과는 캐시에서)
// 같은 검색과 같은 상품은 6시간 동안 저장해 두고 다시 부르지 않는다
export const runtime = "nodejs";
export const maxDuration = 30;

const CACHE_MS = 6 * 60 * 60 * 1000;
const isDev = process.env.NODE_ENV !== "production";

const searchParams = (q: string) => ({ engine: "google_shopping", q, gl: "kr", hl: "ko", location: "South Korea" });
const detailParams = (token: string) => ({ engine: "google_immersive_product", page_token: token, gl: "kr", hl: "ko" });

// 개발 환경에서만, 걸러 내기 전 판매처 목록을 찍는다 (인증 값은 지움)
function devLog(q: string, json: Record<string, unknown> | null, detail?: Record<string, unknown> | null) {
  if (!isDev) return;
  const { rows, stores } = rawSellerLog(json, detail);
  console.log(`[shopping] "${q}" 검색 결과 판매처 (걸러 내기 전)`);
  console.table(rows);
  if (detail !== undefined) {
    console.log(`[shopping] 고른 상품의 스토어 목록 (걸러 내기 전)`);
    console.table(stores);
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const token = url.searchParams.get("token") ?? "";
  if (!q || q.length > 100 || token.length > 2000) return Response.json({ error: "bad_request" }, { status: 400 });

  // 로컬 개발에서 키가 없으면 예시 데이터로 화면을 그린다 (운영에서는 절대 쓰지 않음)
  if (!process.env.SERPAPI_API_KEY && isDev) {
    if (!token) {
      devLog(q, SAMPLE_SEARCH_JSON);
      return Response.json({ ...shapeSearch(SAMPLE_SEARCH_JSON), sample: true });
    }
    const detail = SAMPLE_DETAIL_JSON[token] ?? null;
    devLog(q, SAMPLE_SEARCH_JSON, detail);
    const data = shapeDetail(q, token, SAMPLE_SEARCH_JSON, detail);
    if (data.product) data.product.sample = true;
    return Response.json(data);
  }

  const limited = rateLimit(req);
  if (limited) return limited;

  const search = await serpRaw(searchParams(q), CACHE_MS);
  if (search instanceof Response) return search;
  if (!token) {
    devLog(q, search);
    return Response.json(shapeSearch(search));
  }

  // 상세: 검색 결과에 있는 상품만 조회한다 (아무 토큰으로 요금을 쓰지 못하게)
  const known = shapeSearch(search).items.some((i) => i.token === token);
  if (!known) return Response.json({ product: null });
  const detail = await serpRaw(detailParams(token), CACHE_MS);
  const detailJson = detail instanceof Response ? null : detail; // 실패하면 검색 결과만으로 엄격하게 만든다
  devLog(q, search, detailJson);
  return Response.json(shapeDetail(q, token, search, detailJson));
}

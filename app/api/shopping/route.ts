import { rateLimit, serpRaw } from "@/lib/serpapi";
import { detailStores, findSelected, MAX_TOKEN_LENGTH, rawSellerLog, shapeDetail, shapeSearch, SHOP_CACHE_MS, shoppingResults, shoppingSearchParams } from "@/lib/shopping";
import { SAMPLE_DETAIL_JSON, SAMPLE_SEARCH_JSON } from "@/lib/shopping-fixtures";
import { deeplinkEnabled, toDeeplinks } from "@/lib/coupang-deeplink";
import { applyDeeplink } from "@/lib/coupang-links";
import type { ShoppingResponse } from "@/lib/shopping";

// 쇼핑 데이터.
// - ?q=검색어 → 상품 검색 목록 (google_shopping 1회). 스토어별 가격은 부르지 않는다
// - ?q=검색어&token=…&pid=… → 사용자가 고른 상품의 스토어별 가격 (검색 결과는 캐시에서)
//   1) token이 있으면 google_immersive_product  2) 토큰이 없거나 판매처가 0건이고 pid가 있으면 google_product(offers=1)
//   3) 둘 다 0건·실패면 검색 결과에 있던 판매처 1곳으로 보여 준다 (shapeDetail)
// 같은 검색과 같은 상품은 6시간 동안 저장해 두고 다시 부르지 않는다
export const runtime = "nodejs";
export const maxDuration = 30;

const CACHE_MS = SHOP_CACHE_MS;
const isDev = process.env.NODE_ENV !== "production";
// 원본 판매처 확인 화면(&debug=1): 개발 환경과 Vercel 미리보기에서만. 운영 사이트에서는 꺼져 있다.
// VERCEL_ENV가 안 보이는 설정도 있어, 운영 도메인(gollazyum.com)이 아닌 *.vercel.app 주소인지도 함께 본다
function debugAllowed(url: URL): boolean {
  if (isDev) return true;
  if (process.env.VERCEL_ENV === "production") return false;
  return process.env.VERCEL_ENV === "preview" || url.hostname.endsWith(".vercel.app");
}

const searchParams = shoppingSearchParams;
// more_stores=true: 없으면 스토어가 3곳만 와서 G마켓·11번가 등이 빠진다 (아이폰 17 화이트: 3곳 → 13곳)
const detailParams = (token: string) => ({ engine: "google_immersive_product", page_token: token, more_stores: "true", gl: "kr", hl: "ko" });
const productParams = (pid: string) => ({ engine: "google_product", product_id: pid, offers: "1", gl: "kr", hl: "ko" });

// 개발 환경에서만, 걸러 내기 전 판매처 목록을 찍는다 (인증 값은 지움)
function devLog(q: string, json: Record<string, unknown> | null, detail?: Record<string, unknown> | null) {
  if (!isDev) return;
  const { rows: all, stores } = rawSellerLog(json, detail);
  const rows = all.map(({ token: _t, ...r }) => r);
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
  let token = url.searchParams.get("token") ?? "";
  let pid = url.searchParams.get("pid") ?? "";
  if (!q || q.length > 100 || token.length > MAX_TOKEN_LENGTH || !/^\d{0,40}$/.test(pid)) return Response.json({ error: "bad_request" }, { status: 400 });
  const debug = debugAllowed(url) && url.searchParams.get("debug") === "1";

  // 로컬 개발에서 키가 없으면 예시 데이터로 화면을 그린다 (운영에서는 절대 쓰지 않음)
  if (!process.env.SERPAPI_API_KEY && isDev) {
    if (!token && !pid) {
      devLog(q, SAMPLE_SEARCH_JSON);
      return Response.json({ ...shapeSearch(SAMPLE_SEARCH_JSON, q), sample: true });
    }
    const detail = SAMPLE_DETAIL_JSON[token] ?? null;
    devLog(q, SAMPLE_SEARCH_JSON, detail);
    const data = shapeDetail(q, { token, pid }, SAMPLE_SEARCH_JSON, detail);
    if (data.product) data.product.sample = true;
    return Response.json(await withDeeplinks(data));
  }

  const limited = rateLimit(req);
  if (limited) return limited;

  const search = await serpRaw(searchParams(q), CACHE_MS);
  if (search instanceof Response) return search;
  if (!token && !pid) {
    devLog(q, search);
    if (debug) return debugResponse(url, q, search);
    return Response.json(shapeSearch(search, q));
  }

  // 상세: 검색 결과에 있는 상품만 조회한다 (아무 토큰으로 요금을 쓰지 못하게)
  // 토큰·product_id는 서버가 가진 검색 결과의 값으로 다시 채운다 (한쪽만 넘어와도 나머지를 쓴다)
  const selected = findSelected(shoppingResults(search), { token, pid });
  if (!selected) return Response.json({ product: null });
  token = selected.immersive_product_page_token ?? "";
  pid = selected.product_id == null ? "" : String(selected.product_id);

  let detailJson: Record<string, unknown> | null = null;
  let detailError: string | null = null;
  if (token) {
    const detail = await serpRaw(detailParams(token), CACHE_MS);
    if (detail instanceof Response) detailError = await detail.text();
    else detailJson = detail;
  }
  if (!detailStores(detailJson).length && pid) {
    const product = await serpRaw(productParams(pid), CACHE_MS);
    if (product instanceof Response) detailError = (detailError ? detailError + " / " : "") + (await product.text());
    else if (detailStores(product).length) detailJson = product;
  }
  // 실패·0건이면 detailJson 없이 검색 결과의 판매처 1곳으로 만든다
  devLog(q, search, detailJson);
  if (debug) return debugResponse(url, q, search, detailJson, detailError);
  return Response.json(await withDeeplinks(shapeDetail(q, { token, pid }, search, detailJson)));
}

// 쿠팡 판매처 링크를 파트너스 딥링크(link.coupang.com)로 바꾼다. 키가 없거나 실패하면 기본 파트너스 링크(COUPANG_HOME).
// 쿠팡 원래 주소(target)는 화면으로 보내지 않는다
async function withDeeplinks(data: ShoppingResponse): Promise<ShoppingResponse> {
  const offers = data.product?.offers.filter((o) => o.coupang) ?? [];
  if (!offers.length) return data;
  const targets = offers.map((o) => o.coupang!.target?.url ?? "");
  const links = deeplinkEnabled() ? await toDeeplinks(targets) : targets.map(() => "");
  offers.forEach((o, i) => {
    const { target: _t, ...cp } = applyDeeplink(o.coupang!, links[i]);
    o.coupang = cp;
    o.link = cp.url;
  });
  return data;
}

// 걸러 내기 전 원본 판매처 목록 (인증 값은 지움). 검색 결과마다 상세 확인 주소를 붙인다
function debugResponse(
  url: URL,
  q: string,
  search: Record<string, unknown>,
  detail?: Record<string, unknown> | null,
  detailError?: string | null,
) {
  const { rows, stores } = rawSellerLog(search, detail);
  const detailUrl = (token: string, pid: string) =>
    `${url.origin}/api/shopping?q=${encodeURIComponent(q)}&token=${encodeURIComponent(token)}&pid=${encodeURIComponent(pid)}&debug=1`;
  return Response.json({
    query: q,
    search_results: rows.map(({ token, ...r }, i) => ({ no: i + 1, ...r, detail_debug_url: token || r.product_id ? detailUrl(token, r.product_id) : "" })),
    ...(detail !== undefined ? { stores, stores_error: detailError ?? null } : {}),
  });
}

import { CoupangDisclosure } from "@/components/shop/CoupangDisclosure";
import { COUPANG_HOME, COUPANG_LINK_ATTRS } from "@/lib/coupang-links";
import { searchErrorMessage, SEARCH_RETRY_LABEL } from "@/lib/search-error";

// 쇼핑 데이터를 못 불러왔을 때. 상태 코드만 보고 안내하고, 다시 시도 버튼과 쿠팡 기본 파트너스 링크를 둔다.
// status가 null이면 연결 실패
export function ShopSearchError({ status, onRetry }: { status: number | null; onRetry: () => void }) {
  return (
    <div className="pd-state" role="status">
      <p>{searchErrorMessage(status)}</p>
      <button type="button" className="pd-state-link" onClick={onRetry}>
        {SEARCH_RETRY_LABEL}
      </button>
      <CoupangDisclosure className="pd-disclosure" />
      <a className="pd-state-link" href={COUPANG_HOME} {...COUPANG_LINK_ATTRS} aria-label="쿠팡에서 바로 보기, 새 탭에서 열려요">
        쿠팡에서 바로 보기 ↗
      </a>
    </div>
  );
}

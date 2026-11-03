import { LINK_PASTE_HINT } from "@/lib/shop-results";

// 검색 입력창 아래 안내. 모바일(640px 이하)에서는 항상, 그보다 넓은 화면에서는 주소를 넣었을 때(force)만 보인다
export function LinkPasteHint({ force = false, className = "" }: { force?: boolean; className?: string }) {
  return <p className={`shop-link-hint${force ? " on" : ""} ${className}`.trim()}>{LINK_PASTE_HINT}</p>;
}

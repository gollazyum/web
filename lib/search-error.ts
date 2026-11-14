// 검색 실패 안내 문구. 화면은 서버의 상태 코드만 보고 고른다 (서버 메시지·외부 오류 원문은 화면에 붙이지 않는다)
// 503 = 검색 사용량 소진(quota) 등 잠시 쓸 수 없음, 그 밖의 코드·연결 실패 = 일반 오류
export const SEARCH_QUOTA_MESSAGE = "지금 검색이 많아 잠시 결과를 불러오지 못하고 있어요. 잠시 후 다시 시도하거나 아래 예약 사이트에서 바로 확인해 보세요.";
export const SEARCH_FAIL_MESSAGE = "결과를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.";
export const SEARCH_RETRY_LABEL = "다시 시도";

// status가 null이면 연결 실패
export function searchErrorMessage(status: number | null): string {
  return status === 503 ? SEARCH_QUOTA_MESSAGE : SEARCH_FAIL_MESSAGE;
}

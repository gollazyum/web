// 예약처 0곳 숙소에서 '비슷한 숙소 보기'를 누르면 열려 있는(또는 곧 열릴) 숙소 목록이 이 성급으로 거른다 (0: 성급 모름).
// 홈 첫 화면 코드에 목록 코드를 싣지 않으려고 작은 파일로 따로 둔다
let similarStars: number | null = null;
export const SIMILAR_EVENT = "tb-similar";
export function requestSimilar(stars: number) {
  similarStars = stars;
  window.dispatchEvent(new Event(SIMILAR_EVENT));
}
// 목록이 한 번 받아 간다 (null: 받을 것 없음)
export function takeSimilar(): number | null {
  const n = similarStars;
  similarStars = null;
  return n;
}

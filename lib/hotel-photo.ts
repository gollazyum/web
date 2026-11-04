// 숙소 사진 주소 끝의 크기 값(=w287-h192…, =s287-w287-h192-n-k-no-v1)만 바꾸면 더 큰 사진을 받을 수 있다.
// 크기 값이 없는 주소는 그대로 둔다
const SIZE_SUFFIX = /=(?:s\d+-)?w\d+-h\d+[^/=]*$/;

export function resized(src: string, w: number, h: number): string {
  return /googleusercontent\.com/.test(src) && SIZE_SUFFIX.test(src) ? src.replace(SIZE_SUFFIX, `=w${w}-h${h}-k-no`) : src;
}

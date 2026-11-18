// 마이의 '기록 지우기': 이 브라우저에 남긴 서비스 저장을 모두 지운다 (담아 둔 숙소, 취향, 여행 체크, 가격·검색 캐시, 예전 버전 저장)
const PREFIXES = ["tb-", "gollazyum:", "lowboti:"];

function drop(store: Storage) {
  const keys: string[] = [];
  for (let i = 0; i < store.length; i++) {
    const k = store.key(i);
    if (k && PREFIXES.some((p) => k.startsWith(p))) keys.push(k);
  }
  keys.forEach((k) => store.removeItem(k));
  return keys.length;
}

export function clearAllHistory(): number {
  let n = 0;
  try {
    n += drop(localStorage);
  } catch {
    // 저장소를 못 쓰는 브라우저는 지울 것도 없다
  }
  try {
    n += drop(sessionStorage);
  } catch {
    // 위와 같음
  }
  return n;
}

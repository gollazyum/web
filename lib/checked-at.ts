// 가격 확인 시각 한 줄. 모든 화면(목록·지도·상세·홈·내 여행)이 같은 글자로 쓴다.
// 1시간 안: "방금 확인" / "12분 전 확인". 그 밖: "11월 27일 16:47 확인" (한국 시각)
// at: Unix ms 숫자 또는 ISO 문자열

export function checkedMs(at: number | string | null | undefined): number | null {
  if (at === null || at === undefined || at === "") return null;
  const n = typeof at === "number" ? at : Date.parse(at);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function checkedText(at: number | string | null | undefined, now = Date.now()): string {
  const ms = checkedMs(at);
  if (ms === null) return "";
  const mins = Math.floor((now - ms) / 60_000);
  if (mins < 1) return "방금 확인";
  if (mins < 60) return `${mins}분 전 확인`;
  const d = new Date(ms + 9 * 3_600_000); // 한국 시각
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 ${hh}:${mm} 확인`;
}

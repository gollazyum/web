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

// 배치·저장 기록(hotel_price_history.recorded_at 등)의 확인 시각 한 줄 (2026-11-28).
// 시각이 있는 값(ISO 문자열): "오늘 오전 9시 기준" / "어제 오후 6시 기준" / "11월 26일 오후 2시 기준" (한국 시각)
// 날짜만 있는 값("2026-11-28"): "오늘 기준" / "어제 기준" / "11월 26일 기준"
// '실시간'이라는 말은 쓰지 않는다
export function recordedText(at: string | null | undefined, now = Date.now()): string {
  if (!at) return "";
  const kst = (ms: number) => new Date(ms + 9 * 3_600_000).toISOString().slice(0, 10);
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(at);
  const ms = dateOnly ? Date.parse(`${at}T00:00:00+09:00`) : Date.parse(at);
  if (!Number.isFinite(ms)) return "";
  const day = dateOnly ? at : kst(ms);
  const label = day === kst(now) ? "오늘" : day === kst(now - 86_400_000) ? "어제" : `${Number(day.slice(5, 7))}월 ${Number(day.slice(8, 10))}일`;
  if (dateOnly) return `${label} 기준`;
  const h = new Date(ms + 9 * 3_600_000).getUTCHours();
  const m = new Date(ms + 9 * 3_600_000).getUTCMinutes();
  const hour = `${h < 12 ? "오전" : "오후"} ${h % 12 === 0 ? 12 : h % 12}시${m ? ` ${m}분` : ""}`;
  return `${label} ${hour} 기준`;
}

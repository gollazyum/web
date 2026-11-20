// 마이 탭의 화면·이용 기록 설정. 모두 이 브라우저에만 저장한다 (기록 지우기의 tb- 접두어로 함께 지워진다)

// 큰 글씨 보기: <html>에 tb-big 클래스를 붙이면 앱 글자가 약 2px 커진다 (trip.css)
export const FONT_KEY = "tb-font";
export const BIG_CLASS = "tb-big";

// 화면이 그려지기 전에 큰 글씨를 먼저 적용하는 한 줄 (layout.tsx의 <script>). 글자가 커졌다 작아지는 흔들림을 막는다
export const FONT_BOOT = `try{if(localStorage.getItem("${FONT_KEY}")==="big")document.documentElement.classList.add("${BIG_CLASS}")}catch(e){}`;

export function readBigText(): boolean {
  try {
    return localStorage.getItem(FONT_KEY) === "big";
  } catch {
    return false;
  }
}

export function setBigText(on: boolean) {
  document.documentElement.classList.toggle(BIG_CLASS, on);
  try {
    if (on) localStorage.setItem(FONT_KEY, "big");
    else localStorage.removeItem(FONT_KEY);
  } catch {
    // 저장을 못 해도 지금 화면에는 적용된다
  }
}

// 오늘 AI에게 물어본 횟수 (마이 '오늘 AI 상담 이용 현황'). 날짜가 바뀌면 0부터
export const AI_COUNT_KEY = "tb-ai-count";
type Count = { day: string; n: number };

export function readAiCount(today: string): number {
  try {
    const c = JSON.parse(localStorage.getItem(AI_COUNT_KEY) ?? "null") as Count | null;
    return c && c.day === today && Number.isInteger(c.n) ? c.n : 0;
  } catch {
    return 0;
  }
}

export function bumpAiCount(today: string) {
  try {
    localStorage.setItem(AI_COUNT_KEY, JSON.stringify({ day: today, n: readAiCount(today) + 1 }));
  } catch {
    // 세지 못해도 대화는 그대로 된다
  }
}

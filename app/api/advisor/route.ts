import { jsonError, parseMessages, rateLimited, streamReply } from "@/lib/claudeChat";

// 호텔 결과 화면의 로보티 숙소 도우미. 화면에 보이는 호텔 목록 안에서만 골라 준다.
export const runtime = "nodejs";

const MAX_HOTELS = 60;

const SYSTEM = `너는 Gollazyum의 AI 도우미 "Gollazyum AI"야. 호텔과 항공권 가격 데이터를 정리해 주는 AI 여행 도우미이고, 지금은 호텔 검색 결과 화면 옆에서 숙소 찾는 걸 돕고 있어.

이름
- 네 이름은 "Gollazyum AI"야. 자기소개할 때는 "저는 Gollazyum AI예요"처럼 말해. 서비스 이름은 Gollazyum이야(항상 영어로 써). "로보티", "Roboti", "AI 인사이트", "AI Insight"라고 부르지 마.
- "모찌", "모찌 봇", "봇" 같은 다른 이름이나 수식어를 이름 앞뒤에 붙이지 마.
- 답에 "고르다", "골라", "고른", "비교", "최저가", "추천", "선택"이라는 말은 쓰지 마. 대신 "찾아 드려요", "정리해 드려요", "가장 낮은 가격", "잘 맞는 곳"처럼 말해.

말투
- 친근한 해요체로 짧게. 잘 맞는 곳은 2~3곳, 곳마다 한 줄 이유.
- 이모지는 가끔 한두 개만. 마크다운 굵게(**)나 제목(#)은 쓰지 마.

하는 일
- 사용자가 중요하게 생각하는 것(예산, 후기 점수, 성급, 조식, 수영장 같은 편의시설, 여행 목적)을 듣고 아래 [호텔 목록] 안에서만 찾아 줘.
- 무엇이 중요한지 모르겠으면 먼저 짧게 하나만 물어봐.
- 호텔을 말할 때는 이름을 쓰지 말고 목록 번호만 [[번호]] 형태로 써. 화면에서 이 표시가 호텔 이름 버튼으로 바뀌고, 누르면 그 호텔 카드로 바로 가. 예: "[[3]] 조식 포함에 1박 12만 원대라 가성비가 좋아요."

꼭 지킬 것
- 목록에 있는 가격, 점수, 편의시설만 사실로 말해. 위치, 역과의 거리, 방 크기, 후기 내용처럼 목록에 없는 건 지어내지 말고, 모르면 카드의 지도 보기나 예약 사이트에서 확인하라고 해.
- 가격은 검색 시점 기준이라 바뀔 수 있다고 필요할 때만 짧게 말해. 가격을 실시간이라고 말하지 마.
- 예약이나 결제를 대신 해준다고 말하지 마. 마음에 드는 호텔은 카드의 "가격 보기"를 눌러 예약 사이트별 가격을 보라고 안내해.
- 조건을 다 맞추는 곳이 목록에 없으면 "없어요"로 끝내지 마. 이렇게 해:
  1) 조건을 가장 많이 맞춘 곳을 1~2곳 찾아, 빠진 조건 하나를 솔직하게 밝혀. 예: "[[5]] 수영장은 없지만 조식과 1박 15만 원 이하 조건은 맞아요."
     예산만 안 맞으면 아래 [참고]의 가장 낮은 가격 1위와 가성비 1위를 알려 줘도 돼.
  2) 어떤 조건을 풀면 결과가 생기는지 버튼으로 1~3개 보여 줘. 형식: {{다시:버튼에 쓸 짧은 질문}}
     예: {{다시:예산 2만 원 올려서 1박 17만 원 이하로 찾아 줘}} {{다시:4성급까지 넓혀서 찾아 줘}}
     목록 안에서 그 조건을 풀면 실제로 맞는 곳이 생길 때만 만들어. 위치·역 거리처럼 목록에 없는 조건으로는 만들지 마.
  3) 맨 끝에 {{더찾기}}를 한 번 써. 화면에서 '다음 결과 더 불러오기'와 하루 앞뒤 날짜로 다시 찾는 버튼이 돼.
  목록에 없다는 이유로 "마감됐다", "매진됐다"고 단정하지 마. 이번 검색 결과에 없을 뿐이야.
- 사용자가 예산·후기 점수·성급·편의시설 조건을 말했으면 답 끝에 그 조건을 한 번 적어 줘. 화면에서 '이 조건으로 목록 거르기' 버튼이 돼.
  형식: {{필터:예산=150000,점수=4,등급=4|5,편의=조식|수영장}} (예산은 1박 원 단위, 편의는 목록에 나온 편의시설 이름 그대로, 말하지 않은 항목은 빼)
- {{ }} 표시는 위 세 가지(다시, 더찾기, 필터)만 쓰고, 표시 안에 다른 말을 넣지 마.
- 여행과 관계없는 질문에는 짧게 답할 수 없다고 말하고 숙소 이야기로 돌아와.
- 비밀번호, 카드 번호 같은 민감한 정보는 묻지도 받지도 마.`;

type Hotel = {
  n: number;
  name: string;
  stars: number | null;
  rating: number | null;
  reviews: number | null;
  perNight: number | null;
  total: number | null;
  amenities: string[];
  deal: string;
};

const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

// 화면이 보낸 호텔 목록. 글자 길이와 개수를 잘라서 받는다
function parseContext(body: unknown) {
  if (!body || typeof body !== "object") return null;
  const { place, checkIn, checkOut, adults, hotels } = body as Record<string, unknown>;
  if (!Array.isArray(hotels) || !hotels.length) return null;
  const list: Hotel[] = hotels.slice(0, MAX_HOTELS).map((h, i) => {
    const o = (h && typeof h === "object" ? h : {}) as Record<string, unknown>;
    return {
      n: i + 1,
      name: text(o.name, 80),
      stars: num(o.stars),
      rating: num(o.rating),
      reviews: num(o.reviews),
      perNight: num(o.perNight),
      total: num(o.total),
      amenities: Array.isArray(o.amenities) ? o.amenities.slice(0, 12).map((a) => text(a, 30)).filter(Boolean) : [],
      deal: text(o.deal, 60),
    };
  });
  return { place: text(place, 100), checkIn: text(checkIn, 10), checkOut: text(checkOut, 10), adults: num(adults), list };
}

const won = (n: number | null) => (n === null ? "-" : `${n.toLocaleString("ko-KR")}원`);

function contextBlock(c: NonNullable<ReturnType<typeof parseContext>>): string {
  const lines = c.list.map(
    (h) =>
      `[[${h.n}]] ${h.name} | ${h.stars ? `${h.stars}성급` : "등급 정보 없음"} | 후기 ${h.rating ?? "-"}점(${h.reviews ?? 0}개) | 1박 ${won(h.perNight)} · 총 ${won(h.total)}` +
      `${h.amenities.length ? ` | ${h.amenities.join(", ")}` : ""}${h.deal ? ` | 특가: ${h.deal}` : ""}`,
  );
  // 조건에 맞는 곳이 없을 때 대신 권할 두 곳을 미리 계산해 둔다 (모델이 숫자를 잘못 고르지 않게)
  const priced = c.list.filter((h) => h.perNight !== null).sort((a, b) => (a.perNight ?? 0) - (b.perNight ?? 0));
  const cheapest = priced[0];
  const value = priced.find((h) => (h.rating ?? 0) >= 4) ?? [...priced].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))[0];
  const hint = cheapest
    ? `\n\n[참고]\n가장 낮은 가격 1위: [[${cheapest.n}]] 1박 ${won(cheapest.perNight)}` +
      (value ? `\n가성비 1위: [[${value.n}]] 후기 ${value.rating ?? "-"}점 · 1박 ${won(value.perNight)}` : "")
    : "";
  return `\n\n[검색 조건]\n${c.place} · ${c.checkIn} ~ ${c.checkOut} · 성인 ${c.adults ?? "-"}명\n\n[호텔 목록] (후기 점수는 Google 5점 만점)\n${lines.join("\n")}${hint}`;
}

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) return jsonError(503, "not_configured");
  if (rateLimited(req)) return jsonError(429, "rate_limited");

  const body = await req.json().catch(() => null);
  const messages = parseMessages(body);
  const context = parseContext(body);
  if (!messages || !context) return jsonError(400, "bad_request");
  return streamReply(SYSTEM + contextBlock(context), messages);
}

import { jsonError, parseMessages, rateLimited, streamReply } from "@/lib/claudeChat";

// 호텔 결과 화면의 로보티 숙소 도우미. 화면에 보이는 호텔 목록 안에서만 골라 준다.
export const runtime = "nodejs";

const MAX_HOTELS = 60;

const SYSTEM = `너는 "로보티(Lowboti)"야. 호텔과 항공권 가격을 비교해서 가성비 좋은 선택을 같이 골라 주는 AI 여행 도우미이고, 지금은 호텔 검색 결과 화면 옆에서 숙소 고르는 걸 돕고 있어.

이름
- 네 이름은 "로보티" 하나야. 자기소개할 때는 "저는 로보티예요"처럼 로보티라고만 해. 영어로 물으면 Lowboti라고 해도 돼.
- "모찌", "모찌 봇", "봇" 같은 다른 이름이나 수식어를 이름 앞뒤에 붙이지 마.

말투
- 친근한 해요체로 짧게. 추천은 2~3곳, 곳마다 한 줄 이유.
- 이모지는 가끔 한두 개만. 마크다운 굵게(**)나 제목(#)은 쓰지 마.

하는 일
- 사용자가 중요하게 생각하는 것(예산, 후기 점수, 성급, 조식, 수영장 같은 편의시설, 여행 목적)을 듣고 아래 [호텔 목록] 안에서만 골라 줘.
- 무엇이 중요한지 모르겠으면 먼저 짧게 하나만 물어봐.
- 호텔을 말할 때는 이름을 쓰지 말고 목록 번호만 [[번호]] 형태로 써. 화면에서 이 표시가 호텔 이름 버튼으로 바뀌고, 누르면 그 호텔 카드로 바로 가. 예: "[[3]] 조식 포함에 1박 12만 원대라 가성비가 좋아요."

꼭 지킬 것
- 목록에 있는 가격, 점수, 편의시설만 사실로 말해. 위치, 역과의 거리, 방 크기, 후기 내용처럼 목록에 없는 건 지어내지 말고, 모르면 카드의 지도 보기나 예약 사이트에서 확인하라고 해.
- 가격은 검색 시점 기준이라 바뀔 수 있다고 필요할 때만 짧게 말해.
- 예약이나 결제를 대신 해준다고 말하지 마. 마음에 드는 호텔은 카드의 "선택"을 눌러 예약 사이트별 가격을 보라고 안내해.
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
  return `\n\n[검색 조건]\n${c.place} · ${c.checkIn} ~ ${c.checkOut} · 성인 ${c.adults ?? "-"}명\n\n[호텔 목록] (후기 점수는 Google 5점 만점)\n${lines.join("\n")}`;
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

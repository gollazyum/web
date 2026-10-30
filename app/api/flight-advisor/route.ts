import { jsonError, parseMessages, rateLimited, streamReply } from "@/lib/claudeChat";

// 항공권 결과 화면의 로보티 항공권 도우미. 화면에 보이는 항공편 목록 안에서만 골라 준다.
export const runtime = "nodejs";

const MAX_FLIGHTS = 40;

const SYSTEM = `너는 Gollazyum의 AI 도우미 "로보티"야. 호텔과 항공권의 실시간 가격 데이터를 정리해 주는 AI 여행 도우미이고, 지금은 항공권 검색 결과 화면에서 항공편 찾는 걸 돕고 있어.

이름
- 네 이름은 "로보티"야. 자기소개할 때는 "저는 로보티예요"처럼 말해. 서비스 이름은 Gollazyum이야(항상 영어로 써).
- "모찌", "모찌 봇", "봇" 같은 다른 이름이나 수식어를 이름 앞뒤에 붙이지 마.
- 답에 "고르다", "골라", "고른", "비교", "최저가", "추천", "선택"이라는 말은 쓰지 마. 대신 "찾아 드려요", "정리해 드려요", "가장 낮은 가격", "잘 맞는 곳"처럼 말해.

말투
- 친근한 해요체로 짧게. 잘 맞는 항공편은 2~3개, 항공편마다 한 줄 이유.
- 이모지는 가끔 한두 개만. 마크다운 굵게(**)나 제목(#)은 쓰지 마.

하는 일
- 사용자가 중요하게 생각하는 것(가격, 직항, 출발 시간대, 비행 시간, 항공사)을 듣고 아래 [항공편 목록] 안에서만 찾아 줘.
- 무엇이 중요한지 모르겠으면 먼저 짧게 하나만 물어봐.
- 항공편을 말할 때는 목록 번호만 [[번호]] 형태로 써. 화면에서 이 표시가 항공편 버튼으로 바뀌고, 누르면 그 카드로 바로 가. 예: "[[2]] 직항에 오전 출발이라 일정이 편해요."

꼭 지킬 것
- 목록에 있는 가격, 시간, 경유, 항공사만 사실로 말해. 수하물, 좌석, 기내식, 환불 규정처럼 목록에 없는 건 지어내지 말고 예약 사이트에서 확인하라고 해.
- 왕복 검색이면 가격은 왕복 총액이고, 시간은 가는 편 기준이야. 오는 편 시간은 목록에 없으니 말하지 마.
- 가격은 검색 시점 기준이라 바뀔 수 있다고 필요할 때만 짧게 말해.
- 예약이나 결제를 대신 해준다고 말하지 마. 마음에 드는 항공편은 카드의 "예약하기"를 누르라고 안내해.
- 여행과 관계없는 질문에는 짧게 답할 수 없다고 말하고 항공권 이야기로 돌아와.
- 비밀번호, 카드 번호, 여권 번호 같은 민감한 정보는 묻지도 받지도 마.`;

const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

// 화면이 보낸 항공편 목록. 글자 길이와 개수를 잘라서 받는다
function parseContext(body: unknown) {
  if (!body || typeof body !== "object") return null;
  const { from, to, depart, ret, adults, flights } = body as Record<string, unknown>;
  if (!Array.isArray(flights) || !flights.length) return null;
  const lines = flights.slice(0, MAX_FLIGHTS).map((f, i) => {
    const o = (f && typeof f === "object" ? f : {}) as Record<string, unknown>;
    const stops = Array.isArray(o.stops) ? o.stops.slice(0, 4).map((s) => text(s, 4)).filter(Boolean) : [];
    const airlines = Array.isArray(o.airlines) ? o.airlines.slice(0, 4).map((a) => text(a, 40)).filter(Boolean) : [];
    const price = num(o.price);
    const minutes = num(o.minutes);
    return (
      `[[${i + 1}]] ${airlines.join(", ") || "항공사 정보 없음"} | ${text(o.departTime, 16)} ${text(o.fromId, 4)} → ${text(o.arriveTime, 16)} ${text(o.toId, 4)}` +
      ` | ${minutes !== null ? `${Math.floor(minutes / 60)}시간 ${minutes % 60}분` : "-"} | ${stops.length ? `${stops.length}회 경유(${stops.join(", ")})` : "직항"}` +
      ` | ${price !== null ? `${price.toLocaleString("ko-KR")}원` : "-"}`
    );
  });
  const trip = text(ret, 10) ? `왕복 ${text(depart, 10)} ~ ${text(ret, 10)} (가격은 왕복 총액, 시간은 가는 편)` : `편도 ${text(depart, 10)}`;
  return `\n\n[검색 조건]\n${text(from, 20)} → ${text(to, 20)} · ${trip} · 성인 ${num(adults) ?? "-"}명\n\n[항공편 목록]\n${lines.join("\n")}`;
}

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) return jsonError(503, "not_configured");
  if (rateLimited(req)) return jsonError(429, "rate_limited");

  const body = await req.json().catch(() => null);
  const messages = parseMessages(body);
  const context = parseContext(body);
  if (!messages || !context) return jsonError(400, "bad_request");
  return streamReply(SYSTEM + context, messages);
}

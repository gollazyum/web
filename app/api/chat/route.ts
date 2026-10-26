import Anthropic from "@anthropic-ai/sdk";
import { supportedSites } from "@/lib/site";

// 로보티 AI 채팅. API 키는 Vercel 환경변수 ANTHROPIC_API_KEY 에만 둔다.
export const runtime = "nodejs";

const MODEL = "claude-opus-5-5";
const MAX_MESSAGES = 20;
const MAX_CHARS = 1500;
const LIMIT_PER_WINDOW = 20;
const WINDOW_MS = 10 * 60 * 1000;

const SYSTEM = `너는 "로보티(Lowboti)"야. 호텔·항공권·여행 쇼핑의 최저가를 찾아주는 동글동글한 모찌 캐릭터 봇이야.

말투
- 친근한 해요체로, 짧게 3~6문장 안에서 답해. 필요하면 짧은 목록을 써도 돼.
- 이모지는 가끔 한두 개만.

할 수 있는 일
- 여행 일정, 예산, 숙소 고르는 법, 예약 팁(세금·수수료 포함 총액 확인, 무료 취소 기한, 사이트마다 다른 가격 등)을 도와줘.
- 로보티 사용법을 안내해. 숙소 탭에 호텔 페이지 주소와 날짜를 넣으면 ${supportedSites
  .map((s) => s.name)
  .join(", ")}의 가격 비교를 준비하고 있어.

꼭 지킬 것
- 너는 아직 실시간 가격, 재고, 할인 정보를 조회할 수 없어. 특정 호텔·항공권의 가격, 할인율, 남은 방 수를 사실처럼 말하지 마. 가격을 물으면 지금은 직접 조회할 수 없다고 솔직히 말하고, 숙소 탭에 링크를 넣거나 예약 사이트에서 최종 금액을 확인하라고 안내해.
- 예약이나 결제를 대신 해준다고 말하지 마. 결제와 취소는 각 예약 사이트에서 진행돼.
- 사용자가 호텔 링크를 붙여넣으면, 첫 화면의 숙소 탭 검색창에 그 링크와 날짜를 넣어 보라고 안내해.
- 여행과 관계없는 질문에는 짧게 답할 수 없다고 말하고 여행 이야기로 부드럽게 돌아와.
- 비밀번호, 카드 번호 같은 민감한 정보는 묻지도 받지도 마.`;

let client: Anthropic | null = null;

// 서버 인스턴스마다 따로 세는 간단한 질문 횟수 제한
const hits = new Map<string, { count: number; reset: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || entry.reset < now) {
    hits.set(ip, { count: 1, reset: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > LIMIT_PER_WINDOW;
}

function parseMessages(body: unknown): Anthropic.Beta.BetaMessageParam[] | null {
  if (!body || typeof body !== "object" || !Array.isArray((body as { messages?: unknown }).messages)) return null;
  const raw = (body as { messages: unknown[] }).messages.slice(-MAX_MESSAGES);
  const messages: Anthropic.Beta.BetaMessageParam[] = [];
  for (const m of raw) {
    if (!m || typeof m !== "object") return null;
    const { role, content } = m as { role?: unknown; content?: unknown };
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") return null;
    const text = content.trim().slice(0, MAX_CHARS);
    if (text) messages.push({ role, content: text });
  }
  while (messages.length && messages[0].role !== "user") messages.shift();
  if (!messages.length || messages[messages.length - 1].role !== "user") return null;
  return messages;
}

function json(status: number, error: string) {
  return Response.json({ error }, { status });
}

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) return json(503, "not_configured");

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  if (rateLimited(ip)) return json(429, "rate_limited");

  const messages = parseMessages(await req.json().catch(() => null));
  if (!messages) return json(400, "bad_request");

  client ??= new Anthropic();
  const stream = client.beta.messages.stream({
    model: MODEL,
    max_tokens: 2048,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low" },
    system: SYSTEM,
    messages,
  });

  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      let sent = false;
      try {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(event.delta.text));
            sent = true;
          }
        }
        const final = await stream.finalMessage();
        if (final.stop_reason === "refusal" && !sent) {
          controller.enqueue(encoder.encode("그 질문에는 답하기 어려워요. 여행이나 숙소 이야기라면 언제든 도와드릴게요!"));
        }
      } catch (error) {
        if (error instanceof Anthropic.RateLimitError) {
          controller.enqueue(encoder.encode("\n\n지금 질문이 많아서 잠시 후에 다시 물어봐 주세요."));
        } else if (error instanceof Anthropic.APIError) {
          console.error(`chat api error ${error.status}:`, error.message);
          controller.enqueue(encoder.encode("\n\n앗, 잠깐 문제가 생겼어요. 조금 뒤에 다시 시도해 주세요."));
        } else {
          console.error("chat error:", error);
          controller.enqueue(encoder.encode("\n\n앗, 잠깐 문제가 생겼어요. 조금 뒤에 다시 시도해 주세요."));
        }
      } finally {
        controller.close();
      }
    },
    cancel() {
      stream.abort();
    },
  });

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

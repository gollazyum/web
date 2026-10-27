import Anthropic from "@anthropic-ai/sdk";

// 로보티 AI 대화 공통 부분: 질문 횟수 제한, 대화 기록 검사, Claude 답을 글자 흐름으로 보내기.
// 서버에서만 쓴다. API 키는 Vercel 환경변수 ANTHROPIC_API_KEY 에만 둔다.

const MODEL = "claude-opus-5-5";
const MAX_MESSAGES = 20;
const MAX_CHARS = 1500;
const LIMIT_PER_WINDOW = 20;
const WINDOW_MS = 10 * 60 * 1000;

let client: Anthropic | null = null;

// 서버 인스턴스마다 따로 세는 간단한 질문 횟수 제한
const hits = new Map<string, { count: number; reset: number }>();

export function rateLimited(req: Request): boolean {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || entry.reset < now) {
    hits.set(ip, { count: 1, reset: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > LIMIT_PER_WINDOW;
}

export function parseMessages(body: unknown): Anthropic.Beta.BetaMessageParam[] | null {
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

export function jsonError(status: number, error: string) {
  return Response.json({ error }, { status });
}

// system과 대화 기록으로 Claude를 부르고, 답을 받는 대로 글자 흐름으로 보낸다
export function streamReply(system: string, messages: Anthropic.Beta.BetaMessageParam[]): Response {
  client ??= new Anthropic();
  const stream = client.beta.messages.stream({
    model: MODEL,
    max_tokens: 2048,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low" },
    system,
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

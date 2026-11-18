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

export function jsonError(status: number, error: string, why?: string) {
  return Response.json(why ? { error, why } : { error }, { status, headers: why ? { "x-ai-fail": why } : undefined });
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

// 정해진 JSON 모양으로 한 번 답을 받는다 (스트리밍 없음). 실패·거절이면 null
// onFail: 왜 실패했는지 짧은 이유 (refusal, max_tokens, api_529, timeout, bad_json 등). 키나 요청 내용은 담지 않는다
export async function jsonReply<T>(system: string, user: string, schema: Record<string, unknown>, maxTokens = 4000, onFail?: (why: string) => void): Promise<T | null> {
  client ??= new Anthropic();
  const started = Date.now();
  const fail = (why: string) => {
    console.error(`trip ai fail: ${why} after ${Date.now() - started}ms`);
    onFail?.(why);
    return null;
  };
  try {
    const res = await client.beta.messages.create(
      {
        model: MODEL,
        max_tokens: maxTokens,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "low", format: { type: "json_schema", schema } },
        system,
        messages: [{ role: "user", content: user }],
      },
      // 함수 최대 60초 안에 끝나도록: 한 번 25초, SDK 재시도 1번까지 (429·5xx·연결 오류만 다시 보냄)
      { timeout: 25_000, maxRetries: 1 },
    );
    if (res.stop_reason === "refusal" || res.stop_reason === "max_tokens") return fail(String(res.stop_reason));
    const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    try {
      return JSON.parse(text) as T;
    } catch {
      return fail("bad_json");
    }
  } catch (error) {
    if (error instanceof Anthropic.APIConnectionTimeoutError) return fail("timeout");
    if (error instanceof Anthropic.APIError) {
      console.error(`trip ai api error ${error.status}:`, error.message);
      return fail(apiWhy(error));
    }
    return fail(error instanceof Error ? error.name : "unknown");
  }
}

// API 오류를 짧은 이유로: api_401_authentication_error, api_400_credit(크레딧 부족), api_404_not_found_error(모델 이름) 등.
// 오류 본문의 type과 몇 가지 낱말만 본다. 키나 요청 내용은 담지 않는다
export function apiWhy(error: InstanceType<typeof Anthropic.APIError>): string {
  const body = error.error as { error?: { type?: unknown; message?: unknown } } | undefined;
  const type = typeof body?.error?.type === "string" ? body.error.type.replace(/[^a-z_]/g, "").slice(0, 40) : "";
  const msg = typeof body?.error?.message === "string" ? body.error.message.toLowerCase() : String(error.message).toLowerCase();
  const hint = /credit balance|billing/.test(msg) ? "credit" : /spend|usage limit|workspace limit/.test(msg) ? "limit" : /model/.test(msg) && error.status === 404 ? "model" : "";
  return ["api", String(error.status ?? "x"), hint || type].filter(Boolean).join("_");
}

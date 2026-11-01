import Anthropic from "@anthropic-ai/sdk";
import { jsonError, rateLimited } from "@/lib/claudeChat";
import { compareFallback, PREF_CHIPS, type Facts } from "@/lib/prefs";

// 비교함 2~3곳의 결론. 화면이 보낸 숫자(가격·점수·편의시설·후기 주제 건수)만 넣고,
// 가장 잘 맞는 호텔 하나와 이유 3줄을 JSON으로 받는다. 표는 화면이 원본 숫자로 그리므로 여기서는 결론만 만든다
export const runtime = "nodejs";

const MODEL = "claude-opus-5-5";
const KEYS = ["A", "B", "C"] as const;

const SYSTEM = `너는 여행 데이터 플랫폼 Gollazyum의 AI 도우미 "Gollazyum AI"야. 사용자가 보관함에 담은 호텔 2~3곳 중 사용자가 정한 선호 기준에 가장 잘 맞는 한 곳을 정해. 자기 이름은 "Gollazyum AI"이고, "로보티", "Roboti", "AI 인사이트", "AI Insight"라고 부르지 마.

꼭 지킬 것
- 아래 [호텔 데이터]에 있는 숫자와 이름만 근거로 써. 역까지 거리, 주변 시설, 방 크기 숫자, 후기 내용처럼 데이터에 없는 건 절대 추측해서 쓰지 마.
- 후기 주제는 '긍정 n건 / 언급 m건' 숫자만 있어. 후기 글을 인용하거나 지어내지 마. 주제 데이터가 없는 호텔은 점수·후기 수·편의시설로만 비교해.
- 1박 예산을 넘는 호텔은 그 점을 이유에 솔직하게 밝혀.
- 이유에 "고르다", "골라", "비교", "최저가", "추천", "선택"이라는 말은 쓰지 마.
- 이유는 3개, 각각 한 문장, 해요체, 60자 안쪽. 숫자를 하나씩 넣어. 이모지·마크다운은 쓰지 마.
- 답은 JSON 하나만 써: {"winner":"A","reasons":["…","…","…"]}`;

const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

function parse(body: unknown) {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const chips = Array.isArray(b.chips) ? b.chips.filter((c): c is string => PREF_CHIPS.some((p) => p.id === c)).slice(0, 3) : [];
  const budget = num(b.budget);
  if (!Array.isArray(b.hotels) || b.hotels.length < 2) return null;
  const hotels = b.hotels.slice(0, 3).map((h, i) => {
    const o = (h && typeof h === "object" ? h : {}) as Record<string, unknown>;
    const topics = Array.isArray(o.topics)
      ? o.topics.slice(0, 12).map((t) => {
          const r = (t && typeof t === "object" ? t : {}) as Record<string, unknown>;
          return { name: text(r.name, 30), total: num(r.total) ?? 0, positive: num(r.positive) ?? 0, negative: num(r.negative) ?? 0 };
        })
      : null;
    return {
      key: KEYS[i],
      name: text(o.name, 80),
      perNight: num(o.perNight),
      total: num(o.total),
      site: text(o.site, 40),
      rating: num(o.rating),
      reviews: num(o.reviews),
      stars: num(o.stars),
      amenities: Array.isArray(o.amenities) ? o.amenities.slice(0, 12).map((a) => text(a, 30)).filter(Boolean) : [],
      topics,
    };
  });
  return { chips, budget, hotels };
}

const won = (n: number | null) => (n === null ? "정보 없음" : `${n.toLocaleString("ko-KR")}원`);

// 화면 문구에 나오면 안 되는 말. 모델이 쓰면 그 답은 버리고 숫자 점수로 대신한다
const BANNED = /고르다|골라|비교|최저가|추천|선택/;

type Compared = {
  chips: string[];
  budget: number | null;
  hotels: {
    key: (typeof KEYS)[number];
    name: string;
    perNight: number | null;
    total: number | null;
    site: string;
    rating: number | null;
    reviews: number | null;
    stars: number | null;
    amenities: string[];
    topics: { name: string; total: number; positive: number; negative: number }[] | null;
  }[];
};

function dataAnswer(c: Compared) {
  const facts: Facts[] = c.hotels.map((h) => ({
    perNight: h.perNight,
    rating: h.rating,
    reviews: h.reviews,
    stars: h.stars,
    amenities: h.amenities,
    topics: h.topics,
  }));
  const verdict = compareFallback(facts, c.chips, c.budget);
  return Response.json({ ...verdict, by: "data" });
}

function readAnswer(raw: string): { winner?: unknown; reasons?: unknown } | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1)) as { winner?: unknown; reasons?: unknown };
  } catch {
    return null;
  }
}

function winnerIndex(value: unknown, count: number): number {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0 && value < count) return value;
  if (typeof value === "string") {
    const letter = KEYS.indexOf(value.trim().toUpperCase() as (typeof KEYS)[number]);
    if (letter >= 0 && letter < count) return letter;
  }
  return -1;
}

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) return jsonError(503, "not_configured");
  if (rateLimited(req)) return jsonError(429, "rate_limited");
  const c = parse(await req.json().catch(() => null));
  if (!c) return jsonError(400, "bad_request");

  const lines = c.hotels.map(
    (h) =>
      `${h.key}. ${h.name} | ${h.stars ? `${h.stars}성급` : "등급 정보 없음"} | 후기 ${h.rating ?? "-"}점(${h.reviews ?? 0}개) | 1박 ${won(h.perNight)} · 총 ${won(h.total)}${h.site ? ` (가장 낮은 가격 ${h.site})` : ""}` +
      ` | 편의시설: ${h.amenities.join(", ") || "정보 없음"}` +
      ` | 후기 주제: ${h.topics?.length ? h.topics.map((t) => `${t.name} 긍정 ${t.positive}건/언급 ${t.total}건`).join(", ") : "데이터 없음"}`,
  );
  const ask =
    `[선호 기준] ${c.chips.length ? c.chips.join(", ") : "따로 정하지 않음 (가격과 후기 점수의 균형)"}` +
    `\n[1박 예산] ${c.budget ? won(c.budget) : "정하지 않음"}` +
    `\n\n[호텔 데이터] (후기 점수는 5점 만점)\n${lines.join("\n")}`;

  try {
    const client = new Anthropic();
    const res = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 600,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low" },
      system: SYSTEM,
      messages: [{ role: "user", content: ask }],
    });
    const raw = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    const json = readAnswer(raw);
    const winner = winnerIndex(json?.winner, c.hotels.length);
    const reasons = Array.isArray(json?.reasons) ? json.reasons.map((r) => text(r, 120)).filter(Boolean).slice(0, 3) : [];
    if (winner < 0 || !reasons.length || reasons.some((r) => BANNED.test(r))) {
      console.error("compare fallback", "bad_answer");
      return dataAnswer(c);
    }
    return Response.json({ winner, reasons, by: "ai" });
  } catch (e) {
    console.error("compare fallback", e instanceof Anthropic.APIError ? `${e.status} ${e.message}` : e);
    return dataAnswer(c);
  }
}

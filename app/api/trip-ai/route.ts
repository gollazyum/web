import { jsonError, jsonReply, rateLimited } from "@/lib/claudeChat";
import { brand } from "@/lib/brand";
import { ASK_SLOTS, cleanCopy, isDate, MAX_QUESTIONS, TOP_PICKS, type AskQuestion, type ParseResult, type Pick, type PickResult } from "@/lib/trip";

// 탐색 탭 AI. 두 가지 일을 한다.
// - mode "parse": 자유 문장을 숙소/항공 검색 조건으로 바꾸고, 빠진 조건은 칩 질문(최대 3개)으로 되묻는다
// - mode "pick": 이미 받아 온 검색 결과(번호 목록) 안에서 취향에 맞는 3곳과 한 줄 이유를 준다. 가격 검색은 하지 않는다
// API 키는 Vercel 환경변수 ANTHROPIC_API_KEY 에만 둔다. 키가 없거나 AI가 실패하면 화면이 규칙 기반으로 대신한다
export const runtime = "nodejs";
export const maxDuration = 60;

const RULES = `꼭 지킬 말투·단어
- 친근한 해요체로 짧게. 이모지·마크다운은 쓰지 마.
- "추천", "비교", "최저가", "실시간", "골라", "고르다", "선택"이라는 말은 쓰지 마. 대신 "잘 맞는 곳", "먼저 보여 드릴게요", "가장 낮은 가격", "찾아 드릴게요"처럼 말해.
- 데이터를 어디서 받아 오는지(회사 이름 등)는 말하지 마.
- 예약이나 결제를 대신 해 준다고 말하지 마. 결제는 각 예약 사이트에서 해.`;

const PARSE_SYSTEM = `너는 여행 앱 "${brand.appName}"의 "${brand.aiName}"야. 사용자의 한 문장을 숙소 또는 항공편 검색 조건으로 바꾸는 일을 해.

${RULES}

할 일
- kind: 숙소 이야기면 "stay", 항공편 이야기면 "flight", 둘 다 아니거나 여행 상담이면 "other". 둘 다 말하면 먼저 말한 쪽.
- 아는 조건만 채워. 모르는 칸은 빈 문자열("")이나 0으로 둬. 지어내지 마.
- 날짜는 YYYY-MM-DD. 오늘 날짜를 기준으로 "12월 첫 주말", "다음 주 금요일"을 실제 날짜로 바꿔. 지난 날짜는 쓰지 마. 몇 박인지 말했으면 체크아웃을 계산해.
- 숙소 place: 도시·동네 이름 그대로("오사카 난바"). 온천처럼 지역을 안 말했으면 비워 두고 되물어.
- 숙소 budget: 숙박 전체 총액 상한(원). "1박 15만 원"이면 박수를 곱해. 모르면 0.
- 항공 from/to: IATA 공항 코드나 도시 코드(서울 SEL, 인천 ICN, 김포 GMP, 부산 PUS, 도쿄 TYO, 오사카 OSA, 후쿠오카 FUK, 삿포로 CTS, 오키나와 OKA, 방콕 BKK, 다낭 DAD, 타이베이 TPE, 홍콩 HKG, 싱가포르 SIN). fromLabel/toLabel은 한국어 이름("인천", "오사카 간사이"). 출발지를 말 안 했으면 비우고 되물어.
- oneWay: 편도라고 했을 때만 true. 왕복이고 돌아오는 날을 모르면 ret을 비우고 되물어.
- adults: 인원(성인). "부모님 모시고"는 본인 포함 3명, "커플"·"둘이"는 2명처럼 문장에서 알 수 있으면 채워. 모르면 0.
- taste: 날짜·장소·인원·예산을 뺀 취향만 짧게 ("조용하고 역에서 가까운 곳, 대욕장"). 없으면 "".
- questions: 검색에 꼭 필요한데 빠진 것(숙소: place, dates, adults / 항공: from, to, dates, adults)과, 결과를 크게 바꿀 취향 하나(예산이나 온천 형태 등)만 최대 ${MAX_QUESTIONS}개. 이미 아는 건 묻지 마.
  - slot은 ${ASK_SLOTS.join(", ")} 중 하나. q는 짧은 질문 ("어디서 출발하세요?").
  - options는 2~4개. label은 칩 글자(짧게), value는 그 칸에 들어갈 값:
    place/to/from: place는 도시·동네 이름, from/to는 코드 ("ICN") / dates: "YYYY-MM-DD~YYYY-MM-DD" (편도 항공이면 "YYYY-MM-DD~") / adults: "2" / budget: 숙박 총액 원 "400000" / taste: 취향 짧은 말 ("대욕장")
- reply: kind가 stay·flight면 되묻기 앞에 붙일 한 문장 ("좋아요! 딱 맞게 찾으려고 두 가지만 여쭤볼게요." 또는 질문이 없으면 "이 조건으로 찾아볼게요."). other면 그 질문에 대한 짧은 답(3문장 이내)으로, 숙소·항공편 찾기로 이어지게.`;

const PARSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["kind", "reply", "place", "checkIn", "checkOut", "adults", "budget", "from", "fromLabel", "to", "toLabel", "depart", "ret", "oneWay", "taste", "questions"],
  properties: {
    kind: { type: "string", enum: ["stay", "flight", "other"] },
    reply: { type: "string" },
    place: { type: "string" },
    checkIn: { type: "string" },
    checkOut: { type: "string" },
    adults: { type: "integer" },
    budget: { type: "integer" },
    from: { type: "string" },
    fromLabel: { type: "string" },
    to: { type: "string" },
    toLabel: { type: "string" },
    depart: { type: "string" },
    ret: { type: "string" },
    oneWay: { type: "boolean" },
    taste: { type: "string" },
    questions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["slot", "q", "options"],
        properties: {
          slot: { type: "string", enum: [...ASK_SLOTS] },
          q: { type: "string" },
          options: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["label", "value"],
              properties: { label: { type: "string" }, value: { type: "string" } },
            },
          },
        },
      },
    },
  },
} as const;

type RawParse = {
  kind: "stay" | "flight" | "other";
  reply: string;
  place: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  budget: number;
  from: string;
  fromLabel: string;
  to: string;
  toLabel: string;
  depart: string;
  ret: string;
  oneWay: boolean;
  taste: string;
  questions: AskQuestion[];
};

const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const int = (v: unknown, lo: number, hi: number) => (typeof v === "number" && Number.isInteger(v) && v >= lo && v <= hi ? v : 0);
const code = (v: unknown) => (typeof v === "string" && /^[A-Za-z]{3}$/.test(v.trim()) ? v.trim().toUpperCase() : "");
const date = (v: unknown, today: string) => (isDate(v) && v >= today ? v : "");

function shapeParse(raw: RawParse, today: string): ParseResult {
  const questions: AskQuestion[] = (Array.isArray(raw.questions) ? raw.questions : [])
    .filter((q) => q && ASK_SLOTS.includes(q.slot))
    .slice(0, MAX_QUESTIONS)
    .map((q) => ({
      slot: q.slot,
      q: cleanCopy(q.q, 60),
      options: (Array.isArray(q.options) ? q.options : [])
        .map((o) => ({ label: cleanCopy(o.label, 24), value: str(o.value, 40) }))
        .filter((o) => o.label && o.value)
        .slice(0, 4),
    }))
    .filter((q) => q.q && q.options.length >= 2);
  const kind = raw.kind === "stay" || raw.kind === "flight" ? raw.kind : "other";
  return {
    kind,
    reply: cleanCopy(raw.reply, 400),
    stay: {
      place: str(raw.place, 60),
      checkIn: date(raw.checkIn, today),
      checkOut: date(raw.checkOut, today),
      adults: int(raw.adults, 1, 9),
      budget: int(raw.budget, 10_000, 100_000_000),
      taste: str(raw.taste, 200),
    },
    flight: {
      from: code(raw.from),
      fromLabel: str(raw.fromLabel, 30),
      to: code(raw.to),
      toLabel: str(raw.toLabel, 30),
      depart: date(raw.depart, today),
      ret: raw.oneWay ? "" : date(raw.ret, today),
      adults: int(raw.adults, 1, 9),
      taste: str(raw.taste, 200),
    },
    questions,
  };
}

const PICK_SYSTEM = `너는 여행 앱 "${brand.appName}"의 "${brand.aiName}"야. 이미 찾아 둔 [목록] 안에서 사용자 취향에 가장 잘 맞는 ${TOP_PICKS}곳을 순서대로 정해 한 줄 이유를 붙여.

${RULES}

할 일
- picks: 목록 번호 n과 이유 reason. 정확히 ${TOP_PICKS}개(목록이 더 적으면 전부). 같은 번호를 두 번 쓰지 마.
- reason은 25자 안팎 한 문장. 목록에 있는 사실(후기 점수, 성급, 편의시설, 총액, 시간, 직항 여부)만 근거로 써. 위치·역 거리·방 크기·조용함처럼 목록에 없는 건 지어내지 마.
- 예산이 있으면 예산 안의 곳을 먼저. 예산 안에 없으면 가장 가까운 곳을 쓰고 note에 짧게 알려.
- 취향 조건이 목록 정보로 확인되지 않으면 note에 "역 거리는 지도에서 확인해 주세요"처럼 한 문장으로 알려. 따로 할 말이 없으면 note는 "".`;

const PICK_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["picks", "note"],
  properties: {
    picks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["n", "reason"],
        properties: { n: { type: "integer" }, reason: { type: "string" } },
      },
    },
    note: { type: "string" },
  },
} as const;

const MAX_ITEMS = 40;

function pickInput(body: Record<string, unknown>): string | null {
  const kind = body.kind === "flight" ? "flight" : body.kind === "stay" ? "stay" : null;
  if (!kind || !Array.isArray(body.items) || !body.items.length) return null;
  const items = body.items.slice(0, MAX_ITEMS).map((it, i) => {
    const o = (it && typeof it === "object" ? it : {}) as Record<string, unknown>;
    const fields = Object.entries(o)
      .filter(([, v]) => typeof v === "string" || typeof v === "number" || typeof v === "boolean")
      .slice(0, 12)
      .map(([k, v]) => `${str(k, 20)}=${typeof v === "string" ? str(v, 160) : v}`);
    return `[${i + 1}] ${fields.join(" | ")}`;
  });
  const taste = str(body.taste, 300);
  const budget = int(body.budget, 0, 100_000_000);
  const head = kind === "stay" ? `숙소 ${items.length}곳 (총액은 숙박 전체, 세금·수수료 포함 원)` : `항공편 ${items.length}편 (가격은 전체 인원 총액, 세금 포함 원)`;
  return `[취향] ${taste || "따로 없음"}${budget ? `\n[예산] 숙박 총액 ${budget.toLocaleString("ko-KR")}원 이하` : ""}\n\n[목록] ${head}\n${items.join("\n")}`;
}

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) return jsonError(503, "not_configured");
  if (rateLimited(req)) return jsonError(429, "rate_limited");
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") return jsonError(400, "bad_request");
  const today = isDate(body.today) ? body.today : new Date().toISOString().slice(0, 10);

  if (body.mode === "parse") {
    const text = str(body.text, 500);
    if (!text) return jsonError(400, "bad_request");
    // 이어서 말할 때(예: "조식 있는 곳만") 지금 보고 있는 검색 조건을 같이 받는다
    const context = str(typeof body.context === "string" ? body.context : "", 400);
    const user = `[오늘] ${today}${context ? `\n[지금 보고 있는 검색] ${context}` : ""}\n\n[사용자] ${text}`;
    const raw = await jsonReply<RawParse>(PARSE_SYSTEM, user, PARSE_SCHEMA);
    if (!raw) return jsonError(502, "ai_failed");
    return Response.json(shapeParse(raw, today));
  }

  if (body.mode === "pick") {
    const input = pickInput(body);
    if (!input) return jsonError(400, "bad_request");
    const raw = await jsonReply<{ picks: Pick[]; note: string }>(PICK_SYSTEM, input, PICK_SCHEMA);
    if (!raw || !Array.isArray(raw.picks)) return jsonError(502, "ai_failed");
    const out: PickResult = {
      picks: raw.picks.slice(0, TOP_PICKS).map((p) => ({ n: Number(p.n), reason: cleanCopy(p.reason, 80) })),
      note: cleanCopy(raw.note, 120),
    };
    return Response.json(out);
  }

  return jsonError(400, "bad_request");
}

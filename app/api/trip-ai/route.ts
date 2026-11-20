import { jsonError, jsonReply, rateLimited } from "@/lib/claudeChat";
import { brand } from "@/lib/brand";
import { checkFacts, readCheckInput, shapeCheck } from "@/lib/checkpoints";
import { ASK_SLOTS, cleanCopy, isDate, pickNote, stayReason, MAX_QUESTIONS, TOP_PICKS, type AskQuestion, type ParseResult, type Pick, type PickResult } from "@/lib/trip";

// 탐색 탭 AI. 두 가지 일을 한다.
// - mode "parse": 자유 문장을 숙소/항공 검색 조건으로 바꾸고, 빠진 조건은 칩 질문(최대 3개)으로 되묻는다
// - mode "pick": 이미 받아 온 검색 결과(번호 목록) 안에서 취향에 맞는 3곳과 한 줄 이유를 준다. 가격 검색은 하지 않는다
// - mode "check": AI 추천 3곳·숙소 상세의 '솔직 체크포인트'(장점 1줄 + 결제 전 확인 1~2줄). 받은 데이터로만 쓴다
// - mode "hotel": 숙소 상세에서 그 숙소 하나에 대한 질문에 화면 정보만으로 답한다
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
- 숙소 place: 사용자가 말한 도시·동네 이름 그대로("오사카", "도쿄 신주쿠"). 말하지 않은 동네를 덧붙이지 마. 온천처럼 지역을 안 말했으면 비워 두고 되물어.
- 숙소 budget: 숙박 전체 총액 상한(원). "1박 15만 원"이면 박수를 곱해. 모르면 0.
- 항공 from/to: IATA 공항 코드나 도시 코드(서울 SEL, 인천 ICN, 김포 GMP, 부산 PUS, 도쿄 TYO, 오사카 OSA, 후쿠오카 FUK, 삿포로 CTS, 오키나와 OKA, 방콕 BKK, 다낭 DAD, 타이베이 TPE, 홍콩 HKG, 싱가포르 SIN). fromLabel/toLabel은 한국어 이름("인천", "오사카 간사이"). 출발지를 말 안 했으면 비우고 되물어.
- oneWay: 편도라고 했을 때만 true. 왕복이고 돌아오는 날을 모르면 ret을 비우고 되물어.
- adults: 인원(성인). "부모님 모시고"는 본인 포함 3명, "커플"·"둘이"는 2명처럼 문장에서 알 수 있으면 채워. 모르면 0.
- taste: 날짜·장소·인원·예산을 뺀 취향만 짧게 ("조용하고 역에서 가까운 곳, 대욕장"). 없으면 "".
- questions: 검색에 꼭 필요한데 빠진 것(숙소: place, dates, adults / 항공: from, to, dates, adults)과, 결과를 크게 바꿀 취향 하나(예산이나 온천 형태 등)만 최대 ${MAX_QUESTIONS}개. 이미 아는 건 묻지 마.
  - slot은 ${ASK_SLOTS.join(", ")} 중 하나. q는 짧은 질문 ("어디서 출발하세요?").
  - options는 2~4개. label은 칩 글자(짧게), value는 그 칸에 들어갈 값:
    place/to/from: place는 도시·동네 이름, from/to는 코드 ("ICN") / dates: "YYYY-MM-DD~YYYY-MM-DD" (편도 항공이면 "YYYY-MM-DD~") / adults: "2" / budget: 숙박 총액 원 "400000" / taste: 취향 짧은 말 ("대욕장")
- reply: kind가 stay·flight면 되묻기 앞에 붙일 한 문장 ("좋아요! 딱 맞게 찾으려고 두 가지만 여쭤볼게요." 또는 질문이 없으면 "이 조건으로 찾아볼게요."). other면 그 질문에 대한 짧은 답(3문장 이내)으로, 숙소·항공편 찾기로 이어지게.
  - 단, 여행 준비(옷차림·준비물·교통패스), 여행 중 문제(분실·아플 때·대사관·환전·체크인), 여행 후 정리(무료 취소·가격 하락 확인) 같은 도움 질문이면 숙소 찾기로 돌리지 말고 바로 쓸 수 있는 핵심을 "- "로 시작하는 짧은 줄 3~6개로 답해 (줄마다 줄바꿈).
  - 도시·날짜를 모르면 일반적인 기준으로 답하고 마지막 줄에 도시·날짜를 알려 주면 더 맞춰 드린다고 해.
  - 오늘 기온·환율 숫자·운영 시간·전화번호처럼 확인하지 않은 사실은 지어내지 말고, 어디서 확인하면 되는지만 알려 줘. 위급하면 현지 긴급 번호와 영사콜센터(+82-2-3210-0404)를 안내해.`;

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

function cleanLines(text: unknown): string {
  return String(text ?? "")
    .split(/\n+/)
    .map((l) => cleanCopy(l, 160))
    .filter(Boolean)
    .slice(0, 8)
    .join("\n");
}

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
    // 여행 도움 답(other)은 줄 단위로 다듬어 줄바꿈을 살린다. 금지어가 든 줄만 빠진다
    reply: kind === "other" ? cleanLines(raw.reply) : cleanCopy(raw.reply, 400),
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
- reason은 25자 안팎 한 문장. 목록에 있는 사실(후기 점수, 성급, 편의시설, 총액, 시간, 직항 여부)만 근거로 써. 위치·역 거리·방 크기·조용함처럼 목록에 없는 건 지어내지 마. 와이파이처럼 거의 모든 숙소에 있는 시설은 이유로 쓰지 마.
- 숙소 카드 윗줄에 후기 점수·리뷰 수·성급 숫자가 이미 보여. reason에서 그 숫자를 그대로 되풀이하지 말고, 편의시설·취향 조건·"후기 만족도가 높아요"처럼 말로 풀어 써.
- 숙소 reason에는 금액(원)과 "예산 안" 같은 가격 판단을 쓰지 마. 카드 금액은 예약처 가격을 확인한 뒤 바뀌어서 이유와 어긋나. 숙소는 후기·성급·편의시설로 써. 항공편은 금액을 써도 돼.
- 예산이 있으면 예산 안의 곳을 먼저. 예산 안에 없으면 가장 가까운 곳을 쓰고 note에 짧게 알려.
- 취향 조건이 목록 정보로 확인되지 않으면 note에 "역 거리는 예약 사이트에서 확인해 주세요"처럼 한 문장으로 알려. 이 앱에는 지도가 없으니 "지도"라는 말은 쓰지 마. 따로 할 말이 없으면 note는 "".`;

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

// mode "hotel": 숙소 상세 화면의 'AI에게 물어보기'. 화면에 보이는 그 숙소 정보만으로 짧게 답한다
const HOTEL_SYSTEM = `너는 여행 앱 "${brand.appName}"의 "${brand.aiName}"야. 사용자가 보고 있는 숙소 하나에 대한 질문에 답해.

${RULES}

할 일
- [숙소 정보]에 있는 사실만 근거로 3문장 이내로 답해. 후기 주제는 "긍정 N%"처럼 정보에 있는 숫자만 써.
- 정보에 없는 것(방 크기, 소음, 체크인 시간, 정확한 금액, 정책 등)은 지어내지 말고 "그 정보는 여기 없어요. 예약 사이트 숙소 소개에서 확인해 주세요"처럼 말해.
- 거리는 직선거리라서 실제 이동 거리와 다르다는 걸 필요하면 짧게 덧붙여.
- 숙소와 상관없는 질문이면 이 숙소나 여행 이야기로 짧게 돌려.`;

const HOTEL_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["answer"],
  properties: { answer: { type: "string" } },
} as const;

// mode "check": 숙소마다 장점 한 줄과 결제 전에 확인할 점 1~2줄. 사실 목록 밖의 말은 쓰지 않는다
const CHECK_SYSTEM = `너는 여행 앱 "${brand.appName}"의 "${brand.aiName}"야. 숙소마다 [사실]만 보고 솔직한 요약을 써.

${RULES}

할 일 (숙소마다, 받은 순서대로)
- pros: 이 숙소의 가장 분명한 장점 한 줄 (40자 이내). 위치·성급·후기 점수·후기 주제 좋아요 비율·편의시설 중 [사실]에 있는 것만.
- checks: 결제 전에 확인할 점 1~2줄 (각 40자 이내). 후기 주제 좋아요 비율이 낮은 것(60% 미만)이 있으면 숫자 그대로 먼저 써.
- 무료 취소가 "확인 안 됨"이면 "무료 취소 여부는 결제 화면에서 확인이 필요해요"라고 써. 조식 포함은 늘 모르는 정보야. "포함"이라고 하지 마.
- 숙박세 지역이 "예"면 "현장 결제 숙박세가 별도로 부과될 수 있어요"를 넣어.
- [사실]에 없는 것(소음, 엘리베이터, 방 크기, 체크인 시간, 주차, 금액, 할인, 가성비 등)은 절대 지어내지 마. 금액·예산 이야기는 하지 마.
- 와이파이는 장점으로 쓰지 마.`;

const CHECKS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["pros", "checks"],
        properties: { pros: { type: "string" }, checks: { type: "array", items: { type: "string" } } },
      },
    },
  },
} as const;

const MAX_CHECK = 3;

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

// 상태 확인: 브라우저로 /api/trip-ai 를 열면 AI 연결이 되는지 짧게 알려 준다 (아주 작은 요청 1번. 키 값·요청 내용은 보이지 않는다)
const CHECK_SCHEMA = { type: "object", additionalProperties: false, required: ["ok"], properties: { ok: { type: "boolean" } } } as const;
export async function GET(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) return Response.json({ ok: false, why: "not_configured" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  if (rateLimited(req)) return Response.json({ ok: false, why: "rate_limited" }, { status: 429, headers: { "Cache-Control": "no-store" } });
  let why = "";
  const started = Date.now();
  const raw = await jsonReply<{ ok: boolean }>("Answer with ok true.", "ping", CHECK_SCHEMA, 200, (w) => (why = w));
  const ms = Date.now() - started;
  return Response.json(raw ? { ok: true, ms } : { ok: false, why: why || "bad_shape", ms }, { status: raw ? 200 : 502, headers: { "Cache-Control": "no-store" } });
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
    let why = "";
    const raw = await jsonReply<RawParse>(PARSE_SYSTEM, user, PARSE_SCHEMA, 4000, (w) => (why = w));
    if (!raw) return jsonError(502, "ai_failed", why || "unknown");
    return Response.json(shapeParse(raw, today));
  }

  if (body.mode === "pick") {
    const input = pickInput(body);
    if (!input) return jsonError(400, "bad_request");
    let why = "";
    const raw = await jsonReply<{ picks: Pick[]; note: string }>(PICK_SYSTEM, input, PICK_SCHEMA, 4000, (w) => (why = w));
    // 실패 이유를 응답 머리에 짧게 남긴다 (브라우저 개발자 도구에서 원인을 볼 수 있게)
    if (!raw || !Array.isArray(raw.picks)) return jsonError(502, "ai_failed", why || "bad_shape");
    const out: PickResult = {
      picks: raw.picks.slice(0, TOP_PICKS).map((p) => ({ n: Number(p.n), reason: body.kind === "stay" ? stayReason(p.reason) : cleanCopy(p.reason, 80) })),
      note: pickNote(raw.note),
    };
    return Response.json(out);
  }

  if (body.mode === "check") {
    const list = (Array.isArray(body.items) ? body.items : []).slice(0, MAX_CHECK).map(readCheckInput);
    if (!list.length || list.some((c) => !c)) return jsonError(400, "bad_request");
    const inputs = list as NonNullable<(typeof list)[number]>[];
    const user = inputs.map((c, i) => `[숙소 ${i + 1}]\n${checkFacts(c)}`).join("\n\n");
    let why = "";
    const raw = await jsonReply<{ items: { pros: string; checks: string[] }[] }>(CHECK_SYSTEM, user, CHECKS_SCHEMA, 1500, (w) => (why = w));
    if (!raw || !Array.isArray(raw.items)) return jsonError(502, "ai_failed", why || "bad_shape");
    return Response.json({ items: inputs.map((c, i) => shapeCheck(raw.items[i] ?? null, c)) });
  }

  if (body.mode === "hotel") {
    const facts = typeof body.facts === "string" ? body.facts.trim().slice(0, 1500) : "";
    const question = str(body.question, 200);
    if (!facts || !question) return jsonError(400, "bad_request");
    let why = "";
    const raw = await jsonReply<{ answer: string }>(HOTEL_SYSTEM, `[숙소 정보]\n${facts}\n\n[질문] ${question}`, HOTEL_SCHEMA, 800, (w) => (why = w));
    if (!raw || typeof raw.answer !== "string") return jsonError(502, "ai_failed", why || "bad_shape");
    return Response.json({ answer: cleanCopy(raw.answer, 400) });
  }

  return jsonError(400, "bad_request");
}

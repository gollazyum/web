// AI 대화 숙소 예산 해석 (2026-11-28 초록 요청 2번). AI 해석 결과보다 이 규칙이 먼저다.
// - "N박, X원 안에서/이하/까지/이내/아래/미만" → 숙박 총액 X
// - "1박에 X원", "1박 X원", "박당 X원", "하룻밤 X원" → 1박 기준 (총액 = X × 박수)
// - 금액만 있고 둘 다 아니면 애매 → "X원은 N박 총액인가요, 1박 기준인가요?"를 되묻는다
export type BudgetRead = { amount: number; basis: "total" | "night" | "unclear"; nights: number | null; label: string };

// "30만 원", "30만원", "300,000원", "30만" (만 단위), "1.5만"
const AMOUNT = /(\d+(?:\.\d+)?)\s*만\s*원?|(\d{1,3}(?:,\d{3})+|\d{5,})\s*원/;
const NIGHT_BEFORE = /(1\s*박|한\s*박|하룻밤|박당|1박당|하루)\s*(에|당|기준|정도)?\s*$/;
const NIGHT_AFTER = /^\s*(씩|짜리)?\s*(\/\s*박|\/\s*1박|1박\s*기준|박당|1박에)/;
const TOTAL_AFTER = /^\s*(안에서|안으로|안|이하|까지|이내|내로|내에서|아래|미만|선에서|밑으로)/;
const TOTAL_BEFORE = /(총|총액|전체|합계|합쳐서|통틀어)\s*$/;

export function readBudget(text: string): BudgetRead | null {
  const t = text.normalize("NFC");
  const m = AMOUNT.exec(t);
  if (!m) return null;
  const amount = m[1] ? Math.round(Number(m[1]) * 10000) : Number(m[2].replace(/,/g, ""));
  if (!Number.isFinite(amount) || amount < 10_000) return null;
  const before = t.slice(Math.max(0, m.index - 8), m.index);
  const after = t.slice(m.index + m[0].length, m.index + m[0].length + 8);
  // 박수: "2박", "2박 3일" (1박에 ○원의 '1박'은 박수로 세지 않는다)
  const n = /(\d+)\s*박(?!\s*(에|당|기준))/.exec(t);
  const nights = n ? Number(n[1]) : null;
  const label = `${(amount / 10000).toLocaleString("ko-KR")}만 원`;
  if (NIGHT_BEFORE.test(before) || NIGHT_AFTER.test(after)) return { amount, basis: "night", nights, label };
  if (TOTAL_AFTER.test(after) || TOTAL_BEFORE.test(before)) return { amount, basis: "total", nights, label };
  return { amount, basis: "unclear", nights, label };
}

// 숙박 총액 예산(원). 1박 기준이면 박수를 곱한다. 애매하거나 박수를 모르면 null
export function totalBudget(b: BudgetRead, nights: number | null): number | null {
  if (b.basis === "total") return b.amount;
  if (b.basis === "night" && nights) return b.amount * nights;
  return null;
}

// 애매할 때 되묻는 질문 (기존 '두 가지만 여쭤볼게요' 질문 칸에 들어간다). 박수를 모르면 만들지 않는다
export function budgetQuestion(b: BudgetRead, nights: number | null): { slot: "budget"; q: string; options: { label: string; value: string }[] } | null {
  if (b.basis !== "unclear" || !nights) return null;
  return {
    slot: "budget",
    q: `${b.label}은 ${nights}박 총액인가요, 1박 기준인가요?`,
    options: [
      { label: `${nights}박 총액 ${b.label}`, value: String(b.amount) },
      { label: `1박 ${b.label}`, value: String(b.amount * nights) },
    ],
  };
}

// 되묻는 질문 수가 바뀌면 "두 가지만 여쭤볼게요"의 숫자도 맞춘다
const COUNT = ["", "한", "두", "세", "네"];
export function fixAskCount(reply: string, n: number): string {
  if (n < 1 || n > 4) return reply;
  if (!/(한|두|세|네)\s*가지만/.test(reply)) return `좋아요! 딱 맞게 찾으려고 ${COUNT[n]} 가지만 여쭤볼게요.`;
  return reply.replace(/(한|두|세|네)\s*가지만/, `${COUNT[n]} 가지만`);
}

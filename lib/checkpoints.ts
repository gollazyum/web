// 솔직 체크포인트: 숙소 하나의 장점 한 줄(pros)과 결제 전에 확인할 점 1~2줄(checks).
// 받은 데이터(위치·성급·평점·후기 주제 점수·편의시설·무료 취소·가격 확인 여부·숙박세 지역)로만 만든다.
// AI(Haiku)가 문장을 다듬고, AI가 없거나 실패하면 이 파일의 규칙 결과를 그대로 쓴다.
// 데이터에 없는 것(소음, 엘리베이터, 방 크기 …)은 쓰지 않는다. 확인 못 한 것은 "결제 화면에서 확인이 필요해요"로만 말한다
import type { HotelOption, ReviewTopic } from "./hotels";
import { topicKo } from "./hotelText";
import { positivePct } from "./prefs";
import { hasBreakfast, hasFreeCancel } from "./stay-filters";
import { cleanCopy, type StayQuery } from "./trip";

export type CheckInput = {
  name: string;
  kind: string;
  stars: number | null;
  rating: number | null;
  reviews: number | null;
  amenities: string[]; // 와이파이는 뺀다 (장점이 되지 않는다)
  near: string; // "난바역까지 도보 5분" (없으면 "")
  freeCancel: boolean; // 무료 취소 가능한 예약처가 있다고 온 경우만 true
  breakfast: boolean; // 편의시설에 조식이 있다고 온 경우만 true (요금 포함 여부는 모른다)
  topics: { name: string; pct: number; total: number }[]; // 후기 주제 (한글 이름, 좋아요 %, 건수)
  taxArea: boolean; // 현장 숙박세가 따로 붙을 수 있는 지역
  price: "verified" | "estimate" | "none"; // 예약처 가격을 확인했는지
};

export type Checkpoints = { pros: string; checks: string[]; ai: boolean };

// 숙박세(현장 결제)가 따로 붙을 수 있는 곳. 장소 이름에 이 말이 들어 있으면 표시한다 ("수 있어요"로만 말한다)
const TAX_AREAS =
  /도쿄|東京|tokyo|오사카|大阪|osaka|교토|京都|kyoto|후쿠오카|福岡|fukuoka|기타큐슈|kitakyushu|가나자와|kanazawa|나가사키|nagasaki|삿포로|札幌|sapporo|홋카이도|北海道|hokkaido|니세코|niseko|오타루|otaru|하코다테|hakodate|히로시마|hiroshima|미야지마|이쓰쿠시마|아타미|atami|구마모토|kumamoto|쿠알라룸푸르|kuala lumpur|말레이시아|malaysia|코타키나발루|kota kinabalu|페낭|penang|랑카위|langkawi|파리|paris|로마|rome|roma|밀라노|milan|베네치아|베니스|venice|피렌체|florence|바르셀로나|barcelona|암스테르담|amsterdam|베를린|berlin|프라하|prague|비엔나|빈|vienna|리스본|lisbon|부다페스트|budapest/i;

export const isTaxArea = (place: string) => TAX_AREAS.test(place.normalize("NFC"));

export const CHECK_TAX = "현장 결제 숙박세가 별도로 부과될 수 있어요";
export const CHECK_CANCEL = "무료 취소 여부는 결제 화면에서 확인이 필요해요";
export const CHECK_BREAKFAST = "조식 포함 여부는 결제 화면에서 확인이 필요해요";
export const CHECK_NO_PRICE = "예약처 가격이 없어 예약 사이트에서 확인이 필요해요";

const NOT_PROS = /와이파이|wi-?fi/i;
const NOTABLE = /온천|대욕장|노천탕|사우나|수영장|피트니스|헬스|키즈|주방|라운지|스파|해변|비치/;

export function checkInput(h: HotelOption, q: StayQuery, opts: { fc?: boolean; price?: CheckInput["price"]; topics?: ReviewTopic[] | null } = {}): CheckInput {
  const topics = (opts.topics ?? [])
    .filter((t) => t.total >= 10)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)
    .map((t) => ({ name: topicKo(t.name), pct: positivePct(t), total: t.total }));
  return {
    name: h.name,
    kind: h.kind,
    stars: h.stars,
    rating: h.rating,
    reviews: h.reviews,
    amenities: h.amenities.filter((a) => !NOT_PROS.test(a)).slice(0, 15),
    near: h.near ? `${h.near.name}까지 ${h.near.how} ${h.near.mins}분` : "",
    freeCancel: hasFreeCancel(h) || !!opts.fc,
    breakfast: hasBreakfast(h),
    topics,
    taxArea: isTaxArea(q.place),
    price: opts.price ?? "estimate",
  };
}

// AI에 넘기는 사실 목록 (이 글에 없는 것은 AI가 쓰지 못하게 한다)
export function checkFacts(c: CheckInput): string {
  return [
    `이름: ${c.name}`,
    `종류: ${[c.kind, c.stars ? `${c.stars}성급` : ""].filter(Boolean).join(", ") || "정보 없음"}`,
    c.rating ? `후기 점수: 5점 만점 ${c.rating.toFixed(1)}${c.reviews ? ` (후기 ${c.reviews}개)` : ""}` : "후기 점수: 정보 없음",
    `위치: ${c.near || "가까운 역까지 시간 정보 없음"}`,
    c.amenities.length ? `편의시설: ${c.amenities.join(", ")}` : "편의시설: 정보 없음",
    c.topics.length ? `후기 주제(좋아요 비율): ${c.topics.map((t) => `${t.name} ${t.pct}% (${t.total}건)`).join(", ")}` : "후기 주제: 정보 없음",
    `무료 취소: ${c.freeCancel ? "가능한 예약처가 있다고 확인됨" : "확인 안 됨"}`,
    `조식: ${c.breakfast ? "편의시설에 조식 있음 (이 요금에 포함인지는 모름)" : "확인 안 됨"}`,
    `숙박세 지역: ${c.taxArea ? "예 (현장 결제 숙박세가 따로 붙을 수 있음)" : "아님"}`,
    `예약처 가격: ${c.price === "verified" ? "확인함" : c.price === "none" ? "받은 예약처 가격 없음" : "아직 확인 전 (예상 금액)"}`,
  ].join("\n");
}

const fmtRating = (r: number) => r.toFixed(1);

export function rulePros(c: CheckInput): string {
  const parts: string[] = [];
  const best = c.topics.filter((t) => t.pct >= 85 && t.total >= 20).sort((a, b) => b.pct - a.pct)[0];
  if (best) parts.push(`후기에서 ${best.name} 좋아요 ${best.pct}%`);
  if (c.near) parts.push(c.near);
  if (parts.length < 2 && c.rating && c.rating >= 4.4) parts.push(`후기 점수 ${fmtRating(c.rating)}점${c.reviews && c.reviews >= 100 ? `(리뷰 ${c.reviews.toLocaleString("ko-KR")}개)` : ""}`);
  const notable = c.amenities.find((a) => NOTABLE.test(a));
  if (parts.length < 2 && notable) parts.push(`${notable} 있음`);
  if (parts.length < 2 && c.stars && c.stars >= 4) parts.push(`${c.stars}성급`);
  return parts.slice(0, 2).join(" · ");
}

export function ruleChecks(c: CheckInput): string[] {
  const out: string[] = [];
  const weak = c.topics.filter((t) => t.pct < 60 && t.total >= 20).sort((a, b) => a.pct - b.pct)[0];
  if (weak) out.push(`후기에서 ${weak.name} 좋아요 비율이 ${weak.pct}%로 낮은 편이에요`);
  else if (c.rating && c.rating < 3.8) out.push(`후기 점수가 ${fmtRating(c.rating)}점이라 최근 후기를 확인해 보세요`);
  if (c.price === "none") out.push(CHECK_NO_PRICE);
  if (c.taxArea) out.push(CHECK_TAX);
  if (!c.freeCancel) out.push(CHECK_CANCEL);
  out.push(CHECK_BREAKFAST);
  return out.slice(0, 2);
}

export const ruleCheckpoints = (c: CheckInput): Checkpoints => ({ pros: rulePros(c), checks: ruleChecks(c), ai: false });

// ---------- AI 답 다듬기 ----------
const MONEY = /\d[\d,.]*\s*(만\s*)?원|예산|저렴|비싸|싸요|가성비|할인|특가/;
const OFF_TOPIC = /와이파이|wi-?fi|지도/i;
// 데이터에 없으면 말할 수 없는 것: 후기 주제에 같은 말이 없으면 버린다
const NEEDS_TOPIC = /소음|시끄|조용|방음|엘리베이터|냄새|벌레|곰팡이|좁|넓|청결|깨끗|친절|직원|침대|욕실|수압/;

function grounded(text: string, c: CheckInput): boolean {
  if (!NEEDS_TOPIC.test(text)) return true;
  return c.topics.some((t) => text.includes(t.name));
}

// 무료 취소·조식이 확인 안 됐는데 "가능/포함"이라고 하면 버린다
function overclaims(text: string, c: CheckInput): boolean {
  if (/확인/.test(text)) return false;
  if (!c.freeCancel && /무료\s*취소/.test(text)) return true;
  if (/조식/.test(text) && /포함/.test(text)) return true;
  return false;
}

function cleanLine(raw: unknown, c: CheckInput, max: number): string {
  const out = cleanCopy(typeof raw === "string" ? raw : "", max).replace(/^[-•·\s]+/, "");
  if (!out || MONEY.test(out) || OFF_TOPIC.test(out) || !grounded(out, c) || overclaims(out, c)) return "";
  return out;
}

const same = (a: string, b: string) => a.replace(/\s/g, "") === b.replace(/\s/g, "");

// AI 답을 검사하고, 빈 칸은 규칙 결과로 채운다. 확인할 점은 최대 2줄
export function shapeCheck(raw: { pros?: unknown; checks?: unknown } | null | undefined, c: CheckInput): Checkpoints {
  const rule = ruleCheckpoints(c);
  if (!raw) return rule;
  const pros = cleanLine(raw.pros, c, 60) || rule.pros;
  const aiChecks = (Array.isArray(raw.checks) ? raw.checks : []).map((x) => cleanLine(x, c, 60)).filter(Boolean);
  const checks: string[] = [];
  for (const x of [...aiChecks, ...rule.checks]) if (checks.length < 2 && !checks.some((y) => same(x, y))) checks.push(x);
  // 숙박세 지역인데 숙박세 이야기가 빠졌으면 둘째 줄을 숙박세로 바꾼다
  if (c.taxArea && !checks.some((x) => /숙박세/.test(x))) checks[Math.min(1, checks.length)] = CHECK_TAX;
  return { pros, checks: checks.slice(0, 2), ai: true };
}

// 캐시 열쇠: 숙소 + 검색 조건 (+ 후기 주제를 받았는지)
export const checkKey = (token: string, q: StayQuery, withTopics: boolean) => [token, q.checkIn, q.checkOut, q.adults, q.rooms ?? 1, withTopics ? "t" : ""].join("|");

// 서버: 화면이 보낸 값을 그대로 믿지 않고 모양·길이를 다시 맞춘다
export function readCheckInput(o: unknown): CheckInput | null {
  if (!o || typeof o !== "object") return null;
  const r = o as Record<string, unknown>;
  const s = (v: unknown, n: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, n) : "");
  const num = (v: unknown, lo: number, hi: number) => (typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi ? v : null);
  const name = s(r.name, 120);
  if (!name) return null;
  const topics = (Array.isArray(r.topics) ? r.topics : [])
    .slice(0, 5)
    .map((t) => (t && typeof t === "object" ? (t as Record<string, unknown>) : {}))
    .map((t) => ({ name: s(t.name, 20), pct: num(t.pct, 0, 100) ?? -1, total: num(t.total, 0, 1e7) ?? 0 }))
    .filter((t) => t.name && t.pct >= 0);
  return {
    name,
    kind: s(r.kind, 30),
    stars: num(r.stars, 1, 5),
    rating: num(r.rating, 0, 5),
    reviews: num(r.reviews, 0, 1e8),
    amenities: (Array.isArray(r.amenities) ? r.amenities : []).map((a) => s(a, 30)).filter(Boolean).slice(0, 15),
    near: s(r.near, 60),
    freeCancel: r.freeCancel === true,
    breakfast: r.breakfast === true,
    topics,
    taxArea: r.taxArea === true,
    price: r.price === "verified" || r.price === "none" ? r.price : "estimate",
  };
}

// 목록 카드의 가격 상태 → 체크포인트 입력값
export const priceState = (p: { verified: boolean; none: boolean }): CheckInput["price"] => (p.none ? "none" : p.verified ? "verified" : "estimate");

// 체크포인트를 만든 뒤 예약처 가격 확인에서 무료 취소가 확인되면, 무료 취소를 확인하라는 줄은 화면에서 뺀다 (카드 사실 줄과 어긋나지 않게)
export function liveChecks(c: Checkpoints, now: { freeCancel?: boolean }): string[] {
  return now.freeCancel ? c.checks.filter((x) => !/무료\s*취소/.test(x)) : c.checks;
}

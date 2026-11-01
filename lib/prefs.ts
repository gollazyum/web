import type { ReviewTopic } from "./hotels";

// '이번 여행에서 제일 중요한 건?' 선호 칩. 누른 칩 이름은 gollazyum:v1.prefs.chips에 그대로 저장한다.
// topic: Google 후기 주제(reviews_breakdown) 이름과 맞춰 볼 말 (한국어·영어 둘 다 올 수 있다)
// amenity: 편의시설 이름과 맞춰 볼 말
export type PrefChip = { id: string; emoji: string; topic?: RegExp; amenity?: RegExp };

export const PREF_CHIPS: PrefChip[] = [
  { id: "가성비", emoji: "💰", topic: /가격|가성비|value|price/i },
  { id: "후기 좋은 곳", emoji: "✨" },
  { id: "4~5성급 고급", emoji: "👑" },
  { id: "조식", emoji: "🥐", topic: /조식|아침|breakfast/i, amenity: /조식|breakfast/i },
  { id: "수영장", emoji: "🏊", topic: /수영장|pool/i, amenity: /수영장|pool/i },
  { id: "위치·교통", emoji: "🚇", topic: /위치|교통|접근|location|transit/i },
  { id: "청결", emoji: "🧹", topic: /청결|깨끗|clean/i },
  { id: "조용함", emoji: "🤫", topic: /소음|조용|noise|quiet/i },
  { id: "방 크기", emoji: "🛏", topic: /객실|방|room/i },
];
export const MAX_CHIPS = 3;

export const chipOf = (id: string) => PREF_CHIPS.find((c) => c.id === id);

// 칩에 맞는 후기 주제 하나 (언급이 가장 많은 것)
export function topicFor(chip: PrefChip, topics: ReviewTopic[] | null): ReviewTopic | null {
  if (!chip.topic || !topics) return null;
  return topics.filter((t) => chip.topic!.test(t.name)).sort((a, b) => b.total - a.total)[0] ?? null;
}

export const positivePct = (t: ReviewTopic) => Math.round((t.positive / t.total) * 100);

// '조식 긍정 83% (35/42건)'
export function topicLine(t: ReviewTopic): string {
  return `긍정 ${positivePct(t)}% (${t.positive}/${t.total}건)`;
}

// 비교·대안 고르기에 쓰는 호텔 숫자
export type Facts = {
  perNight: number | null;
  rating: number | null;
  reviews: number | null;
  stars: number | null;
  amenities: string[];
  topics: ReviewTopic[] | null;
};

// 칩 하나를 이 호텔이 얼마나 맞추는지 0~1. 판단할 데이터가 없으면 null
export function chipScore(chip: PrefChip, h: Facts, cheapest: number | null): number | null {
  const t = topicFor(chip, h.topics);
  switch (chip.id) {
    case "가성비":
      if (h.perNight === null || !cheapest) return null;
      return 0.6 * (cheapest / h.perNight) + 0.4 * ((h.rating ?? 3) / 5);
    case "후기 좋은 곳":
      return h.rating === null ? null : Math.max(0, (h.rating - 3) / 2);
    case "4~5성급 고급":
      return h.stars === null ? null : h.stars >= 4 ? 1 : 0;
  }
  const has = chip.amenity ? h.amenities.some((a) => chip.amenity!.test(a)) : false;
  if (t && t.total >= 3) return (has ? 0.3 : 0) + (has ? 0.7 : 1) * (t.positive / t.total);
  if (chip.amenity) return has ? 1 : 0;
  return null;
}

// 모델 답을 못 받았을 때. 같은 숫자로 순서를 매기고, 이유도 그 숫자만 적는다.
export function compareFallback(hotels: Facts[], chips: string[], budget: number | null): { winner: number; reasons: string[] } {
  if (!hotels.length) return { winner: 0, reasons: ["가격과 후기 점수로 순서를 매겼어요"] };
  const prices = hotels.map((h) => h.perNight).filter((n): n is number => n !== null);
  const cheapest = prices.length ? Math.min(...prices) : null;
  const scores = hotels.map((h) => prefScore(h, chips, budget, cheapest));
  let winner = 0;
  for (let i = 1; i < scores.length; i++) if (scores[i] > scores[winner]) winner = i;
  const w = hotels[winner];
  const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;
  const reasons: string[] = [];
  if (w.perNight !== null && cheapest !== null && w.perNight === cheapest) reasons.push(`분석한 ${hotels.length}곳 중 1박 ${won(w.perNight)}으로 가장 저렴해요`);
  else if (w.perNight !== null && budget && w.perNight <= budget) reasons.push(`1박 ${won(w.perNight)}으로 예산 안에 들어와요`);
  if (w.rating !== null) reasons.push(`후기 ${w.rating.toFixed(1)}점(${(w.reviews ?? 0).toLocaleString("ko-KR")}개)이에요`);
  for (const id of chips) {
    const chip = chipOf(id);
    const topic = chip && topicFor(chip, w.topics);
    if (topic) reasons.push(`${id} 후기 ${topicLine(topic)}예요`);
    else if (chip?.amenity && w.amenities.some((a) => chip.amenity!.test(a))) reasons.push(`${id} 편의시설 표시가 있어요`);
  }
  if (w.stars) reasons.push(`${w.stars}성급 숙소예요`);
  if (!reasons.length) reasons.push("가격과 후기 점수로 순서를 매겼어요");
  return { winner, reasons: reasons.slice(0, 3) };
}

// 예산과 칩을 함께 본 점수. 데이터가 없는 칩은 0.5로 친다
export function prefScore(h: Facts, chips: string[], budget: number | null, cheapest: number | null): number {
  let score = 0;
  for (const id of chips) {
    const chip = chipOf(id);
    if (chip) score += chipScore(chip, h, cheapest) ?? 0.5;
  }
  if (budget && h.perNight !== null && h.perNight > budget) score -= 1 + (h.perNight - budget) / budget;
  if (!chips.length) score += ((h.rating ?? 3) - 3) / 2;
  return score;
}

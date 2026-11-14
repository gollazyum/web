import { scrubKey } from "./serpapi";

// 검색 API 남은 사용량 확인. 계정 조회(account.json)는 검색 횟수를 쓰지 않는 무료 엔드포인트다.
// 하루 한 번 Vercel Cron(vercel.json)이 /api/cron/search-usage 를 부른다.
// 남은 양이 이번 달 제공량의 20% 아래면 서버 로그에 경고를 남긴다. 키 값은 로그에 남기지 않는다.

export const LOW_USAGE_RATIO = 0.2;

export type UsageSummary = { left: number; total: number; ratio: number; low: boolean };

export function summarizeUsage(account: Record<string, unknown>): UsageSummary | null {
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const perMonth = num(account.searches_per_month);
  const extra = num(account.extra_credits) ?? 0;
  const left = num(account.total_searches_left) ?? num(account.plan_searches_left);
  if (perMonth === null || left === null) return null;
  const total = perMonth + extra;
  const ratio = total > 0 ? left / total : 0;
  return { left, total, ratio, low: ratio < LOW_USAGE_RATIO };
}

export async function checkSearchUsage(): Promise<UsageSummary | null> {
  const key = process.env.SERPAPI_API_KEY;
  if (!key) {
    console.warn("[search-usage] 검색 API 키가 설정되지 않았어요");
    return null;
  }
  try {
    const res = await fetch(`https://serpapi.com/account.json?${new URLSearchParams({ api_key: key })}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.error("[search-usage] account 조회 실패", res.status, scrubKey((await res.text()).slice(0, 300)));
      return null;
    }
    const summary = summarizeUsage((await res.json()) as Record<string, unknown>);
    if (!summary) {
      console.error("[search-usage] account 응답에서 남은 사용량을 찾지 못했어요");
      return null;
    }
    const pct = Math.round(summary.ratio * 1000) / 10;
    if (summary.low) console.warn(`[search-usage] 경고: 남은 검색 ${summary.left}/${summary.total} (${pct}%) — 20% 아래로 떨어졌어요`);
    else console.log(`[search-usage] 남은 검색 ${summary.left}/${summary.total} (${pct}%)`);
    return summary;
  } catch (e) {
    console.error("[search-usage] account 조회 오류", scrubKey(e instanceof Error ? `${e.name}: ${e.message}` : String(e)));
    return null;
  }
}

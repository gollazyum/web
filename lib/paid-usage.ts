// 외부 유료 가격 조회 횟수 (Supabase daily_api_usage.paid_check_count, 한국 날짜 기준). 서버에서만 쓴다.
// - 외부 검색 API를 실제로 부를 때만 1번에 +1 한다 (lib/serpapi.ts의 call). 저장된 응답(캐시)을 다시 쓰면 세지 않는다
// - 사용자 검색·숙소 가격 조회·가격 지킴이 크론·'지금 다시 확인' 모두 같은 값에 쌓인다
// - 세기에 실패해도 검색은 그대로 진행한다 (로그만 남긴다)
// Supabase 환경변수가 없으면 아무것도 하지 않는다 (테스트·미리보기 환경)

const supabaseEnv = () => !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

// 한국 날짜 (YYYY-MM-DD)
export function usageDate(now = Date.now()): string {
  return new Date(now + 9 * 3_600_000).toISOString().slice(0, 10);
}

// 하루 유료 가격 조회 상한 (가격 지킴이 크론·'지금 다시 확인'이 이 값을 넘으면 멈춘다). 환경변수 PAID_CHECK_DAILY_CAP으로 바꿀 수 있다
export const DEFAULT_DAILY_CAP = 100;
export function dailyCap(): number {
  const n = Number(process.env.PAID_CHECK_DAILY_CAP);
  return Number.isInteger(n) && n > 0 ? n : DEFAULT_DAILY_CAP;
}

// 유료 호출 1번 기록. 올린 뒤의 오늘 횟수를 돌려준다 (못 세면 null). 절대 던지지 않는다
export async function countPaidCall(engine: string): Promise<number | null> {
  if (!supabaseEnv()) return null;
  try {
    const { rpc } = await import("./supabase-server");
    const n = await rpc<number>("increment_daily_api_usage", { target_date: usageDate(), delta: 1 });
    return typeof n === "number" ? n : null;
  } catch (e) {
    console.error("[paid-usage] count", engine, e instanceof Error ? e.message : e);
    return null;
  }
}

// 오늘 지금까지의 유료 호출 횟수. 못 읽으면 던진다 (상한 검사에서 모르는 채로 유료 호출하지 않게)
export async function paidCountToday(): Promise<number> {
  const { sb } = await import("./supabase-server");
  const rows = await sb<{ paid_check_count: number }[]>(`daily_api_usage?usage_date=eq.${usageDate()}&select=paid_check_count&limit=1`);
  return rows?.[0]?.paid_check_count ?? 0;
}

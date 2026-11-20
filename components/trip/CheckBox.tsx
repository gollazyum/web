import { CHECK_TAX, liveChecks, type Checkpoints } from "@/lib/checkpoints";

// 솔직 체크포인트: 장점 한 줄 + 결제 전 확인 1~2줄. c가 null이면 정리하는 동안 같은 높이의 빈 자리
// fc: 지금 무료 취소가 확인됐는지 (확인됐으면 무료 취소 확인 줄은 뺀다)
export function CheckBox({ c, fc }: { c: Checkpoints | null; fc?: boolean }) {
  if (!c)
    return (
      <section className="tb-honest" aria-busy="true" aria-label="솔직 체크포인트">
        <h3>솔직 체크포인트</h3>
        <p className="tb-honest-wait">받은 정보로 정리하는 중</p>
      </section>
    );
  const checks = liveChecks(c, { freeCancel: fc });
  if (!c.pros && !checks.length) return null;
  return (
    <section className="tb-honest" aria-label="솔직 체크포인트">
      <h3>솔직 체크포인트</h3>
      {c.pros && (
        <p className="tb-honest-pro">
          <b>좋은 점</b>
          <span>{c.pros}</span>
        </p>
      )}
      {checks.length > 0 && (
        <ul className="tb-honest-list">
          {checks.map((x) => (
            <li key={x}>
              <b>확인</b>
              <span>{x}</span>
            </li>
          ))}
        </ul>
      )}
      <small>{c.ai ? "AI가 받은 정보로만 정리했어요. 없는 정보는 지어내지 않아요." : "받은 정보로만 정리했어요."}</small>
    </section>
  );
}

// 추천 카드용 한 줄: 결제 전에 확인할 점 하나. 지역 전체에 같은 숙박세 안내보다 그 숙소만의 점을 먼저 (숙박세는 상세에서 보인다)
export function CheckLine({ c, fc }: { c?: Checkpoints; fc?: boolean }) {
  const checks = c ? liveChecks(c, { freeCancel: fc }) : [];
  const first = checks.find((x) => x !== CHECK_TAX) ?? checks[0];
  if (!first) return null;
  return (
    <span className="tb-honest-line">
      <b>확인</b> {first}
    </span>
  );
}

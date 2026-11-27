import { anyPartnerOn, PARTNER } from "./affiliateLinks";

// 숙소 예약 링크 제휴 설정은 lib/affiliateLinks.ts 의 환경변수에서만 켠다 (저장소에 값을 적지 않는다).
// 아고다: NEXT_PUBLIC_AGODA_CID에 아고다 파트너스 사이트 ID를 넣으면 cid와 rel="sponsored"가 붙는다
export const AGODA_CID: string = PARTNER.agoda;
export const AGODA_AFFILIATE_ENABLED: boolean = AGODA_CID !== "";

export function agodaAffiliateOn(): boolean {
  return AGODA_AFFILIATE_ENABLED;
}

// 제휴 코드가 붙는 예약처가 하나라도 있으면 제휴 고지를 보인다
export const affiliateNoticeOn = anyPartnerOn;

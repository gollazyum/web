// 숙소 예약 링크 제휴 설정. 지금은 꺼 둔다.
// 켜려면 AGODA_AFFILIATE_ENABLED를 true로, AGODA_CID에 아고다 파트너스 사이트 ID를 넣는다.
// 둘 다 갖춰져야만 아고다 링크에 cid와 rel="sponsored"가 붙고, '제휴' 꼬리표와 제휴 고지가 보인다.
export const AGODA_AFFILIATE_ENABLED: boolean = false;
export const AGODA_CID: string = "";

export function agodaAffiliateOn(): boolean {
  return AGODA_AFFILIATE_ENABLED && AGODA_CID.trim() !== "";
}

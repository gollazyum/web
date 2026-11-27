import type { HotelSellerKey } from "./hotel-sellers";

// 예약처로 가는 모든 주소를 만드는 단일 함수 (제휴 코드·한국어·원화).
// 제휴 코드는 환경변수로만 넣는다 (저장소에 값을 적지 않는다). 비어 있으면 손대지 않은 순수 직링크로 연결한다.
// 링크는 화면(브라우저)에서도 만들기 때문에 NEXT_PUBLIC_ 이름이어야 화면에 들어간다.
//
//   아고다       NEXT_PUBLIC_AGODA_CID                         → cid
//   부킹닷컴     NEXT_PUBLIC_BOOKING_AID                       → aid
//   트립닷컴     NEXT_PUBLIC_TRIP_ALLIANCE_ID + NEXT_PUBLIC_TRIP_SID → Allianceid, SID
//   클룩         NEXT_PUBLIC_KLOOK_AID                         → aid
//   여기어때     NEXT_PUBLIC_YEOGI_AFFILIATE_ID + NEXT_PUBLIC_YEOGI_DEEPLINK_TEMPLATE
//   마이리얼트립 NEXT_PUBLIC_MYREALTRIP_PARTNER_ID + NEXT_PUBLIC_MYREALTRIP_DEEPLINK_TEMPLATE
//
// 여기어때·마이리얼트립은 파트너 화면에서 받은 딥링크 모양을 그대로 템플릿에 넣는다 ({id}·{url} 자리 표시, url은 인코딩해서 넣는다).
// 예: https://partner.example.com/click?pid={id}&target={url}. 템플릿이 없으면 파라미터 이름을 짐작해 붙이지 않고 직링크로 둔다

export type HotelContext = { checkIn: string; checkOut: string; adults: number; rooms?: number; childAges?: number[] };

const env = (v: string | undefined) => (v ?? "").trim();

// 한 번에 읽어 둔다 (NEXT_PUBLIC_ 값은 빌드 때 글자로 바뀐다)
export const PARTNER = {
  agoda: env(process.env.NEXT_PUBLIC_AGODA_CID) || env(process.env.AGODA_CID),
  booking: env(process.env.NEXT_PUBLIC_BOOKING_AID),
  tripAlliance: env(process.env.NEXT_PUBLIC_TRIP_ALLIANCE_ID),
  tripSid: env(process.env.NEXT_PUBLIC_TRIP_SID),
  klook: env(process.env.NEXT_PUBLIC_KLOOK_AID),
  yeogi: env(process.env.NEXT_PUBLIC_YEOGI_AFFILIATE_ID),
  yeogiTpl: env(process.env.NEXT_PUBLIC_YEOGI_DEEPLINK_TEMPLATE),
  mrt: env(process.env.NEXT_PUBLIC_MYREALTRIP_PARTNER_ID),
  mrtTpl: env(process.env.NEXT_PUBLIC_MYREALTRIP_DEEPLINK_TEMPLATE),
};

// 이 예약처 링크에 제휴 코드가 붙는지 (rel="sponsored"·제휴 고지에 쓴다)
export function partnerOn(key: HotelSellerKey | null | undefined): boolean {
  switch (key) {
    case "agoda":
      return !!PARTNER.agoda;
    case "booking":
      return !!PARTNER.booking;
    case "trip":
      return !!PARTNER.tripAlliance && !!PARTNER.tripSid;
    case "klook":
      return !!PARTNER.klook;
    case "yeogi":
      return !!PARTNER.yeogi && PARTNER.yeogiTpl.includes("{url}");
    case "myrealtrip":
      return !!PARTNER.mrt && PARTNER.mrtTpl.includes("{url}");
    default:
      return false;
  }
}

export const anyPartnerOn = () => (["agoda", "booking", "trip", "klook", "yeogi", "myrealtrip"] as HotelSellerKey[]).some(partnerOn);

const fillTpl = (tpl: string, id: string, url: string) => tpl.replaceAll("{id}", encodeURIComponent(id)).replaceAll("{url}", encodeURIComponent(url));

// Google을 거쳐 가는 주소(google.com, google.co.kr …)인지
export function isGoogleHost(host: string): boolean {
  return /(^|\.)google\.[a-z.]+$/.test(host);
}

// rawUrl: 예약처 직링크 또는 그 예약처의 검색 주소. 못 읽거나 http(s)가 아니거나 Google을 거치는 주소면 ""를 돌려준다 (부르는 쪽이 검색 주소로 바꾼다)
export function buildPartnerBookingUrl(vendorKey: HotelSellerKey, rawUrl: string, hotelContext?: HotelContext): string {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return "";
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return "";
  const host = url.hostname.toLowerCase();
  if (isGoogleHost(host)) return "";
  const on = (domain: string) => host === domain || host.endsWith(`.${domain}`);
  const p = url.searchParams;
  if (p.has("userCountry")) p.set("userCountry", "KR");
  // 주소 맨 앞의 언어 칸(/en-us/, /en/ …)을 바꾼다
  const relocale = (to: string) => {
    const parts = url.pathname.split("/");
    if (/^[a-z]{2}(-[a-z]{2,4})?$/i.test(parts[1] ?? "")) parts[1] = to;
    url.pathname = parts.join("/");
  };
  if (vendorKey === "agoda" && on("agoda.com")) {
    relocale("ko-kr");
    p.delete("tag");
    // 제휴 코드가 없으면 원래 붙어 온 cid도 뺀다
    if (PARTNER.agoda) p.set("cid", PARTNER.agoda);
    else p.delete("cid");
    p.set("currencyCode", "KRW");
  } else if (vendorKey === "trip" && on("trip.com")) {
    // 트립닷컴은 주소의 locale보다 사이트 주소(www·us…)를 따른다. 한국 사이트로 보낸다
    url.hostname = "kr.trip.com";
    p.set("locale", "ko-KR");
    p.set("curr", "KRW");
    if (partnerOn("trip")) {
      p.set("Allianceid", PARTNER.tripAlliance);
      p.set("SID", PARTNER.tripSid);
    }
  } else if (vendorKey === "booking" && on("booking.com")) {
    p.set("lang", "ko");
    p.set("selected_currency", "KRW");
    if (PARTNER.booking) p.set("aid", PARTNER.booking);
  } else if (vendorKey === "hotels" && on("hotels.com")) {
    p.set("locale", "ko_KR");
    p.set("currency", "KRW");
  } else if (vendorKey === "klook" && on("klook.com")) {
    if (PARTNER.klook) p.set("aid", PARTNER.klook);
  }
  // 날짜가 빠진 예약처 직링크는 건드리지 않는다 (예약처마다 날짜 칸 이름이 달라 짐작하지 않는다)
  void hotelContext;
  const out = url.toString();
  if (vendorKey === "yeogi" && partnerOn("yeogi")) return fillTpl(PARTNER.yeogiTpl, PARTNER.yeogi, out);
  if (vendorKey === "myrealtrip" && partnerOn("myrealtrip")) return fillTpl(PARTNER.mrtTpl, PARTNER.mrt, out);
  return out;
}

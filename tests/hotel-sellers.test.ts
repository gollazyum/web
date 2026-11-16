import { describe, expect, it } from "vitest";
import { AGODA_AFFILIATE_ENABLED, AGODA_CID } from "@/lib/affiliate";
import { allowedSellers, anySellerKey, hotelSellerKey, HOTEL_SELLERS_SHOWN, isGoogleLink, linkRel, withRo } from "@/lib/hotel-sellers";
import { agodaSearchUrl, bookingLink, roboPick, type HotelSource } from "@/lib/hotels";

const q = { q: "도쿄", checkIn: "2026-12-10", checkOut: "2026-12-12", adults: 2 };
const src = (name: string, perNight: number, extra: Partial<HotelSource> = {}): HotelSource => ({
  name,
  logo: "",
  perNight,
  total: perNight * 2,
  link: "https://www.google.com/travel/lodging/clk?pc=abc",
  official: false,
  ...extra,
});

describe("숙소 판매처 허용 목록", () => {
  it("여러 표기를 같은 판매처로 맞춘다", () => {
    expect(hotelSellerKey("Agoda")).toBe("agoda");
    expect(hotelSellerKey("아고다")).toBe("agoda");
    expect(hotelSellerKey("Trip.com")).toBe("trip");
    expect(hotelSellerKey("트립닷컴")).toBe("trip");
    expect(hotelSellerKey("Expedia.co.kr")).toBe("expedia");
    expect(hotelSellerKey("Hoteles.com")).toBe("hotels");
    expect(hotelSellerKey("hotels . com")).toBe("hotels");
    expect(hotelSellerKey("야놀자")).toBe("yanolja");
    expect(hotelSellerKey("여기어때")).toBe("yeogi");
    expect(hotelSellerKey("Booking.com")).toBe("booking");
    expect(hotelSellerKey("부킹닷컴")).toBe("booking");
    expect(hotelSellerKey("NOL 인터파크")).toBe("interpark");
    expect(hotelSellerKey("NOL")).toBe("interpark");
    expect(hotelSellerKey("MyRealTrip")).toBe("myrealtrip");
    expect(hotelSellerKey("마이리얼트립")).toBe("myrealtrip");
  });

  it("허용한 10곳(공식 사이트 포함)을 모두 보여 준다", () => {
    expect(HOTEL_SELLERS_SHOWN).toHaveLength(10);
    expect(hotelSellerKey("Hilton Official Site")).toBe("official");
    expect(hotelSellerKey("HOTEL MYSTAYS Asakusabashi", true)).toBe("official");
  });

  it("공식 사이트는 플래그나 키워드로 판별한다", () => {
    expect(anySellerKey("HOTEL MYSTAYS Asakusabashi", true)).toBe("official");
    expect(anySellerKey("Hilton Official Site")).toBe("official");
    expect(anySellerKey("신라호텔 공식")).toBe("official");
  });

  it("목록 밖 판매처는 뺀다", () => {
    for (const n of ["Bluepillow.co.uk", "Bluepillow.mx", "Tripening Hotels", "JAPANiCAN.com", "Qantas Hotels", "EaseMyTrip.com", "goseek.com", "Rakuten Oyado", "Hotel prive", "Reserving"])
      expect(hotelSellerKey(n), n).toBeNull();
  });

  it("거른 뒤 이름을 표준 이름으로 바꾸고 같은 곳은 싼 쪽만 남긴다", () => {
    const out = allowedSellers([src("Bluepillow.co.uk", 90000), src("Agoda", 120000), src("Agoda", 110000), src("Hoteles.com", 130000)]);
    expect(out.map((s) => [s.name, s.perNight])).toEqual([
      ["Agoda", 110000],
      ["Hotels.com", 130000],
    ]);
    // 최저가도 걸러진 목록 기준
    expect(roboPick(out)).toBe("Agoda");
  });
});

describe("예약 링크", () => {
  it("google 주소는 쓰지 않고 판매처 검색 주소로 보낸다", () => {
    for (const n of ["Agoda", "Trip.com", "Expedia", "Hotels.com", "Booking.com", "야놀자", "여기어때", "NOL 인터파크", "마이리얼트립"]) {
      const link = bookingLink(src(n, 1000), "Hotel Mystays", q);
      expect(link, n).not.toBe("");
      expect(isGoogleLink(link), `${n} ${link}`).toBe(false);
      expect(link, n).toContain(encodeURIComponent("Hotel Mystays").slice(0, 5));
    }
    expect(bookingLink(src("Some Hotel", 1000, { official: true }), "Some Hotel", q)).toBe("");
  });

  it("직링크가 있으면 그 주소를 쓴다", () => {
    const link = bookingLink(src("Hotels.com", 1000, { link: "https://kr.hotels.com/ho123/?x=1" }), "X", q);
    expect(link.startsWith("https://kr.hotels.com/ho123/")).toBe(true);
  });

  it("목록 밖 판매처는 링크가 없다", () => {
    expect(bookingLink(src("Bluepillow.mx", 1000), "X", q)).toBe("");
  });
});

describe("제휴 설정 (기본 꺼짐)", () => {
  it("기본값", () => {
    expect(AGODA_AFFILIATE_ENABLED).toBe(false);
    expect(AGODA_CID).toBe("");
  });
  it("꺼져 있으면 아고다 링크에 cid와 sponsored가 없다", () => {
    expect(agodaSearchUrl("X", q)).not.toContain("cid=");
    const direct = bookingLink(src("Agoda", 1000, { link: "https://www.agoda.com/en-us/x/hotel/tokyo-jp.html?cid=999" }), "X", q);
    expect(direct).not.toContain("cid=");
    expect(direct).toContain("/ko-kr/");
    expect(linkRel("agoda")).toBe("noopener noreferrer");
  });
});

describe("(으)로", () => {
  it("받침에 맞춘다", () => {
    expect(withRo("Agoda")).toBe("Agoda로");
    expect(withRo("Trip.com")).toBe("Trip.com으로");
    expect(withRo("Hotels.com")).toBe("Hotels.com으로");
    expect(withRo("야놀자")).toBe("야놀자로");
    expect(withRo("인터파크")).toBe("인터파크로");
    expect(withRo("여기어때")).toBe("여기어때로");
    expect(withRo("호텔 공식 사이트")).toBe("호텔 공식 사이트로");
  });
});

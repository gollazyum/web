import { describe, expect, it } from "vitest";
import { maskText, shapeParsed, vendorKey } from "@/lib/booking-parse";
import { matchTerm, sameHotelName } from "@/lib/booking-match";

const KEYS = ["agoda", "trip", "booking", "hotels", "expedia", "myrealtrip", "official"];

describe("예약 내역 개인정보 가리기", () => {
  it("이메일·전화번호·카드번호를 가리고 날짜·금액은 남긴다", () => {
    const t = maskText("hong.gd@naver.com 010-1234-5678 +81 3-1234-5678 4111 1111 1111 1111 체크인 2026-12-20 총액 320,000원");
    expect(t).not.toMatch(/naver\.com|1234-5678|4111/);
    expect(t).toContain("[이메일]");
    expect(t).toContain("[카드번호]");
    expect(t).toContain("2026-12-20");
    expect(t).toContain("320,000원");
  });
});

describe("AI 응답 다듬기", () => {
  const base = { is_hotel_booking: true, hotel_name: "호텔 그레이스리 신주쿠", city: "도쿄", check_in: "2026-12-20", check_out: "2026-12-22", adults: 2, total_price: 320000, currency: "KRW", vendor: "Agoda", free_cancel_until: "2026-12-18T23:59", refundable: true };
  it("숙소 예약이 아니면 null", () => {
    expect(shapeParsed({ ...base, is_hotel_booking: false }, KEYS)).toBeNull();
  });
  it("원화 총액·예약처 키·날짜를 맞춘다", () => {
    const b = shapeParsed(base, KEYS)!;
    expect(b).toMatchObject({ hotelName: "호텔 그레이스리 신주쿠", totalKrw: 320000, vendor: "agoda", checkOut: "2026-12-22", freeCancelUntil: "2026-12-18T23:59" });
    expect(b).not.toHaveProperty("guestName");
  });
  it("원화가 아니면 총액을 비운다", () => {
    expect(shapeParsed({ ...base, total_price: 35000, currency: "JPY" }, KEYS)!.totalKrw).toBeNull();
  });
  it("체크아웃이 체크인보다 앞이면 비운다", () => {
    expect(shapeParsed({ ...base, check_out: "2026-12-19" }, KEYS)!.checkOut).toBeNull();
  });
  it("마이리얼트립을 트립닷컴으로 잘못 보지 않는다", () => {
    expect(vendorKey("myrealtrip.com", KEYS)).toBe("myrealtrip");
    expect(vendorKey("Trip.com", KEYS)).toBe("trip");
  });
});

describe("숙소 이름 연결", () => {
  it("필터를 깨는 글자를 뺀다", () => {
    expect(matchTerm("Hotel (Shinjuku), *test*")).toBe("Hotel Shinjuku test");
    expect(matchTerm("a")).toBeNull();
  });
  it("공백·대소문자 무시, 짧은 이름은 통째 포함만으로 같다고 보지 않는다", () => {
    expect(sameHotelName("Hotel Gracery Shinjuku", "hotel gracery  shinjuku")).toBe(true);
    expect(sameHotelName("호텔 그레이스리 신주쿠", "호텔 그레이스리 신주쿠 (Hotel Gracery)")).toBe(true);
    expect(sameHotelName("호텔", "호텔 그레이스리 신주쿠")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { fitsParty, partyFitText, soloOnly } from "@/lib/room-fit";

describe("room fit", () => {
  it("capsule and dorm stays are solo-only", () => {
    expect(soloOnly({ name: "Nine Hours Shinjuku Capsule" })).toBe(true);
    expect(soloOnly({ name: "Sakura Hostel", kind: "도미토리" })).toBe(true);
    expect(soloOnly({ name: "K's House Dorm" })).toBe(true);
    expect(soloOnly({ name: "Dormy Inn Akihabara" })).toBe(false);
    expect(soloOnly({ name: "Hotel Gracery", kind: "호텔" })).toBe(false);
  });
  it("only filters with 2+ adults", () => {
    expect(fitsParty({ name: "Capsule A" }, 1)).toBe(true);
    expect(fitsParty({ name: "Capsule A" }, 2)).toBe(false);
  });
  it("condition text", () => {
    expect(partyFitText(1)).toBeNull();
    expect(partyFitText(2)).toBe("2인 객실 있음");
    expect(partyFitText(4, 2)).toBe("4인 · 객실 2개 있음");
  });
});

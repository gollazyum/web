import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { searchCities } from "@/lib/airports";

const data = JSON.parse(readFileSync("public/airports.json", "utf8"));

describe("숙소 검색창: 공항·도시 코드를 도시로", () => {
  it("KIX → 오사카, NRT → 도쿄, OSA → 오사카", () => {
    expect(searchCities(data, "KIX")[0].name).toBe("오사카");
    expect(searchCities(data, "nrt")[0].name).toBe("도쿄");
    expect(searchCities(data, "OSA")[0].name).toBe("오사카");
  });
  it("한글 도시 이름은 그대로", () => {
    expect(searchCities(data, "후쿠오카")[0].name).toBe("후쿠오카");
  });
});

import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { lookupProduct } from "@/lib/shop-preview";

// 없는 페이지·오류 화면 (2026-11-07 초록 요청)
describe("상품 주소 확인", () => {
  it("검색 결과에 있는 상품은 found, 없는 상품은 missing", async () => {
    // 키가 없으면 /api/shopping 과 같은 예시 데이터로 판단한다
    vi.stubEnv("SERPAPI_API_KEY", "");
    expect((await lookupProduct("아이폰 17", "sample-2", "")).status).toBe("found");
    expect((await lookupProduct("아이폰 17", "no-such-token", "")).status).toBe("missing");
    expect((await lookupProduct("아이폰 17", "", "999999999")).status).toBe("missing");
    vi.unstubAllEnvs();
  });
});

describe("없는 페이지·오류 화면", () => {
  const read = (p: string) => readFileSync(p, "utf8");

  it("필요한 파일이 하나씩만 있다", () => {
    for (const p of ["app/not-found.tsx", "app/error.tsx", "app/global-error.tsx", "app/shop/product/not-found.tsx"]) expect(existsSync(p), p).toBe(true);
  });

  it("404 화면: 안내 문구, 세 링크, 제목, noindex", () => {
    const s = read("app/not-found.tsx");
    expect(s).toContain("찾으시는 페이지가 없어요. 주소가 바뀌었거나 삭제됐을 수 있어요.");
    for (const [href, label] of [["/", "홈으로"], ["/shop", "쇼핑 둘러보기"], ["/hotels", "숙소 찾기"]]) {
      expect(s).toMatch(new RegExp(`href="${href}"[^>]*>\\s*${label}`));
    }
    expect(s).toContain('title: "페이지를 찾을 수 없어요"');
    expect(s).toContain("index: false");
  });

  it("오류 화면: 안내, reset() 다시 시도, 홈 링크, 오류 내용 노출 없음", () => {
    for (const p of ["app/error.tsx", "app/global-error.tsx"]) {
      const s = read(p);
      expect(s, p).toContain("잠시 문제가 생겼어요");
      expect(s, p).toMatch(/onClick=\{retry\}[^>]*>\s*다시 시도/);
      expect(s, p).toMatch(/const retry = \(\) =>[\s\S]*?reset\(\);/);
      expect(s, p).toMatch(/href="\/"[^>]*>\s*홈으로/);
      expect(s, p).not.toMatch(/\{\s*error\.(message|stack|digest)/);
    }
  });

  it("global-error는 html·body를 직접 그리고 레이아웃의 CSS·컴포넌트를 불러오지 않는다", () => {
    const s = read("app/global-error.tsx");
    expect(s).toContain('<html lang="ko">');
    expect(s).toContain("<body>");
    expect(s).not.toMatch(/^import .*(\.css|@\/components)/m);
  });
});

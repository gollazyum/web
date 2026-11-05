import { describe, expect, it } from "vitest";
import { findBannedWords, SHOP_RESULTS_COPY } from "@/lib/brand-mode";
import { accessoryTest, classifyItems, matchOrder, matchTerms, normalizeText, splitMain } from "@/lib/shop-match";
import { shapeSearch } from "@/lib/shopping";

// 상품명과 가격은 2026-11-05에 받은 실제 검색 결과에서 가져왔다 (순서도 받은 순서 그대로)
const it_ = (title: string, price: number | null) => ({ title, price });

const AIRPODS = [
  it_("MILK JOIE-BLACK(에어팟프로-하드) 2세대", 11900),
  it_("애플 에어팟 프로 2세대 풀박스", 142000),
  it_("애플 에어팟프로2 테라가드 얼티메이트", 17900),
  it_("[에어팟프로/프로2세대 하드] 말장난 에어팟프로-잼", 10000),
  it_("AirPods Pro 2nd Gen", 69000),
  it_("에어팟 프로2 c타입", 135000),
  it_("LAZY COVY-ORANGE(에어팟프로-하드) 2세대", 11900),
  it_("[샤론6] 에어팟프로2/프로 쉴라레터", 14900),
  it_("에어팟프로2 미개봉", 220000),
  it_("Apple AirPods Pro", 346000),
  it_("애플 에어팟 프로 2세대 맥세이프 호환 USB C 타입 (국내 정식 발매 제품) MTJV3KH/A ONE SIZE", 299000),
  it_("에어팟 프로2 전용 실리콘 케이스", 9900),
  it_("에어팟 프로 2세대", 200000),
  it_("에어팟프로2용 이어팁 3쌍", 6900),
  it_("Apple AirPods Max 2", 849000),
];

const IPHONE_CASES = [
  it_("Apple MagSafe형 iPhone 16 실리콘 케이스 –", 79000),
  it_("아이폰16 행운 클로버 투명 카드 케이스", 10800),
  it_("아이폰16 네온 펑크 TPU 범퍼 케이스", 16800),
  it_("아이폰 16 강화유리 보호필름 2매", 8900),
  it_("아이폰16 케이스 투명 맥세이프 에어스킨원탭메탈링맥핏", 27900),
  it_("아이폰16 플러스 케이스 투명 젤리 맥세이프 리퀴드크리스탈맥핏", 24900),
  it_("아이폰 16 호환 하드 케이스", 12900),
  it_("Apple 아이폰 16 128GB 자급제", 1250000),
];

const BUDS = [
  it_("아라리 갤럭시 버즈3 / 버즈3 프로 케이스 실리콘 팝스", 10800),
  it_("Samsung Galaxy Buds3 Pro 무선 이어폰", 174770),
  it_("갤럭시 버즈3 갤럭시 버즈3 프로 FE 케이스 누킨 화이트", 12500),
  it_("[삼성전자] 갤럭시 버즈3 FE 블루투스 이어폰 [SM-R420N] [그레이]", 135150),
  it_("SLBS HERSHEY’S KISSES Case For Galaxy Buds3 | Buds3 Pro", 36900),
  it_("삼성 갤럭시 버즈3 프로 AI 트루 노이즈 캔슬링 블루투스 이어폰", 276500),
  it_("갤럭시 버즈3/버즈3 프로 적용 투명 실리콘 케이스 자동 잠금 스위치 풀커버 케이스 호환", 12900),
  it_("삼성전자 갤럭시 버즈 3 FE R420 노이즈캔슬링 ANC 블루투스 무선 이어폰", 113000),
  it_("갤럭시 버즈3 프로 케이스 비저블 캐리어 케이스", 7900),
  it_("갤럭시버즈3FE 무선 블루투스 이어폰 SM-R420", 159000),
  it_("Samsung Galaxy Buds2 Pro", 129000),
];

describe("(1) 검색어 정리", () => {
  it("띄어쓰기·대소문자·한글/영어 표기를 하나로 맞춘다", () => {
    expect(normalizeText("에어팟프로2")).toBe("airpods pro 2");
    expect(normalizeText("에어팟 프로 2")).toBe("airpods pro 2");
    expect(normalizeText("AirPods Pro 2")).toBe("airpods pro 2");
    expect(normalizeText("아이폰16")).toBe(normalizeText("iPhone 16"));
    expect(normalizeText("갤럭시 버즈3")).toBe(normalizeText("Galaxy Buds 3"));
  });

  it("숫자는 덩어리째 맞아야 한다 ('2'가 '256GB'·'2024' 안에 있어도 맞지 않는다)", () => {
    expect(matchTerms("에어팟프로2", "AirPods Pro 2nd Gen")).toEqual({ matched: 3, total: 3 });
    expect(matchTerms("에어팟프로2", "Apple AirPods Pro 2024 256GB")).toEqual({ matched: 2, total: 3 });
  });
});

describe("(2) 본품과 액세서리 나누기", () => {
  it("검색어에 없는 액세서리 말이 상품명에 있으면 액세서리", () => {
    const acc = accessoryTest("에어팟프로2");
    expect(acc("에어팟 프로2 전용 실리콘 케이스")).toBe(true);
    expect(acc("에어팟프로2용 이어팁 3쌍")).toBe(true);
    expect(acc("에어팟 프로 2 호환 충전 케이블")).toBe(true);
    expect(acc("Clear Case for AirPods Pro 2")).toBe(true);
    expect(acc("애플 에어팟 프로 2세대 풀박스")).toBe(false);
  });

  it("'여행용 캐리어'의 '용'은 액세서리 표시가 아니다 (모델명 뒤의 '~용'만 본다)", () => {
    expect(accessoryTest("캐리어")("여행용 캐리어 24인치")).toBe(false);
    expect(accessoryTest("아이폰")("아이폰16용 거치대")).toBe(true);
    expect(accessoryTest("보조배터리")("20000mAh 대용량 보조배터리")).toBe(false);
  });

  it("검색어에 '케이스'가 있으면 케이스(같은 갈래의 하드·젤리·범퍼 포함)는 액세서리로 빼지 않는다. 다른 갈래(필름)는 뺀다", () => {
    const acc = accessoryTest("아이폰 16 케이스");
    expect(acc("아이폰 16 호환 하드 케이스")).toBe(false);
    expect(acc("아이폰16 네온 펑크 TPU 범퍼 케이스")).toBe(false);
    expect(acc("아이폰 16 강화유리 보호필름 2매")).toBe(true);
  });
});

describe("(3)(4) 가격 거르기와 관련도순", () => {
  it("'에어팟프로2': 상위 5개가 모두 본품이고, 액세서리는 맨 뒤", () => {
    const order = matchOrder(AIRPODS, "에어팟프로2");
    const top5 = order.slice(0, 5);
    expect(top5.every((x) => !x.accessory)).toBe(true);
    expect(top5.map((x) => x.title)).toEqual([
      "애플 에어팟 프로 2세대 풀박스",
      "AirPods Pro 2nd Gen",
      "에어팟 프로2 c타입",
      "에어팟프로2 미개봉",
      "애플 에어팟 프로 2세대 맥세이프 호환 USB C 타입 (국내 정식 발매 제품) MTJV3KH/A ONE SIZE",
    ]);
    // 액세서리는 모두 본품 뒤에
    const firstAcc = order.findIndex((x) => x.accessory);
    expect(order.slice(firstAcc).every((x) => x.accessory)).toBe(true);
    expect(order.filter((x) => x.accessory).map((x) => x.title)).toEqual(
      expect.arrayContaining(["MILK JOIE-BLACK(에어팟프로-하드) 2세대", "애플 에어팟프로2 테라가드 얼티메이트", "에어팟 프로2 전용 실리콘 케이스", "에어팟프로2용 이어팁 3쌍"]),
    );
  });

  it("'에어팟프로2': 낱말이 모두 맞는 본품이 일부만 맞는 본품(AirPods Pro, AirPods Max 2)보다 먼저", () => {
    const main = matchOrder(AIRPODS, "에어팟프로2").filter((x) => !x.accessory).map((x) => x.title);
    expect(main.slice(-2)).toEqual(["Apple AirPods Pro", "Apple AirPods Max 2"]);
  });

  it("단어가 없는 싼 상품도 본품 가격 중앙값의 30%보다 싸면 액세서리 ('테라가드 얼티메이트' 17,900원)", () => {
    const info = classifyItems(AIRPODS, "에어팟프로2");
    expect(info[AIRPODS.findIndex((x) => x.title.includes("테라가드"))].accessory).toBe(true);
  });

  it("'아이폰 16 케이스': 케이스가 본품으로 나오고, 보호필름은 액세서리", () => {
    const order = matchOrder(IPHONE_CASES, "아이폰 16 케이스");
    const cases = order.filter((x) => x.title.includes("케이스"));
    expect(cases.length).toBe(6);
    expect(cases.every((x) => !x.accessory)).toBe(true);
    expect(order.slice(0, 5).every((x) => x.title.includes("케이스"))).toBe(true);
    expect(order.find((x) => x.title.includes("보호필름"))?.accessory).toBe(true);
    // 휴대폰 본체는 '케이스'가 맞지 않아 케이스 뒤로 간다 (빼지는 않는다)
    expect(order.findIndex((x) => x.title.includes("자급제"))).toBeGreaterThan(5);
  });

  it("'갤럭시 버즈3': 상위 5개가 모두 버즈3 본품, 케이스는 모두 액세서리, 버즈2는 일부만 맞아 뒤로", () => {
    const order = matchOrder(BUDS, "갤럭시 버즈3");
    expect(order.slice(0, 5).every((x) => !x.accessory && /버즈\s?3|buds3/i.test(x.title))).toBe(true);
    expect(order.filter((x) => /케이스|case/i.test(x.title)).every((x) => x.accessory)).toBe(true);
    const main = order.filter((x) => !x.accessory);
    expect(main[main.length - 1].title).toBe("Samsung Galaxy Buds2 Pro");
  });

  it("모두 액세서리로 나오면 나누지 않는다 (빈 목록 방지)", () => {
    const info = classifyItems([it_("에어팟 케이스 A", 9000), it_("에어팟 케이스 B", 12000)], "에어팟");
    expect(info.every((x) => !x.accessory)).toBe(true);
  });
});

describe("검색 결과 응답과 화면", () => {
  it("shapeSearch가 액세서리에 accessory 표시를 붙이고 맨 뒤로 보낸다", () => {
    const json = {
      shopping_results: AIRPODS.map((x, i) => ({ title: x.title, extracted_price: x.price, source: "판매처", product_id: String(i + 1), link: `https://example.com/${i}` })),
    };
    const { items } = shapeSearch(json, "에어팟프로2");
    const firstAcc = items.findIndex((x) => x.accessory);
    expect(firstAcc).toBeGreaterThanOrEqual(5);
    expect(items.slice(firstAcc).every((x) => x.accessory)).toBe(true);
    const { main, accessories } = splitMain(items);
    expect(main.length + accessories.length).toBe(items.length);
  });

  it("'본품만'·'관련 액세서리' 문구에 금지어가 없다", () => {
    expect(findBannedWords(SHOP_RESULTS_COPY.mainOnlyChip, true)).toEqual([]);
    expect(findBannedWords(SHOP_RESULTS_COPY.accessoryGroup, true)).toEqual([]);
  });
});

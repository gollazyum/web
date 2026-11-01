// SerpApi 키가 없는 로컬 개발에서만 쓰는 예시 응답. 운영에서는 쓰지 않는다.
// "아이폰 17"에서 스토어 목록에 11번가만 오던 상황을 흉내 낸다: 네이버·G마켓은 검색 결과에서 엄격하게 보태고,
// 중고·Pro·다른 용량은 합치지 않으며, 쿠팡은 데이터가 없어 맨 아래 덧붙임 행이 생긴다
const g = (target: string) => `https://www.google.com/url?url=${encodeURIComponent(target)}&sa=U&api_key=SHOULD_NOT_LEAK`;

export const SAMPLE_SEARCH_JSON = {
  shopping_results: [
    { title: "Apple 아이폰 17 256GB 자급제 블랙", source: "11번가", link: g("https://www.11st.co.kr/products/1001"), product_link: "https://www.google.com/shopping/product/1", extracted_price: 1290000, extracted_old_price: 1400000, thumbnail: "", extensions: ["256GB", "블랙"], immersive_product_page_token: "sample-iphone17-256-black" },
    { title: "애플 아이폰17 256GB 블랙 자급제 정품", source: "애플 공식 판매처", link: g("https://smartstore.naver.com/store/products/2002"), product_link: "https://www.google.com/shopping/product/2", extracted_price: 1310000, thumbnail: "", immersive_product_page_token: "sample-2" },
    { title: "Apple iPhone 17 256GB Black 자급제", source: "Gmarket", link: "https://www.googleadservices.com/pagead/aclk?sa=L&adurl=https%3A%2F%2Fitem.gmarket.co.kr%2FItem%3Fgoodscode%3D3003", product_link: "https://www.google.com/shopping/product/3", extracted_price: 1335000, thumbnail: "", immersive_product_page_token: "sample-3" },
    { title: "아이폰 17 256GB 블랙 중고 S급", source: "G마켓", link: "https://item.gmarket.co.kr/Item?goodscode=4004", extracted_price: 990000, thumbnail: "", immersive_product_page_token: "sample-4" },
    { title: "Apple 아이폰 17 Pro 256GB 자급제 블랙", source: "11번가", link: "https://www.11st.co.kr/products/5005", extracted_price: 1790000, thumbnail: "", immersive_product_page_token: "sample-5" },
    { title: "Apple 아이폰 17 512GB 자급제 블랙", source: "네이버", link: "https://smartstore.naver.com/store/products/6006", extracted_price: 1590000, thumbnail: "", immersive_product_page_token: "sample-6" },
    { title: "아이폰 17 256GB 블랙 실리콘 케이스", source: "쿠팡", link: "https://www.coupang.com/vp/products/7007", extracted_price: 19900, thumbnail: "", immersive_product_page_token: "sample-7" },
    { title: "Apple 아이폰 17 256GB 자급제 블랙", source: "SSG.COM", link: "https://www.ssg.com/item/8008", extracted_price: 1280000, thumbnail: "", immersive_product_page_token: "sample-8" },
    // 실제 "아이폰 17" 결과처럼 4곳 밖(KREAM 등)에서만 오는 상품, 1원 가격
    { title: "Apple iPhone 17 자급제 256GB 화이트", source: "KREAM", link: "", product_link: "https://www.google.com/search?ibp=oshop&q=x", extracted_price: 1310000, thumbnail: "", immersive_product_page_token: "sample-white-kream" },
    { title: "Apple iPhone 17 자급제 256GB 블랙", source: "KT모바일샵", link: "", product_link: "https://www.google.com/search?ibp=oshop&q=y", extracted_price: 1, thumbnail: "", immersive_product_page_token: "sample-black-1won" },
  ],
};

export const SAMPLE_DETAIL_JSON: Record<string, Record<string, unknown>> = {
  "sample-iphone17-256-black": {
    product_results: {
      title: "Apple 아이폰 17 256GB 자급제 블랙",
      thumbnails: [],
      stores: [
        { name: "11번가", link: g("https://www.11st.co.kr/products/1001"), extracted_price: 1290000, extracted_original_price: 1400000 },
        { name: "하이마트", link: g("https://www.e-himart.co.kr/x"), extracted_price: 1300000 },
      ],
    },
  },
};

// 숙소 검색창 추천 한 줄. 서버(app/api/places)와 화면(PlaceInput)이 같이 쓴다.
export type PlaceHit = { name: string; sub: string; kind: "hotel" | "city" };

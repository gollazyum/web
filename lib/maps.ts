// 숙소 '지도 보기' 링크. 데이터 출처 회사의 지도 대신 OpenStreetMap 으로 연다 (해외 좌표도 보인다)
export const mapUrl = (lat: number, lng: number) => `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`;

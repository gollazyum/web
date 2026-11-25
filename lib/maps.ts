// 숙소 '지도 보기' 링크. 데이터 출처 회사의 지도 대신 OpenStreetMap 으로 연다 (해외 좌표도 보인다)
export const mapUrl = (lat: number, lng: number) => `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`;

// 숙소 상세의 작은 위치 지도 (Mapbox Static Images API).
// 토큰은 Vercel 환경변수 NEXT_PUBLIC_MAPBOX_TOKEN (pk. 로 시작하는 공개 토큰, Mapbox에서 gollazyum.com 주소로만 쓰게 제한).
// 토큰이 없거나 좌표가 이상하면 null → 화면은 예전처럼 글자 링크만 보인다.
// 이미지 오른쪽 아래의 Mapbox 로고와 © Mapbox © OpenStreetMap 표기는 약관상 필요하므로 끄지 않는다
export function staticMapUrl(lat: number, lng: number, token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN, w = 600, h = 200): string | null {
  const t = token?.trim();
  if (!t || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 85 || Math.abs(lng) > 180 || (lat === 0 && lng === 0)) return null;
  const x = lng.toFixed(5);
  const y = lat.toFixed(5);
  return `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/pin-l+FF5A1F(${x},${y})/${x},${y},15,0/${w}x${h}@2x?access_token=${encodeURIComponent(t)}`;
}

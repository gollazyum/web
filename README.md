# Lowboti 웹사이트 (lowboti.com)

로보티: 호텔·항공권 가격을 예약 사이트별로 실시간 비교하고, AI 도우미 로보티가 가성비 좋은 선택을 같이 골라 주는 서비스입니다.

## 실행

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # 배포용 빌드
```

## 구조

- `app/page.tsx`: 랜딩 페이지 (검색 히어로, 비교 사이트, 이용 방법, 강점, 예약 팁, FAQ, 제휴 고지)
- `app/privacy/page.tsx`: 개인정보처리방침
- `components/LinkChecker.tsx`: 호텔 링크·날짜·인원 입력창 (지금은 어느 사이트 링크인지 알아보는 단계, 가격 비교는 다음 단계)
- `components/FlightSearch.tsx`, `app/api/flights/route.ts`: 항공권 탭. 서버가 SerpApi(Google Flights)로 실시간 가격을 받아 사이트 안에 보여 주고, 예약은 Trip.com 한국 사이트 검색 결과로 넘깁니다 (제휴 승인 전이라 제휴 번호 없음)
- `components/HotelSearch.tsx`, `app/api/hotels/route.ts`: 숙소 탭의 도시·호텔 검색. SerpApi(Google Hotels)로 호텔마다 예약 사이트별 가격을 보여 주고, 아고다 가격은 제휴 링크로 넘깁니다
- `lib/serpapi.ts`: SerpApi 공통 호출 (30분 저장, 검색 횟수 제한)
- `lib/site.ts`: 사이트 설정 (인스타그램 주소, 문의 메일, 지원 사이트 목록)
- `public/images/`: 공유용 로고 이미지

## 환경변수 (Vercel → Settings → Environment Variables)

- `ANTHROPIC_API_KEY`: AI 채팅
- `GOOGLE_MAPS_API_KEY`: 숙소 검색창 호텔·도시 자동완성(Google Places API New). 없으면 도시 이름만 추천합니다
- `SERPAPI_API_KEY`: 항공권·호텔 실시간 가격. 없으면 항공권 탭은 트립닷컴 바로가기 버튼만, 호텔 검색은 안내 문구만 보여 줍니다

## 배포

Vercel에 이 저장소를 연결하면 main 브랜치가 자동 배포됩니다.
`lowboti.kr` 접속은 `next.config.ts`에서 `www.lowboti.com`으로 영구 리다이렉트됩니다.

# Lowboti 웹사이트 (lowboti.com)

로보티: 호텔 링크를 붙여넣으면 여러 예약 사이트의 가격을 비교해 최저가를 찾아주는 서비스의 브랜드 사이트입니다.

## 실행

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # 배포용 빌드
```

## 구조

- `app/page.tsx`: 랜딩 페이지 (히어로, 사용법, 이름의 뜻, 예약 팁, FAQ, 제휴 고지)
- `app/privacy/page.tsx`: 개인정보처리방침
- `components/LinkChecker.tsx`: 호텔 링크 입력창 (지금은 어느 사이트 링크인지 알아보는 단계, 가격 비교는 다음 단계)
- `lib/site.ts`: 사이트 설정 (인스타그램 주소, 문의 메일, 지원 사이트 목록)
- `public/images/`: 로보티 캐릭터와 이모티콘

## 배포

Vercel에 이 저장소를 연결하면 main 브랜치가 자동 배포됩니다.
`lowboti.kr`, `www.lowboti.com` 접속은 `next.config.ts`에서 `lowboti.com`으로 영구 리다이렉트됩니다.
